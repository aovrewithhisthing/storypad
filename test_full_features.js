/**
 * Comprehensive Feature Verification Test for StoryPad Engine
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== STARTING EXTENDED FEATURE TESTS ===\n');

// Mock browser DOM environment
global.window = {
  AudioContext: class {
    constructor() { this.state = 'running'; }
    createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  },
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  }
};

const elements = {};
function getOrCreateElement(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      textContent: '',
      innerHTML: '',
      value: '',
      style: {},
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); }
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => {},
      closest: () => null,
      setAttribute: () => {}
    };
  }
  return elements[id];
}

global.document = {
  getElementById: (id) => getOrCreateElement(id),
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {},
  createElement: (tag) => ({
    style: {},
    classList: { add() {}, remove() {} },
    appendChild: () => {},
    focus: () => {},
    select: () => {}
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  }
};

global.navigator = {
  clipboard: {
    writeText: async (t) => Promise.resolve(t)
  },
  vibrate: () => true
};

const StoryPad = require('./app.js');

// 1. Verify StoryPad initialization
StoryPad.init();
console.log('✔ Test 1: StoryPad.init() initialized without exceptions');

// 2. Verify all 3 projects exist with distinct scenes
assert.ok(StoryPad.db.scriptDataProjects['proj-1'], 'Project 1 must exist');
assert.ok(StoryPad.db.scriptDataProjects['proj-2'], 'Project 2 must exist');
assert.ok(StoryPad.db.scriptDataProjects['proj-3'], 'Project 3 must exist');
console.log('✔ Test 2: All 3 screenplay databases present');

// 3. Auto-naming tests for each project
const n1 = StoryPad.generateFileNames('d-2', 2);
assert.strictEqual(n1.videoName, 'SC01_SH02_T02_JanganPergi_CAM-A.mp4');
assert.strictEqual(n1.audioName, 'SC01_SH02_T02_JanganPergi_AUD.wav');

// Switch to proj-2
StoryPad.openProject('proj-2');
assert.strictEqual(StoryPad.state.activeProjectId, 'proj-2');
const n2 = StoryPad.generateFileNames('d-201', 3);
assert.strictEqual(n2.videoName, 'SC04_SH01_T03_MatikanSenter_CAM-A.mp4');
assert.strictEqual(n2.audioName, 'SC04_SH01_T03_MatikanSenter_AUD.wav');

// Switch to proj-3
StoryPad.openProject('proj-3');
assert.strictEqual(StoryPad.state.activeProjectId, 'proj-3');
const n3 = StoryPad.generateFileNames('d-301', 1);
assert.strictEqual(n3.videoName, 'SC01_SH01_T01_InspirasiDatang_CAM-A.mp4');
assert.strictEqual(n3.audioName, 'SC01_SH01_T01_InspirasiDatang_AUD.wav');
console.log('✔ Test 3: Auto-naming engine correctly formats filenames across all projects');

// 4. Circle take toggling & dynamic gauge updates
StoryPad.openProject('proj-1');
assert.strictEqual(StoryPad.state.activeProjectId, 'proj-1');
const pctInitial = elements['hero-gauge-pct'].textContent;
console.log('Initial Gauge pct in proj-1:', pctInitial);
assert.strictEqual(pctInitial, '20%');

// Toggle dialogue d-1 Take 2 to Good
StoryPad.state.activeDialogueId = 'd-1';
StoryPad.toggleCircleTake(2);
const pctAfterToggle = elements['hero-gauge-pct'].textContent;
console.log('Gauge pct after adding Circle Take:', pctAfterToggle);
assert.strictEqual(pctAfterToggle, '40%'); // 2 out of 5 = 40%

// Toggle off
StoryPad.toggleCircleTake(2);
const pctAfterRevert = elements['hero-gauge-pct'].textContent;
console.log('Gauge pct after removing Circle Take:', pctAfterRevert);
assert.strictEqual(pctAfterRevert, '20%');
console.log('✔ Test 4: Dynamic Circle Take toggles & radial gauge recalculation work perfectly');

// 5. Persona logins
StoryPad.loginAs('videoEditor');
assert.strictEqual(StoryPad.state.currentUser.name, 'Dimas Wicaksono');
assert.strictEqual(StoryPad.state.currentUser.initials, 'DW');
assert.strictEqual(elements['profile-user-name'].textContent, 'Dimas Wicaksono');
assert.strictEqual(elements['header-avatar-dash'].textContent, 'DW');

StoryPad.loginAs('soundRecordist');
assert.strictEqual(StoryPad.state.currentUser.name, 'Rama Satria');
assert.strictEqual(StoryPad.state.currentUser.initials, 'RS');
assert.strictEqual(elements['profile-user-name'].textContent, 'Rama Satria');

StoryPad.loginAs('scriptSupervisor');
assert.strictEqual(StoryPad.state.currentUser.name, 'Aulia Larasati, S.Sn.');
assert.strictEqual(StoryPad.state.currentUser.initials, 'AL');
console.log('✔ Test 5: Crew persona switcher correctly updates names, roles, and avatars');

// 6. View Settings
StoryPad.handleViewToggle('focusDialogueMode', true);
assert.strictEqual(StoryPad.state.viewSettings.focusDialogueMode, true);
StoryPad.resetViewFilters();
assert.strictEqual(StoryPad.state.viewSettings.focusDialogueMode, false);
assert.strictEqual(StoryPad.state.viewSettings.showFileCode, true);
console.log('✔ Test 6: View Filters toggling and reset functionality working');

// 7. Video footage controls
const initialFrame = StoryPad.state.footage.frame;
StoryPad.stepFootage(1);
assert.strictEqual(StoryPad.state.footage.frame, initialFrame + 1);
StoryPad.stepFootage(-1);
assert.strictEqual(StoryPad.state.footage.frame, initialFrame);
console.log('✔ Test 7: Video slate monitor frame-stepping working');

// 8. Notifications
assert.strictEqual(StoryPad.state.notifications[0].unread, true);
StoryPad.markAllNotificationsRead();
assert.strictEqual(StoryPad.state.notifications[0].unread, false);
console.log('✔ Test 8: Notifications state and mark all as read working');

// 9. Audio Playback
StoryPad.togglePanelAudioPlayback();
assert.strictEqual(StoryPad.state.audio.isPlaying, true);
StoryPad.stopAudioPlayback();
assert.strictEqual(StoryPad.state.audio.isPlaying, false);
console.log('✔ Test 9: Audio playback start and stop working cleanly');

// 10. Navigation & Smart Go Back
StoryPad.navigate('projects');
assert.strictEqual(StoryPad.state.currentScreen, 'projects');
StoryPad.navigate('script-reader');
assert.strictEqual(StoryPad.state.currentScreen, 'script-reader');
StoryPad.goBack();
assert.strictEqual(StoryPad.state.currentScreen, 'projects');
console.log('✔ Test 10: Navigation history and smart goBack working correctly');

console.log('\n=== ALL 10 COMPREHENSIVE SUITE TESTS PASSED 100%! ===');
