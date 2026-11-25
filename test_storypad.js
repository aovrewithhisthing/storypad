/**
 * Unit & Zero-Dummy Verification Test for StoryPad Engine
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- RUNNING STORYPAD ZERO-DUMMY & CORE VERIFICATION TESTS ---');

// 1. Verify existence of core files
const files = [
  'index.php',
  'index.html',
  'app.css',
  'app.js',
  'lib/ScriptParser.php',
  'api/script-import.php',
  'api/media.php'
];
files.forEach(f => {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing expected file: ${f}`);
  }
  const stat = fs.statSync(p);
  console.log(`[PASS] File exists: ${f} (${stat.size} bytes)`);
});

// 2. Verify zero dummy context strings across application source files
const forbiddenDummyStrings = [
  'Senjakala Merah',
  'Episode 4: Pelarian',
  'Studio Promo',
  'Aulia Larasati',
  'Dimas Wicaksono',
  'Rama Satria',
  'JanganPergi',
  'TidakPunyaWaktu',
  'MatikanSenter'
];

const sourceFilesToAudit = [
  'index.php',
  'index.html',
  'app.js',
  'config/supabase.php',
  'lib/SupabaseClient.php',
  'lib/ScriptParser.php',
  'api/supabase.php',
  'api/admin.php',
  'api/script-import.php',
  'api/media.php',
  'views/layout/navbar.php',
  'views/screens/login.php',
  'views/screens/dashboard.php',
  'views/screens/projects.php',
  'views/screens/script-reader.php',
  'views/screens/profile.php',
  'views/partials/inspector-panel.php',
  'views/partials/modals.php',
  'views/admin/login.php',
  'views/admin/dashboard.php'
];

sourceFilesToAudit.forEach(relPath => {
  const content = fs.readFileSync(path.join(__dirname, relPath), 'utf-8');
  forbiddenDummyStrings.forEach(dummy => {
    if (content.includes(dummy)) {
      throw new Error(`Forbidden dummy string "${dummy}" still found in ${relPath}`);
    }
  });
  if (content.includes('\u2014')) {
    throw new Error(`Forbidden em dash (R-02) found in ${relPath}`);
  }
});
console.log(`[PASS] Zero dummy context & zero em dashes verified across ${sourceFilesToAudit.length} source files!`);

// 3. Verify HTML contains all required elements including converter & real media controls
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const requiredElements = [
  'screen-login',
  'screen-dashboard',
  'screen-projects',
  'screen-script-reader',
  'screen-profile',
  'sheet-view-settings',
  'sheet-audio-panel',
  'sheet-import-script',
  'sheet-add-line',
  'sheet-overlay',
  'floating-navbar',
  'toast-snackbar',
  'hero-gauge-fill',
  'hero-gauge-pct',
  'hero-gauge-takes',
  'hero-gauge-circle',
  'panel-real-audio',
  'panel-real-video',
  'input-upload-audio',
  'input-upload-video',
  'input-script-file',
  'script-scene-switcher',
  'panel-script-notes',
  'filename-video',
  'filename-audio',
  'copy-btn',
  'send-nle-btn',
  'logout-btn'
];

requiredElements.forEach(id => {
  if (!html.includes(`id="${id}"`)) {
    throw new Error(`Missing element ID in index.html: ${id}`);
  }
});
console.log(`[PASS] All ${requiredElements.length} required DOM elements verified in index.html!`);

// 4. Verify StoryPad boots in pure clean empty state before DB sync
global.window = {};
global.navigator = { clipboard: { writeText: async (t) => t }, vibrate: () => true };
global.document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: () => ({
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    style: {},
    addEventListener: () => {},
    setAttribute: () => {},
    removeAttribute: () => {},
    getAttribute: () => null
  }),
  addEventListener: () => {}
};

const StoryPad = require('./app.js');
assert.strictEqual(StoryPad.db.projects.length, 0, 'Initial local projects array must be empty before Supabase sync');
assert.strictEqual(StoryPad.db.crewProfiles.length, 0, 'Initial local crewProfiles array must be empty');
assert.strictEqual(StoryPad.state.notifications.length, 0, 'Initial local notifications array must be empty');
assert.strictEqual(Object.keys(StoryPad.state.scriptNotes).length, 0, 'Initial local scriptNotes must be empty');
console.log('[PASS] StoryPad engine boots with 0 hardcoded dummy records!');

console.log('--- ALL ZERO-DUMMY & CORE VERIFICATION TESTS PASSED! ---');
