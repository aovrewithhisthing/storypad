/**
 * Vercel Serverless Function & Node Handler: StoryPad Admin Console API
 *
 * Security model:
 * - Zero hardcoded credentials and zero service_role exposure to browser.
 * - Requires verified Supabase JWT (`Authorization: Bearer <token>`) checked via `/auth/v1/user`.
 * - Enforces same-origin on state-changing POST requests.
 * - Enforces sliding-window rate limiting on mutations.
 * - Validates all inputs before invoking Postgres RPCs (`admin_*`), where RBAC + RLS + scope checks run.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROJECT_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

const ALLOWED_SYSTEM_ROLES = new Set(['system_owner', 'system_admin', 'production_admin', 'crew_member', 'viewer']);
const ALLOWED_ACCOUNT_STATUSES = new Set(['active', 'suspended', 'deactivated']);
const ALLOWED_MEMBER_ROLES = new Set(['owner', 'production_admin', 'editor', 'viewer']);
const ALLOWED_INVITE_MEMBER_ROLES = new Set(['production_admin', 'editor', 'viewer']);
const ALLOWED_INVITE_SYSTEM_ROLES = new Set(['system_admin', 'production_admin', 'crew_member', 'viewer']);
const ALLOWED_INVITE_ACTIONS = new Set(['revoke', 'resend']);

const rateLimitStore = new Map();
const MAX_MUTATIONS_PER_MIN = 30;
const RATE_WINDOW_MS = 60 * 1000;

function resetRateLimits() {
  rateLimitStore.clear();
}

function getClientIp(req) {
  const fwd = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || 'local';
}

function checkRateLimit(bucketKey, maxAttempts = MAX_MUTATIONS_PER_MIN, windowMs = RATE_WINDOW_MS) {
  const now = Date.now();
  const prev = rateLimitStore.get(bucketKey) || [];
  const active = prev.filter((ts) => now - ts < windowMs);
  if (active.length >= maxAttempts) {
    const oldest = active[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    rateLimitStore.set(bucketKey, active);
    return { allowed: false, retryAfter: retryAfterSec };
  }
  active.push(now);
  rateLimitStore.set(bucketKey, active);
  return { allowed: true, retryAfter: 0 };
}

function verifySameOrigin(req) {
  const headers = req.headers || {};
  const hostHeader = String(headers['x-forwarded-host'] || headers.host || '').trim().toLowerCase();
  if (!hostHeader) return true;

  const origin = String(headers.origin || '').trim();
  const referer = String(headers.referer || '').trim();
  const source = origin || referer;
  if (!source) return true;

  try {
    const parsed = new URL(source);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const expectedHost = hostHeader.split(':')[0];
    const expectedPort = hostHeader.includes(':')
      ? hostHeader.split(':')[1]
      : (parsed.protocol === 'https:' ? '443' : '80');
    const actualPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    return parsed.hostname.toLowerCase() === expectedHost && actualPort === expectedPort;
  } catch (_err) {
    return false;
  }
}

function extractBearerToken(req) {
  const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (typeof authHeader !== 'string') return '';
  const match = authHeader.match(/^\s*Bearer\s+(.+)\s*$/i);
  return match ? match[1].trim() : '';
}

function cleanStr(val, maxLen = 200) {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function clampInt(val, min, max, fallback) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    ...extraHeaders
  };
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    res.status(statusCode).json(payload);
    return;
  }
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(payload));
}

function parseQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try {
    const parsed = new URL(req.url || '/', 'http://localhost');
    return Object.fromEntries(parsed.searchParams.entries());
  } catch (_err) {
    return {};
  }
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body || '{}');
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_err) {
      return null;
    }
  }
  return {};
}

function mapSupabaseRpcError(status, data) {
  const code = String((data && data.code) || '');
  const message = String((data && (data.message || data.error_description || data.error)) || '');

  if (
    code === '42883' ||
    code === '42P01' ||
    code === 'PGRST202' ||
    /Could not find the function/i.test(message) ||
    /does not exist/i.test(message)
  ) {
    return {
      status: 503,
      code: 'MIGRATION_REQUIRED',
      error: 'Skema Admin Console (migrasi P3) belum dijalankan di Supabase.'
    };
  }

  if (code === '42501' || status === 401 || status === 403 || /Forbidden|Unauthorized|row-level security/i.test(message)) {
    return {
      status: 403,
      code: 'FORBIDDEN',
      error: message && !/postgres|relation|schema|pg_/i.test(message)
        ? message
        : 'Akses ditolak: izin atau cakupan peran Anda tidak mencukupi.'
    };
  }

  if (code === '22023' || code === '23514' || code === '23505' || status === 400 || status === 422) {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      error: message && !/postgres|relation|schema|pg_/i.test(message)
        ? message
        : 'Permintaan tidak memenuhi validasi data.'
    };
  }

  return {
    status: 502,
    code: 'UPSTREAM_ERROR',
    error: 'Gagal memproses permintaan ke server database.'
  };
}

async function callSupabaseAuthUser(supabaseUrl, anonKey, jwt, fetchImpl) {
  const resp = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/json'
    }
  });
  let data = null;
  try {
    data = await resp.json();
  } catch (_err) {}
  if (!resp.ok || !data || !data.id) {
    return null;
  }
  return data;
}

async function callSupabaseRpc(supabaseUrl, anonKey, jwt, fnName, params, fetchImpl) {
  const resp = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(fnName)}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(params || {})
  });
  let data = null;
  try {
    data = await resp.json();
  } catch (_err) {}
  if (!resp.ok) {
    return { ok: false, mapped: mapSupabaseRpcError(resp.status, data) };
  }
  return { ok: true, data };
}

async function handleAdminRequest(req, res, deps = {}) {
  const env = deps.env || process.env;
  const fetchImpl = deps.fetch || global.fetch;

  const method = String(req.method || 'GET').toUpperCase();
  const query = parseQuery(req);
  const action = cleanStr(String(query.action || 'my_access'), 64);

  const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = String(env.SUPABASE_ANON_KEY || '');

  if (!supabaseUrl || !anonKey) {
    return sendJson(res, 503, {
      ok: false,
      code: 'SUPABASE_UNCONFIGURED',
      error: 'Konfigurasi SUPABASE_URL atau SUPABASE_ANON_KEY belum disetel di server.'
    });
  }

  if (method === 'POST' && !verifySameOrigin(req)) {
    return sendJson(res, 403, {
      ok: false,
      code: 'CROSS_ORIGIN_REJECTED',
      error: 'Permintaan lintas origin ditolak.'
    });
  }

  const jwt = extractBearerToken(req);
  if (!jwt) {
    return sendJson(res, 401, {
      ok: false,
      code: 'UNAUTHORIZED',
      error: 'Sesi autentikasi diperlukan untuk mengakses Admin Console.'
    });
  }

  const user = await callSupabaseAuthUser(supabaseUrl, anonKey, jwt, fetchImpl);
  if (!user || !UUID_RE.test(String(user.id || ''))) {
    return sendJson(res, 401, {
      ok: false,
      code: 'INVALID_TOKEN',
      error: 'Token autentikasi tidak valid atau telah berakhir.'
    });
  }

  if (method === 'POST') {
    const rlKey = `${getClientIp(req)}:${user.id}`;
    const rl = checkRateLimit(rlKey);
    if (!rl.allowed) {
      return sendJson(
        res,
        429,
        {
          ok: false,
          code: 'RATE_LIMITED',
          error: `Terlalu banyak perubahan dalam waktu singkat. Coba lagi dalam ${rl.retryAfter} detik.`
        },
        { 'Retry-After': String(rl.retryAfter) }
      );
    }
  }

  // GET actions (read-only)
  if (method === 'GET') {
    if (action === 'my_access') {
      const rpc = await callSupabaseRpc(supabaseUrl, anonKey, jwt, 'admin_get_my_access', {}, fetchImpl);
      if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
      return sendJson(res, 200, { ok: true, access: rpc.data });
    }

    if (action === 'overview') {
      const rpc = await callSupabaseRpc(supabaseUrl, anonKey, jwt, 'admin_get_overview', {}, fetchImpl);
      if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
      return sendJson(res, 200, { ok: true, overview: rpc.data });
    }

    if (action === 'accounts') {
      const statusFilter = cleanStr(String(query.status || 'all'), 24).toLowerCase();
      const roleFilter = cleanStr(String(query.system_role || 'all'), 32).toLowerCase();
      if (!['all', 'active', 'suspended', 'deactivated', 'unverified'].includes(statusFilter)) {
        return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'Filter status akun tidak valid.' });
      }
      if (roleFilter !== 'all' && !ALLOWED_SYSTEM_ROLES.has(roleFilter)) {
        return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'Filter system role tidak valid.' });
      }
      const rpc = await callSupabaseRpc(
        supabaseUrl,
        anonKey,
        jwt,
        'admin_list_accounts',
        {
          p_search: cleanStr(String(query.search || ''), 120),
          p_status: statusFilter,
          p_system_role: roleFilter,
          p_limit: clampInt(query.limit, 1, 100, 25),
          p_offset: clampInt(query.offset, 0, 100000, 0)
        },
        fetchImpl
      );
      if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
      return sendJson(res, 200, { ok: true, ...rpc.data });
    }

    if (action === 'account_detail') {
      const targetId = cleanStr(String(query.user_id || ''), 64);
      if (!UUID_RE.test(targetId)) {
        return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'user_id target tidak valid.' });
      }
      const rpc = await callSupabaseRpc(
        supabaseUrl,
        anonKey,
        jwt,
        'admin_get_account_detail',
        { p_target_user_id: targetId },
        fetchImpl
      );
      if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
      return sendJson(res, 200, { ok: true, detail: rpc.data });
    }

    if (action === 'roles') {
      const rpc = await callSupabaseRpc(supabaseUrl, anonKey, jwt, 'admin_list_roles_permissions', {}, fetchImpl);
      if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
      return sendJson(res, 200, { ok: true, ...rpc.data });
    }

    if (action === 'memberships') {
      const projectId = cleanStr(String(query.project_id || ''), 128);
      if (projectId && !PROJECT_ID_RE.test(projectId)) {
        return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'project_id tidak valid.' });
      }
      const rpc = await callSupabaseRpc(
        supabaseUrl,
        anonKey,
        jwt,
        'admin_list_project_memberships',
        {
          p_project_id: projectId || null,
          p_search: cleanStr(String(query.search || ''), 120)
        },
        fetchImpl
      );
      if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
      return sendJson(res, 200, { ok: true, ...rpc.data });
    }

    if (action === 'sessions') {
      const targetId = cleanStr(String(query.user_id || ''), 64);
      if (targetId && !UUID_RE.test(targetId)) {
        return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'user_id filter tidak valid.' });
      }
      const rpc = await callSupabaseRpc(
        supabaseUrl,
        anonKey,
        jwt,
        'admin_list_sessions',
        {
          p_target_user_id: targetId || null,
          p_limit: clampInt(query.limit, 1, 100, 50),
          p_offset: clampInt(query.offset, 0, 100000, 0)
        },
        fetchImpl
      );
      if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
      return sendJson(res, 200, { ok: true, ...rpc.data });
    }

    if (action === 'invitations') {
      const statusFilter = cleanStr(String(query.status || 'all'), 24).toLowerCase();
      const projectId = cleanStr(String(query.project_id || ''), 128);
      if (!['all', 'pending', 'accepted', 'expired', 'revoked'].includes(statusFilter)) {
        return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'Filter status undangan tidak valid.' });
      }
      if (projectId && !PROJECT_ID_RE.test(projectId)) {
        return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'project_id tidak valid.' });
      }
      const rpc = await callSupabaseRpc(
        supabaseUrl,
        anonKey,
        jwt,
        'admin_list_invitations',
        {
          p_status: statusFilter,
          p_project_id: projectId || null,
          p_limit: clampInt(query.limit, 1, 100, 50),
          p_offset: clampInt(query.offset, 0, 100000, 0)
        },
        fetchImpl
      );
      if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
      return sendJson(res, 200, { ok: true, ...rpc.data });
    }

    if (action === 'audit_logs') {
      const statusFilter = cleanStr(String(query.status || 'all'), 24).toLowerCase();
      if (!['all', 'success', 'failure', 'blocked'].includes(statusFilter)) {
        return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'Filter status audit tidak valid.' });
      }
      const rpc = await callSupabaseRpc(
        supabaseUrl,
        anonKey,
        jwt,
        'admin_list_audit_logs',
        {
          p_event_type: cleanStr(String(query.event_type || 'all'), 80) || 'all',
          p_status: statusFilter,
          p_target_type: cleanStr(String(query.target_type || 'all'), 40) || 'all',
          p_search: cleanStr(String(query.search || ''), 120),
          p_from: cleanStr(String(query.from || ''), 40) || null,
          p_to: cleanStr(String(query.to || ''), 40) || null,
          p_limit: clampInt(query.limit, 1, 100, 30),
          p_offset: clampInt(query.offset, 0, 100000, 0)
        },
        fetchImpl
      );
      if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
      return sendJson(res, 200, { ok: true, ...rpc.data });
    }

    if (action === 'security_settings') {
      const rpc = await callSupabaseRpc(supabaseUrl, anonKey, jwt, 'admin_get_security_settings', {}, fetchImpl);
      if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
      return sendJson(res, 200, { ok: true, settings: rpc.data });
    }

    if (action === 'security_posture') {
      const accessRpc = await callSupabaseRpc(supabaseUrl, anonKey, jwt, 'admin_get_my_access', {}, fetchImpl);
      if (!accessRpc.ok) return sendJson(res, accessRpc.mapped.status, { ok: false, ...accessRpc.mapped });
      const perms = Array.isArray(accessRpc.data && accessRpc.data.permissions) ? accessRpc.data.permissions : [];
      if (!perms.includes('security.read')) {
        return sendJson(res, 403, { ok: false, code: 'FORBIDDEN', error: 'Izin security.read diperlukan.' });
      }
      return sendJson(res, 200, {
        ok: true,
        posture: {
          runtime: process.env.VERCEL ? 'Vercel Serverless' : 'Node Local Server',
          vercel_env: String(env.VERCEL_ENV || 'local'),
          node_version: process.version,
          supabase_configured: Boolean(supabaseUrl && anonKey),
          service_role_configured_on_server: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
          service_role_exposed_to_client: false,
          security_headers: [
            'Content-Security-Policy (frame-ancestors none, object-src none)',
            'Strict-Transport-Security (Vercel HTTPS)',
            'X-Frame-Options: DENY',
            'X-Content-Type-Options: nosniff',
            'Referrer-Policy: strict-origin-when-cross-origin',
            'Permissions-Policy: camera=(), microphone=(), geolocation=()',
            'Cross-Origin-Opener-Policy: same-origin'
          ],
          provider_manual_items: [
            'Leaked Password Protection (Supabase Dashboard -> Auth -> Security)',
            'Manual Identity Linking (Supabase Dashboard -> Auth -> Settings)',
            'Email Confirmation & Auth Rate Limits (Supabase Dashboard -> Auth)',
            'MFA / TOTP Enrollment (belum tersedia di UI fase ini)'
          ]
        }
      });
    }

    return sendJson(res, 400, { ok: false, code: 'UNKNOWN_ACTION', error: 'Action GET tidak dikenal.' });
  }

  // POST actions (state mutations)
  if (method !== 'POST') {
    return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', error: 'Method tidak diizinkan.' });
  }

  const body = parseBody(req);
  if (!body) {
    return sendJson(res, 400, { ok: false, code: 'INVALID_JSON', error: 'Payload JSON tidak valid.' });
  }

  if (action === 'update_account_profile') {
    const targetId = cleanStr(body.user_id, 64);
    const fullName = cleanStr(body.full_name, 120);
    if (!UUID_RE.test(targetId) || !fullName) {
      return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'user_id dan nama lengkap wajib diisi.' });
    }
    const grantedRoles = body.granted_roles && typeof body.granted_roles === 'object' ? {
      scriptSupervisor: Boolean(body.granted_roles.scriptSupervisor),
      videoEditor: Boolean(body.granted_roles.videoEditor),
      soundRecordist: Boolean(body.granted_roles.soundRecordist),
      directorProducer: Boolean(body.granted_roles.directorProducer),
      autoExportMeta: body.granted_roles.autoExportMeta !== false
    } : null;

    const rpc = await callSupabaseRpc(
      supabaseUrl,
      anonKey,
      jwt,
      'admin_update_account_profile',
      {
        p_target_user_id: targetId,
        p_full_name: fullName,
        p_role_title: cleanStr(body.role_title, 120) || 'Crew Member',
        p_id_badge: cleanStr(body.id_badge, 32) || 'SP-01',
        p_studio: cleanStr(body.studio, 120) || 'StoryPad Studio',
        p_granted_roles: grantedRoles,
        p_reason: cleanStr(body.reason, 300)
      },
      fetchImpl
    );
    if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
    return sendJson(res, 200, { ok: true, result: rpc.data });
  }

  if (action === 'update_account_status') {
    const targetId = cleanStr(body.user_id, 64);
    const status = cleanStr(body.status, 24).toLowerCase();
    if (!UUID_RE.test(targetId) || !ALLOWED_ACCOUNT_STATUSES.has(status)) {
      return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'user_id atau status akun tidak valid.' });
    }
    const rpc = await callSupabaseRpc(
      supabaseUrl,
      anonKey,
      jwt,
      'admin_update_account_status',
      {
        p_target_user_id: targetId,
        p_status: status,
        p_reason: cleanStr(body.reason, 300)
      },
      fetchImpl
    );
    if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
    return sendJson(res, 200, { ok: true, result: rpc.data });
  }

  if (action === 'assign_system_role') {
    const targetId = cleanStr(body.user_id, 64);
    const newRole = cleanStr(body.system_role, 32).toLowerCase();
    if (!UUID_RE.test(targetId) || !ALLOWED_SYSTEM_ROLES.has(newRole)) {
      return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'user_id atau system_role tidak valid.' });
    }
    const rpc = await callSupabaseRpc(
      supabaseUrl,
      anonKey,
      jwt,
      'admin_assign_system_role',
      {
        p_target_user_id: targetId,
        p_new_role: newRole,
        p_reason: cleanStr(body.reason, 300)
      },
      fetchImpl
    );
    if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
    return sendJson(res, 200, { ok: true, result: rpc.data });
  }

  if (action === 'upsert_membership') {
    const projectId = cleanStr(body.project_id, 128);
    const targetId = cleanStr(body.user_id, 64);
    const memberRole = cleanStr(body.member_role, 32).toLowerCase();
    const productionRole = cleanStr(body.production_role, 80) || 'Crew Member';
    if (!PROJECT_ID_RE.test(projectId) || !UUID_RE.test(targetId) || !ALLOWED_MEMBER_ROLES.has(memberRole)) {
      return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'Data keanggotaan proyek tidak valid.' });
    }
    const rpc = await callSupabaseRpc(
      supabaseUrl,
      anonKey,
      jwt,
      'admin_upsert_project_membership',
      {
        p_project_id: projectId,
        p_target_user_id: targetId,
        p_member_role: memberRole,
        p_production_role: productionRole,
        p_reason: cleanStr(body.reason, 300)
      },
      fetchImpl
    );
    if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
    return sendJson(res, 200, { ok: true, result: rpc.data });
  }

  if (action === 'remove_membership') {
    const projectId = cleanStr(body.project_id, 128);
    const targetId = cleanStr(body.user_id, 64);
    if (!PROJECT_ID_RE.test(projectId) || !UUID_RE.test(targetId)) {
      return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'project_id atau user_id tidak valid.' });
    }
    const rpc = await callSupabaseRpc(
      supabaseUrl,
      anonKey,
      jwt,
      'admin_remove_project_membership',
      {
        p_project_id: projectId,
        p_target_user_id: targetId,
        p_reason: cleanStr(body.reason, 300)
      },
      fetchImpl
    );
    if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
    return sendJson(res, 200, { ok: true, result: rpc.data });
  }

  if (action === 'revoke_session') {
    const sessionId = cleanStr(body.session_id, 64);
    if (!UUID_RE.test(sessionId)) {
      return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'session_id tidak valid.' });
    }
    const rpc = await callSupabaseRpc(
      supabaseUrl,
      anonKey,
      jwt,
      'admin_revoke_session',
      {
        p_session_id: sessionId,
        p_reason: cleanStr(body.reason, 300)
      },
      fetchImpl
    );
    if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
    return sendJson(res, 200, { ok: true, result: rpc.data });
  }

  if (action === 'revoke_user_sessions') {
    const targetId = cleanStr(body.user_id, 64);
    if (!UUID_RE.test(targetId)) {
      return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'user_id target tidak valid.' });
    }
    const rpc = await callSupabaseRpc(
      supabaseUrl,
      anonKey,
      jwt,
      'admin_revoke_user_sessions',
      {
        p_target_user_id: targetId,
        p_reason: cleanStr(body.reason, 300)
      },
      fetchImpl
    );
    if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
    return sendJson(res, 200, { ok: true, result: rpc.data });
  }

  if (action === 'create_invitation') {
    const email = cleanStr(body.email, 200).toLowerCase();
    const projectId = cleanStr(body.project_id, 128);
    const memberRole = cleanStr(body.member_role || 'editor', 32).toLowerCase();
    const productionRole = cleanStr(body.production_role, 80) || 'Crew Member';
    const targetSystemRole = cleanStr(body.target_system_role || 'crew_member', 32).toLowerCase();

    if (!EMAIL_RE.test(email)) {
      return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'Format email undangan tidak valid.' });
    }
    if (projectId && !PROJECT_ID_RE.test(projectId)) {
      return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'project_id tidak valid.' });
    }
    if (!ALLOWED_INVITE_MEMBER_ROLES.has(memberRole) || !ALLOWED_INVITE_SYSTEM_ROLES.has(targetSystemRole)) {
      return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'Role undangan tidak valid.' });
    }

    const expiryHours = body.expiry_hours !== undefined && body.expiry_hours !== null && body.expiry_hours !== ''
      ? clampInt(body.expiry_hours, 1, 720, 72)
      : null;

    const rpc = await callSupabaseRpc(
      supabaseUrl,
      anonKey,
      jwt,
      'admin_create_invitation',
      {
        p_email: email,
        p_project_id: projectId || null,
        p_member_role: memberRole,
        p_production_role: productionRole,
        p_target_system_role: targetSystemRole,
        p_expiry_hours: expiryHours,
        p_note: cleanStr(body.note, 240)
      },
      fetchImpl
    );
    if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
    return sendJson(res, 200, { ok: true, invitation: rpc.data });
  }

  if (action === 'manage_invitation') {
    const invId = cleanStr(body.invitation_id, 64);
    const invAction = cleanStr(body.action, 24).toLowerCase();
    if (!UUID_RE.test(invId) || !ALLOWED_INVITE_ACTIONS.has(invAction)) {
      return sendJson(res, 400, { ok: false, code: 'VALIDATION_ERROR', error: 'invitation_id atau aksi undangan tidak valid.' });
    }
    const rpc = await callSupabaseRpc(
      supabaseUrl,
      anonKey,
      jwt,
      'admin_manage_invitation',
      {
        p_invitation_id: invId,
        p_action: invAction,
        p_reason: cleanStr(body.reason, 300)
      },
      fetchImpl
    );
    if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
    return sendJson(res, 200, { ok: true, invitation: rpc.data });
  }

  if (action === 'update_security_settings') {
    const expiryHours = clampInt(body.invitation_expiry_hours, 1, 720, 72);
    const minPw = clampInt(body.min_password_length, 12, 64, 12);
    const idleMins = clampInt(body.session_idle_minutes, 5, 480, 30);
    const rpc = await callSupabaseRpc(
      supabaseUrl,
      anonKey,
      jwt,
      'admin_update_security_settings',
      {
        p_invitation_expiry_hours: expiryHours,
        p_min_password_length: minPw,
        p_require_reauth_role_change: Boolean(body.require_reauth_role_change),
        p_allow_crew_self_signup: Boolean(body.allow_crew_self_signup),
        p_session_idle_minutes: idleMins,
        p_reason: cleanStr(body.reason, 300)
      },
      fetchImpl
    );
    if (!rpc.ok) return sendJson(res, rpc.mapped.status, { ok: false, ...rpc.mapped });
    return sendJson(res, 200, { ok: true, settings: rpc.data });
  }

  return sendJson(res, 400, { ok: false, code: 'UNKNOWN_ACTION', error: 'Action POST tidak dikenal.' });
}

module.exports = (req, res) => handleAdminRequest(req, res);
module.exports.handleAdminRequest = handleAdminRequest;
module.exports.verifySameOrigin = verifySameOrigin;
module.exports.checkRateLimit = checkRateLimit;
module.exports.resetRateLimits = resetRateLimits;
module.exports.mapSupabaseRpcError = mapSupabaseRpcError;
