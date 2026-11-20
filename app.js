/**
 * StoryPad (Smart Script-to-Timeline Bridge)
 * Core Application Engine & Mobile Interaction Controller
 */

// Application Data & State Store
const StoryPad = {
  state: {
    currentScreen: 'login', // 'login' | 'dashboard' | 'projects' | 'script-reader' | 'profile'
    previousScreen: 'dashboard',
    activeTab: 'home',      // 'home' | 'project-list' | 'profile'
    activeProjectId: 'proj-1',
    activeMediaTab: 'audio', // 'audio' | 'video'
    
    // Active User Profile
    currentUser: {
      name: 'Aulia Larasati, S.Sn.',
      initials: 'AL',
      roleTitle: 'Lead Script Supervisor & Continuity',
      idBadge: 'SP-8842',
      studio: 'Lifelike Pictures',
      prodName: 'BADAI KELANA',
      email: 'aulia@lifelikepictures.com'
    },

    // View Filters (4 Live Filter Toggles)
    viewSettings: {
      showFileCode: true,        // "Tampilkan Kode File"
      filterGoodTakeOnly: false, // "Filter Good Take Only"
      highlightStatus: true,     // "Highlight Status Syuting"
      focusDialogueMode: false   // "Mode Fokus Dialog"
    },
    
    // Active selected dialogue and take in Script Reader
    activeDialogueId: 'd-2',
    activeTakeNumber: 2,
    
    // Role Switcher configuration (5 roles)
    roles: {
      scriptSupervisor: true,
      videoEditor: true,
      soundRecordist: false,
      directorProducer: false,
      autoExportMeta: true
    },
    
    // Audio Player State
    audio: {
      isPlaying: false,
      currentTrackId: null,
      context: null,
      oscillator: null,
      gainNode: null,
      animInterval: null,
      timerInterval: null,
      levelInterval: null,
      elapsedSeconds: 84 // 01:24
    },

    // Video Footage Simulation State
    footage: {
      isPlaying: false,
      interval: null,
      frame: 12,
      seconds: 19
    },

    // Notifications Store
    notifications: [
      {
        id: 1,
        title: 'NLE Bridge: DaVinci Resolve Sync',
        message: 'Scene 01 Take 02 ditandai Good Take & disinkronkan ke Timeline NLE.',
        time: 'Baru saja',
        type: 'sync',
        unread: true
      },
      {
        id: 2,
        title: 'Sound Recordist PolyWAV 48kHz',
        message: 'Audio Boom & Lav-01 channel track disinkronkan ke CAM-A timecode.',
        time: '5 menit yang lalu',
        type: 'audio',
        unread: true
      },
      {
        id: 3,
        title: 'Continuity Supervisor Note',
        message: 'Catatan kontinuitas adegan Shot 02 berhasil diarsipkan ke draft.',
        time: '18 menit yang lalu',
        type: 'notes',
        unread: false
      },
      {
        id: 4,
        title: 'ARRI Alexa 35 Bridge',
        message: 'Roll A04 terhubung via Genlock SMPTE 24.00 FPS.',
        time: '1 jam yang lalu',
        type: 'camera',
        unread: false
      }
    ],
    
    // Script Notes local store
    scriptNotes: {
      'd-1': 'Dian intonasi menekan. Mic boom perlu dijaga dari hembusan kipas set.',
      'd-2': 'Catatan: Emosi pemeran pas di detik ke-18. Cangkir kopi di tangan kiri (kontinuitas aman untuk cut ke Shot 03). Audio boom jernih tanpa distorsi.',
      'd-3': 'Semua berkas meja sudah disinkronkan ke kontinuitas Scene 02.',
      'd-4': 'Andi menatap ragu ke arah CCTV.',
      'd-5': 'Kunci pintu terdengar tegas di latar belakang.',
      'd-201': 'Hujan buatan di luar gudang stabil. Audio boom aman di bawah atap seng.',
      'd-202': 'Maya memegang koper perak dengan kedua tangan.',
      'd-203': 'Pistol prop diletakkan di saku kiri jaket hitam.',
      'd-301': 'Pencahayaan senja golden hour pas. Lensa 35mm T1.5.',
      'd-302': 'Voice over jernih tanpa echo.'
    }
  },

  // Mock Database for Projects & Script Lines
  db: {
    projects: [
      {
        id: 'proj-1',
        title: 'Projek 1',
        subtitle: 'Film Panjang: Senjakala Merah',
        tag: 'A-Cam',
        tagColor: '#3B82F6',
        day: 'Day 14',
        takesLogged: 42,
        fps: '24 fps',
        goodTakePercentage: 68,
        reviewPercentage: 24,
        syncStatus: 'In Sync'
      },
      {
        id: 'proj-2',
        title: 'Projek 2',
        subtitle: "Serial Web: Episode 4 'Pelarian'",
        tag: 'Sync OK',
        tagColor: '#10B981',
        day: 'Day 06',
        takesLogged: 18,
        fps: '23.98 fps',
        goodTakePercentage: 45,
        reviewPercentage: 35,
        syncStatus: 'Sync OK'
      },
      {
        id: 'proj-3',
        title: 'Projek 3',
        subtitle: 'Iklan TVC: Studio Promo',
        tag: 'New',
        tagColor: '#E2E8F0',
        day: 'Day 01',
        takesLogged: 9,
        fps: '25 fps',
        goodTakePercentage: 25,
        reviewPercentage: 20,
        syncStatus: 'Sync Hub Ready'
      }
    ],

    // Multi-project screenplay databases
    scriptDataProjects: {
      'proj-1': {
        projectId: 'proj-1',
        projectTitle: 'Senjakala Merah',
        draft: 'Draft v2.4 (Sync)',
        scene: {
          number: '01',
          shotNumber: '02',
          slugNumber: 'SLUG 01',
          title: 'SCENE 01 - INT. RUANG INTEROGASI - MALAM',
          timecode: '00:04:12:18',
          takeInfo: 'TAKE 02 / C-TAKED'
        },
        lines: [
          {
            id: 'a-1',
            type: 'action',
            content: 'Ruangan temaram. Cahaya lampu gantung berayun perlahan. DIAN berdiri di dekat pintu besi sambil memegang berkas tebal.'
          },
          {
            id: 'd-1',
            type: 'dialogue',
            character: 'DIAN',
            timecode: '00:04:14',
            text: 'Kita tidak punya waktu lagi untuk berdebat.',
            keyword: 'TidakPunyaWaktu',
            shot: '01',
            status: 'warning', // yellow
            statusLabel: 'Review',
            takes: [
              { number: 1, label: 'Take 01 • CAM-A / BOOM', tc: '01:05 SMPTE', statusLabel: 'False Start', isGood: false, isNg: false },
              { number: 2, label: 'Take 02 • CAM-A / BOOM', tc: '01:40 SMPTE', statusLabel: 'Director Pick', isGood: false, isNg: false, directorPick: true },
              { number: 3, label: 'Take 03 • CAM-A / BOOM', tc: '01:35 SMPTE', statusLabel: 'NG (Mic Shadow)', isGood: false, isNg: true }
            ]
          },
          {
            id: 'd-2',
            type: 'dialogue',
            character: 'ANDI',
            timecode: '00:04:19',
            text: 'Jangan pergi, tunggu dulu!',
            keyword: 'JanganPergi',
            shot: '02',
            status: 'good', // green (Good Take)
            statusLabel: 'Good Take',
            takes: [
              { number: 1, label: 'Take 01 • CAM-A / BOOM', tc: '01:14 SMPTE', statusLabel: 'False Start', isGood: false, isNg: false },
              { number: 2, label: 'Take 02 • CAM-A / BOOM', tc: '02:45 SMPTE • MASTER SYNC', statusLabel: 'GOOD TAKE', isGood: true, isNg: false, directorPick: true },
              { number: 3, label: 'Take 03 • CAM-A / BOOM', tc: '02:10 SMPTE', statusLabel: 'NG (Mic Shadow)', isGood: false, isNg: true }
            ]
          },
          {
            id: 'd-3',
            type: 'dialogue',
            character: 'DIAN',
            timecode: '00:04:22',
            text: 'Semua bukti sudah ada di atas meja. Keputusan ada di tanganmu sekarang.',
            keyword: 'SemuaBukti',
            shot: '02',
            status: 'pending', // gray
            statusLabel: 'Pending Shoot',
            takes: [
              { number: 1, label: 'Take 01 • CAM-A / BOOM', tc: '00:58 SMPTE', statusLabel: 'False Start', isGood: false, isNg: false },
              { number: 2, label: 'Take 02 • CAM-A / BOOM', tc: '01:12 SMPTE', statusLabel: 'NG (Focus Pull)', isGood: false, isNg: true }
            ]
          },
          {
            id: 'a-2',
            type: 'action',
            content: 'Andi melangkah mundur, menatap berkas merah tersebut dengan ragu.'
          },
          {
            id: 'd-4',
            type: 'dialogue',
            character: 'ANDI',
            timecode: '00:04:28',
            text: 'Bagaimana dengan rekaman CCTV di lantai empat?',
            keyword: 'RekamanCCTV',
            shot: '03',
            status: 'pending',
            statusLabel: 'Pending Shoot',
            takes: [
              { number: 1, label: 'Take 01 • CAM-A / BOOM', tc: '01:02 SMPTE', statusLabel: 'Hold', isGood: false, isNg: false }
            ]
          },
          {
            id: 'd-5',
            type: 'dialogue',
            character: 'DIAN',
            timecode: '00:04:33',
            text: 'Sudah diamankan. Tidak ada celah untuk lari.',
            keyword: 'SudahDiamankan',
            shot: '03',
            status: 'pending',
            statusLabel: 'Pending Shoot',
            takes: []
          }
        ]
      },
      'proj-2': {
        projectId: 'proj-2',
        projectTitle: "Serial Web: Episode 4 'Pelarian'",
        draft: 'Draft v1.8 (Shooting Script)',
        scene: {
          number: '04',
          shotNumber: '01',
          slugNumber: 'SLUG 04',
          title: 'SCENE 04 - INT. GUDANG DERMAGA - MALAM',
          timecode: '00:12:05:14',
          takeInfo: 'TAKE 03 / C-TAKED'
        },
        lines: [
          {
            id: 'a-201',
            type: 'action',
            content: 'Deru ombak membentur dermaga kayu di kejauhan. Hujan deras mulai mengguyur atap seng gudang tua. RENO menyalakan senter kecil.'
          },
          {
            id: 'd-201',
            type: 'dialogue',
            character: 'RENO',
            timecode: '00:12:08',
            text: 'Matikan sentermu sekarang! Ada patroli lewat di luar.',
            keyword: 'MatikanSenter',
            shot: '01',
            status: 'good',
            statusLabel: 'Good Take',
            takes: [
              { number: 1, label: 'Take 01 • CAM-A / BOOM', tc: '01:08 SMPTE', statusLabel: 'False Start', isGood: false, isNg: false },
              { number: 2, label: 'Take 02 • CAM-A / BOOM', tc: '01:52 SMPTE', statusLabel: 'NG (Sound Glitch)', isGood: false, isNg: true },
              { number: 3, label: 'Take 03 • CAM-A / BOOM', tc: '02:15 SMPTE • MASTER SYNC', statusLabel: 'GOOD TAKE', isGood: true, isNg: false, directorPick: true }
            ]
          },
          {
            id: 'd-202',
            type: 'dialogue',
            character: 'MAYA',
            timecode: '00:12:14',
            text: 'Koper ini terlalu berat. Kita harus tinggalkan sebagian berkas di sini.',
            keyword: 'KoperBerat',
            shot: '01',
            status: 'warning',
            statusLabel: 'Review',
            takes: [
              { number: 1, label: 'Take 01 • CAM-A / BOOM', tc: '01:20 SMPTE', statusLabel: 'Director Pick', isGood: true, isNg: false },
              { number: 2, label: 'Take 02 • CAM-A / BOOM', tc: '01:10 SMPTE', statusLabel: 'NG (Boom Shadow)', isGood: false, isNg: true }
            ]
          },
          {
            id: 'a-202',
            type: 'action',
            content: 'Reno merogoh saku jaketnya, memastikan kunci kendaraan sudah siap.'
          },
          {
            id: 'd-203',
            type: 'dialogue',
            character: 'RENO',
            timecode: '00:12:20',
            text: 'Tidak ada yang ditinggalkan. Satu lembar saja hilang, kita tamat.',
            keyword: 'TidakDitinggalkan',
            shot: '02',
            status: 'pending',
            statusLabel: 'Pending Shoot',
            takes: [
              { number: 1, label: 'Take 01 • CAM-A / BOOM', tc: '00:45 SMPTE', statusLabel: 'Hold', isGood: false, isNg: false }
            ]
          }
        ]
      },
      'proj-3': {
        projectId: 'proj-3',
        projectTitle: 'Iklan TVC: Studio Promo',
        draft: 'Draft Agency v3.0',
        scene: {
          number: '01',
          shotNumber: '01',
          slugNumber: 'SLUG 01',
          title: 'SCENE 01 - EXT. ROOFTOP GEDUNG - SORE',
          timecode: '00:01:10:00',
          takeInfo: 'TAKE 01 / READY'
        },
        lines: [
          {
            id: 'a-301',
            type: 'action',
            content: 'Kamera drone meluncur cepat menangkap siluet gedung pencakar langit berlatar matahari terbenam keemasan.'
          },
          {
            id: 'd-301',
            type: 'dialogue',
            character: 'TALENT A',
            timecode: '00:01:12',
            text: 'Inspirasi tak pernah menunggu. Kapan pun ide datang, rekam seketika.',
            keyword: 'InspirasiDatang',
            shot: '01',
            status: 'good',
            statusLabel: 'Good Take',
            takes: [
              { number: 1, label: 'Take 01 • CAM-A / BOOM', tc: '00:30 SMPTE • MASTER SYNC', statusLabel: 'GOOD TAKE', isGood: true, isNg: false, directorPick: true }
            ]
          },
          {
            id: 'd-302',
            type: 'dialogue',
            character: 'VOICE OVER',
            timecode: '00:01:18',
            text: 'StoryPad. Menghubungkan setiap bingkai cerita ke timeline editing Anda.',
            keyword: 'StoryPadBridge',
            shot: '02',
            status: 'pending',
            statusLabel: 'Pending Shoot',
            takes: [
              { number: 1, label: 'Take 01 • CAM-A / BOOM', tc: '00:25 SMPTE', statusLabel: 'Pending', isGood: false, isNg: false }
            ]
          }
        ]
      }
    },

    // Default scriptData is proj-1 (for 100% test compatibility)
    scriptData: null
  },

  // Initialization
  init() {
    // Initialize scriptData from proj-1
    this.db.scriptData = this.db.scriptDataProjects['proj-1'];

    this.loadPersistedSettings();
    this.bindEvents();
    this.renderScreen('login');
    this.updateProgressGauge();
    this.initAudioContext();
    this.updateStatusBarClock();
    this.startLiveClocks();
    this.renderProfileRoles();
  },

  // Load preferences from localStorage if available
  loadPersistedSettings() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedView = localStorage.getItem('storypad_view_settings');
        if (savedView) {
          const parsed = JSON.parse(savedView);
          this.state.viewSettings = { ...this.state.viewSettings, ...parsed };
        }
        const savedRoles = localStorage.getItem('storypad_roles');
        if (savedRoles) {
          const parsed = JSON.parse(savedRoles);
          this.state.roles = { ...this.state.roles, ...parsed };
        }
        const savedUser = localStorage.getItem('storypad_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          this.state.currentUser = { ...this.state.currentUser, ...parsed };
        }
      }
    } catch (e) {
      console.warn('Could not load localStorage settings');
    }
  },

  savePersistedSettings() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('storypad_view_settings', JSON.stringify(this.state.viewSettings));
        localStorage.setItem('storypad_roles', JSON.stringify(this.state.roles));
        localStorage.setItem('storypad_user', JSON.stringify(this.state.currentUser));
      }
    } catch (e) {}
  },

  // Setup Web Audio Context for realistic on-set sound monitoring
  initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.state.audio.context = new AudioContext();
      }
    } catch (e) {
      console.warn('Web Audio not supported');
    }
  },

  // Play synthetic tone when previewing audio tracks
  playAudioBeep(freq = 440) {
    if (!this.state.audio.context) return;
    try {
      if (this.state.audio.context.state === 'suspended') {
        this.state.audio.context.resume();
      }
      const osc = this.state.audio.context.createOscillator();
      const gain = this.state.audio.context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.state.audio.context.currentTime);
      gain.gain.setValueAtTime(0.08, this.state.audio.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.state.audio.context.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.state.audio.context.destination);
      osc.start();
      osc.stop(this.state.audio.context.currentTime + 0.4);
    } catch (err) {}
  },

  // Haptic feedback helper
  triggerHaptic() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch (e) {}
    }
  },

  // Show Toast Snackbar
  showToast(message = 'Nama file berhasil disalin!') {
    const toast = document.getElementById('toast-snackbar');
    const toastMsg = document.getElementById('toast-message');
    if (!toast) return;
    if (toastMsg) toastMsg.textContent = message;
    toast.classList.add('show');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  },

  // Reliable Clipboard Writer with Fallback
  writeClipboardText(text, successMessage = 'Nama file berhasil disalin!') {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(successMessage);
      }).catch(() => {
        this.fallbackCopy(text, successMessage);
      });
    } else {
      this.fallbackCopy(text, successMessage);
    }
  },

  fallbackCopy(text, successMessage = 'Nama file berhasil disalin!') {
    if (typeof document === 'undefined') return;
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      this.showToast(successMessage);
    } catch (err) {
      this.showToast('Gagal menyalin otomatis');
    }
    document.body.removeChild(textArea);
  },

  // Navigation Controller
  navigate(screenId, tabId = null) {
    this.triggerHaptic();
    if (this.state.currentScreen !== screenId) {
      this.state.previousScreen = this.state.currentScreen;
    }
    this.state.currentScreen = screenId;
    if (tabId) {
      this.state.activeTab = tabId;
    } else if (screenId === 'dashboard') {
      this.state.activeTab = 'home';
    } else if (screenId === 'projects') {
      this.state.activeTab = 'project-list';
    } else if (screenId === 'profile') {
      this.state.activeTab = 'profile';
    }

    this.renderScreen(screenId);
    this.updateNavbarVisibility();
    this.updateActiveTabStyles();
  },

  // Smart Go Back Navigation
  goBack() {
    this.triggerHaptic();
    const target = (this.state.previousScreen && this.state.previousScreen !== 'script-reader' && this.state.previousScreen !== 'login')
      ? this.state.previousScreen
      : 'projects';
    const tab = target === 'dashboard' ? 'home' : (target === 'projects' ? 'project-list' : 'profile');
    this.navigate(target, tab);
  },

  // Open Specific Project into Script Reader
  openProject(projectId) {
    this.triggerHaptic();
    this.state.activeProjectId = projectId;
    if (this.db.scriptDataProjects[projectId]) {
      this.db.scriptData = this.db.scriptDataProjects[projectId];
      // Select first dialogue in new project
      const firstDialogue = this.db.scriptData.lines.find(l => l.type === 'dialogue');
      if (firstDialogue) {
        this.state.activeDialogueId = firstDialogue.id;
        this.state.activeTakeNumber = (firstDialogue.takes && firstDialogue.takes.length > 0) ? firstDialogue.takes[0].number : 1;
      }
    }
    this.navigate('script-reader');
  },

  renderScreen(screenId) {
    // Hide all screen views
    document.querySelectorAll('.screen-view').forEach(view => {
      view.classList.add('hidden');
    });

    const activeView = document.getElementById(`screen-${screenId}`);
    if (activeView) {
      activeView.classList.remove('hidden');
      const scrollParent = activeView.closest('.screen-viewport') || activeView;
      if (scrollParent) scrollParent.scrollTop = 0;
    }

    // Specific screen render hooks
    if (screenId === 'dashboard') {
      this.updateProgressGauge();
    } else if (screenId === 'script-reader') {
      this.renderScriptContent();
    } else if (screenId === 'profile') {
      this.renderProfileRoles();
    }
  },

  // Control floating navbar visibility based on current screen
  updateNavbarVisibility() {
    const navbar = document.getElementById('floating-navbar');
    if (!navbar) return;
    
    // Login screen hides the bottom floating capsule
    if (this.state.currentScreen === 'login') {
      navbar.classList.add('hidden');
    } else {
      navbar.classList.remove('hidden');
      navbar.classList.remove('hidden-scroll');
    }
  },

  updateActiveTabStyles() {
    document.querySelectorAll('.nav-capsule-tab').forEach(tab => {
      const tabName = tab.getAttribute('data-tab');
      if (tabName === this.state.activeTab) {
        tab.className = 'nav-capsule-tab active';
      } else {
        tab.className = 'nav-capsule-tab';
      }
    });
  },

  // Dynamic Progress Gauge Calculation (Progress & Continuity Tracker)
  updateProgressGauge() {
    if (!this.db.scriptData || !this.db.scriptData.lines) return;

    const dialogues = this.db.scriptData.lines.filter(l => l.type === 'dialogue');
    const goodTakeCount = dialogues.filter(d => d.status === 'good').length;

    const totalCount = dialogues.length || 1;
    const percentage = Math.round((goodTakeCount / totalCount) * 100);

    // Circumference of half circle r=80 is PI * 80 = 251.32
    const circumference = 251.32;
    const offset = circumference - (percentage / 100) * circumference;

    const progressFill = document.getElementById('hero-gauge-fill');
    const progressText = document.getElementById('hero-gauge-pct');
    const takesBadge = document.getElementById('hero-gauge-takes');
    const circleBadge = document.getElementById('hero-gauge-circle');

    if (progressFill) {
      progressFill.style.strokeDashoffset = offset.toFixed(2);
    }
    if (progressText) {
      progressText.textContent = `${percentage}%`;
    }
    if (takesBadge) {
      takesBadge.textContent = `${goodTakeCount * 8} / 40 Takes`;
    }
    if (circleBadge) {
      circleBadge.textContent = `${goodTakeCount * 5} Confirmed`;
    }
  },

  // Auto-Naming Engine
  // Format: [KodeScene]_[KodeShot]_[NomorTake]_[KataKunciDialog]_[CAM-A.mp4 / AUD.wav]
  generateFileNames(dialogueId = this.state.activeDialogueId, takeNum = this.state.activeTakeNumber) {
    const dialogue = (this.db.scriptData && this.db.scriptData.lines)
      ? (this.db.scriptData.lines.find(l => l.id === dialogueId) || this.db.scriptData.lines[2] || this.db.scriptData.lines[1])
      : { shot: '02', keyword: 'JanganPergi' };

    const sceneNum = (this.db.scriptData && this.db.scriptData.scene) ? this.db.scriptData.scene.number : '01';
    const sceneCode = `SC${sceneNum}`;
    const shotCode = `SH${dialogue.shot || '02'}`;
    const takeCode = `T${String(takeNum).padStart(2, '0')}`;
    const keyword = dialogue.keyword || 'Dialogue';

    const videoName = `${sceneCode}_${shotCode}_${takeCode}_${keyword}_CAM-A.mp4`;
    const audioName = `${sceneCode}_${shotCode}_${takeCode}_${keyword}_AUD.wav`;

    return {
      sceneCode,
      shotCode,
      takeCode,
      keyword,
      videoName,
      audioName
    };
  },

  // Render Interactive Script Screenplay Content (Screen 4)
  renderScriptContent() {
    const container = document.getElementById('script-lines-container');
    if (!container || !this.db.scriptData) return;

    // Update screen header metadata dynamically
    const titleEl = document.getElementById('script-project-title');
    const draftEl = document.getElementById('script-project-draft');
    const slugEl = document.getElementById('script-slug-badge');
    const headerTcEl = document.getElementById('script-header-tc');
    const takeInfoEl = document.getElementById('script-take-info');
    const sceneTitleEl = document.getElementById('script-scene-title');
    const boxSceneTitleEl = document.getElementById('script-box-scenename');

    if (titleEl) titleEl.textContent = this.db.scriptData.projectTitle;
    if (draftEl) draftEl.textContent = this.db.scriptData.draft;
    if (slugEl) slugEl.textContent = this.db.scriptData.scene.slugNumber;
    if (headerTcEl) headerTcEl.textContent = this.db.scriptData.scene.timecode;
    if (takeInfoEl) takeInfoEl.textContent = this.db.scriptData.scene.takeInfo;
    if (sceneTitleEl) sceneTitleEl.textContent = this.db.scriptData.scene.title;
    if (boxSceneTitleEl) boxSceneTitleEl.textContent = this.db.scriptData.scene.title;

    const { lines } = this.db.scriptData;
    const { showFileCode, highlightStatus, focusDialogueMode, filterGoodTakeOnly } = this.state.viewSettings;

    let html = '';

    lines.forEach(line => {
      // If Mode Fokus Dialog is ON, skip action descriptions
      if (focusDialogueMode && line.type === 'action') {
        return;
      }

      if (line.type === 'action') {
        html += `
          <div class="leading-relaxed text-[#9CA3AF] text-xs font-mono py-1 px-2 border-l-2 border-transparent transition-opacity duration-200">
            ${line.content}
          </div>
        `;
      } else if (line.type === 'dialogue') {
        const isSelected = line.id === this.state.activeDialogueId;
        const statusClass = highlightStatus ? `status-${line.status}` : '';
        const naming = this.generateFileNames(line.id, this.state.activeTakeNumber);
        const hasGoodTake = line.status === 'good' || (line.takes && line.takes.some(t => t.isGood));

        // If filterGoodTakeOnly is active, dim non-good takes in script
        const dimClass = (filterGoodTakeOnly && !hasGoodTake) ? 'opacity-40' : '';

        html += `
          <div class="script-line-card relative flex flex-col items-center w-full my-1.5 p-3 rounded-xl bg-[#14171E] border border-[#2A2E39] cursor-pointer ${statusClass} ${isSelected ? 'selected' : ''} ${dimClass}"
               onclick="StoryPad.selectDialogueLine('${line.id}')"
               id="script-cue-${line.id}">
            
            ${isSelected ? `
              <!-- Floating Quick Action Bar (Play Audio, Video Footage, Notes) -->
              <div class="absolute -top-5 z-20 flex items-center gap-1.5 p-1 bg-[#111317] border border-[#3B82F6] rounded-full shadow-lg animate-in fade-in duration-200">
                <button aria-label="Putar Audio" 
                        onclick="event.stopPropagation(); StoryPad.openAudioPanel('${line.id}', 'audio')" 
                        class="flex items-center justify-center w-8 h-8 rounded-full bg-[#3B82F6] text-white hover:opacity-90 active:scale-95 transition-all shadow" 
                        title="Putar Audio Take">
                  <span class="material-symbols-outlined text-[18px]">play_arrow</span>
                </button>
                <button aria-label="Footage Media" 
                        onclick="event.stopPropagation(); StoryPad.openAudioPanel('${line.id}', 'video')" 
                        class="flex items-center justify-center w-8 h-8 rounded-full bg-[#21252E] text-[#3B82F6] border border-[#2A2E39] hover:bg-[#2A2E39] active:scale-95 transition-all" 
                        title="Buka Footage Media (CAM-A)">
                  <span class="material-symbols-outlined text-[18px]">movie</span>
                </button>
                <button aria-label="Catatan Kontinuitas" 
                        onclick="event.stopPropagation(); StoryPad.openAudioPanel('${line.id}', 'notes')" 
                        class="flex items-center justify-center w-8 h-8 rounded-full bg-[#21252E] text-[#10B981] border border-[#2A2E39] hover:bg-[#2A2E39] active:scale-95 transition-all" 
                        title="Catatan Kontinuitas">
                  <span class="material-symbols-outlined text-[18px]">edit_note</span>
                </button>
              </div>
            ` : ''}

            <!-- Character Header -->
            <div class="flex items-center gap-2 mb-1">
              <span class="font-bold font-sans uppercase tracking-wider text-xs ${isSelected ? 'text-[#3B82F6]' : 'text-[#E2E8F0]'}">
                ${line.character}
              </span>
              ${isSelected ? `
                <span class="px-1.5 py-0.2 rounded-full bg-[#3B82F6] text-white text-[9px] font-bold font-sans uppercase tracking-wider">
                  TERPILIH
                </span>
              ` : ''}
              ${hasGoodTake ? `
                <span class="px-1.5 py-0.2 rounded-full bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981] text-[9px] font-bold font-sans uppercase tracking-wider flex items-center gap-0.5">
                  <span class="material-symbols-outlined text-[10px]">star</span> GOOD
                </span>
              ` : ''}
              <span class="text-[11px] font-timecode text-[#9CA3AF]">[${line.timecode}]</span>
            </div>

            <!-- Dialogue Text -->
            <p class="max-w-xs text-center text-[#E2E8F0] text-sm font-mono leading-relaxed px-2">
              "${line.text}"
            </p>

            ${showFileCode ? `
              <!-- Auto-Naming Code Tag Display -->
              <div class="mt-2 flex flex-col items-center gap-0.5 w-full pt-1.5 border-t border-[#2A2E39]/60">
                <span class="font-mono text-[10px] text-[#3B82F6] bg-[#0F1115] px-2 py-0.5 rounded border border-[#2A2E39] truncate max-w-[280px]">
                  ${naming.videoName}
                </span>
              </div>
            ` : ''}
          </div>
        `;
      }
    });

    container.innerHTML = html;
  },

  // Select a dialogue line
  selectDialogueLine(dialogueId) {
    this.triggerHaptic();
    this.state.activeDialogueId = dialogueId;
    this.renderScriptContent();
  },

  // Open Bottom Sheet 1 – View (Pengaturan Tampilan)
  openViewSettings() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-view-settings');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet && overlay) {
      overlay.classList.add('active');
      sheet.classList.add('open');
      this.syncViewTogglesUI();
    }
  },

  closeViewSettings() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-view-settings');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet) sheet.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  },

  // Sync checkboxes with viewSettings state
  syncViewTogglesUI() {
    const tFileCode = document.getElementById('filter-toggle-filecode');
    const tGoodTake = document.getElementById('filter-toggle-goodtake');
    const tHighlight = document.getElementById('filter-toggle-highlight');
    const tFocusDialog = document.getElementById('filter-toggle-focusdialog');

    if (tFileCode) tFileCode.checked = this.state.viewSettings.showFileCode;
    if (tGoodTake) tGoodTake.checked = this.state.viewSettings.filterGoodTakeOnly;
    if (tHighlight) tHighlight.checked = this.state.viewSettings.highlightStatus;
    if (tFocusDialog) tFocusDialog.checked = this.state.viewSettings.focusDialogueMode;
  },

  // Handle View filter toggle change
  handleViewToggle(settingKey, isChecked) {
    this.triggerHaptic();
    this.state.viewSettings[settingKey] = isChecked;
    this.savePersistedSettings();
    this.renderScriptContent();
    if (settingKey === 'filterGoodTakeOnly') {
      this.renderPanelTakes();
    }
  },

  // Reset View settings
  resetViewFilters() {
    this.triggerHaptic();
    this.state.viewSettings = {
      showFileCode: true,
      filterGoodTakeOnly: false,
      highlightStatus: true,
      focusDialogueMode: false
    };
    this.savePersistedSettings();
    this.syncViewTogglesUI();
    this.renderScriptContent();
    this.renderPanelTakes();
    this.showToast('Pengaturan tampilan di-reset ke default');
  },

  // Switch Media Tab inside Panel (Audio Monitor vs Footage Preview)
  switchPanelMediaTab(tab = 'audio') {
    this.triggerHaptic();
    this.state.activeMediaTab = tab;

    const audioBtn = document.getElementById('panel-tab-audio');
    const videoBtn = document.getElementById('panel-tab-video');
    const audioContainer = document.getElementById('panel-audio-container');
    const footageContainer = document.getElementById('panel-footage-container');

    if (tab === 'video') {
      if (videoBtn) {
        videoBtn.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all bg-[#3B82F6] text-white shadow';
      }
      if (audioBtn) {
        audioBtn.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-[#9CA3AF] hover:text-white';
      }
      if (footageContainer) footageContainer.classList.remove('hidden');
      if (audioContainer) audioContainer.classList.add('hidden');
    } else {
      if (audioBtn) {
        audioBtn.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all bg-[#3B82F6] text-white shadow';
      }
      if (videoBtn) {
        videoBtn.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-[#9CA3AF] hover:text-white';
      }
      if (audioContainer) audioContainer.classList.remove('hidden');
      if (footageContainer) footageContainer.classList.add('hidden');
    }
  },

  // Open Bottom Sheet 2 – Panel Audio & Skrip
  openAudioPanel(dialogueId = this.state.activeDialogueId, focusTarget = 'audio') {
    this.triggerHaptic();
    this.state.activeDialogueId = dialogueId;
    
    // Default to Take 2
    this.state.activeTakeNumber = 2;

    const sheet = document.getElementById('sheet-audio-panel');
    const overlay = document.getElementById('sheet-overlay');
    
    this.renderPanelContent();
    
    // Switch to targeted media tab
    if (focusTarget === 'video') {
      this.switchPanelMediaTab('video');
    } else {
      this.switchPanelMediaTab('audio');
    }

    if (sheet && overlay) {
      overlay.classList.add('active');
      sheet.classList.add('open');
      
      // Auto-scroll to notes if focused
      if (focusTarget === 'notes') {
        setTimeout(() => {
          const notesArea = document.getElementById('panel-script-notes');
          if (notesArea) {
            notesArea.focus();
            notesArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    }
  },

  closeAudioPanel() {
    this.triggerHaptic();
    this.stopAudioPlayback();
    this.stopFootagePlayback();
    const sheet = document.getElementById('sheet-audio-panel');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet) sheet.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  },

  // Render Panel Audio & Skrip components
  renderPanelContent() {
    const dialogue = (this.db.scriptData && this.db.scriptData.lines)
      ? (this.db.scriptData.lines.find(l => l.id === this.state.activeDialogueId) || this.db.scriptData.lines[2])
      : { shot: '02' };
    
    const sceneNum = (this.db.scriptData && this.db.scriptData.scene) ? this.db.scriptData.scene.number : '01';

    // Update Header
    const titleEl = document.getElementById('panel-scene-title');
    if (titleEl) {
      titleEl.innerHTML = `Panel Audio &amp; Skrip <span class="font-body-sm text-xs text-[#94A3B8] font-normal font-mono">(Scene ${sceneNum} / Shot ${dialogue.shot || '02'})</span>`;
    }

    // Update video slate badges
    const slateSc = document.getElementById('footage-scene-badge');
    const slateSh = document.getElementById('footage-shot-badge');
    const slateTk = document.getElementById('footage-take-badge');
    if (slateSc) slateSc.textContent = `SC ${sceneNum}`;
    if (slateSh) slateSh.textContent = `SH ${dialogue.shot || '02'}`;
    if (slateTk) slateTk.textContent = `TK 0${this.state.activeTakeNumber}`;

    // Render Takes list
    this.renderPanelTakes();

    // Render Auto-Naming codes
    this.updatePanelAutoNaming();

    // Render Notes
    const notesEl = document.getElementById('panel-script-notes');
    if (notesEl) {
      notesEl.value = this.state.scriptNotes[this.state.activeDialogueId] || 'Catatan: Kontinuitas adegan aman. Audio boom jernih.';
    }
  },

  renderPanelTakes() {
    const listEl = document.getElementById('panel-takes-list');
    if (!listEl || !this.db.scriptData) return;

    const dialogue = this.db.scriptData.lines.find(l => l.id === this.state.activeDialogueId) || this.db.scriptData.lines[2];
    let takes = dialogue.takes || [];

    // If "Filter Good Take Only" is checked in View settings, filter out non-good takes
    if (this.state.viewSettings.filterGoodTakeOnly) {
      takes = takes.filter(t => t.isGood);
    }

    if (takes.length === 0) {
      listEl.innerHTML = `
        <div class="p-3 bg-[#14171E] border border-[#2A2E39] rounded-xl text-center text-xs text-[#9CA3AF]">
          Tidak ada take Good Take pada dialog ini.
        </div>
      `;
      return;
    }

    let html = '';
    takes.forEach(t => {
      const isSelected = t.number === this.state.activeTakeNumber;
      const isGood = t.isGood;
      const isNg = t.isNg;

      let cardBg = isSelected 
        ? (isGood ? 'bg-[#064E3B] border-[#10B981]' : 'bg-[#1E293B] border-[#3B82F6]') 
        : 'bg-[#21252E] border-[#2A2E39]';

      html += `
        <div class="border p-2.5 flex items-center justify-between rounded-xl cursor-pointer transition-colors ${cardBg}"
             onclick="StoryPad.selectTake(${t.number})">
          <div class="flex items-center gap-2.5 min-w-0">
            <button aria-label="Audisi Take" 
                    onclick="event.stopPropagation(); StoryPad.previewTakeAudio(${t.number})" 
                    class="w-7 h-7 rounded-lg ${isGood ? 'bg-[#10B981] text-[#064E3B]' : 'bg-[#14171E] text-[#9CA3AF] border border-[#2A2E39]'} flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-sm">
              <span class="material-symbols-outlined text-[16px]">${isSelected && StoryPad.state.audio.isPlaying ? 'volume_up' : 'play_arrow'}</span>
            </button>
            <div class="w-7 h-7 rounded ${isGood ? 'bg-[#10B981] text-[#064E3B]' : 'bg-[#14171E] text-[#94A3B8] border border-[#2A2E39]'} flex items-center justify-center font-mono text-xs font-bold shrink-0">
              0${t.number}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="font-sans text-xs ${isGood ? 'text-white font-bold' : 'text-[#E2E8F0] font-medium'} truncate">
                  ${t.label}
                </p>
                ${isGood ? `<span class="material-symbols-outlined text-[14px] text-[#F59E0B]">star</span>` : ''}
              </div>
              <p class="font-mono text-[10px] ${isGood ? 'text-[#6EE7B7] font-semibold' : 'text-[#94A3B8]'}">
                ${t.tc}
              </p>
            </div>
          </div>
          
          <div class="flex flex-col items-end gap-1 shrink-0">
            <div class="flex items-center gap-1">
              <button aria-label="Toggle Circle Take" 
                      onclick="event.stopPropagation(); StoryPad.toggleCircleTake(${t.number})" 
                      class="btn-press flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-sans font-bold transition-all ${isGood ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]' : 'bg-[#14171E] border-[#2A2E39] text-[#9CA3AF] hover:text-white'}"
                      title="${isGood ? 'Batal tandai Circle Take' : 'Tandai sebagai Circle Take ⭐'}">
                <span class="material-symbols-outlined text-[12px] ${isGood ? 'text-[#F59E0B]' : ''}">star</span>
                <span>${isGood ? 'Circle' : 'Hold'}</span>
              </button>
            </div>
            ${isGood ? `
              <span class="px-2 py-0.5 rounded-full bg-[#10B981] text-[#064E3B] font-sans text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-[#064E3B]"></span>GOOD TAKE
              </span>
            ` : isNg ? `
              <span class="px-1.5 py-0.5 rounded bg-[#14171E] border border-[#EF4444]/40 text-[#EF4444] font-sans text-[9px] uppercase tracking-wide flex items-center gap-1">
                <span class="material-symbols-outlined text-[11px]">cancel</span>${t.statusLabel}
              </span>
            ` : `
              <span class="px-1.5 py-0.5 rounded bg-[#14171E] border border-[#2A2E39] text-[#94A3B8] font-sans text-[9px] uppercase tracking-wide">
                ${t.statusLabel}
              </span>
            `}
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
  },

  // Toggle Circle / Good Take for an individual take
  toggleCircleTake(takeNumber) {
    this.triggerHaptic();
    const dialogue = this.db.scriptData.lines.find(l => l.id === this.state.activeDialogueId);
    if (!dialogue || !dialogue.takes) return;
    const take = dialogue.takes.find(t => t.number === takeNumber);
    if (!take) return;

    take.isGood = !take.isGood;
    if (take.isGood) {
      take.isNg = false;
      dialogue.status = 'good';
      this.showToast(`Take 0${takeNumber} ditandai sebagai Circle Take! ⭐`);
    } else {
      const hasOtherGood = dialogue.takes.some(t => t.isGood);
      dialogue.status = hasOtherGood ? 'good' : 'warning';
      this.showToast(`Tanda Circle Take 0${takeNumber} dihapus.`);
    }

    this.renderPanelTakes();
    this.renderScriptContent();
    this.updateProgressGauge();
  },

  selectTake(takeNumber) {
    this.triggerHaptic();
    this.state.activeTakeNumber = takeNumber;
    this.renderPanelTakes();
    this.updatePanelAutoNaming();

    const slateTk = document.getElementById('footage-take-badge');
    if (slateTk) slateTk.textContent = `TK 0${takeNumber}`;
  },

  previewTakeAudio(takeNumber) {
    this.selectTake(takeNumber);
    this.togglePanelAudioPlayback();
  },

  updatePanelAutoNaming() {
    const naming = this.generateFileNames(this.state.activeDialogueId, this.state.activeTakeNumber);

    const titleEl = document.getElementById('panel-naming-title');
    const scEl = document.getElementById('panel-naming-sc');
    const shEl = document.getElementById('panel-naming-sh');
    const tkEl = document.getElementById('panel-naming-tk');
    const camEl = document.getElementById('panel-naming-cam');
    const videoEl = document.getElementById('filename-video');
    const audioEl = document.getElementById('filename-audio');

    if (titleEl) titleEl.textContent = `Kode Penamaan Otomatis (Take 0${this.state.activeTakeNumber})`;
    if (scEl) scEl.textContent = `SC: ${naming.sceneCode.replace('SC', '')}`;
    if (shEl) shEl.textContent = `SH: ${naming.shotCode.replace('SH', '')}`;
    if (tkEl) tkEl.textContent = `TK: 0${this.state.activeTakeNumber}`;
    if (camEl) camEl.textContent = `CAM: A`;
    if (videoEl) videoEl.textContent = naming.videoName;
    if (audioEl) audioEl.textContent = naming.audioName;
  },

  // Copy auto-naming codes to clipboard
  copyFileNames() {
    this.triggerHaptic();
    const naming = this.generateFileNames(this.state.activeDialogueId, this.state.activeTakeNumber);
    const textToCopy = `${naming.videoName}\n${naming.audioName}`;

    this.writeClipboardText(textToCopy, 'Nama file video & audio disalin!');

    const copyBtnText = document.getElementById('copy-text');
    const copyBtnIcon = document.getElementById('copy-icon');
    if (copyBtnText) copyBtnText.textContent = 'Disalin!';
    if (copyBtnIcon) copyBtnIcon.textContent = 'check';

    setTimeout(() => {
      if (copyBtnText) copyBtnText.textContent = 'Copy';
      if (copyBtnIcon) copyBtnIcon.textContent = 'content_copy';
    }, 2000);
  },

  // Copy individual video or audio filename
  copySpecificFilename(type) {
    this.triggerHaptic();
    const naming = this.generateFileNames(this.state.activeDialogueId, this.state.activeTakeNumber);
    const text = type === 'video' ? naming.videoName : naming.audioName;
    const label = type === 'video' ? 'video' : 'audio';
    this.writeClipboardText(text, `Nama file ${label} berhasil disalin!`);
  },

  // Save Continuity Notes
  saveNotes() {
    const notesEl = document.getElementById('panel-script-notes');
    if (notesEl) {
      this.state.scriptNotes[this.state.activeDialogueId] = notesEl.value;
      this.showToast('Catatan berhasil disimpan ke Draft');
    }
  },

  // Push to NLE simulation
  syncToNle() {
    this.triggerHaptic();
    const btn = document.getElementById('send-nle-btn');
    if (!btn) return;

    const originalContent = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">sync</span><span>Meneruskan ke Premiere / Resolve...</span>`;
    btn.disabled = true;

    setTimeout(() => {
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">done_all</span><span>Tersinkronisasi ke Timeline NLE!</span>`;
      this.showToast('Timeline NLE tersinkronisasi');

      setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.disabled = false;
      }, 2000);
    }, 1200);
  },

  // Audio Playback Simulation for Panel & Dashboard
  togglePanelAudioPlayback() {
    this.triggerHaptic();
    const isPlaying = this.state.audio.isPlaying;

    if (isPlaying) {
      this.stopAudioPlayback();
    } else {
      this.startAudioPlayback('panel-waveform');
    }
  },

  startAudioPlayback(waveformContainerId) {
    this.state.audio.isPlaying = true;
    this.playAudioBeep(520);

    const playIcon = document.getElementById('panel-play-icon');
    if (playIcon) playIcon.textContent = 'pause';

    const container = document.getElementById(waveformContainerId);
    const bars = container ? container.querySelectorAll('.waveform-bar') : [];

    clearInterval(this.state.audio.animInterval);
    this.state.audio.animInterval = setInterval(() => {
      bars.forEach(bar => {
        const heightPct = Math.floor(Math.random() * 70 + 25);
        bar.style.height = `${heightPct}%`;
      });
      if (Math.random() > 0.6) {
        this.playAudioBeep(Math.floor(Math.random() * 180 + 420));
      }
    }, 110);

    // Dynamic PolyWAV VU meters
    const ch1Meter = document.getElementById('vu-meter-ch1');
    const ch2Meter = document.getElementById('vu-meter-ch2');
    const ch1Db = document.getElementById('vu-val-ch1');
    const ch2Db = document.getElementById('vu-val-ch2');

    clearInterval(this.state.audio.levelInterval);
    this.state.audio.levelInterval = setInterval(() => {
      const db1 = -(Math.floor(Math.random() * 12 + 6));
      const db2 = -(Math.floor(Math.random() * 14 + 10));
      if (ch1Db) ch1Db.textContent = `${db1} dB`;
      if (ch2Db) ch2Db.textContent = `${db2} dB`;
      if (ch1Meter) ch1Meter.style.width = `${Math.min(100, Math.max(10, 100 + db1 * 4))}%`;
      if (ch2Meter) ch2Meter.style.width = `${Math.min(100, Math.max(10, 100 + db2 * 4))}%`;
    }, 120);

    // Increment timecode display
    const tcEl = document.getElementById('panel-elapsed-tc');
    clearInterval(this.state.audio.timerInterval);
    this.state.audio.timerInterval = setInterval(() => {
      this.state.audio.elapsedSeconds++;
      if (this.state.audio.elapsedSeconds > 165) {
        this.state.audio.elapsedSeconds = 0;
      }
      if (tcEl) {
        const secs = String(this.state.audio.elapsedSeconds % 60).padStart(2, '0');
        tcEl.textContent = `00:01:${secs}:12`;
      }
    }, 1000);
  },

  stopAudioPlayback() {
    this.state.audio.isPlaying = false;
    clearInterval(this.state.audio.animInterval);
    clearInterval(this.state.audio.timerInterval);
    clearInterval(this.state.audio.levelInterval);

    const playIcon = document.getElementById('panel-play-icon');
    if (playIcon) playIcon.textContent = 'play_arrow';

    // Reset panel waveform bars to static baseline
    const container = document.getElementById('panel-waveform');
    if (container) {
      const bars = container.querySelectorAll('.waveform-bar');
      const defaultHeights = [35, 60, 45, 85, 70, 95, 65, 40, 55, 30, 75, 90, 50, 35, 65, 40, 80, 45, 30];
      bars.forEach((b, idx) => {
        b.style.height = `${defaultHeights[idx % defaultHeights.length]}%`;
      });
    }

    // Reset dashboard play buttons and clear all dashboard anim intervals
    document.querySelectorAll('.dashboard-play-btn').forEach(btn => {
      if (btn._animInterval) {
        clearInterval(btn._animInterval);
        btn._animInterval = null;
      }
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = 'play_arrow';
    });

    // Reset dashboard waveform bars to scaleY(1)
    ['dash-waveform-1', 'dash-waveform-2'].forEach(id => {
      const wf = document.getElementById(id);
      if (wf) {
        wf.querySelectorAll('span').forEach(s => {
          s.style.transform = 'scaleY(1)';
        });
      }
    });
  },

  // Dashboard Audio Player
  toggleDashboardTrack(btn, waveformId) {
    this.triggerHaptic();
    const icon = btn.querySelector('.material-symbols-outlined');
    const isPlaying = icon && icon.textContent === 'pause';

    // Stop all others first
    this.stopAudioPlayback();

    if (!isPlaying) {
      if (icon) icon.textContent = 'pause';
      this.playAudioBeep(480);
      const waveform = document.getElementById(waveformId);
      if (waveform) {
        const bars = waveform.querySelectorAll('span');
        clearInterval(btn._animInterval);
        btn._animInterval = setInterval(() => {
          bars.forEach(bar => {
            const randScale = (Math.random() * 0.8 + 0.4).toFixed(2);
            bar.style.transform = `scaleY(${randScale})`;
          });
        }, 110);
      }
    }
  },

  // Video Footage Playback & Frame Jogging
  toggleFootagePlayback() {
    this.triggerHaptic();
    this.state.footage.isPlaying = !this.state.footage.isPlaying;
    const playIcon = document.getElementById('footage-play-icon');
    if (playIcon) playIcon.textContent = this.state.footage.isPlaying ? 'pause' : 'play_arrow';

    if (this.state.footage.isPlaying) {
      this.playAudioBeep(580);
      clearInterval(this.state.footage.interval);
      this.state.footage.interval = setInterval(() => {
        this.stepFootage(1);
      }, 100);
    } else {
      clearInterval(this.state.footage.interval);
    }
  },

  stopFootagePlayback() {
    this.state.footage.isPlaying = false;
    clearInterval(this.state.footage.interval);
    const playIcon = document.getElementById('footage-play-icon');
    if (playIcon) playIcon.textContent = 'play_arrow';
  },

  stepFootage(direction) {
    this.state.footage.frame = (this.state.footage.frame || 12) + direction;
    if (this.state.footage.frame > 24) {
      this.state.footage.frame = 0;
      this.state.footage.seconds = (this.state.footage.seconds || 19) + 1;
    } else if (this.state.footage.frame < 0) {
      this.state.footage.frame = 23;
      this.state.footage.seconds = Math.max(0, (this.state.footage.seconds || 19) - 1);
    }
    const frameStr = String(this.state.footage.frame).padStart(2, '0');
    const secStr = String((this.state.footage.seconds || 19) % 60).padStart(2, '0');
    const tc = `00:04:${secStr}:${frameStr}`;
    const tcLive = document.getElementById('footage-live-tc');
    const tcElapsed = document.getElementById('footage-elapsed-tc');
    if (tcLive) tcLive.textContent = tc;
    if (tcElapsed) tcElapsed.textContent = tc;
  },

  // Role Switcher in Profile (5 Rows)
  renderProfileRoles() {
    // Reflect active roles onto toggles
    Object.keys(this.state.roles).forEach(key => {
      const row = document.querySelector(`[data-role-key="${key}"]`);
      if (row) {
        const toggleBtn = row.querySelector('.toggle-box');
        const isChecked = this.state.roles[key];
        if (toggleBtn) {
          if (isChecked) {
            toggleBtn.setAttribute('data-checked', 'true');
            toggleBtn.className = 'toggle-box w-6 h-6 rounded bg-[#3B82F6] flex items-center justify-center shrink-0 text-white transition-colors';
            row.classList.remove('opacity-70');
          } else {
            toggleBtn.setAttribute('data-checked', 'false');
            toggleBtn.className = 'toggle-box w-6 h-6 rounded bg-[#14171E] border border-[#2A2E39] flex items-center justify-center shrink-0 text-transparent transition-colors';
            row.classList.add('opacity-70');
          }
        }
      }
    });

    // Update user profile card in UI
    const nameEl = document.getElementById('profile-user-name');
    const roleEl = document.getElementById('profile-user-role');
    const badgeEl = document.getElementById('profile-user-badge');
    const avatarEl = document.getElementById('profile-avatar-initials');
    const dashAvatarEl = document.getElementById('header-avatar-dash');
    const projAvatarEl = document.getElementById('header-avatar-proj');
    const profileAvatarEl = document.getElementById('header-avatar-profile');

    if (nameEl) nameEl.textContent = this.state.currentUser.name;
    if (roleEl) roleEl.textContent = this.state.currentUser.roleTitle;
    if (badgeEl) badgeEl.textContent = `${this.state.currentUser.idBadge} • ${this.state.currentUser.studio}`;
    if (avatarEl) avatarEl.textContent = this.state.currentUser.initials;
    if (dashAvatarEl) dashAvatarEl.textContent = this.state.currentUser.initials;
    if (projAvatarEl) projAvatarEl.textContent = this.state.currentUser.initials;
    if (profileAvatarEl) profileAvatarEl.textContent = this.state.currentUser.initials;
  },

  toggleRole(roleKey, btnElement) {
    this.triggerHaptic();
    this.state.roles[roleKey] = !this.state.roles[roleKey];
    this.savePersistedSettings();
    const isChecked = this.state.roles[roleKey];

    const row = btnElement ? btnElement.closest('.role-item') : null;
    if (isChecked) {
      if (btnElement) {
        btnElement.setAttribute('data-checked', 'true');
        btnElement.className = 'toggle-box w-6 h-6 rounded bg-[#3B82F6] flex items-center justify-center shrink-0 text-white transition-colors';
      }
      if (row) row.classList.remove('opacity-70');
      this.showToast(`Mode ${roleKey} diaktifkan`);
    } else {
      if (btnElement) {
        btnElement.setAttribute('data-checked', 'false');
        btnElement.className = 'toggle-box w-6 h-6 rounded bg-[#14171E] border border-[#2A2E39] flex items-center justify-center shrink-0 text-transparent transition-colors';
      }
      if (row) row.classList.add('opacity-70');
      this.showToast(`Mode ${roleKey} dinonaktifkan`);
    }
  },

  // Interactive Project Search / Filter
  toggleProjectSearch() {
    this.triggerHaptic();
    const bar = document.getElementById('project-search-bar');
    if (!bar) return;
    const isHidden = bar.classList.contains('hidden');
    if (isHidden) {
      bar.classList.remove('hidden');
      const input = document.getElementById('project-search-input');
      if (input) input.focus();
    } else {
      bar.classList.add('hidden');
      this.clearProjectSearch();
    }
  },

  filterProjects(query) {
    const q = (query || '').toLowerCase().trim();
    const cards = document.querySelectorAll('.project-card-item');
    let matchCount = 0;
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      if (!q || text.includes(q)) {
        card.style.display = '';
        matchCount++;
      } else {
        card.style.display = 'none';
      }
    });

    const empty = document.getElementById('project-search-empty');
    if (empty) {
      if (matchCount === 0) {
        empty.classList.remove('hidden');
        empty.style.display = 'block';
      } else {
        empty.classList.add('hidden');
        empty.style.display = 'none';
      }
    }
  },

  // Category Filter Chips
  filterProjectsByCategory(category, btnElement) {
    this.triggerHaptic();
    document.querySelectorAll('.project-category-btn').forEach(btn => {
      btn.className = 'project-category-btn px-2.5 py-1 rounded-full text-[10px] font-sans font-semibold border border-[#2A2E39] bg-[#14171E] text-[#9CA3AF] hover:text-white transition-all';
    });
    if (btnElement) {
      btnElement.className = 'project-category-btn px-2.5 py-1 rounded-full text-[10px] font-sans font-semibold border border-[#3B82F6] bg-[#3B82F6] text-white shadow-sm transition-all';
    }
    const cards = document.querySelectorAll('.project-card-item');
    let matchCount = 0;
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      if (category === 'all' || text.includes(category.toLowerCase())) {
        card.style.display = '';
        matchCount++;
      } else {
        card.style.display = 'none';
      }
    });

    const empty = document.getElementById('project-search-empty');
    if (empty) {
      if (matchCount === 0) {
        empty.classList.remove('hidden');
        empty.style.display = 'block';
      } else {
        empty.classList.add('hidden');
        empty.style.display = 'none';
      }
    }
  },

  clearProjectSearch() {
    const input = document.getElementById('project-search-input');
    if (input) input.value = '';
    this.filterProjects('');
  },

  // Notification Sheet Controls
  openNotifications() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-notifications');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet && overlay) {
      overlay.classList.add('active');
      sheet.classList.add('open');
      this.renderNotificationsList();
    }
  },

  closeNotifications() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-notifications');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet) sheet.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  },

  renderNotificationsList() {
    const list = document.getElementById('notifications-list');
    if (!list) return;

    let html = '';
    this.state.notifications.forEach(n => {
      html += `
        <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#14171E] border border-[#2A2E39] ${n.unread ? 'border-l-2 border-l-[#3B82F6]' : 'opacity-80'}">
          <div class="w-7 h-7 rounded-lg bg-[#21252E] flex items-center justify-center text-[#3B82F6] shrink-0 mt-0.5">
            <span class="material-symbols-outlined text-[16px]">${n.type === 'sync' ? 'sync' : n.type === 'audio' ? 'graphic_eq' : 'edit_note'}</span>
          </div>
          <div class="flex flex-col min-w-0 flex-1">
            <div class="flex items-center justify-between gap-1">
              <span class="font-sans text-xs font-semibold text-white truncate">${n.title}</span>
              <span class="font-mono text-[9px] text-[#9CA3AF] shrink-0">${n.time}</span>
            </div>
            <p class="font-sans text-[11px] text-[#9CA3AF] mt-0.5 leading-snug">${n.message}</p>
          </div>
        </div>
      `;
    });
    list.innerHTML = html;
  },

  markAllNotificationsRead() {
    this.triggerHaptic();
    this.state.notifications.forEach(n => { n.unread = false; });
    this.renderNotificationsList();
    this.showToast('Semua notifikasi ditandai dibaca');
  },

  // Login Persona Switcher Modal
  openLoginAccounts() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-login-accounts');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet && overlay) {
      overlay.classList.add('active');
      sheet.classList.add('open');
    }
  },

  closeLoginAccounts() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-login-accounts');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet) sheet.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  },

  loginAs(personaKey) {
    this.triggerHaptic();
    if (personaKey === 'scriptSupervisor') {
      this.state.currentUser = {
        name: 'Aulia Larasati, S.Sn.',
        initials: 'AL',
        roleTitle: 'Lead Script Supervisor & Continuity',
        idBadge: 'SP-8842',
        studio: 'Lifelike Pictures',
        prodName: 'BADAI KELANA',
        email: 'aulia@lifelikepictures.com'
      };
      this.state.roles = { scriptSupervisor: true, videoEditor: true, soundRecordist: false, directorProducer: false, autoExportMeta: true };
    } else if (personaKey === 'videoEditor') {
      this.state.currentUser = {
        name: 'Dimas Wicaksono',
        initials: 'DW',
        roleTitle: 'Lead Offline Video Editor',
        idBadge: 'ED-3021',
        studio: 'Lifelike Post',
        prodName: 'BADAI KELANA',
        email: 'dimas.edit@lifelikepictures.com'
      };
      this.state.roles = { scriptSupervisor: false, videoEditor: true, soundRecordist: false, directorProducer: false, autoExportMeta: true };
    } else if (personaKey === 'soundRecordist') {
      this.state.currentUser = {
        name: 'Rama Satria',
        initials: 'RS',
        roleTitle: 'Production Sound Mixer & Boom Logger',
        idBadge: 'AU-7104',
        studio: 'Lifelike Sound',
        prodName: 'BADAI KELANA',
        email: 'sound.rama@lifelikepictures.com'
      };
      this.state.roles = { scriptSupervisor: false, videoEditor: false, soundRecordist: true, directorProducer: false, autoExportMeta: true };
    }

    this.savePersistedSettings();
    this.renderProfileRoles();
    this.closeLoginAccounts();
    this.navigate('dashboard', 'home');
    this.showToast(`Selamat datang, ${this.state.currentUser.name}!`);
  },

  loginWithGoogle() {
    this.triggerHaptic();
    this.showToast('Autentikasi Google Studio...');
    setTimeout(() => {
      this.loginAs('scriptSupervisor');
    }, 600);
  },

  // Logout Flow
  handleLogout() {
    this.triggerHaptic();
    const btn = document.getElementById('logout-btn');
    if (!btn) return;

    const originalContent = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span><span>Menyimpan Sesi Snapshot...</span>`;

    setTimeout(() => {
      btn.innerHTML = originalContent;
      this.navigate('login');
      this.showToast('Berhasil keluar akun produksi');
    }, 900);
  },

  // Status Bar Clock Updater
  updateStatusBarClock() {
    const clockEl = document.getElementById('mobile-clock');
    if (!clockEl) return;
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${hrs}:${mins}`;
  },

  // Master Genlock / SMPTE Timecode Running Simulation
  startLiveClocks() {
    setInterval(() => {
      this.updateStatusBarClock();
    }, 30000);

    // Live frame ticker for on-set telemetry
    let frame = 8;
    let sec = 22;
    setInterval(() => {
      frame++;
      if (frame > 24) {
        frame = 0;
        sec++;
        if (sec > 59) sec = 0;
      }
      const ff = String(frame).padStart(2, '0');
      const ss = String(sec).padStart(2, '0');
      const masterTc = document.getElementById('master-tc-live');
      if (masterTc) {
        masterTc.textContent = `01:14:${ss}:${ff}`;
      }
    }, 100);
  },

  // Event Listeners Registration
  bindEvents() {
    if (typeof document === 'undefined') return;

    // Scroll Listeners for Auto-Hide Floating Capsule Navbar
    const scrollContainers = document.querySelectorAll('.screen-viewport');
    scrollContainers.forEach(container => {
      let lastScrollTop = 0;
      container.addEventListener('scroll', () => {
        const currentScrollTop = container.scrollTop;
        const navbar = document.getElementById('floating-navbar');
        const quickDock = document.getElementById('floating-quick-dock');

        if (navbar && this.state.currentScreen !== 'login') {
          if (currentScrollTop > lastScrollTop && currentScrollTop > 30) {
            navbar.classList.add('hidden-scroll');
            if (quickDock) quickDock.classList.add('opacity-0', 'translate-y-4');
          } else if (currentScrollTop < lastScrollTop - 4 || currentScrollTop <= 20) {
            navbar.classList.remove('hidden-scroll');
            if (quickDock) quickDock.classList.remove('opacity-0', 'translate-y-4');
          }
        }
        lastScrollTop = Math.max(0, currentScrollTop);
      }, { passive: true });
    });

    // Native Touch / Drag to dismiss on Bottom Sheets
    this.setupSwipeableSheet('sheet-view-settings');
    this.setupSwipeableSheet('sheet-audio-panel');
    this.setupSwipeableSheet('sheet-notifications');
    this.setupSwipeableSheet('sheet-login-accounts');

    // Keyboard Avoidance for Textarea
    const notesTextarea = document.getElementById('panel-script-notes');
    if (notesTextarea) {
      notesTextarea.addEventListener('focus', () => {
        const sheet = document.getElementById('sheet-audio-panel');
        if (sheet) {
          sheet.style.transform = 'translateY(-15%)';
        }
      });
      notesTextarea.addEventListener('blur', () => {
        const sheet = document.getElementById('sheet-audio-panel');
        if (sheet) {
          sheet.style.transform = 'translateY(0)';
        }
      });
    }

    // Backdrop dismissal
    const overlay = document.getElementById('sheet-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        this.closeViewSettings();
        this.closeAudioPanel();
        this.closeNotifications();
        this.closeLoginAccounts();
      });
    }
  },

  // Swipeable gesture controller for modal bottom sheets
  setupSwipeableSheet(sheetId) {
    if (typeof document === 'undefined') return;
    const sheet = document.getElementById(sheetId);
    if (!sheet) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const handle = sheet.querySelector('.bottom-sheet-handle') || sheet;

    handle.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      isDragging = true;
      sheet.style.transition = 'none';
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      if (deltaY > 0) {
        sheet.style.transform = `translateY(${deltaY}px)`;
      }
    }, { passive: true });

    handle.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      isDragging = false;
      sheet.style.transition = '';
      const deltaY = currentY - startY;

      // If dragged down by more than 70px, close it
      if (deltaY > 70) {
        if (sheetId === 'sheet-view-settings') {
          StoryPad.closeViewSettings();
        } else if (sheetId === 'sheet-audio-panel') {
          StoryPad.closeAudioPanel();
        } else if (sheetId === 'sheet-notifications') {
          StoryPad.closeNotifications();
        } else if (sheetId === 'sheet-login-accounts') {
          StoryPad.closeLoginAccounts();
        }
      } else {
        sheet.style.transform = 'translateY(0)';
      }
      startY = 0;
      currentY = 0;
    }, { passive: true });
  }
};

// Immediately initialize scriptData to default proj-1
StoryPad.db.scriptData = StoryPad.db.scriptDataProjects['proj-1'];

// Expose globally
if (typeof window !== 'undefined') {
  window.StoryPad = StoryPad;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StoryPad;
}

// Start application when DOM is ready
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    StoryPad.init();
  });
}
