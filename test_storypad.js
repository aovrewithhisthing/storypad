/**
 * Unit & Integration Test for StoryPad Engine
 */
const fs = require('fs');
const path = require('path');

console.log('--- RUNNING STORYPAD VERIFICATION TESTS ---');

// 1. Verify existence of core files
const files = ['index.html', 'app.css', 'app.js', 'server.js'];
files.forEach(f => {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing expected file: ${f}`);
  }
  const stat = fs.statSync(p);
  console.log(`[PASS] File exists: ${f} (${stat.size} bytes)`);
});

// 2. Read and verify HTML contains all required elements and screen IDs
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

const requiredElements = [
  'screen-login',
  'screen-dashboard',
  'screen-projects',
  'screen-script-reader',
  'screen-profile',
  'sheet-view-settings',
  'sheet-audio-panel',
  'sheet-overlay',
  'floating-navbar',
  'toast-snackbar',
  'hero-gauge-fill',
  'hero-gauge-pct',
  'hero-gauge-takes',
  'hero-gauge-circle',
  'btn-login-email',
  'btn-login-google',
  'filter-toggle-filecode',
  'filter-toggle-goodtake',
  'filter-toggle-highlight',
  'filter-toggle-focusdialog',
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
  console.log(`[PASS] HTML Element present: #${id}`);
});

// 3. Test app.js logic by evaluating data structures and methods
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf-8');

// Mock a lightweight browser environment to test app.js methods
global.window = {
  AudioContext: class {
    constructor() { this.state = 'running'; }
    createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  }
};
global.navigator = {
  clipboard: {
    writeText: async (text) => { return Promise.resolve(text); }
  },
  vibrate: (ms) => true
};
global.document = {
  querySelectorAll: () => [],
  getElementById: (id) => ({
    classList: { add() {}, remove() {}, contains: () => false },
    style: {},
    addEventListener: () => {},
    querySelector: () => null
  }),
  addEventListener: () => {}
};

const StoryPad = require('./app.js');

if (!StoryPad) {
  throw new Error('StoryPad object is not defined');
}

console.log('[PASS] StoryPad engine loaded successfully');

// Test 4: Auto-naming engine
const naming = StoryPad.generateFileNames('d-2', 2);
console.log('Generated Auto-Naming result:', naming);

if (naming.videoName !== 'SC01_SH02_T02_JanganPergi_CAM-A.mp4') {
  throw new Error(`Unexpected video naming: ${naming.videoName}`);
}
if (naming.audioName !== 'SC01_SH02_T02_JanganPergi_AUD.wav') {
  throw new Error(`Unexpected audio naming: ${naming.audioName}`);
}
console.log('[PASS] Auto-naming generated format SC01_SH02_T02_JanganPergi_CAM-A.mp4 & AUD.wav matches requirement!');

// Test 5: Dynamic Half-Gauge Calculation
const dialogues = StoryPad.db.scriptData.lines.filter(l => l.type === 'dialogue');
const goodTakeCount = dialogues.filter(d => d.status === 'good').length;
const totalCount = dialogues.length;
const percentage = Math.round((goodTakeCount / totalCount) * 100);

console.log(`Dynamic Progress calculation: ${goodTakeCount} / ${totalCount} = ${percentage}%`);
if (percentage !== 20) {
  throw new Error(`Expected 20% but got ${percentage}%`);
}
console.log('[PASS] Dynamic 20% calculation confirmed!');

// Test 6: Verify 4 View Filter keys
const filterKeys = ['showFileCode', 'filterGoodTakeOnly', 'highlightStatus', 'focusDialogueMode'];
filterKeys.forEach(k => {
  if (!(k in StoryPad.state.viewSettings)) {
    throw new Error(`Missing viewSettings key: ${k}`);
  }
});
console.log('[PASS] All 4 View Settings filters properly initialized in state!');

// Test 7: Verify 5 Roles in state
const roleKeys = ['scriptSupervisor', 'videoEditor', 'soundRecordist', 'directorProducer', 'autoExportMeta'];
roleKeys.forEach(r => {
  if (!(r in StoryPad.state.roles)) {
    throw new Error(`Missing role key: ${r}`);
  }
});
console.log('[PASS] All 5 role switcher keys verified!');

console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
