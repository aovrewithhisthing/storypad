/**
 * StoryPad Admin Console Controller
 * Server-verified RBAC, Accounts, Roles, Project Memberships, Sessions, Invitations, Audit & Security
 */
const StoryPadAdmin = {
  supabaseConfig: {
    url: '',
    anonKey: '',
    projectId: ''
  },
  supabase: null,
  _supabaseLoadListenerAdded: false,
  _lastFocusEl: null,
  _confirmResolver: null,
  _toastTimer: null,

  state: {
    theme: 'slate',
    sidebarCollapsed: false,
    session: null,
    user: null,
    access: null,
    activeSection: 'overview',
    accounts: [],
    accountsTotal: 0,
    accountsOffset: 0,
    accountsLimit: 25,
    rolesData: { roles: [], permissions: [] },
    membershipsData: { projects: [], memberships: [] },
    sessionsData: { scope: 'own', total: 0, sessions: [] },
    invitationsData: { total: 0, invitations: [] },
    auditData: { total: 0, limit: 30, offset: 0, logs: [] },
    securitySettings: null,
    securityPosture: null,
    activeDetailUserId: null
  },

  init() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    this.loadTheme();
    this.hydrateBootConfig();
    this.bindEvents();
    this.initSupabase();
  },

  el(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
  },

  escapeHtml(val) {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  hasPerm(perm) {
    const perms = this.state.access && Array.isArray(this.state.access.permissions)
      ? this.state.access.permissions
      : [];
    return perms.includes(perm);
  },

  loadTheme() {
    try {
      const saved = window.localStorage.getItem('storypad_theme');
      this.state.theme = saved === 'daylight' ? 'daylight' : 'slate';
    } catch (_e) {
      this.state.theme = 'slate';
    }
    this.applyTheme(this.state.theme);
  },

  applyTheme(theme) {
    const next = theme === 'daylight' ? 'daylight' : 'slate';
    this.state.theme = next;
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', next);
    }
    document.querySelectorAll('.admin-theme-label').forEach((node) => {
      node.textContent = next === 'daylight' ? 'Mode Slate Gelap' : 'Mode Kertas Editorial';
    });
    try {
      window.localStorage.setItem('storypad_theme', next);
    } catch (_e) {}
  },

  toggleTheme() {
    this.applyTheme(this.state.theme === 'daylight' ? 'slate' : 'daylight');
    this.showToast(this.state.theme === 'slate' ? 'Tema Slate Gelap aktif' : 'Tema Kertas Editorial aktif');
  },

  showToast(message) {
    const toast = this.el('admin-toast');
    const msg = this.el('admin-toast-msg');
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  },

  formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  parseUa(ua) {
    const raw = String(ua || '').trim();
    if (!raw) return 'Perangkat tidak dikenal';
    let browser = 'Browser';
    if (/Edg\//i.test(raw)) browser = 'Edge';
    else if (/Chrome\//i.test(raw) && !/Chromium/i.test(raw)) browser = 'Chrome';
    else if (/Firefox\//i.test(raw)) browser = 'Firefox';
    else if (/Safari\//i.test(raw) && !/Chrome/i.test(raw)) browser = 'Safari';
    let os = 'Perangkat';
    if (/Windows/i.test(raw)) os = 'Windows';
    else if (/iPhone|iPad|iOS/i.test(raw)) os = 'iOS';
    else if (/Android/i.test(raw)) os = 'Android';
    else if (/Mac OS X|Macintosh/i.test(raw)) os = 'macOS';
    else if (/Linux/i.test(raw)) os = 'Linux';
    return `${browser} di ${os}`;
  },

  hydrateBootConfig() {
    if (typeof window !== 'undefined' && window.STORYPAD_PHP_BOOT) {
      const b = window.STORYPAD_PHP_BOOT;
      if (b.studioName && this.el('gate-studio-name')) {
        this.el('gate-studio-name').textContent = b.studioName;
      }
      if (b.supabase) {
        this.supabaseConfig = { ...this.supabaseConfig, ...b.supabase };
      }
    }
  },

  updateGateBadge(text, variant = 'neutral') {
    const b = this.el('gate-supabase-badge');
    if (!b) return;
    b.textContent = text;
    b.className = `sp-badge font-mono ${variant === 'good' ? 'sp-badge-good' : (variant === 'amber' ? 'sp-badge-amber' : 'sp-badge-neutral')}`;
  },

  initSupabase() {
    if (typeof window === 'undefined') return;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      if (!this._supabaseLoadListenerAdded) {
        this._supabaseLoadListenerAdded = true;
        window.addEventListener('load', () => this.initSupabase(), { once: true });
      }
      return;
    }

    if (this.supabase) return;
    if (!this.supabaseConfig.url || !this.supabaseConfig.anonKey) {
      if (!this._configFetched && typeof fetch === 'function') {
        this._configFetched = true;
        fetch('/api/config')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && d.ok && d.supabase && d.supabase.url && d.supabase.anonKey) {
              this.supabaseConfig = { ...this.supabaseConfig, ...d.supabase };
              if (d.studioName && this.el('gate-studio-name')) {
                this.el('gate-studio-name').textContent = d.studioName;
              }
              this.initSupabase();
            } else {
              this.updateGateBadge('Config Belum Diatur', 'amber');
            }
          })
          .catch(() => this.updateGateBadge('Config Gagal', 'amber'));
      }
      return;
    }

    this.supabase = window.supabase.createClient(this.supabaseConfig.url, this.supabaseConfig.anonKey);
    this.updateGateBadge('Supabase Siap', 'good');

    this.supabase.auth.getSession().then(async ({ data }) => {
      if (data && data.session && data.session.user) {
        this.state.session = data.session;
        this.state.user = data.session.user;
        await this.bootstrapConsole();
      } else {
        this.showView('gate');
      }
    }).catch(() => this.showView('gate'));

    this.supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session && session.user) {
        const prev = this.state.user ? this.state.user.id : '';
        this.state.session = session;
        this.state.user = session.user;
        if (prev !== session.user.id) {
          await this.bootstrapConsole();
        }
      } else {
        this.state.session = null;
        this.state.user = null;
        this.state.access = null;
        this.showView('gate');
      }
    });
  },

  showView(viewName) {
    const gate = this.el('admin-auth-gate');
    const denied = this.el('admin-access-denied');
    const shell = this.el('admin-console-shell');
    if (gate) gate.classList.toggle('hidden', viewName !== 'gate');
    if (denied) denied.classList.toggle('hidden', viewName !== 'denied');
    if (shell) shell.classList.toggle('hidden', viewName !== 'console');
  },

  async apiCall(action, options = {}) {
    const token = this.state.session && this.state.session.access_token;
    if (!token) {
      throw Object.assign(new Error('Sesi autentikasi tidak ditemukan.'), { status: 401, code: 'UNAUTHORIZED' });
    }
    const method = options.method || 'GET';
    const qs = new URLSearchParams({ action, ...(options.params || {}) });
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    };
    const fetchOpts = { method, headers };
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      fetchOpts.body = JSON.stringify(options.body || {});
    }

    const resp = await fetch(`/api/admin?${qs.toString()}`, fetchOpts);
    let data = {};
    try {
      data = await resp.json();
    } catch (_e) {}

    if (resp.status === 401) {
      this.showView('gate');
    }

    if (!resp.ok || !data.ok) {
      const err = new Error(data.error || `Permintaan gagal (HTTP ${resp.status})`);
      err.status = resp.status;
      err.code = data.code || 'API_ERROR';
      throw err;
    }
    return data;
  },

  async bootstrapConsole() {
    try {
      const res = await this.apiCall('my_access');
      const access = res.access;
      this.state.access = access;

      if (!access || !access.can_access_console) {
        this.showDeniedScreen(
          'Akses Admin Console Ditolak',
          `${access ? access.email : ''} (${access ? access.system_role_label : 'Tanpa Akses'})`,
          'Akun ini tidak memiliki System Role (System Owner / System Admin) atau cakupan Production Admin pada proyek aktif. Jabatan produksi seperti Director tidak otomatis memberi akses admin sistem.',
          false
        );
        return;
      }

      this.showView('console');
      this.applyConsoleAccessControls();
      await this.selectSection(this.state.activeSection || 'overview');
    } catch (err) {
      if (err.code === 'MIGRATION_REQUIRED') {
        this.showDeniedScreen(
          'Migrasi Database P3 Diperlukan',
          'Skema Admin Console belum aktif di Supabase',
          err.message,
          true
        );
        return;
      }
      if (err.status === 401) {
        this.showView('gate');
        return;
      }
      this.showDeniedScreen(
        'Gagal Memverifikasi Akses Admin',
        'Kesalahan verifikasi server',
        err.message || 'Tidak dapat menghubungi API Admin Console.',
        false
      );
    }
  },

  showDeniedScreen(title, subtitle, message, showMigrationGuide) {
    this.showView('denied');
    if (this.el('denied-title')) this.el('denied-title').textContent = title;
    if (this.el('denied-subtitle')) this.el('denied-subtitle').textContent = subtitle;
    if (this.el('denied-message')) this.el('denied-message').textContent = message;
    if (this.el('denied-migration-guide')) {
      this.el('denied-migration-guide').classList.toggle('hidden', !showMigrationGuide);
    }
  },

  applyConsoleAccessControls() {
    const a = this.state.access || {};
    if (this.el('sidebar-actor-name')) this.el('sidebar-actor-name').textContent = a.full_name || a.email || '-';
    if (this.el('sidebar-actor-role')) this.el('sidebar-actor-role').textContent = a.system_role_label || a.system_role || '-';
    if (this.el('admin-actor-subtitle')) this.el('admin-actor-subtitle').textContent = `${a.full_name || '-'} | ${a.email || '-'}`;
    if (this.el('admin-role-badge')) this.el('admin-role-badge').textContent = a.system_role_label || a.system_role || '-';

    const sectionAllowed = {
      overview: this.hasPerm('accounts.read'),
      accounts: this.hasPerm('accounts.read'),
      roles: this.hasPerm('roles.read'),
      projects: this.hasPerm('projects.manage_members'),
      invitations: this.hasPerm('accounts.invite'),
      sessions: this.hasPerm('sessions.read_all') || this.hasPerm('sessions.read_own'),
      audit: this.hasPerm('audit.read'),
      security: this.hasPerm('security.read')
    };

    document.querySelectorAll('[data-section]').forEach((btn) => {
      const sec = btn.getAttribute('data-section');
      const ok = !!sectionAllowed[sec];
      btn.classList.toggle('hidden', !ok);
    });

    if (this.el('btn-accounts-invite')) {
      this.el('btn-accounts-invite').classList.toggle('hidden', !this.hasPerm('accounts.invite'));
    }
    if (this.el('roles-assign-card')) {
      this.el('roles-assign-card').classList.toggle('hidden', !this.hasPerm('roles.assign'));
    }
    if (!sectionAllowed[this.state.activeSection]) {
      const firstAllowed = Object.keys(sectionAllowed).find((k) => sectionAllowed[k]) || 'overview';
      this.state.activeSection = firstAllowed;
    }
  },

  setGlobalBanner(message = '') {
    const box = this.el('admin-global-banner');
    const txt = this.el('admin-global-banner-text');
    if (!box || !txt) return;
    if (!message) {
      box.classList.add('hidden');
      txt.textContent = '';
    } else {
      txt.textContent = message;
      box.classList.remove('hidden');
    }
  },

  async selectSection(section) {
    this.state.activeSection = section;
    const titles = {
      overview: 'Overview',
      accounts: 'Accounts',
      roles: 'Roles & Permissions',
      projects: 'Projects / Memberships',
      invitations: 'Invitations',
      sessions: 'Sessions & Devices',
      audit: 'Audit Logs',
      security: 'Security Settings'
    };
    if (this.el('admin-active-heading')) {
      this.el('admin-active-heading').textContent = titles[section] || 'Admin Console';
    }

    document.querySelectorAll('[data-section]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-section') === section);
    });

    document.querySelectorAll('.admin-section').forEach((sec) => {
      sec.classList.toggle('hidden', sec.id !== `sec-${section}`);
    });

    this.closeMobileDrawer();
    this.setGlobalBanner('');

    try {
      if (section === 'overview') await this.loadOverview();
      else if (section === 'accounts') await this.loadAccounts();
      else if (section === 'roles') await this.loadRoles();
      else if (section === 'projects') await this.loadMemberships();
      else if (section === 'sessions') await this.loadSessions();
      else if (section === 'invitations') await this.loadInvitations();
      else if (section === 'audit') await this.loadAuditLogs();
      else if (section === 'security') await this.loadSecurity();
    } catch (err) {
      this.setGlobalBanner(err.message || 'Gagal memuat bagian ini.');
    }
  },

  // -----------------------------------------------------------
  // 1. OVERVIEW
  // -----------------------------------------------------------
  async loadOverview() {
    const res = await this.apiCall('overview');
    const ov = res.overview || {};
    const c = ov.counts || {};

    if (this.el('ov-total-accounts')) this.el('ov-total-accounts').textContent = String(c.total_accounts ?? 0);
    if (this.el('ov-accounts-sub')) {
      this.el('ov-accounts-sub').textContent = `${c.active_accounts ?? 0} aktif | ${c.managed_projects ?? 0} proyek`;
    }
    const attention = (c.unverified_accounts ?? 0) + (c.suspended_accounts ?? 0) + (c.deactivated_accounts ?? 0);
    if (this.el('ov-attention-accounts')) this.el('ov-attention-accounts').textContent = String(attention);
    if (this.el('ov-attention-sub')) {
      this.el('ov-attention-sub').textContent = `${c.unverified_accounts ?? 0} unverified | ${c.suspended_accounts ?? 0} suspended`;
    }
    if (this.el('ov-active-sessions')) this.el('ov-active-sessions').textContent = String(c.active_sessions ?? 0);
    if (this.el('ov-pending-invites')) this.el('ov-pending-invites').textContent = String(c.pending_invitations ?? 0);
    if (this.el('ov-invites-sub')) {
      this.el('ov-invites-sub').textContent = `${c.expired_invitations ?? 0} kedaluwarsa`;
    }

    const alertsBox = this.el('ov-alerts-list');
    if (alertsBox) {
      const alerts = ov.security_alerts || [];
      if (ov.scope === 'project') {
        alertsBox.innerHTML = '<p class="font-sans text-xs m-0" style="color: var(--text-secondary);">Ringkasan keamanan global hanya tersedia untuk System Owner dan System Admin.</p>';
      } else if (alerts.length === 0) {
        alertsBox.innerHTML = '<p class="font-sans text-xs m-0" style="color: var(--text-secondary);">Tidak ada peringatan keamanan yang diblokir atau gagal baru-baru ini.</p>';
      } else {
        alertsBox.innerHTML = alerts.map((a) => `
          <div class="sp-panel-muted p-3 flex flex-col gap-1">
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-xs font-bold" style="color: var(--text-primary);">${this.escapeHtml(a.event_type)}</span>
              <span class="sp-badge ${a.status === 'success' ? 'sp-badge-amber' : 'sp-badge-red'}">${this.escapeHtml(a.status)}</span>
            </div>
            <div class="font-mono text-[11px]" style="color: var(--text-secondary);">
              ${this.escapeHtml(a.target_email || '-')} | ${this.escapeHtml(this.formatDate(a.created_at))}
            </div>
            ${a.reason ? `<div class="font-sans text-xs" style="color: var(--text-secondary);">${this.escapeHtml(a.reason)}</div>` : ''}
          </div>
        `).join('');
      }
    }

    const recentBox = this.el('ov-recent-audits');
    if (recentBox) {
      const audits = ov.recent_audits || [];
      if (ov.scope === 'project') {
        recentBox.innerHTML = '<p class="font-sans text-xs m-0" style="color: var(--text-secondary);">Gunakan tab Projects / Memberships atau Invitations untuk mengelola kru pada proyek Anda.</p>';
      } else if (audits.length === 0) {
        recentBox.innerHTML = '<p class="font-sans text-xs m-0" style="color: var(--text-secondary);">Belum ada aktivitas administratif tercatat di tabel security_audit_logs.</p>';
      } else {
        recentBox.innerHTML = audits.map((row) => `
          <div class="sp-panel-muted p-3 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-mono text-xs font-semibold truncate" style="color: var(--text-primary);">${this.escapeHtml(row.event_type)}</div>
              <div class="font-mono text-[11px] truncate" style="color: var(--text-secondary);">${this.escapeHtml(row.actor_email || 'sistem')} | ${this.escapeHtml(this.formatDate(row.created_at))}</div>
            </div>
            <span class="sp-badge ${row.status === 'success' ? 'sp-badge-good' : 'sp-badge-red'} shrink-0">${this.escapeHtml(row.status)}</span>
          </div>
        `).join('');
      }
    }
  },

  // -----------------------------------------------------------
  // 2. ACCOUNTS & ACCOUNT DETAIL DRAWER
  // -----------------------------------------------------------
  async loadAccounts() {
    const stateBox = this.el('acc-state-box');
    const tbody = this.el('acc-tbody');
    if (stateBox) {
      stateBox.textContent = 'Memuat daftar akun...';
      stateBox.classList.remove('hidden');
    }
    if (tbody) tbody.innerHTML = '';

    const search = this.el('acc-search') ? this.el('acc-search').value.trim() : '';
    const status = this.el('acc-filter-status') ? this.el('acc-filter-status').value : 'all';
    const sysRole = this.el('acc-filter-role') ? this.el('acc-filter-role').value : 'all';

    const data = await this.apiCall('accounts', {
      params: {
        search,
        status,
        system_role: sysRole,
        limit: String(this.state.accountsLimit),
        offset: String(this.state.accountsOffset)
      }
    });

    this.state.accounts = data.accounts || [];
    this.state.accountsTotal = Number(data.total || 0);
    this.renderAccountsTable();
  },

  renderAccountsTable() {
    const stateBox = this.el('acc-state-box');
    const tbody = this.el('acc-tbody');
    const pageInfo = this.el('acc-page-info');
    const prevBtn = this.el('acc-prev-btn');
    const nextBtn = this.el('acc-next-btn');
    if (!tbody) return;

    const rows = this.state.accounts;
    if (rows.length === 0) {
      tbody.innerHTML = '';
      if (stateBox) {
        stateBox.textContent = 'Tidak ada akun yang cocok dengan filter saat ini.';
        stateBox.classList.remove('hidden');
      }
    } else {
      if (stateBox) stateBox.classList.add('hidden');
      tbody.innerHTML = rows.map((acc) => {
        const statusBadge = acc.account_status === 'active'
          ? '<span class="sp-badge sp-badge-good">Aktif</span>'
          : (acc.account_status === 'suspended'
            ? '<span class="sp-badge sp-badge-amber">Suspended</span>'
            : '<span class="sp-badge sp-badge-red">Nonaktif</span>');
        const verifiedBadge = acc.email_confirmed_at
          ? '<span class="sp-badge sp-badge-blue">Email Verified</span>'
          : '<span class="sp-badge sp-badge-amber">Unverified</span>';

        return `
          <tr class="admin-table-row">
            <td class="py-3 px-3">
              <div class="flex items-center gap-2.5">
                <span class="w-8 h-8 rounded bg-[#2563EB] text-white font-sans text-xs font-bold flex items-center justify-center shrink-0">${this.escapeHtml(acc.initials || 'KP')}</span>
                <div class="min-w-0">
                  <div class="font-sans text-xs font-bold truncate" style="color: var(--text-primary);">${this.escapeHtml(acc.full_name)}</div>
                  <div class="font-mono text-[11px] truncate" style="color: var(--text-secondary);">${this.escapeHtml(acc.email)}</div>
                </div>
              </div>
            </td>
            <td class="py-3 px-3">
              <span class="sp-badge sp-badge-neutral font-mono">${this.escapeHtml(acc.system_role_label || acc.system_role)}</span>
              <div class="font-mono text-[11px] mt-1" style="color: var(--text-muted);">${this.escapeHtml(acc.id_badge || '-')}</div>
            </td>
            <td class="py-3 px-3">
              <div class="flex flex-wrap gap-1">${statusBadge}${verifiedBadge}</div>
            </td>
            <td class="py-3 px-3 font-mono text-xs tabular-nums" style="color: var(--text-primary);">
              ${this.escapeHtml(String(acc.project_count ?? 0))} proyek
            </td>
            <td class="py-3 px-3 font-mono text-[11px]" style="color: var(--text-secondary);">
              ${this.escapeHtml(this.formatDate(acc.last_sign_in_at))}
            </td>
            <td class="py-3 px-3 text-right whitespace-nowrap">
              <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" data-open-account="${this.escapeHtml(acc.user_id)}">Detail</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    if (pageInfo) {
      const start = this.state.accountsTotal === 0 ? 0 : this.state.accountsOffset + 1;
      const end = Math.min(this.state.accountsTotal, this.state.accountsOffset + rows.length);
      pageInfo.textContent = `Menampilkan ${start}-${end} dari ${this.state.accountsTotal} akun`;
    }
    if (prevBtn) prevBtn.disabled = this.state.accountsOffset <= 0;
    if (nextBtn) nextBtn.disabled = this.state.accountsOffset + this.state.accountsLimit >= this.state.accountsTotal;
  },

  async openAccountDetail(userId) {
    this.state.activeDetailUserId = userId;
    const drawer = this.el('drawer-account-detail');
    const body = this.el('drawer-acc-body');
    if (body) body.innerHTML = '<p class="font-mono text-xs" style="color: var(--text-secondary);">Memuat detail akun dari server...</p>';
    this.openOverlayElement(drawer);

    try {
      const res = await this.apiCall('account_detail', { params: { user_id: userId } });
      const d = res.detail;
      if (this.el('drawer-acc-title')) this.el('drawer-acc-title').textContent = d.profile.full_name || d.email;
      if (this.el('drawer-acc-email')) this.el('drawer-acc-email').textContent = `${d.email} | ${d.system_role_label}`;

      const canEditProfile = this.hasPerm('accounts.update_profile');
      const canUpdateStatus = this.hasPerm('accounts.update_status');
      const canRevokeSession = this.hasPerm('sessions.revoke_user_sessions');
      const isSelf = this.state.access && this.state.access.user_id === d.user_id;

      const permsHtml = (d.permissions || []).map((p) => `<span class="sp-badge sp-badge-neutral font-mono">${this.escapeHtml(p)}</span>`).join('');
      const membershipsHtml = (d.memberships || []).length === 0
        ? '<p class="font-sans text-xs m-0" style="color: var(--text-secondary);">Belum tergabung pada proyek produksi yang terjangkau.</p>'
        : d.memberships.map((m) => `
          <div class="sp-panel-muted p-2.5 flex items-center justify-between gap-2 text-xs">
            <div class="min-w-0">
              <div class="font-sans font-bold truncate" style="color: var(--text-primary);">${this.escapeHtml(m.project_code)} | ${this.escapeHtml(m.project_title)}</div>
              <div class="font-mono text-[11px]" style="color: var(--text-secondary);">Jabatan: ${this.escapeHtml(m.production_role)} | Akses: ${this.escapeHtml(m.member_role)}</div>
            </div>
          </div>
        `).join('');

      const identitiesHtml = (d.identities || []).length === 0
        ? '<p class="font-sans text-xs m-0" style="color: var(--text-secondary);">Data identitas tidak tersedia pada cakupan Anda.</p>'
        : d.identities.map((idn) => `
          <div class="sp-panel-muted p-2.5 flex items-center justify-between gap-2 text-xs">
            <span class="font-sans font-semibold" style="color: var(--text-primary);">${this.escapeHtml(idn.provider)}</span>
            <span class="font-mono text-[11px]" style="color: var(--text-secondary);">${this.escapeHtml(idn.email || '-')}</span>
          </div>
        `).join('');

      const sessionsHtml = !d.sessions_accessible
        ? '<p class="font-sans text-xs m-0" style="color: var(--text-secondary);">Anda tidak memiliki izin melihat sesi perangkat akun lain.</p>'
        : (d.sessions || []).length === 0
          ? '<p class="font-sans text-xs m-0" style="color: var(--text-secondary);">Tidak ada sesi aktif tercatat di auth.sessions.</p>'
          : d.sessions.map((s) => `
            <div class="sp-panel-muted p-2.5 flex items-center justify-between gap-2 text-xs">
              <div class="min-w-0">
                <div class="font-sans font-semibold truncate" style="color: var(--text-primary);">${this.escapeHtml(this.parseUa(s.user_agent))}</div>
                <div class="font-mono text-[11px]" style="color: var(--text-secondary);">${this.escapeHtml(s.ip_masked)} | ${this.escapeHtml(this.formatDate(s.refreshed_at || s.created_at))}</div>
              </div>
              ${canRevokeSession ? `<button type="button" class="sp-btn sp-btn-danger-ghost sp-btn-compact shrink-0" data-revoke-session="${this.escapeHtml(s.session_id)}">Cabut</button>` : ''}
            </div>
          `).join('');

      const auditsHtml = !d.audits_accessible
        ? '<p class="font-sans text-xs m-0" style="color: var(--text-secondary);">Log audit global hanya dapat dilihat oleh System Owner / System Admin.</p>'
        : (d.recent_audits || []).length === 0
          ? '<p class="font-sans text-xs m-0" style="color: var(--text-secondary);">Belum ada log aktivitas untuk akun ini.</p>'
          : d.recent_audits.map((ev) => `
            <div class="sp-panel-muted p-2.5 flex items-center justify-between gap-2 text-xs">
              <div class="min-w-0">
                <div class="font-mono font-semibold truncate" style="color: var(--text-primary);">${this.escapeHtml(ev.event_type)}</div>
                <div class="font-mono text-[11px]" style="color: var(--text-secondary);">${this.escapeHtml(this.formatDate(ev.created_at))}${ev.reason ? ' | ' + this.escapeHtml(ev.reason) : ''}</div>
              </div>
              <span class="sp-badge ${ev.status === 'success' ? 'sp-badge-good' : 'sp-badge-red'}">${this.escapeHtml(ev.status)}</span>
            </div>
          `).join('');

      body.innerHTML = `
        <div class="sp-panel-muted p-3.5 flex flex-col gap-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="font-sans text-xs font-bold" style="color: var(--text-primary);">${this.escapeHtml(d.profile.role_title)}</div>
              <div class="font-mono text-[11px]" style="color: var(--text-secondary);">Badge ${this.escapeHtml(d.profile.id_badge)} | ${this.escapeHtml(d.profile.studio)}</div>
            </div>
            <span class="sp-badge ${d.profile.account_status === 'active' ? 'sp-badge-good' : 'sp-badge-red'}">${this.escapeHtml(d.profile.account_status)}</span>
          </div>
          <div class="font-mono text-[11px]" style="color: var(--text-secondary);">
            Terdaftar: ${this.escapeHtml(this.formatDate(d.created_at))} | Masuk Terakhir: ${this.escapeHtml(this.formatDate(d.last_sign_in_at))}
          </div>
          <div class="font-mono text-[11px]" style="color: var(--text-secondary);">
            Verifikasi Email: ${d.email_confirmed_at ? 'Terverifikasi (' + this.escapeHtml(this.formatDate(d.email_confirmed_at)) + ')' : 'Belum terverifikasi'}
          </div>
          ${(canEditProfile || (canUpdateStatus && !isSelf)) ? `
            <div class="flex flex-wrap gap-2 pt-2 border-t" style="border-color: var(--border-flat);">
              ${canEditProfile ? `<button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" id="btn-drawer-edit-profile">Edit Profil</button>` : ''}
              ${canUpdateStatus && !isSelf && d.profile.account_status === 'active' ? `<button type="button" class="sp-btn sp-btn-danger sp-btn-compact" data-change-status="suspended">Suspend Akun</button>` : ''}
              ${canUpdateStatus && !isSelf && d.profile.account_status !== 'deactivated' ? `<button type="button" class="sp-btn sp-btn-danger-ghost sp-btn-compact" data-change-status="deactivated">Nonaktifkan</button>` : ''}
              ${canUpdateStatus && !isSelf && d.profile.account_status !== 'active' ? `<button type="button" class="sp-btn sp-btn-primary sp-btn-compact" data-change-status="active">Aktifkan Kembali</button>` : ''}
            </div>
          ` : ''}
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="font-sans text-xs font-bold uppercase tracking-wide m-0" style="color: var(--text-secondary);">System Role &amp; Effective Permissions</h3>
          <div class="flex flex-wrap gap-1">${permsHtml || '<span class="font-mono text-xs">Tidak ada permission konsol</span>'}</div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="font-sans text-xs font-bold uppercase tracking-wide m-0" style="color: var(--text-secondary);">Keanggotaan Proyek &amp; Jabatan Produksi</h3>
          <div class="flex flex-col gap-2">${membershipsHtml}</div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="font-sans text-xs font-bold uppercase tracking-wide m-0" style="color: var(--text-secondary);">Linked Identities</h3>
          <div class="flex flex-col gap-2">${identitiesHtml}</div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-sans text-xs font-bold uppercase tracking-wide m-0" style="color: var(--text-secondary);">Sesi Aktif</h3>
            ${canRevokeSession && d.sessions_accessible && (d.sessions || []).length > 0 ? `<button type="button" class="sp-btn sp-btn-danger-ghost sp-btn-compact" id="btn-drawer-revoke-all">Cabut Semua Sesi</button>` : ''}
          </div>
          <div class="flex flex-col gap-2">${sessionsHtml}</div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="font-sans text-xs font-bold uppercase tracking-wide m-0" style="color: var(--text-secondary);">Audit Events Terbaru</h3>
          <div class="flex flex-col gap-2">${auditsHtml}</div>
        </div>
      `;

      const editBtn = this.el('btn-drawer-edit-profile');
      if (editBtn) {
        editBtn.addEventListener('click', () => this.openEditProfileModal(d));
      }
      const revokeAllBtn = this.el('btn-drawer-revoke-all');
      if (revokeAllBtn) {
        revokeAllBtn.addEventListener('click', () => this.confirmRevokeAllUserSessions(d.user_id, d.email));
      }
      body.querySelectorAll('[data-change-status]').forEach((btn) => {
        btn.addEventListener('click', () => this.confirmChangeAccountStatus(d.user_id, d.email, btn.getAttribute('data-change-status')));
      });
      body.querySelectorAll('[data-revoke-session]').forEach((btn) => {
        btn.addEventListener('click', () => this.confirmRevokeSession(btn.getAttribute('data-revoke-session')));
      });
    } catch (err) {
      if (body) body.innerHTML = `<div class="sp-auth-alert sp-auth-alert-error p-3 rounded border text-xs">${this.escapeHtml(err.message)}</div>`;
    }
  },

  openEditProfileModal(detail) {
    this.el('ep-user-id').value = detail.user_id;
    this.el('ep-full-name').value = detail.profile.full_name || '';
    this.el('ep-role-title').value = detail.profile.role_title || '';
    this.el('ep-id-badge').value = detail.profile.id_badge || '';
    this.el('ep-studio').value = detail.profile.studio || 'StoryPad Studio';
    const gr = detail.profile.granted_roles || {};
    this.el('ep-gr-script').checked = !!gr.scriptSupervisor;
    this.el('ep-gr-editor').checked = !!gr.videoEditor;
    this.el('ep-gr-sound').checked = !!gr.soundRecordist;
    this.el('ep-gr-director').checked = !!gr.directorProducer;
    this.el('ep-reason').value = '';
    this.openOverlayElement(this.el('modal-edit-profile'));
  },

  async confirmChangeAccountStatus(userId, email, nextStatus) {
    const label = nextStatus === 'active' ? 'Aktifkan Kembali' : (nextStatus === 'suspended' ? 'Suspend' : 'Nonaktifkan');
    const res = await this.openConfirmDialog({
      title: `${label} akun ${email}?`,
      message: nextStatus === 'active'
        ? 'Akun dapat masuk kembali ke StoryPad sesuai izin proyeknya.'
        : 'Seluruh sesi aktif akun ini akan dicabut segera dan login baru akan diblokir di server. Data produksi tidak dihapus.',
      confirmLabel: label,
      dangerous: nextStatus !== 'active',
      requireReason: true
    });
    if (!res.confirmed) return;

    try {
      await this.apiCall('update_account_status', {
        method: 'POST',
        body: { user_id: userId, status: nextStatus, reason: res.reason }
      });
      this.showToast(`Status akun ${email} diperbarui ke ${nextStatus}`);
      await this.loadAccounts();
      await this.openAccountDetail(userId);
    } catch (err) {
      this.showToast(err.message);
    }
  },

  // -----------------------------------------------------------
  // 3. ROLES & PERMISSIONS
  // -----------------------------------------------------------
  async loadRoles() {
    const data = await this.apiCall('roles');
    this.state.rolesData = data;
    this.renderRolesMatrix();

    if (this.hasPerm('accounts.read') && this.state.accounts.length === 0) {
      const accRes = await this.apiCall('accounts', { params: { limit: '100', offset: '0' } });
      this.state.accounts = accRes.accounts || [];
    }
    this.populateRoleTargetSelect();
  },

  renderRolesMatrix() {
    const tbody = this.el('roles-matrix-tbody');
    if (!tbody) return;
    const roleOrder = ['system_owner', 'system_admin', 'production_admin', 'crew_member', 'viewer'];
    const permsList = this.state.rolesData.permissions || [];
    const byPerm = {};
    permsList.forEach((item) => {
      if (!byPerm[item.permission_key]) byPerm[item.permission_key] = {};
      byPerm[item.permission_key][item.role_key] = item.scope;
    });

    const keys = Object.keys(byPerm).sort();
    if (keys.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 font-mono text-xs">Data matriks permission belum tersedia.</td></tr>';
      return;
    }

    tbody.innerHTML = keys.map((perm) => {
      const cells = roleOrder.map((r) => {
        const sc = byPerm[perm][r];
        if (!sc) return '<td class="font-mono text-[11px]" style="color: var(--text-muted);">-</td>';
        return `<td><span class="sp-badge ${sc === 'global' ? 'sp-badge-blue' : (sc === 'project' ? 'sp-badge-amber' : 'sp-badge-good')} font-mono">${this.escapeHtml(sc)}</span></td>`;
      }).join('');
      return `<tr><td class="font-mono font-semibold" style="color: var(--text-primary);">${this.escapeHtml(perm)}</td>${cells}</tr>`;
    }).join('');
  },

  populateRoleTargetSelect() {
    const sel = this.el('role-target-user');
    if (!sel) return;
    const myId = this.state.access ? this.state.access.user_id : '';
    const options = (this.state.accounts || []).filter((a) => a.user_id !== myId);
    if (options.length === 0) {
      sel.innerHTML = '<option value="">Tidak ada akun lain</option>';
      return;
    }
    sel.innerHTML = options.map((a) => `
      <option value="${this.escapeHtml(a.user_id)}">${this.escapeHtml(a.full_name)} (${this.escapeHtml(a.email)}) [${this.escapeHtml(a.system_role)}]</option>
    `).join('');
    this.updateRoleImpactPreview();
  },

  updateRoleImpactPreview() {
    const box = this.el('role-impact-preview');
    const selUser = this.el('role-target-user');
    const selRole = this.el('role-target-value');
    if (!box || !selUser || !selRole) return;
    const target = (this.state.accounts || []).find((a) => a.user_id === selUser.value);
    const nextRole = selRole.value;
    if (!target) {
      box.textContent = 'Pilih akun dan role tujuan untuk melihat dampak izin.';
      return;
    }
    const roleMeta = (this.state.rolesData.roles || []).find((r) => r.role_key === nextRole);
    const countPerms = (this.state.rolesData.permissions || []).filter((p) => p.role_key === nextRole).length;
    box.textContent = `Perubahan: ${target.email} dari "${target.system_role}" menjadi "${nextRole}" (${roleMeta ? roleMeta.scope : 'project'} scope, ${countPerms} permission).`;
  },

  // -----------------------------------------------------------
  // 4. PROJECTS / MEMBERSHIPS
  // -----------------------------------------------------------
  async loadMemberships() {
    const projId = this.el('proj-filter-select') ? this.el('proj-filter-select').value : '';
    const search = this.el('proj-member-search') ? this.el('proj-member-search').value.trim() : '';
    const data = await this.apiCall('memberships', { params: { project_id: projId, search } });
    this.state.membershipsData = data;
    this.renderMemberships(projId);
  },

  renderMemberships(selectedProjId = '') {
    const filterSel = this.el('proj-filter-select');
    const projects = this.state.membershipsData.projects || [];
    if (filterSel) {
      filterSel.innerHTML = '<option value="">Semua Proyek Terjangkau</option>' + projects.map((p) =>
        `<option value="${this.escapeHtml(p.id)}">${this.escapeHtml(p.code)} | ${this.escapeHtml(p.title)}</option>`
      ).join('');
      filterSel.value = selectedProjId;
    }

    const tbody = this.el('proj-members-tbody');
    const stateBox = this.el('proj-state-box');
    if (!tbody) return;
    const rows = this.state.membershipsData.memberships || [];
    if (rows.length === 0) {
      tbody.innerHTML = '';
      if (stateBox) {
        stateBox.textContent = 'Belum ada keanggotaan proyek yang cocok.';
        stateBox.classList.remove('hidden');
      }
      return;
    }
    if (stateBox) stateBox.classList.add('hidden');

    tbody.innerHTML = rows.map((m) => `
      <tr class="admin-table-row">
        <td class="py-3 px-3">
          <div class="font-mono text-xs font-bold" style="color: var(--text-primary);">${this.escapeHtml(m.project_code)}</div>
          <div class="font-sans text-xs" style="color: var(--text-secondary);">${this.escapeHtml(m.project_title)}</div>
        </td>
        <td class="py-3 px-3">
          <div class="font-sans text-xs font-bold" style="color: var(--text-primary);">${this.escapeHtml(m.full_name)}</div>
          <div class="font-mono text-[11px]" style="color: var(--text-secondary);">${this.escapeHtml(m.email)}</div>
        </td>
        <td class="py-3 px-3">
          <span class="sp-badge sp-badge-neutral">${this.escapeHtml(m.production_role)}</span>
        </td>
        <td class="py-3 px-3">
          <span class="sp-badge ${m.member_role === 'owner' || m.member_role === 'production_admin' ? 'sp-badge-amber' : 'sp-badge-blue'} font-mono">${this.escapeHtml(m.member_role)}</span>
        </td>
        <td class="py-3 px-3 text-right whitespace-nowrap">
          ${m.is_project_owner
            ? '<span class="font-mono text-[11px]" style="color: var(--text-muted);">Pemilik Proyek</span>'
            : `<button type="button" class="sp-btn sp-btn-danger-ghost sp-btn-compact" data-remove-member="${this.escapeHtml(m.project_id)}|${this.escapeHtml(m.user_id)}|${this.escapeHtml(m.email)}|${this.escapeHtml(m.project_code)}">Cabut Akses</button>`
          }
        </td>
      </tr>
    `).join('');
  },

  async openUpsertMemberModal() {
    if (this.state.accounts.length === 0 && this.hasPerm('accounts.read')) {
      const acc = await this.apiCall('accounts', { params: { limit: '100', offset: '0' } });
      this.state.accounts = acc.accounts || [];
    }
    const projSel = this.el('um-project');
    const userSel = this.el('um-user');
    if (projSel) {
      projSel.innerHTML = (this.state.membershipsData.projects || []).map((p) =>
        `<option value="${this.escapeHtml(p.id)}">${this.escapeHtml(p.code)} | ${this.escapeHtml(p.title)}</option>`
      ).join('');
    }
    if (userSel) {
      userSel.innerHTML = (this.state.accounts || []).map((a) =>
        `<option value="${this.escapeHtml(a.user_id)}">${this.escapeHtml(a.full_name)} (${this.escapeHtml(a.email)})</option>`
      ).join('');
    }
    this.el('um-reason').value = '';
    this.openOverlayElement(this.el('modal-upsert-member'));
  },

  // -----------------------------------------------------------
  // 5. SESSIONS & DEVICES
  // -----------------------------------------------------------
  async loadSessions() {
    const userSel = this.el('sess-filter-user');
    const targetUser = userSel ? userSel.value : '';
    if (this.hasPerm('accounts.read') && this.state.accounts.length === 0) {
      const acc = await this.apiCall('accounts', { params: { limit: '100', offset: '0' } });
      this.state.accounts = acc.accounts || [];
    }
    if (userSel && userSel.options.length <= 1 && this.hasPerm('sessions.read_all')) {
      userSel.innerHTML = '<option value="">Semua Akun Terjangkau</option>' + (this.state.accounts || []).map((a) =>
        `<option value="${this.escapeHtml(a.user_id)}">${this.escapeHtml(a.full_name)} (${this.escapeHtml(a.email)})</option>`
      ).join('');
      userSel.value = targetUser;
    }

    const data = await this.apiCall('sessions', { params: { user_id: targetUser, limit: '50', offset: '0' } });
    this.state.sessionsData = data;
    this.renderSessionsTable(targetUser);
  },

  renderSessionsTable(selectedUser) {
    const tbody = this.el('sess-tbody');
    const stateBox = this.el('sess-state-box');
    const revokeAllBtn = this.el('btn-sess-revoke-user');
    if (revokeAllBtn) {
      revokeAllBtn.classList.toggle('hidden', !(selectedUser && this.hasPerm('sessions.revoke_user_sessions')));
    }
    if (!tbody) return;

    const rows = this.state.sessionsData.sessions || [];
    if (rows.length === 0) {
      tbody.innerHTML = '';
      if (stateBox) {
        stateBox.textContent = 'Tidak ada sesi aktif tercatat di auth.sessions.';
        stateBox.classList.remove('hidden');
      }
      return;
    }
    if (stateBox) stateBox.classList.add('hidden');

    const myId = this.state.access ? this.state.access.user_id : '';
    tbody.innerHTML = rows.map((s) => {
      const canRevoke = s.is_current
        ? false
        : (s.user_id === myId ? this.hasPerm('sessions.revoke_own') : this.hasPerm('sessions.revoke_user_sessions'));
      return `
        <tr class="admin-table-row">
          <td class="py-3 px-3">
            <div class="font-sans text-xs font-bold" style="color: var(--text-primary);">${this.escapeHtml(s.full_name || s.email)}</div>
            <div class="font-mono text-[11px]" style="color: var(--text-secondary);">${this.escapeHtml(s.email)}</div>
          </td>
          <td class="py-3 px-3">
            <div class="font-sans text-xs font-semibold" style="color: var(--text-primary);">${this.escapeHtml(this.parseUa(s.user_agent))}</div>
            <div class="font-mono text-[11px]" style="color: var(--text-secondary);">${this.escapeHtml(s.ip_masked)} | ID ${this.escapeHtml(String(s.session_id).slice(0, 8))}</div>
          </td>
          <td class="py-3 px-3 font-mono text-[11px]" style="color: var(--text-secondary);">
            ${this.escapeHtml(this.formatDate(s.refreshed_at || s.updated_at || s.created_at))}
          </td>
          <td class="py-3 px-3">
            <span class="sp-badge ${s.is_current ? 'sp-badge-blue' : 'sp-badge-neutral'} font-mono">${s.is_current ? 'CURRENT' : this.escapeHtml(String(s.aal || 'aal1').toUpperCase())}</span>
          </td>
          <td class="py-3 px-3 text-right whitespace-nowrap">
            ${canRevoke
              ? `<button type="button" class="sp-btn sp-btn-danger-ghost sp-btn-compact" data-revoke-session="${this.escapeHtml(s.session_id)}">Cabut Sesi</button>`
              : '<span class="font-mono text-[11px]" style="color: var(--text-muted);">-</span>'
            }
          </td>
        </tr>
      `;
    }).join('');
  },

  async confirmRevokeSession(sessionId) {
    const res = await this.openConfirmDialog({
      title: 'Cabut sesi perangkat ini?',
      message: 'Sesi refresh di auth.sessions akan dihapus sehingga perangkat tidak dapat memperbarui token akses.',
      confirmLabel: 'Cabut Sesi',
      dangerous: true,
      requireReason: true
    });
    if (!res.confirmed) return;

    try {
      await this.apiCall('revoke_session', { method: 'POST', body: { session_id: sessionId, reason: res.reason } });
      this.showToast('Sesi berhasil dicabut');
      if (this.state.activeSection === 'sessions') await this.loadSessions();
      if (this.state.activeDetailUserId) await this.openAccountDetail(this.state.activeDetailUserId);
    } catch (err) {
      this.showToast(err.message);
    }
  },

  async confirmRevokeAllUserSessions(userId, label) {
    const res = await this.openConfirmDialog({
      title: `Cabut seluruh sesi ${label}?`,
      message: 'Semua sesi aktif untuk akun ini akan dihapus dari auth.sessions.',
      confirmLabel: 'Cabut Semua Sesi',
      dangerous: true,
      requireReason: true
    });
    if (!res.confirmed) return;

    try {
      await this.apiCall('revoke_user_sessions', { method: 'POST', body: { user_id: userId, reason: res.reason } });
      this.showToast('Seluruh sesi akun telah dicabut');
      if (this.state.activeSection === 'sessions') await this.loadSessions();
      if (this.state.activeDetailUserId) await this.openAccountDetail(this.state.activeDetailUserId);
    } catch (err) {
      this.showToast(err.message);
    }
  },

  // -----------------------------------------------------------
  // 6. INVITATIONS
  // -----------------------------------------------------------
  async loadInvitations() {
    const status = this.el('inv-filter-status') ? this.el('inv-filter-status').value : 'all';
    const data = await this.apiCall('invitations', { params: { status, limit: '50', offset: '0' } });
    this.state.invitationsData = data;
    this.renderInvitationsTable();
  },

  renderInvitationsTable() {
    const tbody = this.el('inv-tbody');
    const stateBox = this.el('inv-state-box');
    if (!tbody) return;
    const rows = this.state.invitationsData.invitations || [];
    if (rows.length === 0) {
      tbody.innerHTML = '';
      if (stateBox) {
        stateBox.textContent = 'Belum ada undangan untuk filter ini.';
        stateBox.classList.remove('hidden');
      }
      return;
    }
    if (stateBox) stateBox.classList.add('hidden');

    tbody.innerHTML = rows.map((inv) => {
      const st = inv.effective_status;
      const badgeClass = st === 'accepted'
        ? 'sp-badge-good'
        : (st === 'pending' ? 'sp-badge-blue' : (st === 'expired' ? 'sp-badge-amber' : 'sp-badge-red'));
      const canAct = st === 'pending' || st === 'expired' || st === 'revoked';
      return `
        <tr class="admin-table-row">
          <td class="py-3 px-3">
            <div class="font-mono text-xs font-bold" style="color: var(--text-primary);">${this.escapeHtml(inv.email)}</div>
            <div class="font-mono text-[11px]" style="color: var(--text-secondary);">Oleh ${this.escapeHtml(inv.invited_by_email || '-')}</div>
          </td>
          <td class="py-3 px-3">
            <div class="font-sans text-xs font-semibold" style="color: var(--text-primary);">${this.escapeHtml(inv.project_code)} | ${this.escapeHtml(inv.project_title)}</div>
            <div class="font-mono text-[11px]" style="color: var(--text-secondary);">${this.escapeHtml(inv.production_role)} (${this.escapeHtml(inv.member_role)}) | Sys: ${this.escapeHtml(inv.target_system_role)}</div>
          </td>
          <td class="py-3 px-3">
            <span class="sp-badge ${badgeClass}">${this.escapeHtml(st)}</span>
            <div class="font-mono text-[11px] mt-1" style="color: var(--text-muted);">Exp: ${this.escapeHtml(this.formatDate(inv.expires_at))}</div>
          </td>
          <td class="py-3 px-3 text-right whitespace-nowrap">
            ${st !== 'accepted' && canAct ? `
              <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact mr-1" data-inv-resend="${this.escapeHtml(inv.id)}">Kirim Ulang</button>
              ${st === 'pending' ? `<button type="button" class="sp-btn sp-btn-danger-ghost sp-btn-compact" data-inv-revoke="${this.escapeHtml(inv.id)}">Cabut</button>` : ''}
            ` : '<span class="font-mono text-[11px]" style="color: var(--text-muted);">Selesai</span>'}
          </td>
        </tr>
      `;
    }).join('');
  },

  openCreateInviteModal() {
    const projSel = this.el('ci-project');
    const projects = (this.state.access && this.state.access.managed_projects) || [];
    const isGlobal = this.state.access && ['system_owner', 'system_admin'].includes(this.state.access.system_role);

    if (projSel) {
      projSel.innerHTML = (isGlobal ? '<option value="">Tanpa Proyek Spesifik</option>' : '') + projects.map((p) =>
        `<option value="${this.escapeHtml(p.id)}">${this.escapeHtml(p.code)} | ${this.escapeHtml(p.title)}</option>`
      ).join('');
    }
    const sysSel = this.el('ci-sys-role');
    if (sysSel) {
      const myRole = this.state.access ? this.state.access.system_role : 'production_admin';
      sysSel.querySelectorAll('option').forEach((opt) => {
        if (opt.value === 'system_admin') opt.disabled = myRole !== 'system_owner';
        if (opt.value === 'production_admin') opt.disabled = !isGlobal;
      });
      sysSel.value = 'crew_member';
    }
    if (this.el('ci-token-box')) this.el('ci-token-box').classList.add('hidden');
    if (this.el('ci-email')) this.el('ci-email').value = '';
    if (this.el('ci-note')) this.el('ci-note').value = '';
    this.openOverlayElement(this.el('modal-create-invite'));
  },

  buildInviteUrl(token) {
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
    return `${origin}/index.html?invite=${encodeURIComponent(token)}`;
  },

  // -----------------------------------------------------------
  // 7. AUDIT LOGS
  // -----------------------------------------------------------
  async loadAuditLogs() {
    const search = this.el('audit-search') ? this.el('audit-search').value.trim() : '';
    const status = this.el('audit-filter-status') ? this.el('audit-filter-status').value : 'all';
    const targetType = this.el('audit-filter-target') ? this.el('audit-filter-target').value : 'all';
    const data = await this.apiCall('audit_logs', {
      params: {
        search,
        status,
        target_type: targetType,
        limit: String(this.state.auditData.limit),
        offset: String(this.state.auditData.offset)
      }
    });
    this.state.auditData = {
      ...this.state.auditData,
      total: Number(data.total || 0),
      logs: data.logs || []
    };
    this.renderAuditLogs();
  },

  renderAuditLogs() {
    const tbody = this.el('audit-tbody');
    const stateBox = this.el('audit-state-box');
    const pageInfo = this.el('audit-page-info');
    const prevBtn = this.el('audit-prev-btn');
    const nextBtn = this.el('audit-next-btn');
    if (!tbody) return;

    const rows = this.state.auditData.logs || [];
    if (rows.length === 0) {
      tbody.innerHTML = '';
      if (stateBox) {
        stateBox.textContent = 'Tidak ada entri audit log yang cocok dengan filter.';
        stateBox.classList.remove('hidden');
      }
    } else {
      if (stateBox) stateBox.classList.add('hidden');
      tbody.innerHTML = rows.map((row) => `
        <tr class="admin-table-row">
          <td class="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap" style="color: var(--text-secondary);">
            ${this.escapeHtml(this.formatDate(row.created_at))}
          </td>
          <td class="py-2.5 px-3">
            <div class="font-mono text-xs font-bold" style="color: var(--text-primary);">${this.escapeHtml(row.event_type)}</div>
            <div class="font-mono text-[11px]" style="color: var(--text-muted);">${this.escapeHtml(JSON.stringify(row.metadata || {}))}</div>
          </td>
          <td class="py-2.5 px-3">
            <div class="font-mono text-[11px]" style="color: var(--text-primary);">Aktor: ${this.escapeHtml(row.actor_email || row.actor_id || '-')}</div>
            <div class="font-mono text-[11px]" style="color: var(--text-secondary);">Target: ${this.escapeHtml(row.target_type || '-')} ${this.escapeHtml(row.target_email || row.target_id || '')}</div>
          </td>
          <td class="py-2.5 px-3">
            <span class="sp-badge ${row.status === 'success' ? 'sp-badge-good' : (row.status === 'blocked' ? 'sp-badge-amber' : 'sp-badge-red')}">${this.escapeHtml(row.status)}</span>
            ${row.reason ? `<div class="font-sans text-xs mt-1" style="color: var(--text-secondary);">${this.escapeHtml(row.reason)}</div>` : ''}
          </td>
        </tr>
      `).join('');
    }

    if (pageInfo) {
      const start = this.state.auditData.total === 0 ? 0 : this.state.auditData.offset + 1;
      const end = Math.min(this.state.auditData.total, this.state.auditData.offset + rows.length);
      pageInfo.textContent = `Menampilkan ${start}-${end} dari ${this.state.auditData.total} entri`;
    }
    if (prevBtn) prevBtn.disabled = this.state.auditData.offset <= 0;
    if (nextBtn) nextBtn.disabled = this.state.auditData.offset + this.state.auditData.limit >= this.state.auditData.total;
  },

  // -----------------------------------------------------------
  // 8. SECURITY SETTINGS & POSTURE
  // -----------------------------------------------------------
  async loadSecurity() {
    const [settingsRes, postureRes] = await Promise.all([
      this.apiCall('security_settings'),
      this.apiCall('security_posture')
    ]);
    this.state.securitySettings = settingsRes.settings;
    this.state.securityPosture = postureRes.posture;
    this.renderSecuritySection();
  },

  renderSecuritySection() {
    const s = this.state.securitySettings || {};
    const canManage = this.hasPerm('security.manage');

    if (this.el('sec-edit-badge')) {
      this.el('sec-edit-badge').textContent = canManage ? 'System Owner Editable' : 'Read-Only';
      this.el('sec-edit-badge').className = `sp-badge font-mono ${canManage ? 'sp-badge-blue' : 'sp-badge-neutral'}`;
    }

    const fields = ['sec-invite-hours', 'sec-min-pw', 'sec-idle-mins', 'sec-reauth-role', 'sec-self-signup', 'sec-reason', 'btn-save-security'];
    fields.forEach((id) => {
      const node = this.el(id);
      if (node) node.disabled = !canManage;
    });

    if (this.el('sec-invite-hours')) this.el('sec-invite-hours').value = String(s.invitation_expiry_hours ?? 72);
    if (this.el('sec-min-pw')) this.el('sec-min-pw').value = String(s.min_password_length ?? 12);
    if (this.el('sec-idle-mins')) this.el('sec-idle-mins').value = String(s.session_idle_minutes ?? 30);
    if (this.el('sec-reauth-role')) this.el('sec-reauth-role').checked = s.require_reauth_role_change !== false;
    if (this.el('sec-self-signup')) this.el('sec-self-signup').checked = s.allow_crew_self_signup !== false;
    if (this.el('sec-updated-meta')) {
      this.el('sec-updated-meta').textContent = s.updated_at
        ? `Diubah ${this.formatDate(s.updated_at)} oleh ${s.updated_by_email || 'System Owner'}`
        : 'Menggunakan nilai default kebijakan.';
    }

    const p = this.state.securityPosture || {};
    const box = this.el('sec-posture-box');
    if (box) {
      box.innerHTML = `
        <div class="sp-panel-muted p-3 flex flex-col gap-1">
          <div class="flex justify-between"><span>Runtime</span><span class="font-mono font-semibold">${this.escapeHtml(p.runtime || '-')} (${this.escapeHtml(p.vercel_env || '-')})</span></div>
          <div class="flex justify-between"><span>Service Key di Browser</span><span class="font-mono font-semibold" style="color: var(--good-text);">Tidak Pernah Diekspos</span></div>
          <div class="flex justify-between"><span>Supabase Config</span><span class="font-mono font-semibold">${p.supabase_configured ? 'Terpasang' : 'Belum Lengkap'}</span></div>
        </div>
        <div>
          <h3 class="font-sans text-xs font-bold mb-1.5" style="color: var(--text-primary);">Header Keamanan Aktif</h3>
          <ul class="m-0 pl-4 flex flex-col gap-1" style="color: var(--text-secondary);">
            ${(p.security_headers || []).map((h) => `<li class="font-mono text-[11px]">${this.escapeHtml(h)}</li>`).join('')}
          </ul>
        </div>
        <div>
          <h3 class="font-sans text-xs font-bold mb-1.5" style="color: var(--text-primary);">Pengaturan Manual Provider (Tidak Diubah dari Browser)</h3>
          <ul class="m-0 pl-4 flex flex-col gap-1" style="color: var(--text-secondary);">
            ${(p.provider_manual_items || []).map((m) => `<li class="font-sans text-[11px]">${this.escapeHtml(m)}</li>`).join('')}
          </ul>
        </div>
      `;
    }
  },

  // -----------------------------------------------------------
  // OVERLAYS, MODALS & CONFIRMATION WITH RE-AUTH
  // -----------------------------------------------------------
  openOverlayElement(el) {
    if (!el) return;
    this._lastFocusEl = document.activeElement;
    this.closeAllModals(true);
    const overlay = this.el('admin-overlay');
    if (overlay) overlay.classList.add('active');
    el.classList.add('open');
    const firstFocusable = el.querySelector('input:not([type="hidden"]), select, button, [tabindex="0"]');
    if (firstFocusable) firstFocusable.focus();
  },

  closeMobileDrawer() {
    const drawer = this.el('admin-mobile-drawer');
    const btn = this.el('btn-open-mobile-menu');
    if (drawer) drawer.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (!document.querySelector('.modal-dialog.open, .admin-detail-drawer.open')) {
      const overlay = this.el('admin-overlay');
      if (overlay) overlay.classList.remove('active');
    }
  },

  closeAllModals(keepFocus = false) {
    document.querySelectorAll('.modal-dialog.open, .admin-detail-drawer.open, .admin-mobile-drawer.open').forEach((n) => {
      n.classList.remove('open');
    });
    const overlay = this.el('admin-overlay');
    if (overlay) overlay.classList.remove('active');
    if (this.el('btn-open-mobile-menu')) {
      this.el('btn-open-mobile-menu').setAttribute('aria-expanded', 'false');
    }
    if (!keepFocus && this._lastFocusEl && typeof this._lastFocusEl.focus === 'function') {
      try { this._lastFocusEl.focus(); } catch (_e) {}
      this._lastFocusEl = null;
    }
  },

  openConfirmDialog({ title, message, confirmLabel = 'Konfirmasi', dangerous = false, requireReason = false, requireReauth = false }) {
    return new Promise((resolve) => {
      this._confirmResolver = resolve;
      const modal = this.el('admin-confirm-modal');
      this.el('ac-title').textContent = title;
      this.el('ac-message').textContent = message;
      const btn = this.el('ac-confirm-btn');
      btn.textContent = confirmLabel;
      btn.className = `sp-btn sp-btn-compact ${dangerous ? 'sp-btn-danger' : 'sp-btn-primary'}`;

      const reasonWrap = this.el('ac-reason-wrap');
      const reasonInput = this.el('ac-reason-input');
      reasonWrap.classList.toggle('hidden', !requireReason);
      reasonInput.value = '';

      const reauthWrap = this.el('ac-reauth-wrap');
      const reauthInput = this.el('ac-reauth-pw');
      reauthWrap.classList.toggle('hidden', !requireReauth);
      reauthInput.value = '';

      const errEl = this.el('ac-error');
      errEl.classList.add('hidden');
      errEl.textContent = '';

      this.openOverlayElement(modal);

      const cleanup = () => {
        btn.onclick = null;
        this.el('ac-cancel-btn').onclick = null;
        this.el('ac-cancel-x').onclick = null;
      };

      const cancel = () => {
        cleanup();
        this.closeAllModals();
        resolve({ confirmed: false, reason: '' });
      };

      this.el('ac-cancel-btn').onclick = cancel;
      this.el('ac-cancel-x').onclick = cancel;

      btn.onclick = async () => {
        errEl.classList.add('hidden');
        const reason = reasonInput.value.trim();
        if (requireReason && reason.length < 3) {
          errEl.textContent = 'Alasan wajib diisi minimal 3 karakter untuk Audit Log.';
          errEl.classList.remove('hidden');
          reasonInput.focus();
          return;
        }
        if (requireReauth) {
          const pw = reauthInput.value;
          if (!pw) {
            errEl.textContent = 'Masukkan kata sandi Anda untuk verifikasi ulang.';
            errEl.classList.remove('hidden');
            reauthInput.focus();
            return;
          }
          btn.disabled = true;
          try {
            const email = this.state.user && this.state.user.email;
            const { error } = await this.supabase.auth.signInWithPassword({ email, password: pw });
            if (error) {
              errEl.textContent = 'Verifikasi kata sandi gagal. Tindakan dibatalkan.';
              errEl.classList.remove('hidden');
              btn.disabled = false;
              return;
            }
          } catch (_e) {
            errEl.textContent = 'Gagal memverifikasi kata sandi.';
            errEl.classList.remove('hidden');
            btn.disabled = false;
            return;
          }
          btn.disabled = false;
        }
        cleanup();
        this.closeAllModals();
        resolve({ confirmed: true, reason });
      };
    });
  },

  // -----------------------------------------------------------
  // EVENT BINDINGS
  // -----------------------------------------------------------
  bindEvents() {
    if (this.el('gate-theme-btn')) this.el('gate-theme-btn').addEventListener('click', () => this.toggleTheme());
    if (this.el('btn-admin-theme')) this.el('btn-admin-theme').addEventListener('click', () => this.toggleTheme());

    if (this.el('gate-toggle-pw') && this.el('gate-password')) {
      this.el('gate-toggle-pw').addEventListener('click', () => {
        const inp = this.el('gate-password');
        const showing = inp.type === 'text';
        inp.type = showing ? 'password' : 'text';
        this.el('gate-toggle-pw').setAttribute('aria-pressed', String(!showing));
      });
    }

    if (this.el('admin-gate-form')) {
      this.el('admin-gate-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fb = this.el('gate-auth-feedback');
        fb.classList.add('hidden');
        const email = this.el('gate-email').value.trim();
        const password = this.el('gate-password').value;
        if (!email || !password) {
          fb.textContent = 'Masukkan email akun dan kata sandi.';
          fb.className = 'mb-4 p-3 rounded border text-xs font-medium sp-auth-alert-error';
          return;
        }
        if (!this.supabase) {
          fb.textContent = 'Klien Supabase belum siap. Periksa konfigurasi environment.';
          fb.className = 'mb-4 p-3 rounded border text-xs font-medium sp-auth-alert-error';
          return;
        }
        const btn = this.el('gate-submit-btn');
        btn.disabled = true;
        try {
          const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
          if (error || !data || !data.session) {
            fb.textContent = 'Email atau kata sandi tidak cocok.';
            fb.className = 'mb-4 p-3 rounded border text-xs font-medium sp-auth-alert-error';
            return;
          }
          this.el('gate-password').value = '';
          this.state.session = data.session;
          this.state.user = data.session.user;
          await this.bootstrapConsole();
        } finally {
          btn.disabled = false;
        }
      });
    }

    const handleLogout = async () => {
      if (this.supabase) {
        await this.supabase.auth.signOut({ scope: 'local' });
      }
      this.state.session = null;
      this.state.user = null;
      this.state.access = null;
      this.showView('gate');
    };
    if (this.el('btn-admin-logout')) this.el('btn-admin-logout').addEventListener('click', handleLogout);
    if (this.el('denied-logout-btn')) this.el('denied-logout-btn').addEventListener('click', handleLogout);
    if (this.el('denied-retry-btn')) this.el('denied-retry-btn').addEventListener('click', () => this.bootstrapConsole());

    if (this.el('btn-toggle-sidebar') && this.el('admin-sidebar')) {
      this.el('btn-toggle-sidebar').addEventListener('click', () => {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
        this.el('admin-sidebar').classList.toggle('is-collapsed', this.state.sidebarCollapsed);
        this.el('btn-toggle-sidebar').setAttribute('aria-expanded', String(!this.state.sidebarCollapsed));
      });
    }

    if (this.el('btn-open-mobile-menu')) {
      this.el('btn-open-mobile-menu').addEventListener('click', () => {
        this.openOverlayElement(this.el('admin-mobile-drawer'));
        this.el('btn-open-mobile-menu').setAttribute('aria-expanded', 'true');
      });
    }
    if (this.el('btn-close-mobile-menu')) {
      this.el('btn-close-mobile-menu').addEventListener('click', () => this.closeAllModals());
    }

    document.querySelectorAll('[data-section]').forEach((btn) => {
      btn.addEventListener('click', () => this.selectSection(btn.getAttribute('data-section')));
    });
    document.querySelectorAll('[data-jump-section]').forEach((btn) => {
      btn.addEventListener('click', () => this.selectSection(btn.getAttribute('data-jump-section')));
    });

    if (this.el('btn-admin-refresh')) {
      this.el('btn-admin-refresh').addEventListener('click', () => this.selectSection(this.state.activeSection));
    }
    if (this.el('btn-banner-retry')) {
      this.el('btn-banner-retry').addEventListener('click', () => this.selectSection(this.state.activeSection));
    }

    // Accounts filter & pagination
    if (this.el('btn-acc-apply-filter')) {
      this.el('btn-acc-apply-filter').addEventListener('click', () => {
        this.state.accountsOffset = 0;
        this.loadAccounts().catch((e) => this.setGlobalBanner(e.message));
      });
    }
    if (this.el('acc-prev-btn')) {
      this.el('acc-prev-btn').addEventListener('click', () => {
        this.state.accountsOffset = Math.max(0, this.state.accountsOffset - this.state.accountsLimit);
        this.loadAccounts().catch((e) => this.setGlobalBanner(e.message));
      });
    }
    if (this.el('acc-next-btn')) {
      this.el('acc-next-btn').addEventListener('click', () => {
        this.state.accountsOffset += this.state.accountsLimit;
        this.loadAccounts().catch((e) => this.setGlobalBanner(e.message));
      });
    }
    if (this.el('btn-accounts-invite')) {
      this.el('btn-accounts-invite').addEventListener('click', () => this.openCreateInviteModal());
    }

    // Roles assign
    if (this.el('role-target-user')) this.el('role-target-user').addEventListener('change', () => this.updateRoleImpactPreview());
    if (this.el('role-target-value')) this.el('role-target-value').addEventListener('change', () => this.updateRoleImpactPreview());
    if (this.el('form-assign-role')) {
      this.el('form-assign-role').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const userId = this.el('role-target-user').value;
        const role = this.el('role-target-value').value;
        const reason = this.el('role-change-reason').value.trim();
        if (!userId || !reason) {
          this.showToast('Pilih akun dan masukkan alasan perubahan role');
          return;
        }
        const conf = await this.openConfirmDialog({
          title: `Ubah System Role menjadi ${role}?`,
          message: 'Perubahan hak akses sistem langsung berlaku untuk akun target dan tercatat ke Audit Log.',
          confirmLabel: 'Terapkan Role',
          dangerous: role === 'system_owner' || role === 'system_admin',
          requireReauth: true
        });
        if (!conf.confirmed) return;

        try {
          await this.apiCall('assign_system_role', {
            method: 'POST',
            body: { user_id: userId, system_role: role, reason }
          });
          this.el('role-change-reason').value = '';
          this.showToast('System Role berhasil diperbarui');
          await this.loadRoles();
        } catch (err) {
          this.showToast(err.message);
        }
      });
    }

    // Projects / Memberships
    if (this.el('btn-proj-filter')) {
      this.el('btn-proj-filter').addEventListener('click', () => this.loadMemberships().catch((e) => this.setGlobalBanner(e.message)));
    }
    if (this.el('btn-open-add-membership')) {
      this.el('btn-open-add-membership').addEventListener('click', () => this.openUpsertMemberModal());
    }
    if (this.el('form-upsert-member')) {
      this.el('form-upsert-member').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        try {
          await this.apiCall('upsert_membership', {
            method: 'POST',
            body: {
              project_id: this.el('um-project').value,
              user_id: this.el('um-user').value,
              member_role: this.el('um-member-role').value,
              production_role: this.el('um-prod-role').value.trim(),
              reason: this.el('um-reason').value.trim()
            }
          });
          this.closeAllModals();
          this.showToast('Keanggotaan proyek disimpan');
          await this.loadMemberships();
        } catch (err) {
          this.showToast(err.message);
        }
      });
    }

    // Edit Profile Submit
    if (this.el('form-edit-profile')) {
      this.el('form-edit-profile').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const userId = this.el('ep-user-id').value;
        try {
          await this.apiCall('update_account_profile', {
            method: 'POST',
            body: {
              user_id: userId,
              full_name: this.el('ep-full-name').value.trim(),
              role_title: this.el('ep-role-title').value.trim(),
              id_badge: this.el('ep-id-badge').value.trim(),
              studio: this.el('ep-studio').value.trim(),
              granted_roles: {
                scriptSupervisor: this.el('ep-gr-script').checked,
                videoEditor: this.el('ep-gr-editor').checked,
                soundRecordist: this.el('ep-gr-sound').checked,
                directorProducer: this.el('ep-gr-director').checked,
                autoExportMeta: true
              },
              reason: this.el('ep-reason').value.trim()
            }
          });
          this.closeAllModals();
          this.showToast('Profil akun diperbarui');
          await this.loadAccounts();
          await this.openAccountDetail(userId);
        } catch (err) {
          this.showToast(err.message);
        }
      });
    }

    // Sessions
    if (this.el('btn-sessions-reload')) {
      this.el('btn-sessions-reload').addEventListener('click', () => this.loadSessions().catch((e) => this.setGlobalBanner(e.message)));
    }
    if (this.el('sess-filter-user')) {
      this.el('sess-filter-user').addEventListener('change', () => this.loadSessions().catch((e) => this.setGlobalBanner(e.message)));
    }
    if (this.el('btn-sess-revoke-user')) {
      this.el('btn-sess-revoke-user').addEventListener('click', () => {
        const uid = this.el('sess-filter-user').value;
        if (uid) this.confirmRevokeAllUserSessions(uid, uid);
      });
    }

    // Invitations
    if (this.el('btn-inv-reload')) {
      this.el('btn-inv-reload').addEventListener('click', () => this.loadInvitations().catch((e) => this.setGlobalBanner(e.message)));
    }
    if (this.el('inv-filter-status')) {
      this.el('inv-filter-status').addEventListener('change', () => this.loadInvitations().catch((e) => this.setGlobalBanner(e.message)));
    }
    if (this.el('btn-open-create-invite')) {
      this.el('btn-open-create-invite').addEventListener('click', () => this.openCreateInviteModal());
    }
    if (this.el('form-create-invite')) {
      this.el('form-create-invite').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        try {
          const res = await this.apiCall('create_invitation', {
            method: 'POST',
            body: {
              email: this.el('ci-email').value.trim(),
              project_id: this.el('ci-project').value,
              production_role: this.el('ci-prod-role').value.trim(),
              member_role: this.el('ci-member-role').value,
              target_system_role: this.el('ci-sys-role').value,
              expiry_hours: Number(this.el('ci-expiry').value || 72),
              note: this.el('ci-note').value.trim()
            }
          });
          const token = res.invitation && res.invitation.one_time_token;
          if (token && this.el('ci-token-box') && this.el('ci-token-url')) {
            this.el('ci-token-url').value = this.buildInviteUrl(token);
            this.el('ci-token-box').classList.remove('hidden');
          }
          this.showToast('Undangan berhasil dibuat');
          if (this.state.activeSection === 'invitations') await this.loadInvitations();
        } catch (err) {
          this.showToast(err.message);
        }
      });
    }
    if (this.el('btn-copy-invite-url')) {
      this.el('btn-copy-invite-url').addEventListener('click', async () => {
        const val = this.el('ci-token-url').value;
        if (val && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(val);
          this.showToast('Tautan undangan disalin');
        }
      });
    }

    // Audit Logs
    if (this.el('btn-audit-apply')) {
      this.el('btn-audit-apply').addEventListener('click', () => {
        this.state.auditData.offset = 0;
        this.loadAuditLogs().catch((e) => this.setGlobalBanner(e.message));
      });
    }
    if (this.el('audit-prev-btn')) {
      this.el('audit-prev-btn').addEventListener('click', () => {
        this.state.auditData.offset = Math.max(0, this.state.auditData.offset - this.state.auditData.limit);
        this.loadAuditLogs().catch((e) => this.setGlobalBanner(e.message));
      });
    }
    if (this.el('audit-next-btn')) {
      this.el('audit-next-btn').addEventListener('click', () => {
        this.state.auditData.offset += this.state.auditData.limit;
        this.loadAuditLogs().catch((e) => this.setGlobalBanner(e.message));
      });
    }

    // Security Settings
    if (this.el('form-security-settings')) {
      this.el('form-security-settings').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (!this.hasPerm('security.manage')) return;
        const conf = await this.openConfirmDialog({
          title: 'Simpan perubahan kebijakan keamanan?',
          message: 'Kebijakan ini mengatur panjang kata sandi minimum, masa berlaku undangan, dan idle timeout sesi.',
          confirmLabel: 'Simpan Kebijakan',
          dangerous: true,
          requireReauth: true
        });
        if (!conf.confirmed) return;

        try {
          const res = await this.apiCall('update_security_settings', {
            method: 'POST',
            body: {
              invitation_expiry_hours: Number(this.el('sec-invite-hours').value),
              min_password_length: Number(this.el('sec-min-pw').value),
              session_idle_minutes: Number(this.el('sec-idle-mins').value),
              require_reauth_role_change: this.el('sec-reauth-role').checked,
              allow_crew_self_signup: this.el('sec-self-signup').checked,
              reason: this.el('sec-reason').value.trim()
            }
          });
          this.state.securitySettings = res.settings;
          this.renderSecuritySection();
          this.showToast('Kebijakan keamanan disimpan');
        } catch (err) {
          this.showToast(err.message);
        }
      });
    }

    // Delegated table clicks & overlay/escape close
    document.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-close-admin-modal]')) {
        this.closeAllModals();
        return;
      }

      const openAccBtn = ev.target.closest('[data-open-account]');
      if (openAccBtn) {
        this.openAccountDetail(openAccBtn.getAttribute('data-open-account'));
        return;
      }

      const removeMemBtn = ev.target.closest('[data-remove-member]');
      if (removeMemBtn) {
        const [projectId, userId, email, code] = removeMemBtn.getAttribute('data-remove-member').split('|');
        const conf = await this.openConfirmDialog({
          title: `Cabut akses ${email} dari ${code}?`,
          message: 'Pengguna tidak lagi dapat mengakses naskah atau take proyek ini. Data proyek dan rekaman take tetap dipertahankan.',
          confirmLabel: 'Cabut Keanggotaan',
          dangerous: true,
          requireReason: true
        });
        if (!conf.confirmed) return;
        try {
          await this.apiCall('remove_membership', {
            method: 'POST',
            body: { project_id: projectId, user_id: userId, reason: conf.reason }
          });
          this.showToast('Keanggotaan proyek dicabut');
          await this.loadMemberships();
        } catch (err) {
          this.showToast(err.message);
        }
        return;
      }

      const revSessBtn = ev.target.closest('[data-revoke-session]');
      if (revSessBtn && !revSessBtn.closest('#drawer-account-detail')) {
        this.confirmRevokeSession(revSessBtn.getAttribute('data-revoke-session'));
        return;
      }

      const invResendBtn = ev.target.closest('[data-inv-resend]');
      if (invResendBtn) {
        const invId = invResendBtn.getAttribute('data-inv-resend');
        try {
          const res = await this.apiCall('manage_invitation', {
            method: 'POST',
            body: { invitation_id: invId, action: 'resend', reason: 'Kirim ulang undangan' }
          });
          const tok = res.invitation && res.invitation.one_time_token;
          if (tok) {
            this.openOverlayElement(this.el('modal-create-invite'));
            this.el('ci-token-url').value = this.buildInviteUrl(tok);
            this.el('ci-token-box').classList.remove('hidden');
          }
          this.showToast('Token undangan diperbarui');
          await this.loadInvitations();
        } catch (err) {
          this.showToast(err.message);
        }
        return;
      }

      const invRevokeBtn = ev.target.closest('[data-inv-revoke]');
      if (invRevokeBtn) {
        const invId = invRevokeBtn.getAttribute('data-inv-revoke');
        const conf = await this.openConfirmDialog({
          title: 'Cabut undangan ini?',
          message: 'Token undangan akan dibatalkan sehingga tidak dapat digunakan lagi.',
          confirmLabel: 'Cabut Undangan',
          dangerous: true,
          requireReason: true
        });
        if (!conf.confirmed) return;
        try {
          await this.apiCall('manage_invitation', {
            method: 'POST',
            body: { invitation_id: invId, action: 'revoke', reason: conf.reason }
          });
          this.showToast('Undangan dicabut');
          await this.loadInvitations();
        } catch (err) {
          this.showToast(err.message);
        }
      }
    });

    if (this.el('admin-overlay')) {
      this.el('admin-overlay').addEventListener('click', () => this.closeAllModals());
    }
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') this.closeAllModals();
    });
  }
};

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => StoryPadAdmin.init());
  } else {
    StoryPadAdmin.init();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StoryPadAdmin;
}
