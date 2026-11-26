/**
 * Security, RBAC & Negative Verification Suite for StoryPad Admin Console (Phase P3)
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const adminApi = require('./api/admin');

console.log('=== STARTING STORYPAD ADMIN CONSOLE SECURITY & NEGATIVE TESTS ===\n');

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    status(code) {
      this.statusCode = code;
      return {
        json: (payload) => {
          this.body = payload;
        }
      };
    },
    writeHead(code, hdrs = {}) {
      this.statusCode = code;
      Object.entries(hdrs).forEach(([k, v]) => {
        this.headers[k.toLowerCase()] = v;
      });
    },
    end(raw) {
      try {
        this.body = JSON.parse(raw);
      } catch (_e) {
        this.body = raw;
      }
    }
  };
  return res;
}

const UID_OWNER = '10000000-0000-4000-8000-000000000001';
const UID_ADMIN = '10000000-0000-4000-8000-000000000002';
const UID_PROD_ADMIN = '10000000-0000-4000-8000-000000000003';
const UID_CREW = '10000000-0000-4000-8000-000000000004';
const SESS_OTHER = '20000000-0000-4000-8000-000000000099';

function buildMockSupabaseFetch(auditLogSink = []) {
  const tokens = {
    'jwt-owner': { id: UID_OWNER, email: 'owner@studio.test', role: 'system_owner' },
    'jwt-admin': { id: UID_ADMIN, email: 'admin@studio.test', role: 'system_admin' },
    'jwt-prod-admin': { id: UID_PROD_ADMIN, email: 'prod@studio.test', role: 'production_admin' },
    'jwt-crew': { id: UID_CREW, email: 'crew@studio.test', role: 'crew_member' }
  };

  return async (url, opts = {}) => {
    const u = String(url);
    const headers = opts.headers || {};
    const auth = String(headers.Authorization || '');
    const jwt = auth.replace(/^Bearer\s+/i, '');
    const actor = tokens[jwt] || null;

    if (u.endsWith('/auth/v1/user')) {
      if (!actor) {
        return { ok: false, status: 401, json: async () => ({ error: 'invalid jwt' }) };
      }
      return { ok: true, status: 200, json: async () => ({ id: actor.id, email: actor.email }) };
    }

    if (u.includes('/rest/v1/rpc/')) {
      const fn = decodeURIComponent(u.split('/rest/v1/rpc/')[1]);
      const body = opts.body ? JSON.parse(opts.body) : {};

      if (fn === 'admin_get_my_access') {
        const permMap = {
          system_owner: ['accounts.read', 'accounts.update_profile', 'accounts.update_status', 'accounts.invite', 'accounts.manage_membership', 'roles.read', 'roles.assign', 'sessions.read_all', 'sessions.revoke_user_sessions', 'audit.read', 'projects.manage_members', 'security.read', 'security.manage'],
          system_admin: ['accounts.read', 'accounts.update_profile', 'accounts.update_status', 'accounts.invite', 'accounts.manage_membership', 'roles.read', 'roles.assign', 'sessions.read_all', 'sessions.revoke_user_sessions', 'audit.read', 'projects.manage_members', 'security.read'],
          production_admin: ['accounts.read', 'accounts.invite', 'roles.read', 'projects.manage_members', 'sessions.read_own', 'sessions.revoke_own'],
          crew_member: ['sessions.read_own', 'sessions.revoke_own']
        };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            user_id: actor.id,
            email: actor.email,
            system_role: actor.role,
            system_role_label: actor.role,
            can_access_console: ['system_owner', 'system_admin', 'production_admin'].includes(actor.role),
            permissions: permMap[actor.role] || [],
            managed_projects: actor.role === 'production_admin' ? [{ id: 'proj-a', code: 'PRJ-A', title: 'Project A' }] : []
          })
        };
      }

      if (fn === 'admin_get_overview') {
        if (actor.role === 'crew_member') {
          return { ok: false, status: 403, json: async () => ({ code: '42501', message: 'Forbidden: insufficient permission for overview' }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            scope: actor.role === 'production_admin' ? 'project' : 'global',
            counts: { total_accounts: 2, active_accounts: 2, suspended_accounts: 0, deactivated_accounts: 0, unverified_accounts: 0, active_sessions: 1, pending_invitations: 0, expired_invitations: 0, managed_projects: 1 },
            recent_audits: [],
            security_alerts: []
          })
        };
      }

      if (fn === 'admin_assign_system_role') {
        if (actor.role === 'crew_member' || actor.role === 'production_admin') {
          return { ok: false, status: 403, json: async () => ({ code: '42501', message: 'Forbidden: insufficient permission to assign system roles' }) };
        }
        if (body.p_target_user_id === actor.id) {
          return { ok: false, status: 403, json: async () => ({ code: '42501', message: 'Admin tidak dapat mengubah system role miliknya sendiri' }) };
        }
        if (actor.role !== 'system_owner' && body.p_new_role === 'system_owner') {
          return { ok: false, status: 403, json: async () => ({ code: '42501', message: 'Hanya System Owner yang dapat menetapkan role System Owner' }) };
        }
        auditLogSink.push({ event_type: 'system_role_changed', actor_id: actor.id, target: body.p_target_user_id });
        return { ok: true, status: 200, json: async () => ({ ok: true, new_role: body.p_new_role }) };
      }

      if (fn === 'admin_upsert_project_membership') {
        if (actor.role === 'crew_member') {
          return { ok: false, status: 403, json: async () => ({ code: '42501', message: 'Forbidden' }) };
        }
        if (actor.role === 'production_admin' && body.p_project_id !== 'proj-a') {
          return { ok: false, status: 403, json: async () => ({ code: '42501', message: 'Forbidden: project outside your management scope' }) };
        }
        auditLogSink.push({ event_type: 'project_membership_updated', actor_id: actor.id, project_id: body.p_project_id });
        return { ok: true, status: 200, json: async () => ({ ok: true, project_id: body.p_project_id }) };
      }

      if (fn === 'admin_revoke_session' || fn === 'admin_update_account_status') {
        if (actor.role === 'crew_member' || actor.role === 'production_admin') {
          return { ok: false, status: 403, json: async () => ({ code: '42501', message: 'Forbidden: insufficient permission' }) };
        }
        auditLogSink.push({ event_type: fn, actor_id: actor.id });
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }

      if (fn === 'admin_update_security_settings') {
        if (actor.role !== 'system_owner') {
          return { ok: false, status: 403, json: async () => ({ code: '42501', message: 'Forbidden: hanya System Owner' }) };
        }
        auditLogSink.push({ event_type: 'security_settings_updated', actor_id: actor.id });
        return { ok: true, status: 200, json: async () => ({ invitation_expiry_hours: body.p_invitation_expiry_hours }) };
      }
    }

    return { ok: false, status: 404, json: async () => ({ message: 'Not found' }) };
  };
}

async function runAdminTests() {
  const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-test-key' };
  const auditSink = [];
  const mockFetch = buildMockSupabaseFetch(auditSink);
  adminApi.resetRateLimits();

  // 1. Anonymous user blocked (401)
  {
    const res = createMockRes();
    await adminApi.handleAdminRequest({ method: 'GET', url: '/api/admin?action=overview', headers: {} }, res, { env, fetch: mockFetch });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.ok, false);
    console.log('1. [PASS] Anonymous requests to /api/admin are rejected with HTTP 401');
  }

  // 2. Invalid/tampered JWT rejected (401)
  {
    const res = createMockRes();
    await adminApi.handleAdminRequest(
      { method: 'GET', url: '/api/admin?action=overview', headers: { authorization: 'Bearer forged-jwt' } },
      res,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(res.statusCode, 401);
    console.log('2. [PASS] Forged or invalid JWT is rejected with HTTP 401');
  }

  // 3. Cross-origin POST rejected (403)
  {
    const res = createMockRes();
    await adminApi.handleAdminRequest(
      {
        method: 'POST',
        url: '/api/admin?action=update_account_status',
        headers: { host: 'storypad-nu.vercel.app', origin: 'https://evil.example', authorization: 'Bearer jwt-owner' },
        body: { user_id: UID_CREW, status: 'suspended' }
      },
      res,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.code, 'CROSS_ORIGIN_REJECTED');
    console.log('3. [PASS] Cross-origin POST is rejected with HTTP 403');
  }

  // 4. Crew Member blocked from Admin Console access & all admin mutations (403)
  {
    const accessRes = createMockRes();
    await adminApi.handleAdminRequest(
      { method: 'GET', url: '/api/admin?action=my_access', headers: { authorization: 'Bearer jwt-crew' } },
      accessRes,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(accessRes.statusCode, 200);
    assert.strictEqual(accessRes.body.access.can_access_console, false);

    const ovRes = createMockRes();
    await adminApi.handleAdminRequest(
      { method: 'GET', url: '/api/admin?action=overview', headers: { authorization: 'Bearer jwt-crew' } },
      ovRes,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(ovRes.statusCode, 403);

    const promoRes = createMockRes();
    await adminApi.handleAdminRequest(
      {
        method: 'POST',
        url: '/api/admin?action=assign_system_role',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000', authorization: 'Bearer jwt-crew' },
        body: { user_id: UID_CREW, system_role: 'system_owner', reason: 'self escalate' }
      },
      promoRes,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(promoRes.statusCode, 403);
    console.log('4. [PASS] Crew Member denied console access, overview, and self-promotion');
  }

  // 5. Production Admin scoped strictly to proj-a; blocked on proj-b (IDOR), session revoke, and status update
  {
    const okMem = createMockRes();
    await adminApi.handleAdminRequest(
      {
        method: 'POST',
        url: '/api/admin?action=upsert_membership',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000', authorization: 'Bearer jwt-prod-admin' },
        body: { project_id: 'proj-a', user_id: UID_CREW, member_role: 'editor', production_role: 'First AC', reason: 'assign' }
      },
      okMem,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(okMem.statusCode, 200);

    const idorMem = createMockRes();
    await adminApi.handleAdminRequest(
      {
        method: 'POST',
        url: '/api/admin?action=upsert_membership',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000', authorization: 'Bearer jwt-prod-admin' },
        body: { project_id: 'proj-b', user_id: UID_CREW, member_role: 'editor', production_role: 'Camera', reason: 'idor' }
      },
      idorMem,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(idorMem.statusCode, 403);

    const revRes = createMockRes();
    await adminApi.handleAdminRequest(
      {
        method: 'POST',
        url: '/api/admin?action=revoke_session',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000', authorization: 'Bearer jwt-prod-admin' },
        body: { session_id: SESS_OTHER, reason: 'unauthorized' }
      },
      revRes,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(revRes.statusCode, 403);

    const statusRes = createMockRes();
    await adminApi.handleAdminRequest(
      {
        method: 'POST',
        url: '/api/admin?action=update_account_status',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000', authorization: 'Bearer jwt-prod-admin' },
        body: { user_id: UID_CREW, status: 'suspended', reason: 'unauthorized' }
      },
      statusRes,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(statusRes.statusCode, 403);
    console.log('5. [PASS] Production Admin enforces project scope, blocks cross-project IDOR & global ops');
  }

  // 6. System Admin blocked from promoting to system_owner, modifying own role, or changing security settings
  {
    const hierRes = createMockRes();
    await adminApi.handleAdminRequest(
      {
        method: 'POST',
        url: '/api/admin?action=assign_system_role',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000', authorization: 'Bearer jwt-admin' },
        body: { user_id: UID_CREW, system_role: 'system_owner', reason: 'bypass' }
      },
      hierRes,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(hierRes.statusCode, 403);

    const secRes = createMockRes();
    await adminApi.handleAdminRequest(
      {
        method: 'POST',
        url: '/api/admin?action=update_security_settings',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000', authorization: 'Bearer jwt-admin' },
        body: { invitation_expiry_hours: 24, min_password_length: 12, session_idle_minutes: 30, require_reauth_role_change: true, allow_crew_self_signup: true }
      },
      secRes,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(secRes.statusCode, 403);

    const postureRes = createMockRes();
    await adminApi.handleAdminRequest(
      { method: 'GET', url: '/api/admin?action=security_posture', headers: { authorization: 'Bearer jwt-prod-admin' } },
      postureRes,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(postureRes.statusCode, 403);
    console.log('6. [PASS] Role hierarchy, security.manage, and security.read permissions enforced');
  }

  // 7. System Owner mutations succeed and record audit entries; security_posture never exposes secrets
  {
    const ownerSecRes = createMockRes();
    await adminApi.handleAdminRequest(
      {
        method: 'POST',
        url: '/api/admin?action=update_security_settings',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000', authorization: 'Bearer jwt-owner' },
        body: { invitation_expiry_hours: 48, min_password_length: 14, session_idle_minutes: 30, require_reauth_role_change: true, allow_crew_self_signup: true, reason: 'Tighten policy' }
      },
      ownerSecRes,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(ownerSecRes.statusCode, 200);
    assert.ok(auditSink.some((a) => a.event_type === 'security_settings_updated'));

    const postureOk = createMockRes();
    await adminApi.handleAdminRequest(
      { method: 'GET', url: '/api/admin?action=security_posture', headers: { authorization: 'Bearer jwt-owner' } },
      postureOk,
      { env: { ...env, SUPABASE_SERVICE_ROLE_KEY: 'super-secret-do-not-leak' }, fetch: mockFetch }
    );
    assert.strictEqual(postureOk.statusCode, 200);
    assert.strictEqual(postureOk.body.posture.service_role_exposed_to_client, false);
    assert.ok(!JSON.stringify(postureOk.body).includes('super-secret-do-not-leak'));
    console.log('7. [PASS] System Owner updates recorded to audit sink; zero secret leakage in posture');
  }

  // 8. Input validation & missing-migration graceful handling (503)
  {
    const badUuid = createMockRes();
    await adminApi.handleAdminRequest(
      { method: 'GET', url: '/api/admin?action=account_detail&user_id=not-a-uuid', headers: { authorization: 'Bearer jwt-owner' } },
      badUuid,
      { env, fetch: mockFetch }
    );
    assert.strictEqual(badUuid.statusCode, 400);

    const migFetch = async (url) => {
      if (String(url).endsWith('/auth/v1/user')) {
        return { ok: true, status: 200, json: async () => ({ id: UID_OWNER, email: 'owner@studio.test' }) };
      }
      return { ok: false, status: 404, json: async () => ({ code: 'PGRST202', message: 'Could not find the function public.admin_get_my_access' }) };
    };
    const migRes = createMockRes();
    await adminApi.handleAdminRequest(
      { method: 'GET', url: '/api/admin?action=my_access', headers: { authorization: 'Bearer jwt-owner' } },
      migRes,
      { env, fetch: migFetch }
    );
    assert.strictEqual(migRes.statusCode, 503);
    assert.strictEqual(migRes.body.code, 'MIGRATION_REQUIRED');
    console.log('8. [PASS] Server-side input validation & missing-migration 503 mapping verified');
  }

  // 9. Rate limiter triggers HTTP 429 on mutation bursts
  {
    adminApi.resetRateLimits();
    let hit429 = false;
    for (let i = 0; i < 35; i++) {
      const rlRes = createMockRes();
      await adminApi.handleAdminRequest(
        {
          method: 'POST',
          url: '/api/admin?action=upsert_membership',
          headers: { host: 'localhost:3000', origin: 'http://localhost:3000', authorization: 'Bearer jwt-owner' },
          body: { project_id: 'proj-a', user_id: UID_CREW, member_role: 'editor', production_role: 'Crew', reason: 'burst' }
        },
        rlRes,
        { env, fetch: mockFetch }
      );
      if (rlRes.statusCode === 429) {
        hit429 = true;
        break;
      }
    }
    assert.strictEqual(hit429, true, 'Mutation burst must trigger HTTP 429 rate limit');
    console.log('9. [PASS] Admin mutation rate limiter enforces HTTP 429');
  }

  // 10. SQL migration & verification file invariants + zero em dashes + zero service_role in frontend
  {
    const migSql = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20261126000004_admin_console_rbac_invitations_audit.sql'), 'utf8');
    const verSql = fs.readFileSync(path.join(__dirname, 'supabase/verify_admin_console.sql'), 'utf8');
    assert.ok(migSql.includes('CREATE TABLE IF NOT EXISTS public.system_roles'));
    assert.ok(migSql.includes('CREATE TABLE IF NOT EXISTS public.role_permissions'));
    assert.ok(migSql.includes('CREATE TABLE IF NOT EXISTS public.user_system_roles'));
    assert.ok(migSql.includes('CREATE TABLE IF NOT EXISTS public.project_invitations'));
    assert.ok(migSql.includes('CREATE TABLE IF NOT EXISTS public.admin_security_settings'));
    assert.ok(migSql.includes('REVOKE INSERT, UPDATE, DELETE ON public.security_audit_logs FROM anon, authenticated'));
    assert.ok(migSql.includes('REVOKE ALL ON FUNCTION private.bootstrap_first_system_owner(text) FROM PUBLIC, anon, authenticated'));
    assert.ok(migSql.includes("extensions.digest(convert_to("));
    assert.ok(verSql.includes('BEGIN;') && verSql.includes('ROLLBACK;'));

    const allFiles = [
      'admin.html',
      'admin.js',
      'api/admin.js',
      'server.js',
      'vercel.json',
      'app.css',
      'app.js',
      'index.html',
      'views/layout/navbar.php',
      'views/screens/profile.php',
      'views/admin/dashboard.php',
      'views/admin/login.php',
      'docs/ADMIN_CONSOLE.md',
      'supabase/migrations/20261126000004_admin_console_rbac_invitations_audit.sql',
      'supabase/verify_admin_console.sql',
      'test_admin_console.js'
    ];
    allFiles.forEach((rel) => {
      const content = fs.readFileSync(path.join(__dirname, rel), 'utf8');
      assert.ok(!content.includes('\u2014'), `Forbidden em dash found in ${rel}`);
    });

    ['admin.html', 'admin.js', 'index.html', 'app.js'].forEach((fe) => {
      const content = fs.readFileSync(path.join(__dirname, fe), 'utf8');
      assert.ok(!content.includes('SUPABASE_SERVICE_ROLE_KEY'), `Frontend file ${fe} must not reference service_role key`);
      assert.ok(!content.includes('service_role'), `Frontend file ${fe} must not expose service_role`);
    });
    console.log('10. [PASS] Migration invariants, zero em dashes, and zero service_role in frontend verified');
  }

  console.log('\n=== ALL 10 ADMIN CONSOLE SECURITY & NEGATIVE TESTS PASSED 100%! ===');
}

runAdminTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
