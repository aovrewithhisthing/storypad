/**
 * Comprehensive Feature Verification Test for StoryPad Engine:
 * DOCX Converter, Multi-Scene Reader, Auto-Naming, Take Logging, and Real Media Attachment
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== STARTING EXTENDED STORYPAD FEATURE TESTS ===\n');

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
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
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

const StoryPad = require('./app.js');

async function runTests() {
  StoryPad.init();
  console.log('1. [PASS] StoryPad.init() initialized cleanly with zero dummy state');

  // 2. Test real .docx binary extraction & conversion if JADI- SCRIPT.docx is available, plus raw script conversion
  const docxPath = 'c:\\Users\\T4\\Downloads\\JADI- SCRIPT.docx';
  let parsedScript;
  if (fs.existsSync(docxPath)) {
    const buf = fs.readFileSync(docxPath);
    const blocks = await StoryPad.extractDocxBlocksFromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    parsedScript = StoryPad.parseBlocksToProject(blocks, { id: 'proj-jadi', code: 'JADI-01', sourceFilename: 'JADI- SCRIPT.docx' });
    assert.strictEqual(parsedScript.project.title, 'JADI?');
    assert.strictEqual(parsedScript.summary.sceneCount, 6, 'Must detect all 6 scenes from JADI- SCRIPT.docx');
    assert.ok(parsedScript.summary.dialogueCount >= 35, 'Must detect all dialogues in JADI- SCRIPT.docx');
    assert.ok(!JSON.stringify(parsedScript).includes('\u2014'), 'Em dashes must be normalized out');
    console.log(`2. [PASS] Real DOCX Converter extracted "${parsedScript.project.title}" (${parsedScript.summary.sceneCount} scenes, ${parsedScript.summary.dialogueCount} dialogues)`);
  } else {
    parsedScript = StoryPad.parseScriptText([
      'JADI?',
      'Genre: Komedi absurd | Lokasi: Technopark',
      '',
      'SCENE 1 — BRIEFING',
      'Durasi: 0:00–0:07',
      '[SHOT: Wide shot di Technopark]',
      'KHOIRUL',
      '“Kita 10 orang?”',
      '(Emosi: Memastikan | Gesture: Menghitung anggota)',
      'SCENE 2 — IDE',
      'JEZANIA',
      '“Horror mulu, bosen.”'
    ].join('\n'), { id: 'proj-jadi', code: 'JADI-01' });
    assert.strictEqual(parsedScript.summary.sceneCount, 2);
    console.log('2. [PASS] Raw Script Converter parsed multi-scene text accurately');
  }

  // 3. Hydrate StoryPad via applyBootstrapPayload (simulating Supabase response)
  StoryPad.applyBootstrapPayload([parsedScript.project], parsedScript.lines, [], [], []);
  assert.strictEqual(StoryPad.db.projects.length, 1);
  assert.strictEqual(StoryPad.state.activeProjectId, 'proj-jadi');
  console.log('3. [PASS] Bootstrap payload hydrated project & multi-scene lines cleanly');

  // 4. Test Auto-Naming Engine on Scene 01 Dialogue 01 ("Kita 10 orang?")
  const firstDlg = StoryPad.db.scriptData.lines.find(l => l.type === 'dialogue');
  const naming = StoryPad.generateFileNames(firstDlg.id, 1);
  assert.strictEqual(naming.videoName, 'SC01_SH01_T01_Kita10Orang_CAM-A.mp4');
  assert.strictEqual(naming.audioName, 'SC01_SH01_T01_Kita10Orang_AUD.wav');
  console.log('4. [PASS] Auto-naming generated exact NLE filenames:', naming.videoName);

  // 5. Multi-scene filtering
  StoryPad.selectSceneFilter('02');
  assert.strictEqual(StoryPad.state.activeSceneFilter, '02');
  const sc2Dlg = StoryPad.getActiveDialogueObject();
  assert.strictEqual(sc2Dlg.sceneNumber, '02');
  StoryPad.selectSceneFilter('all');
  console.log('5. [PASS] Multi-scene filter switches active scene & dialogue cue accurately');

  // 6. Log Take & Circle Take Gauge Math
  StoryPad.selectDialogueLine(firstDlg.id);
  assert.strictEqual(elements['hero-gauge-pct'].textContent, '0%');
  StoryPad.logNewTake();
  assert.strictEqual(firstDlg.takes.length, 1);
  StoryPad.toggleCircleTake(1);
  assert.strictEqual(firstDlg.takes[0].isGood, true);
  const expectedPct = `${Math.round((1 / StoryPad.db.scriptData.lines.filter(l => l.type === 'dialogue').length) * 100)}%`;
  assert.strictEqual(elements['hero-gauge-pct'].textContent, expectedPct);
  console.log(`6. [PASS] Take logging & Circle Take updated continuity gauge to ${expectedPct}`);

  // 7. Attach & Clear Real Audio & Footage URLs on Take 01
  getOrCreateElement('input-audio-url').value = 'https://example.supabase.co/storage/v1/object/public/storypad-media/proj-jadi/test_aud.wav';
  await StoryPad.attachMediaByUrl('audio');
  assert.ok(firstDlg.takes[0].audioUrl.endsWith('test_aud.wav'));

  getOrCreateElement('input-video-url').value = 'https://example.supabase.co/storage/v1/object/public/storypad-media/proj-jadi/test_vid.mp4';
  await StoryPad.attachMediaByUrl('video');
  assert.ok(firstDlg.takes[0].videoUrl.endsWith('test_vid.mp4'));

  StoryPad.togglePanelAudioPlayback();
  assert.strictEqual(StoryPad.state.audio.isPlaying, true);
  StoryPad.stopAudioPlayback();
  assert.strictEqual(StoryPad.state.audio.isPlaying, false);

  StoryPad.switchPanelMediaTab('video');
  assert.strictEqual(StoryPad.state.activeMediaTab, 'video');
  StoryPad.stepFootage(1);
  assert.strictEqual(StoryPad.state.footage.frame, 1);

  await StoryPad.clearTakeMedia('audio');
  assert.strictEqual(firstDlg.takes[0].audioUrl, null);
  console.log('7. [PASS] Real audio & footage attachment, playback, frame-step, and removal verified');

  // 8. Manual Add Line to Scene + Theme + Crew Quick Session + Modal Preview
  getOrCreateElement('addline-type').value = 'dialogue';
  getOrCreateElement('addline-scene-num').value = '06';
  getOrCreateElement('addline-scene-title').value = 'SCENE 06 - FILMNYA';
  getOrCreateElement('addline-character').value = 'KHOIRUL';
  getOrCreateElement('addline-shot').value = '04';
  getOrCreateElement('addline-dialogue-text').value = 'Udah langsung upload aja!';
  getOrCreateElement('addline-parenthetical').value = 'Emosi: Lega';
  await StoryPad.submitAddLine();
  const lastAdded = StoryPad.db.scriptData.lines[StoryPad.db.scriptData.lines.length - 1];
  assert.strictEqual(lastAdded.character, 'KHOIRUL');
  assert.strictEqual(lastAdded.keyword, 'UdahLangsungUpload');

  StoryPad.openScriptImportModal();
  StoryPad.switchImportSourceTab('text');
  getOrCreateElement('import-raw-textarea').value = 'TES\nSCENE 1 - SET\nRAKA\n"Siap!"';
  await StoryPad.runScriptPreview();
  assert.strictEqual(StoryPad.state.importModal.lastParsed.summary.dialogueCount, 1);
  StoryPad.closeScriptImportModal();

  StoryPad.loginQuickSession();
  assert.strictEqual(StoryPad.state.currentUser.studio, 'StoryPad Studio');
  StoryPad.setTheme('slate');
  assert.strictEqual(StoryPad.state.theme, 'slate');
  StoryPad.setTheme('daylight');
  assert.strictEqual(StoryPad.state.theme, 'daylight');
  console.log('8. [PASS] Add Line, Script Converter Preview, Quick Session, and Theme switches verified');

  clearInterval(StoryPad.state._clocks.clockTimer);
  console.log('\n=== ALL 8 EXTENDED FEATURE SUITE TESTS PASSED 100%! ===');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
