/**
 * Security & Authentication Verification Suite for StoryPad Phase P0
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== STARTING STORYPAD P0 AUTH & SECURITY TESTS ===\n');

const elements = {};
function getOrCreateElement(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      type: 'password',
      textContent: '',
      innerHTML: '',
      value: '',
      checked: false,
      disabled: false,
      style: {},
      classList: {
        _classes: new Set(),
        add(...cs) { cs.forEach(c => this._classes.add(c)); },
        remove(...cs) { cs.forEach(c => this._classes.delete(c)); },
        toggle(c, force) {
          if (force === undefined) {
            if (this._classes.has(c)) this._classes.delete(c);
            else this._classes.add(c);
          } else if (force) this._classes.add(c);
          else this._classes.delete(c);
        },
        contains(c) { return this._classes.has(c); }
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => {},
      closest: () => null,
      focus: () => {},
      setAttribute(k, v) { this['_' + k] = v; },
      getAttribute(k) { return this['_' + k] || null; },
      removeAttribute(k) { delete this['_' + k]; },
      pause: () => {},
      play: async () => {}
    };
  }
  return elements[id];
}

global.window = {
  location: { origin: 'https://storypad-nu.vercel.app', pathname: '/' },
  localStorage: {
    _data: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  }
};

global.document = {
  getElementById: (id) => getOrCreateElement(id),
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {},
  documentElement: { setAttribute: () => {}, getAttribute: () => 'daylight' },
  body: { setAttribute: () => {}, appendChild: () => {}, removeChild: () => {} },
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild: () => {}, focus: () => {}, select: () => {} })
};

global.navigator = {
  clipboard: { writeText: async (t) => t },
  vibrate: () => true
};

// Pre-seed tampered localStorage role & user keys to prove they are ignored and cleared
window.localStorage.setItem('storypad_roles', JSON.stringify({ directorProducer: true }));
window.localStorage.setItem('storypad_user', JSON.stringify({ name: 'Attacker', email: 'evil@test.local' }));

const StoryPad = require('./app.js');

async function runSecurityTests() {
  StoryPad.init();

  // 1. Tampered localStorage identity/role keys must be wiped on init
  assert.strictEqual(window.localStorage.getItem('storypad_roles'), null, 'storypad_roles must be removed from localStorage');
  assert.strictEqual(window.localStorage.getItem('storypad_user'), null, 'storypad_user must be removed from localStorage');
  assert.strictEqual(StoryPad.isAuthenticated(), false, 'Must not be authenticated without valid Supabase session');
  console.log('1. [PASS] Tampered localStorage identity/roles stripped and ignored');

  // 2. Auth gate blocks all protected screens when unauthenticated
  ['dashboard', 'projects', 'script-reader', 'profile'].forEach(screen => {
    const res = StoryPad.navigate(screen);
    assert.strictEqual(res, false, `navigate(${screen}) must be rejected while unauthenticated`);
    assert.strictEqual(StoryPad.state.currentScreen, 'login');
  });
  assert.strictEqual(StoryPad.loginAs('scriptSupervisor'), false, 'Passwordless loginAs bypass must be disabled');
  assert.strictEqual(typeof StoryPad.loginQuickSession, 'undefined', 'loginQuickSession bypass must be removed');
  console.log('2. [PASS] Unauthenticated navigation & passwordless login bypasses blocked');

  // 3. Remembered Accounts store never saves passwords, tokens, or roles
  const remembered = StoryPad.rememberAccountFromUser({
    id: '11111111-1111-1111-1111-111111111111',
    email: 'KruA@StoryPad.id',
    user_metadata: {
      full_name: 'Kru A',
      password: 'secret-password',
      access_token: 'jwt-access-token',
      refresh_token: 'jwt-refresh-token',
      roles: { directorProducer: true }
    }
  });
  assert.ok(remembered);
  const rawStored = window.localStorage.getItem(StoryPad.REMEMBERED_STORAGE_KEY);
  assert.ok(rawStored, 'Remembered account metadata must be saved locally');
  assert.ok(!rawStored.includes('secret-password'), 'Password must never be stored in remembered accounts');
  assert.ok(!rawStored.includes('jwt-access-token'), 'Access token must never be stored in remembered accounts');
  assert.ok(!rawStored.includes('jwt-refresh-token'), 'Refresh token must never be stored in remembered accounts');
  assert.ok(!rawStored.includes('directorProducer'), 'Roles/permissions must never be stored in remembered accounts');
  assert.deepStrictEqual(Object.keys(JSON.parse(rawStored)[0]).sort(), ['display_name', 'email', 'id', 'initials', 'last_used_at']);
  console.log('3. [PASS] Remembered account metadata strictly sanitized (zero passwords/tokens/roles)');

  // 4. Selecting remembered account opens password prompt and NEVER opens dashboard
  const selectedOk = StoryPad.selectRememberedAccount('11111111-1111-1111-1111-111111111111');
  assert.strictEqual(selectedOk, true);
  assert.strictEqual(StoryPad.state.authView, 'selected');
  assert.strictEqual(StoryPad.state.currentScreen, 'login', 'Selecting remembered account must stay on login screen');
  assert.strictEqual(StoryPad.isAuthenticated(), false);

  // Removing remembered account deletes only locally without deleting any server state
  const removedOk = await StoryPad.removeRememberedAccount('11111111-1111-1111-1111-111111111111', false);
  assert.strictEqual(removedOk, true);
  assert.strictEqual(StoryPad.state.rememberedAccounts.length, 0);
  console.log('4. [PASS] Selecting remembered account requires password; local removal works cleanly');

  // 5. Password policy enforces 12..128 chars
  assert.notStrictEqual(StoryPad.validateNewPassword('short11char'), '', 'Passwords < 12 chars must be rejected');
  assert.strictEqual(StoryPad.validateNewPassword('kata sandi panjang produksi'), '', 'Passphrase >= 12 chars must be accepted');
  assert.notStrictEqual(StoryPad.validateNewPassword('a'.repeat(129)), '', 'Passwords > 128 chars must be rejected');
  console.log('5. [PASS] Password policy enforces 12-128 characters (passphrase supported)');

  // 6. External media URL validation blocks http, javascript, data, localhost, and private IPs
  assert.strictEqual(StoryPad.isSafeExternalMediaUrl('https://cdn.example.com/clip.mp4'), true);
  assert.strictEqual(StoryPad.isSafeExternalMediaUrl('http://cdn.example.com/clip.mp4'), false);
  assert.strictEqual(StoryPad.isSafeExternalMediaUrl('javascript:alert(1)'), false);
  assert.strictEqual(StoryPad.isSafeExternalMediaUrl('https://localhost/clip.mp4'), false);
  assert.strictEqual(StoryPad.isSafeExternalMediaUrl('https://127.0.0.1/clip.mp4'), false);
  assert.strictEqual(StoryPad.isSafeExternalMediaUrl('https://169.254.169.254/latest'), false);
  assert.strictEqual(StoryPad.isSafeExternalMediaUrl('https://10.0.0.5/clip.mp4'), false);
  console.log('6. [PASS] External media URL validator enforces HTTPS and blocks SSRF/XSS protocols');

  // 7. Role Switcher refuses toggling ungranted roles
  StoryPad.state.grantedRoles = {
    scriptSupervisor: true,
    videoEditor: false,
    soundRecordist: false,
    directorProducer: false,
    autoExportMeta: true
  };
  StoryPad.state.roles = { ...StoryPad.state.grantedRoles };
  const escalated = await StoryPad.toggleRole('directorProducer', null);
  assert.strictEqual(escalated, false, 'Ungranted role toggle must be rejected');
  assert.strictEqual(StoryPad.state.roles.directorProducer, false);
  const allowedToggle = await StoryPad.toggleRole('scriptSupervisor', null);
  assert.strictEqual(allowedToggle, true, 'Granted role toggle must succeed');
  assert.strictEqual(StoryPad.state.roles.scriptSupervisor, false);
  console.log('7. [PASS] Role Switcher enforces grantedRoles and blocks privilege escalation');

  // 8. Zero em dash (U+2014) across all modified and new files
  const filesToCheck = [
    'app.js',
    'app.css',
    'index.html',
    'index.php',
    'admin-login.php',
    'admin.php',
    'config/supabase.php',
    'includes/session.php',
    'lib/SupabaseClient.php',
    'api/session.php',
    'api/supabase.php',
    'api/media.php',
    'api/script-import.php',
    'api/admin.php',
    'views/screens/login.php',
    'views/screens/profile.php',
    'views/partials/modals.php',
    'supabase/migrations/20261126000001_p0_ownership_strict_rls_and_role_protection.sql',
    'supabase/verify_p0_rls.sql',
    'supabase/migrations/20261126000002_p1_sessions_audit_and_identity_rpcs.sql',
    'supabase/verify_p1_sessions_audit.sql',
    'test_auth_security.js'
  ];
  filesToCheck.forEach(rel => {
    const content = fs.readFileSync(path.join(__dirname, rel), 'utf8');
    assert.ok(!content.includes('\u2014'), `Forbidden em dash found in ${rel}`);
  });
  console.log(`8. [PASS] Zero em dashes verified across ${filesToCheck.length} files`);

  // 9. P1: UA parser & audit metadata sanitizer strip sensitive credentials
  assert.strictEqual(StoryPad.parseUserAgentSummary('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0'), 'Chrome di Windows');
  assert.strictEqual(StoryPad.parseUserAgentSummary('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1'), 'Safari di iOS');
  const sanitizedMeta = StoryPad.sanitizeAuditMetadata({
    method: 'password',
    password: 'do-not-log',
    access_token: 'secret-jwt',
    refresh_token: 'secret-ref',
    authorization: 'Bearer xyz',
    safe_flag: true
  });
  assert.strictEqual(sanitizedMeta.method, 'password');
  assert.strictEqual(sanitizedMeta.safe_flag, true);
  assert.strictEqual('password' in sanitizedMeta, false);
  assert.strictEqual('access_token' in sanitizedMeta, false);
  assert.strictEqual('refresh_token' in sanitizedMeta, false);
  assert.strictEqual('authorization' in sanitizedMeta, false);
  console.log('9. [PASS] UA summary parser & audit metadata sanitizer strip sensitive keys');

  // 10. P1: Clear all remembered accounts + Profile P1 DOM parity check
  const profilePhp = fs.readFileSync(path.join(__dirname, 'views/screens/profile.php'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  ['profile-account-management', 'profile-change-password-card', 'profile-session-manager', 'profile-linked-identities', 'profile-audit-log'].forEach(domId => {
    assert.ok(profilePhp.includes(`id="${domId}"`), `views/screens/profile.php missing #${domId}`);
    assert.ok(indexHtml.includes(`id="${domId}"`), `index.html missing #${domId}`);
  });

  const origConfirm = StoryPad.openConfirmDialog;
  StoryPad.openConfirmDialog = async () => true;
  StoryPad.saveRememberedAccountsList([
    { id: '11111111-1111-4111-8111-111111111111', display_name: 'Kru A', email: 'a@studio.test', initials: 'KA' },
    { id: '22222222-2222-4222-8222-222222222222', display_name: 'Kru B', email: 'b@studio.test', initials: 'KB' }
  ]);
  const clearedAll = await StoryPad.clearAllRememberedAccounts();
  assert.strictEqual(clearedAll, true);
  assert.strictEqual(StoryPad.state.rememberedAccounts.length, 0);
  console.log('10. [PASS] Clear all remembered accounts & Profile P1 markup parity verified');

  // 11. P1: Server-confirmed SessionManager (revokeSession & logoutOtherSessions)
  const rpcCalls = [];
  const signOutCalls = [];
  const auditInserts = [];
  let mockedRevokeShouldFail = false;

  StoryPad.state.supabaseUser = { id: '11111111-1111-4111-8111-111111111111', email: 'kru@studio.test' };
  StoryPad.state.supabaseSession = { access_token: 'mock-jwt', user: StoryPad.state.supabaseUser };
  StoryPad.supabase = {
    rpc: async (fn, params) => {
      rpcCalls.push({ fn, params });
      if (fn === 'get_my_sessions') {
        return {
          data: [
            { session_id: 'aaaa-1111', user_agent: 'Chrome/131 Windows NT 10.0', ip_masked: '203.0.113.xxx', aal: 'aal1', is_current: true, created_at: new Date().toISOString() },
            { session_id: 'bbbb-2222', user_agent: 'Safari/604.1 iPhone', ip_masked: '198.51.100.xxx', aal: 'aal1', is_current: false, created_at: new Date().toISOString() }
          ],
          error: null
        };
      }
      if (fn === 'revoke_my_session') {
        if (mockedRevokeShouldFail) return { data: false, error: { message: 'server denied' } };
        return { data: true, error: null };
      }
      if (fn === 'log_security_event') {
        auditInserts.push(params);
        return { data: 'log-uuid', error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({
            data: [{ id: 'log-1', event_type: 'session_revoked', status: 'success', metadata: { revoked_session_id: 'bbbb-222' }, created_at: new Date().toISOString() }],
            error: null
          })
        })
      })
    }),
    auth: {
      signOut: async opts => {
        signOutCalls.push(opts);
        return { error: null };
      },
      signInWithPassword: async ({ password }) => {
        if (password !== 'current-valid-passphrase') {
          return { data: null, error: { message: 'Invalid login credentials' } };
        }
        return { data: { session: StoryPad.state.supabaseSession, user: StoryPad.state.supabaseUser }, error: null };
      },
      updateUser: async () => ({ data: { user: StoryPad.state.supabaseUser }, error: null }),
      getUserIdentities: async () => ({
        data: { identities: StoryPad.state.linkedIdentities },
        error: null
      }),
      linkIdentity: async ({ provider }) => ({
        data: null,
        error: { message: `identity_already_exists for ${provider}` }
      }),
      unlinkIdentity: async () => ({ data: {}, error: null })
    }
  };

  await StoryPad.loadActiveSessions();
  assert.strictEqual(StoryPad.state.sessions.length, 2);
  // Refuse revoking current session via revokeSession
  assert.strictEqual(await StoryPad.revokeSession('aaaa-1111'), false);
  // When server refuses revoke, secondary session must remain
  mockedRevokeShouldFail = true;
  assert.strictEqual(await StoryPad.revokeSession('bbbb-2222'), false);
  assert.strictEqual(StoryPad.state.sessions.length, 2, 'UI must not pretend session was revoked on failure');
  // When server confirms revoke, secondary session is removed
  mockedRevokeShouldFail = false;
  assert.strictEqual(await StoryPad.revokeSession('bbbb-2222'), true);
  assert.strictEqual(StoryPad.state.sessions.length, 1);
  // Logout other sessions calls signOut({ scope: 'others' })
  assert.strictEqual(await StoryPad.logoutOtherSessions(), true);
  assert.ok(signOutCalls.some(c => c && c.scope === 'others'));
  console.log('11. [PASS] Server-confirmed SessionManager blocks unconfirmed revokes & supports global signOut(others)');

  // 12. P1: LinkedIdentities enforces min-1 identity & blocks conflict auto-merge
  StoryPad.state.linkedIdentities = [{ id: 'id-email-1', identity_id: 'id-email-1', provider: 'email', identity_data: { email: 'kru@studio.test' } }];
  assert.strictEqual(await StoryPad.unlinkUserIdentity('id-email-1'), false, 'Single remaining identity cannot be unlinked');
  assert.strictEqual(await StoryPad.linkAdditionalIdentity('google'), false, 'Conflicting external identity must return false cleanly');
  assert.ok(auditInserts.some(a => a.p_event_type === 'identity_link_conflict' && a.p_status === 'blocked'));
  StoryPad.state.linkedIdentities = [
    { id: 'id-email-1', identity_id: 'id-email-1', provider: 'email', identity_data: { email: 'kru@studio.test' } },
    { id: 'id-google-2', identity_id: 'id-google-2', provider: 'google', identity_data: { email: 'kru@studio.test' } }
  ];
  assert.strictEqual(await StoryPad.unlinkUserIdentity('id-google-2'), true, 'Secondary identity can be unlinked when another remains');
  console.log('12. [PASS] LinkedIdentities preserves min-1 auth method & handles identity conflicts cleanly');

  // 13. P1: Change Password requires valid current password re-authentication before updateUser
  document.getElementById('profile-pw-current').value = 'wrong-current-passphrase';
  document.getElementById('profile-pw-next').value = 'new-strong-passphrase-123';
  document.getElementById('profile-pw-confirm').value = 'new-strong-passphrase-123';
  assert.strictEqual(await StoryPad.submitChangePassword(), false, 'Wrong current password must abort password change');

  document.getElementById('profile-pw-current').value = 'current-valid-passphrase';
  document.getElementById('profile-pw-next').value = 'new-strong-passphrase-123';
  document.getElementById('profile-pw-confirm').value = 'new-strong-passphrase-123';
  assert.strictEqual(await StoryPad.submitChangePassword(), true, 'Valid re-auth must update password and sign out others');
  assert.strictEqual(document.getElementById('profile-pw-current').value, '');
  assert.strictEqual(document.getElementById('profile-pw-next').value, '');
  assert.ok(auditInserts.some(a => a.p_event_type === 'password_changed' && a.p_status === 'success'));
  console.log('13. [PASS] Change Password enforces current password re-auth & clears inputs');

  StoryPad.openConfirmDialog = origConfirm;
  clearInterval(StoryPad.state._clocks.clockTimer);
  console.log('\n=== ALL 13 STORYPAD P0 & P1 SECURITY & AUTH TESTS PASSED 100%! ===');
}

runSecurityTests().catch(err => {
  console.error(err);
  process.exit(1);
});
