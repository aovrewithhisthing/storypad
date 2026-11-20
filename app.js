/**
 * StoryPad (Smart Script-to-Timeline Bridge)
 * Core Application Engine & Responsive Production Controller
 */

const StoryPad = {
  supabaseConfig: {
    url: 'https://pwhrfuxwhydjiqfgjnts.supabase.co',
    anonKey: 'sb_publishable_EW9WAakXeLHajK_gaTEOBA_oIH2sat-',
    projectId: 'pwhrfuxwhydjiqfgjnts'
  },
  supabase: null,
  _realtimeChannel: null,
  _syncDebounceTimer: null,
  _noteSyncTimer: null,
  _supabaseLoadListenerAdded: false,

  state: {
    currentScreen: 'login', // 'login' | 'dashboard' | 'projects' | 'script-reader' | 'profile'
    previousScreen: 'dashboard',
    activeTab: 'home',      // 'home' | 'project-list' | 'script-reader' | 'profile'
    activeProjectId: 'proj-1',
    activeMediaTab: 'audio', // 'audio' | 'video'
    theme: 'daylight',       // 'daylight' | 'slate'
    activeProjectCategory: 'all',
    projectSearchQuery: '',
    activePersonaKey: 'scriptSupervisor',
    supabaseConnected: false,
    supabaseUser: null,

    // Active User Profile
    currentUser: {
      name: 'Aulia Larasati, S.Sn.',
      initials: 'AL',
      roleTitle: 'Lead Script Supervisor & Continuity',
      idBadge: 'SP-8842',
      studio: 'Lifelike Pictures',
      prodName: 'Senjakala Merah',
      email: 'aulia@lifelikepictures.com'
    },

    // View Filters (4 Live Filter Toggles)
    viewSettings: {
      showFileCode: true,
      filterGoodTakeOnly: false,
      highlightStatus: true,
      focusDialogueMode: false
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
      elapsedSeconds: 84
    },

    // Video Footage Playback State
    footage: {
      isPlaying: false,
      interval: null,
      frame: 12,
      seconds: 19
    },

    // Notifications Store (priority separates production notes from routine sync)
    notifications: [
      {
        id: 1,
        title: 'NLE Bridge: DaVinci Resolve Sync',
        message: 'Scene 01 Take 02 ditandai Good Take dan siap disinkronkan ke Timeline NLE.',
        time: 'Baru saja',
        type: 'sync',
        priority: 'routine',
        unread: true,
        dismissed: false
      },
      {
        id: 2,
        title: 'Sound Recordist PolyWAV 48kHz',
        message: 'Audio Boom & Lav-01 channel track disinkronkan ke CAM-A timecode.',
        time: '5 menit lalu',
        type: 'audio',
        priority: 'important',
        unread: true,
        dismissed: false
      },
      {
        id: 3,
        title: 'Continuity Supervisor Note',
        message: 'Catatan kontinuitas adegan Shot 02 berhasil diarsipkan ke draft.',
        time: '18 menit lalu',
        type: 'notes',
        priority: 'important',
        unread: false,
        dismissed: false
      },
      {
        id: 4,
        title: 'ARRI Alexa 35 Profile',
        message: 'Roll A04 terkonfigurasi pada SMPTE 24.00 FPS.',
        time: '1 jam lalu',
        type: 'camera',
        priority: 'routine',
        unread: false,
        dismissed: false
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
    },

    _clocks: {
      clockTimer: null,
      tcTimer: null
    }
  },

  // Single source of truth database for projects & screenplays
  db: {
    crewProfiles: [
      {
        personaKey: 'scriptSupervisor',
        fullName: 'Aulia Larasati, S.Sn.',
        initials: 'AL',
        roleTitle: 'Lead Script Supervisor & Continuity',
        idBadge: 'SP-8842',
        studio: 'Lifelike Pictures',
        prodName: 'Senjakala Merah',
        email: 'aulia@lifelikepictures.com',
        roles: { scriptSupervisor: true, videoEditor: true, soundRecordist: false, directorProducer: false, autoExportMeta: true }
      },
      {
        personaKey: 'videoEditor',
        fullName: 'Dimas Wicaksono',
        initials: 'DW',
        roleTitle: 'Lead Offline Video Editor',
        idBadge: 'ED-3021',
        studio: 'Lifelike Post',
        prodName: 'Senjakala Merah',
        email: 'dimas.edit@lifelikepictures.com',
        roles: { scriptSupervisor: false, videoEditor: true, soundRecordist: false, directorProducer: false, autoExportMeta: true }
      },
      {
        personaKey: 'soundRecordist',
        fullName: 'Rama Satria',
        initials: 'RS',
        roleTitle: 'Production Sound Mixer & Boom Logger',
        idBadge: 'AU-7104',
        studio: 'Lifelike Sound',
        prodName: 'Senjakala Merah',
        email: 'sound.rama@lifelikepictures.com',
        roles: { scriptSupervisor: false, videoEditor: false, soundRecordist: true, directorProducer: false, autoExportMeta: true }
      }
    ],

    projects: [
      {
        id: 'proj-1',
        code: 'PROJ-01',
        title: 'Senjakala Merah',
        category: 'Film Panjang',
        subtitle: 'Film Panjang: Senjakala Merah',
        tag: 'A-Cam',
        day: 'Day 14',
        takesLogged: 42,
        fps: '24 fps',
        goodTakePercentage: 68,
        reviewPercentage: 24,
        syncStatus: 'In Sync'
      },
      {
        id: 'proj-2',
        code: 'PROJ-02',
        title: 'Episode 4: Pelarian',
        category: 'Serial Web',
        subtitle: "Serial Web: Episode 4 'Pelarian'",
        tag: 'Sync OK',
        day: 'Day 06',
        takesLogged: 18,
        fps: '23.98 fps',
        goodTakePercentage: 45,
        reviewPercentage: 35,
        syncStatus: 'Review'
      },
      {
        id: 'proj-3',
        code: 'PROJ-03',
        title: 'Studio Promo',
        category: 'Iklan TVC',
        subtitle: 'Iklan TVC: Studio Promo',
        tag: 'New',
        day: 'Day 01',
        takesLogged: 9,
        fps: '25 fps',
        goodTakePercentage: 25,
        reviewPercentage: 20,
        syncStatus: 'Sync Hub Ready'
      }
    ],

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
            status: 'warning',
            statusLabel: 'Review',
            takes: [
              { number: 1, label: 'Take 01 | CAM-A / BOOM', tc: '01:05 SMPTE', statusLabel: 'False Start', isGood: false, isNg: false },
              { number: 2, label: 'Take 02 | CAM-A / BOOM', tc: '01:40 SMPTE', statusLabel: 'Director Pick', isGood: false, isNg: false, directorPick: true },
              { number: 3, label: 'Take 03 | CAM-A / BOOM', tc: '01:35 SMPTE', statusLabel: 'NG (Mic Shadow)', isGood: false, isNg: true }
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
            status: 'good',
            statusLabel: 'Good Take',
            takes: [
              { number: 1, label: 'Take 01 | CAM-A / BOOM', tc: '01:14 SMPTE', statusLabel: 'False Start', isGood: false, isNg: false },
              { number: 2, label: 'Take 02 | CAM-A / BOOM', tc: '02:45 SMPTE | MASTER SYNC', statusLabel: 'GOOD TAKE', isGood: true, isNg: false, directorPick: true },
              { number: 3, label: 'Take 03 | CAM-A / BOOM', tc: '02:10 SMPTE', statusLabel: 'NG (Mic Shadow)', isGood: false, isNg: true }
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
            status: 'pending',
            statusLabel: 'Pending Shoot',
            takes: [
              { number: 1, label: 'Take 01 | CAM-A / BOOM', tc: '00:58 SMPTE', statusLabel: 'False Start', isGood: false, isNg: false },
              { number: 2, label: 'Take 02 | CAM-A / BOOM', tc: '01:12 SMPTE', statusLabel: 'NG (Focus Pull)', isGood: false, isNg: true }
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
              { number: 1, label: 'Take 01 | CAM-A / BOOM', tc: '01:02 SMPTE', statusLabel: 'Hold', isGood: false, isNg: false }
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
              { number: 1, label: 'Take 01 | CAM-A / BOOM', tc: '01:08 SMPTE', statusLabel: 'False Start', isGood: false, isNg: false },
              { number: 2, label: 'Take 02 | CAM-A / BOOM', tc: '01:52 SMPTE', statusLabel: 'NG (Sound Glitch)', isGood: false, isNg: true },
              { number: 3, label: 'Take 03 | CAM-A / BOOM', tc: '02:15 SMPTE | MASTER SYNC', statusLabel: 'GOOD TAKE', isGood: true, isNg: false, directorPick: true }
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
              { number: 1, label: 'Take 01 | CAM-A / BOOM', tc: '01:20 SMPTE', statusLabel: 'Director Pick', isGood: true, isNg: false },
              { number: 2, label: 'Take 02 | CAM-A / BOOM', tc: '01:10 SMPTE', statusLabel: 'NG (Boom Shadow)', isGood: false, isNg: true }
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
              { number: 1, label: 'Take 01 | CAM-A / BOOM', tc: '00:45 SMPTE', statusLabel: 'Hold', isGood: false, isNg: false }
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
              { number: 1, label: 'Take 01 | CAM-A / BOOM', tc: '00:30 SMPTE | MASTER SYNC', statusLabel: 'GOOD TAKE', isGood: true, isNg: false, directorPick: true }
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
              { number: 1, label: 'Take 01 | CAM-A / BOOM', tc: '00:25 SMPTE', statusLabel: 'Pending', isGood: false, isNg: false }
            ]
          }
        ]
      }
    },

    scriptData: null
  },

  init() {
    this.db.scriptData = this.db.scriptDataProjects[this.state.activeProjectId] || this.db.scriptDataProjects['proj-1'];
    this.loadPersistedSettings();
    this.applyTheme(this.state.theme);
    this.bindEvents();
    this.renderScreen('login');
    this.updateDashboardData();
    this.updateProgressGauge();
    this.initAudioContext();
    this.updateStatusBarClock();
    this.startLiveClocks();
    this.renderProfileRoles();
    this.renderCrewAccountsList();
    this.updateNotificationIndicators();
    this.initSupabase();
  },

  initSupabase() {
    if (typeof window === 'undefined') return;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      if (!this._supabaseLoadListenerAdded && typeof window.addEventListener === 'function') {
        this._supabaseLoadListenerAdded = true;
        window.addEventListener('load', () => this.initSupabase(), { once: true });
      }
      return;
    }

    if (this.supabase) return;
    try {
      this.supabase = window.supabase.createClient(this.supabaseConfig.url, this.supabaseConfig.anonKey);
      this.updateSupabaseStatusBadge('Menghubungkan...', 'neutral');

      this.supabase.auth.getSession().then(({ data }) => {
        if (data && data.session && data.session.user) {
          this.applyAuthenticatedSupabaseUser(data.session.user);
        }
      }).catch(() => {});

      this.supabase.auth.onAuthStateChange((_event, session) => {
        if (session && session.user) {
          this.applyAuthenticatedSupabaseUser(session.user);
        } else {
          this.state.supabaseUser = null;
        }
      });

      this.syncFromSupabase();
      this.subscribeRealtime();
    } catch (e) {
      this.updateSupabaseStatusBadge('Mode Lokal', 'neutral');
    }
  },

  updateSupabaseStatusBadge(text, variant = 'neutral') {
    const badge = document.getElementById('supabase-status-badge');
    if (!badge) return;
    badge.textContent = text;
    badge.className = `sp-badge font-mono ${variant === 'good' ? 'sp-badge-good' : (variant === 'amber' ? 'sp-badge-amber' : 'sp-badge-neutral')}`;
  },

  applyAuthenticatedSupabaseUser(user) {
    this.state.supabaseUser = user;
    const email = user.email || '';
    const displayName = (user.user_metadata && user.user_metadata.full_name) ? user.user_metadata.full_name : (email.split('@')[0] || 'Kru Produksi');
    const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'SP';
    this.state.currentUser = {
      ...this.state.currentUser,
      name: displayName,
      initials,
      email
    };
    this.renderProfileRoles();
  },

  async syncFromSupabase() {
    if (!this.supabase) return;
    try {
      const [projRes, linesRes, takesRes, crewRes, notifRes] = await Promise.all([
        this.supabase.from('projects').select('*').order('sort_order', { ascending: true }),
        this.supabase.from('script_lines').select('*').order('sort_order', { ascending: true }),
        this.supabase.from('takes').select('*').order('take_number', { ascending: true }),
        this.supabase.from('crew_profiles').select('*'),
        this.supabase.from('notifications').select('*').order('id', { ascending: true })
      ]);

      if (projRes.error || linesRes.error || takesRes.error) {
        this.updateSupabaseStatusBadge('Sinkronisasi Tertunda', 'amber');
        return;
      }

      const projRows = projRes.data || [];
      const lineRows = linesRes.data || [];
      const takeRows = takesRes.data || [];

      if (projRows.length > 0) {
        this.db.projects = projRows.map(p => ({
          id: p.id,
          code: p.code,
          title: p.title,
          category: p.category,
          subtitle: p.subtitle,
          tag: p.tag,
          day: p.day,
          takesLogged: p.takes_logged,
          fps: p.fps,
          goodTakePercentage: p.good_take_percentage,
          reviewPercentage: p.review_percentage,
          syncStatus: p.sync_status
        }));

        const takesByDialogue = {};
        takeRows.forEach(t => {
          if (!takesByDialogue[t.dialogue_id]) takesByDialogue[t.dialogue_id] = [];
          takesByDialogue[t.dialogue_id].push({
            number: t.take_number,
            label: t.label,
            tc: t.tc,
            statusLabel: t.status_label,
            isGood: !!t.is_good,
            isNg: !!t.is_ng,
            directorPick: !!t.director_pick
          });
        });

        const rebuiltProjects = {};
        projRows.forEach(p => {
          const pLines = lineRows.filter(l => l.project_id === p.id).map(l => {
            if (l.line_type === 'action') {
              return {
                id: l.id,
                type: 'action',
                content: l.content || ''
              };
            }
            if (l.continuity_note !== undefined && l.continuity_note !== null && l.continuity_note !== '') {
              this.state.scriptNotes[l.id] = l.continuity_note;
            }
            return {
              id: l.id,
              type: 'dialogue',
              character: l.character_name || '',
              timecode: l.timecode || '',
              text: l.dialogue_text || '',
              keyword: l.keyword || '',
              shot: l.shot || '01',
              status: l.status || 'pending',
              statusLabel: l.status_label || 'Pending Shoot',
              takes: takesByDialogue[l.id] || []
            };
          });

          rebuiltProjects[p.id] = {
            projectId: p.id,
            projectTitle: p.subtitle || p.title,
            draft: p.draft,
            scene: {
              number: p.scene_number,
              shotNumber: p.shot_number,
              slugNumber: p.slug_number,
              title: p.scene_title,
              timecode: p.scene_timecode,
              takeInfo: p.take_info
            },
            lines: pLines
          };
        });

        this.db.scriptDataProjects = rebuiltProjects;
        this.db.scriptData = this.db.scriptDataProjects[this.state.activeProjectId] || this.db.scriptDataProjects['proj-1'];
      }

      if (crewRes && !crewRes.error && Array.isArray(crewRes.data) && crewRes.data.length > 0) {
        this.db.crewProfiles = crewRes.data.map(c => ({
          personaKey: c.persona_key,
          fullName: c.full_name,
          initials: c.initials,
          roleTitle: c.role_title,
          idBadge: c.id_badge,
          studio: c.studio,
          prodName: c.prod_name,
          email: c.email,
          roles: c.roles || { scriptSupervisor: true, videoEditor: false, soundRecordist: false, directorProducer: false, autoExportMeta: true }
        }));
        this.renderCrewAccountsList();
        const activeCrew = this.db.crewProfiles.find(c => c.personaKey === this.state.activePersonaKey);
        if (activeCrew && activeCrew.roles) {
          this.state.roles = { ...this.state.roles, ...activeCrew.roles };
        }
      }

      if (notifRes && !notifRes.error && Array.isArray(notifRes.data) && notifRes.data.length > 0) {
        this.state.notifications = notifRes.data.map(n => ({
          id: n.id,
          title: n.title,
          message: n.message,
          time: n.time_label,
          type: n.notif_type,
          priority: n.priority,
          unread: !!n.unread,
          dismissed: !!n.dismissed
        }));
      }

      this.state.supabaseConnected = true;
      this.updateSupabaseStatusBadge('Supabase Terhubung', 'good');
      this.updateDashboardData();
      this.updateProgressGauge();
      this.renderScriptContent();
      this.renderPanelContent();
      this.renderProfileRoles();
      this.renderNotificationsList();
    } catch (e) {
      this.updateSupabaseStatusBadge('Mode Lokal', 'neutral');
    }
  },

  subscribeRealtime() {
    if (!this.supabase || this._realtimeChannel) return;
    const scheduleSync = () => {
      clearTimeout(this._syncDebounceTimer);
      this._syncDebounceTimer = setTimeout(() => {
        this.syncFromSupabase();
      }, 180);
    };

    this._realtimeChannel = this.supabase
      .channel('storypad-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'script_lines' }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'takes' }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crew_profiles' }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, scheduleSync)
      .subscribe();
  },

  loadPersistedSettings() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedView = localStorage.getItem('storypad_view_settings');
        if (savedView) {
          this.state.viewSettings = { ...this.state.viewSettings, ...JSON.parse(savedView) };
        }
        const savedRoles = localStorage.getItem('storypad_roles');
        if (savedRoles) {
          this.state.roles = { ...this.state.roles, ...JSON.parse(savedRoles) };
        }
        const savedUser = localStorage.getItem('storypad_user');
        if (savedUser) {
          this.state.currentUser = { ...this.state.currentUser, ...JSON.parse(savedUser) };
        }
        const savedPersona = localStorage.getItem('storypad_persona_key');
        if (savedPersona) {
          this.state.activePersonaKey = savedPersona;
        }
        const savedTheme = localStorage.getItem('storypad_theme');
        if (savedTheme === 'daylight' || savedTheme === 'slate') {
          this.state.theme = savedTheme;
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
        localStorage.setItem('storypad_persona_key', this.state.activePersonaKey);
        localStorage.setItem('storypad_theme', this.state.theme);
      }
    } catch (e) {}
  },

  applyTheme(themeName) {
    const nextTheme = themeName === 'slate' ? 'slate' : 'daylight';
    this.state.theme = nextTheme;
    if (typeof document === 'undefined') return;
    if (document.documentElement && typeof document.documentElement.setAttribute === 'function') {
      document.documentElement.setAttribute('data-theme', nextTheme);
    }
    const labelText = nextTheme === 'daylight' ? 'Mode Slate Gelap' : 'Mode Kertas Editorial';
    document.querySelectorAll('.theme-label-text').forEach(el => {
      el.textContent = labelText;
    });

    const dayBtns = [document.getElementById('profile-theme-daylight'), document.getElementById('view-theme-daylight')];
    const slateBtns = [document.getElementById('profile-theme-slate'), document.getElementById('view-theme-slate')];
    dayBtns.forEach(btn => {
      if (!btn || !btn.classList) return;
      if (nextTheme === 'daylight') {
        btn.classList.add('sp-btn-primary');
        btn.classList.remove('sp-btn-secondary');
      } else {
        btn.classList.remove('sp-btn-primary');
        btn.classList.add('sp-btn-secondary');
      }
    });
    slateBtns.forEach(btn => {
      if (!btn || !btn.classList) return;
      if (nextTheme === 'slate') {
        btn.classList.add('sp-btn-primary');
        btn.classList.remove('sp-btn-secondary');
      } else {
        btn.classList.remove('sp-btn-primary');
        btn.classList.add('sp-btn-secondary');
      }
    });
  },

  setTheme(themeName) {
    this.triggerHaptic();
    this.applyTheme(themeName);
    this.savePersistedSettings();
    this.showToast(themeName === 'slate' ? 'Tema Slate Gelap diaktifkan' : 'Tema Kertas Editorial diaktifkan');
  },

  toggleTheme() {
    this.setTheme(this.state.theme === 'daylight' ? 'slate' : 'daylight');
  },

  initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.state.audio.context = new AudioContext();
      }
    } catch (e) {}
  },

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

  triggerHaptic() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch (e) {}
    }
  },

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
    } else if (screenId === 'script-reader') {
      this.state.activeTab = 'script-reader';
    } else if (screenId === 'profile') {
      this.state.activeTab = 'profile';
    }

    this.closeAllModals(true);
    this.renderScreen(screenId);
    this.updateNavbarVisibility();
    this.updateActiveTabStyles();
  },

  goBack() {
    this.triggerHaptic();
    const target = (this.state.previousScreen && this.state.previousScreen !== 'script-reader' && this.state.previousScreen !== 'login')
      ? this.state.previousScreen
      : 'projects';
    const tab = target === 'dashboard' ? 'home' : (target === 'projects' ? 'project-list' : 'profile');
    this.navigate(target, tab);
  },

  openProject(projectId) {
    this.triggerHaptic();
    this.state.activeProjectId = projectId;
    if (this.db.scriptDataProjects[projectId]) {
      this.db.scriptData = this.db.scriptDataProjects[projectId];
      const firstDialogue = this.db.scriptData.lines.find(l => l.type === 'dialogue');
      if (firstDialogue) {
        this.state.activeDialogueId = firstDialogue.id;
        this.state.activeTakeNumber = (firstDialogue.takes && firstDialogue.takes.length > 0) ? firstDialogue.takes[0].number : 1;
      }
      const proj = this.db.projects.find(p => p.id === projectId);
      if (proj) {
        this.state.currentUser.prodName = proj.title;
      }
    }
    this.updateProgressGauge();
    this.updateDashboardData();
    this.navigate('script-reader', 'script-reader');
  },

  openProjectPanel(projectId, dialogueId, focusTarget = 'audio') {
    this.state.activeProjectId = projectId;
    if (this.db.scriptDataProjects[projectId]) {
      this.db.scriptData = this.db.scriptDataProjects[projectId];
    }
    this.openAudioPanel(dialogueId, focusTarget);
  },

  renderScreen(screenId) {
    if (typeof document !== 'undefined' && document.body && typeof document.body.setAttribute === 'function') {
      document.body.setAttribute('data-active-screen', screenId);
    }

    document.querySelectorAll('.screen-view').forEach(view => {
      view.classList.add('hidden');
      if (typeof view.setAttribute === 'function') {
        view.setAttribute('aria-hidden', 'true');
      }
    });

    const activeView = document.getElementById(`screen-${screenId}`);
    if (activeView) {
      activeView.classList.remove('hidden');
      if (typeof activeView.setAttribute === 'function') {
        activeView.setAttribute('aria-hidden', 'false');
      }
      const scrollParent = (typeof activeView.closest === 'function') ? (activeView.closest('.screen-viewport') || activeView) : activeView;
      if (scrollParent) scrollParent.scrollTop = 0;
    }

    if (screenId === 'dashboard') {
      this.updateDashboardData();
      this.updateProgressGauge();
    } else if (screenId === 'projects') {
      this.syncProjectFilterState();
    } else if (screenId === 'script-reader') {
      this.renderScriptContent();
      this.renderPanelContent();
    } else if (screenId === 'profile') {
      this.renderProfileRoles();
    }
  },

  updateNavbarVisibility() {
    const navbar = document.getElementById('floating-navbar');
    if (!navbar) return;

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
        if (typeof tab.setAttribute === 'function') tab.setAttribute('aria-current', 'page');
      } else {
        tab.className = 'nav-capsule-tab';
        if (typeof tab.removeAttribute === 'function') tab.removeAttribute('aria-current');
      }
    });
  },

  // Populate Dashboard active project, real audio filenames, and project summary list
  updateDashboardData() {
    const proj = this.db.projects.find(p => p.id === this.state.activeProjectId) || this.db.projects[0];
    const script = this.db.scriptData || this.db.scriptDataProjects['proj-1'];
    if (!proj || !script) return;

    const titleEl = document.getElementById('dash-active-proj-title');
    const metaEl = document.getElementById('dash-active-proj-meta');
    const sceneLineEl = document.getElementById('dash-active-scene-line');
    const sceneBadgeEl = document.getElementById('dash-scene-badge');
    const nextActionEl = document.getElementById('dash-next-action');
    const navProdEl = document.getElementById('nav-prod-name');

    if (titleEl) titleEl.textContent = proj.title;
    if (metaEl) metaEl.textContent = `${proj.category} | ${proj.day} | ${proj.fps}`;
    if (sceneLineEl && script.scene) sceneLineEl.textContent = script.scene.title;
    if (sceneBadgeEl && script.scene) sceneBadgeEl.textContent = `Scene ${script.scene.number}`;
    if (navProdEl) navProdEl.textContent = proj.title;

    const dialogues = script.lines.filter(l => l.type === 'dialogue');
    const goodCount = dialogues.filter(d => d.status === 'good').length;
    const pendingDialogue = dialogues.find(d => d.status !== 'good');
    if (nextActionEl) {
      if (pendingDialogue) {
        nextActionEl.textContent = `${goodCount} dari ${dialogues.length} dialog pada Scene ${script.scene.number} sudah ditandai Good Take. Tinjau ${pendingDialogue.character} (Shot ${pendingDialogue.shot}) untuk langkah selanjutnya.`;
      } else {
        nextActionEl.textContent = `Semua ${dialogues.length} dialog pada Scene ${script.scene.number} sudah berstatus Good Take dan siap diekspor ke editor NLE.`;
      }
    }

    // Update Dashboard audio master tracks with real generated names from active project
    const track1El = document.getElementById('dash-track-1-name');
    const track2El = document.getElementById('dash-track-2-name');
    if (dialogues.length > 0) {
      const firstGood = dialogues.find(d => d.status === 'good') || dialogues[0];
      const secondDlg = dialogues.find(d => d.id !== firstGood.id) || firstGood;
      const n1 = this.generateFileNames(firstGood.id, (firstGood.takes && firstGood.takes[0]) ? firstGood.takes[0].number : 1);
      const n2 = this.generateFileNames(secondDlg.id, (secondDlg.takes && secondDlg.takes[0]) ? secondDlg.takes[0].number : 1);
      if (track1El) track1El.textContent = n1.audioName;
      if (track2El) track2El.textContent = n2.audioName;
    }

    // Render consistent project rows on Dashboard
    const listEl = document.getElementById('dash-projects-list');
    if (listEl) {
      listEl.innerHTML = this.db.projects.map(p => {
        const sc = this.db.scriptDataProjects[p.id];
        const firstDlg = sc && sc.lines ? sc.lines.find(l => l.type === 'dialogue') : null;
        const firstDlgId = firstDlg ? firstDlg.id : 'd-2';
        const statusCls = p.syncStatus === 'In Sync' ? 'sp-badge-good' : (p.syncStatus === 'Review' ? 'sp-badge-amber' : 'sp-badge-blue');
        return `
          <div class="p-3 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5" style="background-color: var(--panel-lowest); border-color: var(--border-flat);">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <button type="button" class="font-sans text-sm font-bold text-left hover:underline bg-transparent border-0 p-0" style="color: var(--text-primary);" onclick="StoryPad.openProject('${p.id}')">
                  ${p.title}
                </button>
                <span class="sp-badge ${statusCls}">${p.syncStatus}</span>
              </div>
              <p class="font-mono text-[11px] mt-0.5 tabular-nums" style="color: var(--text-secondary);">
                ${p.category} | ${p.day} | ${p.takesLogged} Takes | ${p.fps}
              </p>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.openProject('${p.id}')">Naskah</button>
              <button type="button" class="sp-icon-btn" aria-label="Putar audio ${p.title}" onclick="StoryPad.openProjectPanel('${p.id}', '${firstDlgId}', 'audio')">
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">play_arrow</span>
              </button>
              <button type="button" class="sp-icon-btn" aria-label="Buka footage ${p.title}" onclick="StoryPad.openProjectPanel('${p.id}', '${firstDlgId}', 'video')">
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">videocam</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  },

  // Dynamic Progress Gauge Calculation
  updateProgressGauge() {
    if (!this.db.scriptData || !this.db.scriptData.lines) return;

    const dialogues = this.db.scriptData.lines.filter(l => l.type === 'dialogue');
    const goodTakeCount = dialogues.filter(d => d.status === 'good').length;
    const totalCount = dialogues.length || 1;
    const percentage = Math.round((goodTakeCount / totalCount) * 100);

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
      takesBadge.textContent = `${goodTakeCount} / ${totalCount} Dialog`;
    }
    if (circleBadge) {
      circleBadge.textContent = `${goodTakeCount} Confirmed`;
    }
  },

  // Auto-Naming Engine: [KodeScene]_[KodeShot]_[NomorTake]_[KataKunciDialog]_[CAM-A.mp4 / AUD.wav]
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

    // Highlight active project switcher button
    document.querySelectorAll('.script-proj-switch').forEach(btn => {
      const pid = btn.getAttribute('data-project-id');
      if (pid === this.state.activeProjectId) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });

    // Update active filter summary
    const filterSummaryEl = document.getElementById('script-filter-summary');
    if (filterSummaryEl) {
      const activeFilters = [];
      if (this.state.viewSettings.showFileCode) activeFilters.push('Kode File');
      if (this.state.viewSettings.filterGoodTakeOnly) activeFilters.push('Good Take Only');
      if (this.state.viewSettings.highlightStatus) activeFilters.push('Highlight Status');
      if (this.state.viewSettings.focusDialogueMode) activeFilters.push('Fokus Dialog');
      filterSummaryEl.textContent = activeFilters.length > 0
        ? `Filter aktif: ${activeFilters.join(', ')}`
        : 'Semua filter tampilan nonaktif';
    }

    const { lines } = this.db.scriptData;
    const { showFileCode, highlightStatus, focusDialogueMode, filterGoodTakeOnly } = this.state.viewSettings;

    let html = '';
    let renderedDialogues = 0;

    lines.forEach(line => {
      if (focusDialogueMode && line.type === 'action') {
        return;
      }

      if (line.type === 'action') {
        html += `
          <div class="font-mono text-xs leading-relaxed px-3 py-2 rounded border-l-2" style="color: var(--text-secondary); background-color: var(--panel-lowest); border-left-color: var(--border-control);">
            ${line.content}
          </div>
        `;
      } else if (line.type === 'dialogue') {
        const isSelected = line.id === this.state.activeDialogueId;
        const statusClass = highlightStatus ? `status-${line.status}` : '';
        const naming = this.generateFileNames(line.id, this.state.activeTakeNumber);
        const hasGoodTake = line.status === 'good' || (line.takes && line.takes.some(t => t.isGood));

        if (filterGoodTakeOnly && !hasGoodTake) {
          return;
        }
        renderedDialogues++;

        const badgeHtml = hasGoodTake
          ? `<span class="sp-badge sp-badge-good">GOOD TAKE</span>`
          : (line.status === 'warning'
            ? `<span class="sp-badge sp-badge-amber">REVIEW</span>`
            : `<span class="sp-badge sp-badge-neutral">PENDING</span>`);

        const takeCount = line.takes ? line.takes.length : 0;

        html += `
          <article class="script-line-card p-3.5 md:p-4 ${statusClass} ${isSelected ? 'selected' : ''}" id="script-cue-${line.id}">
            <div class="flex flex-col md:flex-row md:items-start justify-between gap-3">
              <div class="flex flex-col gap-1.5 min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <button type="button"
                          class="font-sans text-xs font-bold uppercase tracking-wide bg-transparent border-0 p-0 text-left hover:underline"
                          style="color: ${isSelected ? 'var(--primary-text)' : 'var(--text-primary)'};"
                          aria-pressed="${isSelected ? 'true' : 'false'}"
                          onclick="StoryPad.selectDialogueLine('${line.id}')">
                    ${line.character}
                  </button>
                  <span class="font-mono text-xs tabular-nums" style="color: var(--text-secondary);">SH ${line.shot}</span>
                  <span class="font-mono text-xs tabular-nums" style="color: var(--text-muted);">${line.timecode}</span>
                  ${badgeHtml}
                  ${isSelected ? `<span class="sp-badge sp-badge-blue">Aktif di Deck</span>` : ''}
                </div>

                <button type="button"
                        class="text-left bg-transparent border-0 p-0 font-mono text-sm leading-relaxed select-text"
                        style="color: var(--text-script);"
                        onclick="StoryPad.selectDialogueLine('${line.id}')">
                  ${line.text}
                </button>

                ${showFileCode ? `
                  <div class="pt-1 flex flex-wrap items-center gap-2">
                    <code class="font-mono text-[11px] px-2 py-0.5 rounded border truncate max-w-full" style="background-color: var(--panel-bg); border-color: var(--border-flat); color: var(--primary-text);">
                      ${naming.videoName}
                    </code>
                    <span class="font-mono text-[11px] tabular-nums" style="color: var(--text-muted);">${takeCount} take</span>
                  </div>
                ` : ''}
              </div>

              <!-- Operational Cue Actions -->
              <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" aria-label="Putar Audio ${line.character}" onclick="StoryPad.openAudioPanel('${line.id}', 'audio')">
                  <span class="material-symbols-outlined text-[16px]" aria-hidden="true">play_arrow</span>
                  <span>Audio</span>
                </button>
                <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" aria-label="Buka Footage ${line.character}" onclick="StoryPad.openAudioPanel('${line.id}', 'video')">
                  <span class="material-symbols-outlined text-[16px]" aria-hidden="true">videocam</span>
                  <span>Footage</span>
                </button>
                <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" aria-label="Catatan Kontinuitas ${line.character}" onclick="StoryPad.openAudioPanel('${line.id}', 'notes')">
                  <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit_note</span>
                  <span>Catatan</span>
                </button>
              </div>
            </div>
          </article>
        `;
      }
    });

    if (renderedDialogues === 0) {
      html += `
        <div class="p-6 rounded border text-center" style="background-color: var(--panel-lowest); border-color: var(--border-flat);">
          <p class="font-sans text-sm font-semibold mb-1" style="color: var(--text-primary);">Tidak ada dialog berstatus Good Take pada adegan ini</p>
          <p class="font-sans text-xs mb-4" style="color: var(--text-secondary);">Filter Good Take Only sedang menyembunyikan dialog berstatus Review dan Pending Shoot.</p>
          <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.handleViewToggle('filterGoodTakeOnly', false); StoryPad.syncViewTogglesUI();">
            Tampilkan Semua Dialog
          </button>
        </div>
      `;
    }

    container.innerHTML = html;
  },

  selectDialogueLine(dialogueId) {
    this.triggerHaptic();
    this.state.activeDialogueId = dialogueId;
    const dialogue = this.db.scriptData && this.db.scriptData.lines
      ? this.db.scriptData.lines.find(l => l.id === dialogueId)
      : null;
    if (dialogue && dialogue.takes && dialogue.takes.length > 0) {
      const preferred = dialogue.takes.find(t => t.isGood) || dialogue.takes[0];
      this.state.activeTakeNumber = preferred.number;
    } else {
      this.state.activeTakeNumber = 1;
    }
    this.renderScriptContent();
    this.renderPanelContent();
  },

  // View Settings Modal Controls
  openViewSettings() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-view-settings');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet && overlay) {
      overlay.classList.add('active');
      sheet.classList.add('open');
      sheet.style.transform = '';
      this.syncViewTogglesUI();
    }
  },

  closeViewSettings() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-view-settings');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet) {
      sheet.classList.remove('open');
      sheet.style.transform = '';
    }
    if (overlay) overlay.classList.remove('active');
  },

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

  handleViewToggle(settingKey, isChecked) {
    this.triggerHaptic();
    this.state.viewSettings[settingKey] = isChecked;
    this.savePersistedSettings();
    this.renderScriptContent();
    if (settingKey === 'filterGoodTakeOnly') {
      this.renderPanelTakes();
    }
  },

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
    this.showToast('Pengaturan tampilan dikembalikan ke default');
  },

  // Switch Media Tab inside Inspector Panel (Audio Monitor vs Footage Preview)
  switchPanelMediaTab(tab = 'audio') {
    this.triggerHaptic();
    this.state.activeMediaTab = tab;

    const audioBtn = document.getElementById('panel-tab-audio');
    const videoBtn = document.getElementById('panel-tab-video');
    const audioContainer = document.getElementById('panel-audio-container');
    const footageContainer = document.getElementById('panel-footage-container');

    if (tab === 'video') {
      if (videoBtn) {
        videoBtn.className = 'min-h-[40px] py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors bg-[#2563EB] text-white';
        if (typeof videoBtn.setAttribute === 'function') videoBtn.setAttribute('aria-selected', 'true');
      }
      if (audioBtn) {
        audioBtn.className = 'min-h-[40px] py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors text-[#A1A9B8] hover:text-white';
        if (typeof audioBtn.setAttribute === 'function') audioBtn.setAttribute('aria-selected', 'false');
      }
      if (footageContainer) footageContainer.classList.remove('hidden');
      if (audioContainer) audioContainer.classList.add('hidden');
    } else {
      if (audioBtn) {
        audioBtn.className = 'min-h-[40px] py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors bg-[#2563EB] text-white';
        if (typeof audioBtn.setAttribute === 'function') audioBtn.setAttribute('aria-selected', 'true');
      }
      if (videoBtn) {
        videoBtn.className = 'min-h-[40px] py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors text-[#A1A9B8] hover:text-white';
        if (typeof videoBtn.setAttribute === 'function') videoBtn.setAttribute('aria-selected', 'false');
      }
      if (audioContainer) audioContainer.classList.remove('hidden');
      if (footageContainer) footageContainer.classList.add('hidden');
    }
  },

  // Open Inspector Panel
  openAudioPanel(dialogueId = this.state.activeDialogueId, focusTarget = 'audio') {
    this.triggerHaptic();
    this.state.activeDialogueId = dialogueId;

    const dialogue = this.db.scriptData && this.db.scriptData.lines
      ? this.db.scriptData.lines.find(l => l.id === dialogueId)
      : null;
    if (dialogue && dialogue.takes && dialogue.takes.length > 0) {
      const targetTake = dialogue.takes.find(t => t.number === 2) || dialogue.takes[0];
      this.state.activeTakeNumber = targetTake.number;
    } else {
      this.state.activeTakeNumber = 2;
    }

    const sheet = document.getElementById('sheet-audio-panel');
    const overlay = document.getElementById('sheet-overlay');

    this.renderScriptContent();
    this.renderPanelContent();

    if (focusTarget === 'video') {
      this.switchPanelMediaTab('video');
    } else {
      this.switchPanelMediaTab('audio');
    }

    const isDesktopDocked = typeof window !== 'undefined' && window.innerWidth >= 1024 && this.state.currentScreen === 'script-reader';

    if (sheet && overlay) {
      if (!isDesktopDocked) {
        overlay.classList.add('active');
        sheet.classList.add('open');
        sheet.style.transform = '';
      }

      if (focusTarget === 'notes') {
        setTimeout(() => {
          const notesArea = document.getElementById('panel-script-notes');
          if (notesArea && typeof notesArea.focus === 'function') {
            notesArea.focus();
            if (typeof notesArea.scrollIntoView === 'function') {
              notesArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 250);
      }
    }
  },

  closeAudioPanel() {
    this.triggerHaptic();
    this.stopAudioPlayback();
    this.stopFootagePlayback();
    const sheet = document.getElementById('sheet-audio-panel');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet) {
      sheet.classList.remove('open');
      sheet.style.transform = '';
    }
    if (overlay) overlay.classList.remove('active');
  },

  renderPanelContent() {
    const dialogue = (this.db.scriptData && this.db.scriptData.lines)
      ? (this.db.scriptData.lines.find(l => l.id === this.state.activeDialogueId) || this.db.scriptData.lines[2])
      : { shot: '02' };

    const sceneNum = (this.db.scriptData && this.db.scriptData.scene) ? this.db.scriptData.scene.number : '01';

    const titleEl = document.getElementById('panel-scene-title');
    if (titleEl) {
      titleEl.innerHTML = `Panel Audio &amp; Skrip <span class="text-xs text-[#A1A9B8] font-normal font-mono">(Scene ${sceneNum} / Shot ${dialogue.shot || '02'})</span>`;
    }

    const slateSc = document.getElementById('footage-scene-badge');
    const slateSh = document.getElementById('footage-shot-badge');
    const slateTk = document.getElementById('footage-take-badge');
    if (slateSc) slateSc.textContent = `SC ${sceneNum}`;
    if (slateSh) slateSh.textContent = `SH ${dialogue.shot || '02'}`;
    if (slateTk) slateTk.textContent = `TK ${String(this.state.activeTakeNumber).padStart(2, '0')}`;

    this.renderPanelTakes();
    this.updatePanelAutoNaming();

    const notesEl = document.getElementById('panel-script-notes');
    if (notesEl) {
      notesEl.value = this.state.scriptNotes[this.state.activeDialogueId] || 'Catatan: Kontinuitas adegan aman. Audio boom jernih.';
    }
  },

  renderPanelTakes() {
    const listEl = document.getElementById('panel-takes-list');
    if (!listEl || !this.db.scriptData) return;

    const dialogue = this.db.scriptData.lines.find(l => l.id === this.state.activeDialogueId) || this.db.scriptData.lines[2];
    const sceneNum = this.db.scriptData.scene ? this.db.scriptData.scene.number : '01';
    const allTakes = dialogue.takes || [];

    const headerLabel = document.getElementById('panel-takes-header-label');
    const countBadge = document.getElementById('panel-takes-count-badge');
    if (headerLabel) {
      headerLabel.textContent = `Daftar Rekaman Take (Scene ${sceneNum} / Shot ${dialogue.shot || '02'})`;
    }
    if (countBadge) {
      countBadge.textContent = `${allTakes.length} Take`;
    }

    let takes = allTakes;
    if (this.state.viewSettings.filterGoodTakeOnly) {
      takes = takes.filter(t => t.isGood);
    }

    if (allTakes.length === 0) {
      listEl.innerHTML = `
        <div class="p-3 bg-[#12151B] border border-[#2A2E39] rounded text-center flex flex-col items-center gap-2">
          <p class="font-sans text-xs text-[#F3F4F6] font-semibold">Belum ada take terekam pada dialog ini</p>
          <p class="font-sans text-[11px] text-[#A1A9B8]">Catat take pertama untuk menghasilkan kode penamaan file.</p>
          <button type="button" class="sp-btn sp-btn-monitor sp-btn-compact" onclick="StoryPad.logNewTake()">
            Catat Take 01
          </button>
        </div>
      `;
      return;
    }

    if (takes.length === 0) {
      listEl.innerHTML = `
        <div class="p-3 bg-[#12151B] border border-[#2A2E39] rounded text-center flex flex-col items-center gap-2">
          <p class="font-sans text-xs text-[#F3F4F6] font-semibold">Tidak ada Good Take pada dialog ini</p>
          <p class="font-sans text-[11px] text-[#A1A9B8]">Filter Good Take Only aktif menyembunyikan ${allTakes.length} take lainnya.</p>
          <button type="button" class="sp-btn sp-btn-monitor sp-btn-compact" onclick="StoryPad.handleViewToggle('filterGoodTakeOnly', false); StoryPad.syncViewTogglesUI();">
            Tampilkan Semua Take
          </button>
        </div>
      `;
      return;
    }

    let html = '';
    takes.forEach(t => {
      const isSelected = t.number === this.state.activeTakeNumber;
      const isGood = t.isGood;
      const isNg = t.isNg;
      const takePad = String(t.number).padStart(2, '0');

      const rowBorder = isSelected
        ? (isGood ? 'border-[#10B981] bg-[#064E3B]' : 'border-[#3B82F6] bg-[#1E293B]')
        : 'border-[#2A2E39] bg-[#12151B]';

      const statusBadge = isGood
        ? `<span class="px-2 py-0.5 rounded bg-[#047857] text-white font-sans text-[10px] font-bold uppercase">GOOD TAKE</span>`
        : (isNg
          ? `<span class="px-2 py-0.5 rounded bg-[#450A0A] border border-[#EF4444] text-[#F87171] font-sans text-[10px] font-semibold">${t.statusLabel}</span>`
          : `<span class="px-2 py-0.5 rounded bg-[#1E222B] border border-[#6A748B] text-[#F3F4F6] font-sans text-[10px]">${t.statusLabel}</span>`);

      html += `
        <div class="border ${rowBorder} p-2.5 rounded flex items-center justify-between gap-2 transition-colors">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <button aria-label="Audisi Take ${takePad}"
                    type="button"
                    onclick="StoryPad.previewTakeAudio(${t.number})"
                    class="w-10 h-10 rounded ${isGood ? 'bg-[#047857] text-white' : 'bg-[#1E222B] text-[#F3F4F6] border border-[#6A748B]'} flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">${isSelected && StoryPad.state.audio.isPlaying ? 'volume_up' : 'play_arrow'}</span>
            </button>
            <button type="button"
                    onclick="StoryPad.selectTake(${t.number})"
                    class="min-w-0 flex-1 text-left bg-transparent border-0 p-1 rounded">
              <span class="block font-sans text-xs font-bold text-[#F3F4F6] truncate">
                T${takePad} | ${t.label}
              </span>
              <span class="block font-mono text-[11px] ${isGood ? 'text-[#A7F3D0]' : 'text-[#A1A9B8]'} tabular-nums truncate">
                ${t.tc}
              </span>
            </button>
          </div>

          <div class="flex flex-col items-end gap-1.5 shrink-0">
            <button aria-label="${isGood ? 'Batalkan Circle Take' : 'Tandai Circle Take'} Take ${takePad}"
                    type="button"
                    onclick="StoryPad.toggleCircleTake(${t.number})"
                    class="min-h-[36px] px-2.5 py-1 rounded border text-[11px] font-sans font-semibold transition-colors ${isGood ? 'bg-[#047857] border-[#34D399] text-white' : 'bg-[#1E222B] border-[#6A748B] text-[#F3F4F6] hover:bg-[#2A303C]'}">
              ${isGood ? 'Circle' : 'Tandai Good'}
            </button>
            ${statusBadge}
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
  },

  logNewTake() {
    this.triggerHaptic();
    const dialogue = this.db.scriptData && this.db.scriptData.lines
      ? this.db.scriptData.lines.find(l => l.id === this.state.activeDialogueId)
      : null;
    if (!dialogue) return;
    if (!dialogue.takes) dialogue.takes = [];
    const nextNum = dialogue.takes.length + 1;
    const newTake = {
      number: nextNum,
      label: `Take ${String(nextNum).padStart(2, '0')} | CAM-A / BOOM`,
      tc: '01:00 SMPTE',
      statusLabel: 'Hold',
      isGood: false,
      isNg: false
    };
    dialogue.takes.push(newTake);
    if (dialogue.status === 'pending') {
      dialogue.status = 'warning';
      dialogue.statusLabel = 'Review';
    }
    this.state.activeTakeNumber = nextNum;
    this.renderPanelTakes();
    this.renderScriptContent();
    this.updatePanelAutoNaming();
    this.updateProgressGauge();
    this.showToast(`Take ${String(nextNum).padStart(2, '0')} dicatat pada Shot ${dialogue.shot}`);

    if (this.supabase) {
      this.supabase.from('takes').upsert({
        dialogue_id: dialogue.id,
        project_id: this.state.activeProjectId,
        take_number: newTake.number,
        label: newTake.label,
        tc: newTake.tc,
        status_label: newTake.statusLabel,
        is_good: false,
        is_ng: false,
        director_pick: false
      }, { onConflict: 'dialogue_id,take_number' }).then(() => {});
      this.supabase.from('script_lines').update({
        status: dialogue.status,
        status_label: dialogue.statusLabel
      }).eq('id', dialogue.id).then(() => {});
    }
  },

  toggleCircleTake(takeNumber) {
    this.triggerHaptic();
    const dialogue = this.db.scriptData.lines.find(l => l.id === this.state.activeDialogueId);
    if (!dialogue || !dialogue.takes) return;
    const take = dialogue.takes.find(t => t.number === takeNumber);
    if (!take) return;

    take.isGood = !take.isGood;
    if (take.isGood) {
      take.isNg = false;
      take.statusLabel = 'GOOD TAKE';
      dialogue.status = 'good';
      dialogue.statusLabel = 'Good Take';
      this.showToast(`Take 0${takeNumber} ditandai sebagai Circle Take`);
    } else {
      take.statusLabel = take.directorPick ? 'Director Pick' : 'Hold';
      const hasOtherGood = dialogue.takes.some(t => t.isGood);
      dialogue.status = hasOtherGood ? 'good' : 'warning';
      dialogue.statusLabel = hasOtherGood ? 'Good Take' : 'Review';
      this.showToast(`Tanda Circle Take 0${takeNumber} dihapus`);
    }

    this.renderPanelTakes();
    this.renderScriptContent();
    this.updateProgressGauge();
    this.updateDashboardData();

    if (this.supabase) {
      this.supabase.from('takes').update({
        is_good: take.isGood,
        is_ng: take.isNg,
        status_label: take.statusLabel
      }).eq('dialogue_id', dialogue.id).eq('take_number', takeNumber).then(() => {});
      this.supabase.from('script_lines').update({
        status: dialogue.status,
        status_label: dialogue.statusLabel
      }).eq('id', dialogue.id).then(() => {});
    }
  },

  selectTake(takeNumber) {
    this.triggerHaptic();
    this.state.activeTakeNumber = takeNumber;
    this.renderPanelTakes();
    this.updatePanelAutoNaming();

    const slateTk = document.getElementById('footage-take-badge');
    if (slateTk) slateTk.textContent = `TK ${String(takeNumber).padStart(2, '0')}`;
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
    if (camEl) camEl.textContent = 'CAM: A';
    if (videoEl) videoEl.textContent = naming.videoName;
    if (audioEl) audioEl.textContent = naming.audioName;
  },

  copyFileNames() {
    this.triggerHaptic();
    const naming = this.generateFileNames(this.state.activeDialogueId, this.state.activeTakeNumber);
    const textToCopy = `${naming.videoName}\n${naming.audioName}`;

    this.writeClipboardText(textToCopy, 'Nama file video dan audio disalin');

    const copyBtnText = document.getElementById('copy-text');
    const copyBtnIcon = document.getElementById('copy-icon');
    if (copyBtnText) copyBtnText.textContent = 'Disalin';
    if (copyBtnIcon) copyBtnIcon.textContent = 'check';

    setTimeout(() => {
      if (copyBtnText) copyBtnText.textContent = 'Salin Semua';
      if (copyBtnIcon) copyBtnIcon.textContent = 'content_copy';
    }, 2000);
  },

  copySpecificFilename(type) {
    this.triggerHaptic();
    const naming = this.generateFileNames(this.state.activeDialogueId, this.state.activeTakeNumber);
    const text = type === 'video' ? naming.videoName : naming.audioName;
    const label = type === 'video' ? 'video' : 'audio';
    this.writeClipboardText(text, `Nama file ${label} berhasil disalin`);
  },

  updateActiveNote(value) {
    const dialogueId = this.state.activeDialogueId;
    this.state.scriptNotes[dialogueId] = value;
    const statusEl = document.getElementById('panel-autosave-status');
    if (statusEl) {
      statusEl.textContent = this.supabase ? 'Menyimpan ke Supabase...' : 'Tersimpan lokal';
    }
    if (this.supabase) {
      clearTimeout(this._noteSyncTimer);
      this._noteSyncTimer = setTimeout(() => {
        this.supabase.from('script_lines').update({
          continuity_note: value
        }).eq('id', dialogueId).then(({ error }) => {
          if (statusEl && !error) statusEl.textContent = 'Tersimpan ke Supabase';
        });
      }, 500);
    }
  },

  saveNotes() {
    const notesEl = document.getElementById('panel-script-notes');
    if (notesEl) {
      const dialogueId = this.state.activeDialogueId;
      this.state.scriptNotes[dialogueId] = notesEl.value;
      const statusEl = document.getElementById('panel-autosave-status');
      if (statusEl) statusEl.textContent = this.supabase ? 'Disimpan ke Supabase' : 'Draft disimpan';
      this.showToast('Catatan berhasil disimpan ke Draft');
      if (this.supabase) {
        this.supabase.from('script_lines').update({
          continuity_note: notesEl.value
        }).eq('id', dialogueId).then(() => {});
      }
    }
  },

  syncToNle() {
    this.triggerHaptic();
    const btn = document.getElementById('send-nle-btn');
    const statusEl = document.getElementById('nle-sync-status');
    if (!btn) return;

    if (!this.state.roles.videoEditor && !this.state.roles.autoExportMeta) {
      if (statusEl) {
        statusEl.textContent = 'Gagal ekspor: aktifkan peran Video Editor atau Auto-Export Meta pada menu Profil.';
      }
      this.showToast('Izin ekspor NLE dinonaktifkan pada peran aktif');
      return;
    }

    const originalContent = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-outlined text-[16px]" aria-hidden="true">sync</span><span>Menyiapkan paket XML/EDL...</span>`;
    btn.disabled = true;
    if (statusEl) statusEl.textContent = 'Memproses ekspor metadata take aktif...';

    const finishSync = () => {
      const naming = this.generateFileNames(this.state.activeDialogueId, this.state.activeTakeNumber);
      btn.innerHTML = `<span class="material-symbols-outlined text-[16px]" aria-hidden="true">done_all</span><span>Paket NLE Siap</span>`;
      if (statusEl) {
        statusEl.textContent = `Paket metadata siap untuk ${naming.videoName}`;
      }
      this.showToast('Metadata timeline NLE disinkronkan');

      if (this.supabase) {
        this.supabase.from('projects').update({ sync_status: 'In Sync' }).eq('id', this.state.activeProjectId).then(() => {});
        this.supabase.from('notifications').insert({
          title: 'NLE Bridge: Ekspor Metadata',
          message: `Paket ${naming.videoName} dan catatan kontinuitas disinkronkan oleh ${this.state.currentUser.name}.`,
          time_label: 'Baru saja',
          notif_type: 'sync',
          priority: 'routine',
          unread: true,
          dismissed: false
        }).then(() => {});
      }

      setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.disabled = false;
      }, 2000);
    };

    setTimeout(finishSync, 900);
  },

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

    const tcEl = document.getElementById('panel-elapsed-tc');
    clearInterval(this.state.audio.timerInterval);
    this.state.audio.timerInterval = setInterval(() => {
      this.state.audio.elapsedSeconds++;
      if (this.state.audio.elapsedSeconds > 165) {
        this.state.audio.elapsedSeconds = 0;
      }
      if (tcEl) {
        const mins = String(Math.floor(this.state.audio.elapsedSeconds / 60)).padStart(2, '0');
        const secs = String(this.state.audio.elapsedSeconds % 60).padStart(2, '0');
        tcEl.textContent = `00:${mins}:${secs}:12`;
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

    const container = document.getElementById('panel-waveform');
    if (container) {
      const bars = container.querySelectorAll('.waveform-bar');
      const defaultHeights = [35, 60, 45, 85, 70, 95, 65, 40, 55, 30, 75, 90, 50, 35, 65, 40, 80, 45, 30];
      bars.forEach((b, idx) => {
        b.style.height = `${defaultHeights[idx % defaultHeights.length]}%`;
      });
    }

    document.querySelectorAll('.dashboard-play-btn').forEach(btn => {
      if (btn._animInterval) {
        clearInterval(btn._animInterval);
        btn._animInterval = null;
      }
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = 'play_arrow';
    });

    ['dash-waveform-1', 'dash-waveform-2'].forEach(id => {
      const wf = document.getElementById(id);
      if (wf) {
        wf.querySelectorAll('span').forEach(s => {
          s.style.transform = 'scaleY(1)';
        });
      }
    });
  },

  toggleDashboardTrack(btn, waveformId) {
    this.triggerHaptic();
    const icon = btn.querySelector('.material-symbols-outlined');
    const isPlaying = icon && icon.textContent === 'pause';

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

  // Role Switcher & Real Profile Totals
  renderProfileRoles() {
    Object.keys(this.state.roles).forEach(key => {
      const row = document.querySelector(`[data-role-key="${key}"]`);
      if (row) {
        const toggleBtn = row.querySelector('.toggle-box');
        const isChecked = this.state.roles[key];
        if (typeof row.setAttribute === 'function') {
          row.setAttribute('aria-pressed', isChecked ? 'true' : 'false');
        }
        if (toggleBtn) {
          if (typeof toggleBtn.setAttribute === 'function') {
            toggleBtn.setAttribute('data-checked', isChecked ? 'true' : 'false');
          }
          if (isChecked) {
            toggleBtn.className = 'toggle-box w-6 h-6 rounded bg-[#2563EB] flex items-center justify-center shrink-0 text-white transition-colors';
            row.classList.remove('opacity-70');
          } else {
            toggleBtn.className = 'toggle-box w-6 h-6 rounded border flex items-center justify-center shrink-0 text-transparent transition-colors';
            if (toggleBtn.style) {
              toggleBtn.style.backgroundColor = 'var(--panel-lowest)';
              toggleBtn.style.borderColor = 'var(--border-control)';
            }
            row.classList.add('opacity-70');
          }
        }
      }
    });

    const nameEl = document.getElementById('profile-user-name');
    const roleEl = document.getElementById('profile-user-role');
    const badgeEl = document.getElementById('profile-user-badge');
    const prodEl = document.getElementById('profile-active-prod');
    const avatarEl = document.getElementById('profile-avatar-initials');
    const dashAvatarEl = document.getElementById('header-avatar-dash');
    const projAvatarEl = document.getElementById('header-avatar-proj');
    const profileAvatarEl = document.getElementById('header-avatar-profile');
    const navUserEl = document.getElementById('nav-user-name');
    const navProdEl = document.getElementById('nav-prod-name');

    if (nameEl) nameEl.textContent = this.state.currentUser.name;
    if (roleEl) roleEl.textContent = this.state.currentUser.roleTitle;
    if (badgeEl) badgeEl.textContent = `${this.state.currentUser.idBadge} | ${this.state.currentUser.studio}`;
    if (prodEl) prodEl.textContent = this.state.currentUser.prodName;
    if (avatarEl) avatarEl.textContent = this.state.currentUser.initials;
    if (dashAvatarEl) dashAvatarEl.textContent = this.state.currentUser.initials;
    if (projAvatarEl) projAvatarEl.textContent = this.state.currentUser.initials;
    if (profileAvatarEl) profileAvatarEl.textContent = this.state.currentUser.initials;
    if (navUserEl) navUserEl.textContent = this.state.currentUser.name;
    if (navProdEl) navProdEl.textContent = this.state.currentUser.prodName;

    // Real calculated stats from StoryPad.db
    let totalTakes = 0;
    let circledTakes = 0;
    Object.values(this.db.scriptDataProjects).forEach(proj => {
      proj.lines.forEach(line => {
        if (line.type === 'dialogue' && line.takes) {
          totalTakes += line.takes.length;
          circledTakes += line.takes.filter(t => t.isGood).length;
        }
      });
    });

    const statProj = document.getElementById('profile-stat-projects');
    const statTakes = document.getElementById('profile-stat-takes');
    const statCircled = document.getElementById('profile-stat-circled');
    if (statProj) statProj.textContent = String(this.db.projects.length);
    if (statTakes) statTakes.textContent = String(totalTakes);
    if (statCircled) statCircled.textContent = String(circledTakes);

    this.updateRolePermissionIndicators();

    if (this.supabase && this.state.activePersonaKey) {
      this.supabase.from('crew_profiles').update({
        roles: this.state.roles
      }).eq('persona_key', this.state.activePersonaKey).then(() => {});
    }
  },

  updateRolePermissionIndicators() {
    const roleBadge = document.getElementById('script-role-indicator');
    if (roleBadge) {
      const activeRoles = [];
      if (this.state.roles.scriptSupervisor) activeRoles.push('Script Supv');
      if (this.state.roles.videoEditor) activeRoles.push('Editor NLE');
      if (this.state.roles.soundRecordist) activeRoles.push('Sound');
      if (this.state.roles.directorProducer) activeRoles.push('Director Review');
      roleBadge.textContent = activeRoles.length > 0 ? `Peran: ${activeRoles.join(' + ')}` : 'Peran: Tinjauan';
    }

    const nleBtn = document.getElementById('send-nle-btn');
    if (nleBtn) {
      const canExportNle = this.state.roles.videoEditor || this.state.roles.autoExportMeta;
      nleBtn.disabled = !canExportNle;
      nleBtn.title = canExportNle ? 'Kirim paket metadata ke Editor NLE' : 'Aktifkan peran Video Editor atau Auto-Export Meta di Profil untuk ekspor NLE';
    }
  },

  toggleRole(roleKey, btnElement) {
    this.triggerHaptic();
    this.state.roles[roleKey] = !this.state.roles[roleKey];
    this.savePersistedSettings();
    const isChecked = this.state.roles[roleKey];

    const row = btnElement && typeof btnElement.closest === 'function' ? btnElement.closest('.role-item') : null;
    if (row && typeof row.setAttribute === 'function') {
      row.setAttribute('aria-pressed', isChecked ? 'true' : 'false');
    }
    if (btnElement && typeof btnElement.setAttribute === 'function') {
      btnElement.setAttribute('data-checked', isChecked ? 'true' : 'false');
    }
    if (isChecked) {
      if (btnElement) {
        btnElement.className = 'toggle-box w-6 h-6 rounded bg-[#2563EB] flex items-center justify-center shrink-0 text-white transition-colors';
      }
      if (row) row.classList.remove('opacity-70');
      this.showToast(`Mode ${roleKey} diaktifkan`);
    } else {
      if (btnElement) {
        btnElement.className = 'toggle-box w-6 h-6 rounded border flex items-center justify-center shrink-0 text-transparent transition-colors';
        if (btnElement.style) {
          btnElement.style.backgroundColor = 'var(--panel-lowest)';
          btnElement.style.borderColor = 'var(--border-control)';
        }
      }
      if (row) row.classList.add('opacity-70');
      this.showToast(`Mode ${roleKey} dinonaktifkan`);
    }
    this.updateRolePermissionIndicators();

    if (this.supabase && this.state.activePersonaKey) {
      this.supabase.from('crew_profiles').update({
        roles: this.state.roles
      }).eq('persona_key', this.state.activePersonaKey).then(() => {});
    }
  },

  // Project Search & Category Filters
  toggleProjectSearch() {
    this.triggerHaptic();
    const bar = document.getElementById('project-search-bar');
    if (!bar) return;
    const isHidden = bar.classList.contains('hidden');
    if (isHidden) {
      bar.classList.remove('hidden');
      const input = document.getElementById('project-search-input');
      if (input && typeof input.focus === 'function') input.focus();
    } else {
      const input = document.getElementById('project-search-input');
      if (input && input.value) {
        this.clearProjectSearch();
      } else if (input && typeof input.focus === 'function') {
        input.focus();
      }
    }
  },

  filterProjects(query) {
    this.state.projectSearchQuery = (query || '').toLowerCase().trim();
    this.syncProjectFilterState();
  },

  filterProjectsByCategory(category, btnElement) {
    this.triggerHaptic();
    this.state.activeProjectCategory = category || 'all';
    document.querySelectorAll('.project-category-btn').forEach(btn => {
      if (!btn.classList.contains('script-proj-switch')) {
        btn.className = 'project-category-btn';
      }
    });
    if (btnElement) {
      btnElement.className = 'project-category-btn is-active';
    }
    this.syncProjectFilterState();
  },

  syncProjectFilterState() {
    const q = this.state.projectSearchQuery;
    const category = this.state.activeProjectCategory;
    const cards = document.querySelectorAll('.project-card-item');
    let matchCount = 0;

    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      const matchesCategory = category === 'all' || text.includes(category.toLowerCase());
      const matchesQuery = !q || text.includes(q);
      if (matchesCategory && matchesQuery) {
        card.style.display = '';
        matchCount++;
      } else {
        card.style.display = 'none';
      }
    });

    const countLabel = document.getElementById('projects-count-label');
    if (countLabel) {
      countLabel.textContent = `${matchCount} Ditampilkan`;
    }

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

  resetProjectFilters() {
    this.state.activeProjectCategory = 'all';
    const input = document.getElementById('project-search-input');
    if (input) input.value = '';
    this.state.projectSearchQuery = '';
    const allBtn = document.querySelector('#project-category-chips .project-category-btn');
    this.filterProjectsByCategory('all', allBtn);
  },

  // Notification Controls
  openNotifications() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-notifications');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet && overlay) {
      overlay.classList.add('active');
      sheet.classList.add('open');
      sheet.style.transform = '';
      this.renderNotificationsList();
    }
  },

  closeNotifications() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-notifications');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet) {
      sheet.classList.remove('open');
      sheet.style.transform = '';
    }
    if (overlay) overlay.classList.remove('active');
  },

  updateNotificationIndicators() {
    const hasUnread = this.state.notifications.some(n => !n.dismissed && n.unread);
    document.querySelectorAll('.notif-unread-dot').forEach(dot => {
      if (hasUnread) {
        dot.classList.remove('hidden');
      } else {
        dot.classList.add('hidden');
      }
    });
  },

  renderNotificationsList() {
    const list = document.getElementById('notifications-list');
    if (!list) return;

    const visible = this.state.notifications.filter(n => !n.dismissed);
    if (visible.length === 0) {
      list.innerHTML = `
        <div class="p-4 rounded border text-center" style="background-color: var(--panel-lowest); border-color: var(--border-flat);">
          <p class="font-sans text-xs font-semibold mb-1" style="color: var(--text-primary);">Tidak ada notifikasi aktif</p>
          <p class="font-sans text-[11px]" style="color: var(--text-secondary);">Semua pembaruan produksi telah dibaca atau disingkirkan.</p>
        </div>
      `;
      this.updateNotificationIndicators();
      return;
    }

    const sorted = [...visible].sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      return a.priority === 'important' ? -1 : 1;
    });

    let html = '';
    sorted.forEach(n => {
      const priorityBadge = n.priority === 'important'
        ? `<span class="sp-badge sp-badge-amber">Penting</span>`
        : `<span class="sp-badge sp-badge-neutral">Sinkronisasi</span>`;
      const stateBadge = n.unread
        ? `<span class="sp-badge sp-badge-blue">Belum Dibaca</span>`
        : `<span class="font-mono text-[10px]" style="color: var(--text-muted);">Dibaca</span>`;

      html += `
        <div class="p-3 rounded border flex flex-col gap-2 ${n.unread ? 'border-l-4' : 'opacity-85'}" style="background-color: var(--panel-lowest); border-color: var(--border-flat); ${n.unread ? 'border-left-color: var(--primary-accent);' : ''}">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              ${priorityBadge}
              ${stateBadge}
            </div>
            <span class="font-mono text-[11px] shrink-0" style="color: var(--text-muted);">${n.time}</span>
          </div>
          <div>
            <p class="font-sans text-xs font-bold" style="color: var(--text-primary);">${n.title}</p>
            <p class="font-sans text-xs mt-0.5 leading-snug" style="color: var(--text-secondary);">${n.message}</p>
          </div>
          <div class="flex items-center gap-2 pt-1">
            ${n.unread ? `<button type="button" class="font-sans text-[11px] font-semibold hover:underline bg-transparent border-0 p-0" style="color: var(--primary-text);" onclick="StoryPad.markNotificationRead(${n.id})">Tandai Dibaca</button>` : ''}
            <button type="button" class="font-sans text-[11px] font-semibold hover:underline bg-transparent border-0 p-0" style="color: var(--text-secondary);" onclick="StoryPad.dismissNotification(${n.id})">Singkirkan</button>
          </div>
        </div>
      `;
    });
    list.innerHTML = html;
    this.updateNotificationIndicators();
  },

  markNotificationRead(id) {
    const item = this.state.notifications.find(n => n.id === id);
    if (item) {
      item.unread = false;
      this.renderNotificationsList();
      if (this.supabase) {
        this.supabase.from('notifications').update({ unread: false }).eq('id', id).then(() => {});
      }
    }
  },

  dismissNotification(id) {
    const item = this.state.notifications.find(n => n.id === id);
    if (item) {
      item.dismissed = true;
      item.unread = false;
      this.renderNotificationsList();
      if (this.supabase) {
        this.supabase.from('notifications').update({ dismissed: true, unread: false }).eq('id', id).then(() => {});
      }
    }
  },

  restoreDismissedNotifications() {
    this.state.notifications.forEach(n => { n.dismissed = false; });
    this.renderNotificationsList();
    this.showToast('Riwayat notifikasi dipulihkan');
    if (this.supabase) {
      this.supabase.from('notifications').update({ dismissed: false }).neq('id', 0).then(() => {});
    }
  },

  markAllNotificationsRead() {
    this.triggerHaptic();
    this.state.notifications.forEach(n => { n.unread = false; });
    this.renderNotificationsList();
    this.showToast('Semua notifikasi ditandai dibaca');
    if (this.supabase) {
      this.supabase.from('notifications').update({ unread: false }).neq('id', 0).then(() => {});
    }
  },

  // Login Persona Switcher Modal
  openLoginAccounts() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-login-accounts');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet && overlay) {
      overlay.classList.add('active');
      sheet.classList.add('open');
      sheet.style.transform = '';
    }
  },

  closeLoginAccounts() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-login-accounts');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet) {
      sheet.classList.remove('open');
      sheet.style.transform = '';
    }
    if (overlay) overlay.classList.remove('active');
  },

  closeAllModals(silent = false) {
    if (!silent) this.triggerHaptic();
    ['sheet-view-settings', 'sheet-audio-panel', 'sheet-notifications', 'sheet-login-accounts'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('open');
        el.style.transform = '';
      }
    });
    const overlay = document.getElementById('sheet-overlay');
    if (overlay) overlay.classList.remove('active');
    this.stopAudioPlayback();
    this.stopFootagePlayback();
  },

  renderCrewAccountsList() {
    const listEl = document.getElementById('crew-accounts-list');
    if (!listEl || !Array.isArray(this.db.crewProfiles)) return;

    const escape = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    listEl.innerHTML = this.db.crewProfiles.map(c => {
      const roles = c.roles || {};
      let avatarClass = 'bg-[#2563EB] text-white';
      let roleTextStyle = 'var(--primary-text)';
      if (roles.videoEditor && !roles.scriptSupervisor) {
        avatarClass = 'bg-[#047857] text-white';
        roleTextStyle = 'var(--good-text)';
      } else if (roles.soundRecordist && !roles.scriptSupervisor) {
        avatarClass = 'bg-[#F59E0B] text-[#14171E]';
        roleTextStyle = 'var(--amber-text)';
      }

      return `
        <button type="button" class="sp-crew-btn w-full text-left flex items-center justify-between p-3 rounded border" onclick="StoryPad.loginAs('${escape(c.personaKey)}')">
          <span class="flex items-center gap-3 min-w-0">
            <span class="w-10 h-10 rounded ${avatarClass} flex items-center justify-center font-bold text-xs shrink-0">${escape(c.initials)}</span>
            <span class="flex flex-col min-w-0">
              <span class="font-sans text-xs font-bold truncate" style="color: var(--text-primary);">${escape(c.fullName)}</span>
              <span class="font-sans text-[11px] truncate" style="color: ${roleTextStyle};">${escape(c.roleTitle)}</span>
              <span class="font-mono text-[10px] truncate" style="color: var(--text-muted);">${escape(c.email)}</span>
            </span>
          </span>
          <span class="material-symbols-outlined text-[18px] shrink-0" style="color: ${roleTextStyle};" aria-hidden="true">chevron_right</span>
        </button>
      `;
    }).join('');
  },

  loginAs(personaKey) {
    this.triggerHaptic();
    this.state.activePersonaKey = personaKey;
    const activeProj = this.db.projects.find(p => p.id === this.state.activeProjectId) || this.db.projects[0];
    const prodName = activeProj ? activeProj.title : 'Senjakala Merah';

    const profile = Array.isArray(this.db.crewProfiles)
      ? this.db.crewProfiles.find(c => c.personaKey === personaKey)
      : null;

    if (profile) {
      this.state.currentUser = {
        name: profile.fullName,
        initials: profile.initials,
        roleTitle: profile.roleTitle,
        idBadge: profile.idBadge,
        studio: profile.studio,
        prodName,
        email: profile.email
      };
      this.state.roles = {
        scriptSupervisor: false,
        videoEditor: false,
        soundRecordist: false,
        directorProducer: false,
        autoExportMeta: true,
        ...(profile.roles || {})
      };
    } else if (personaKey === 'scriptSupervisor') {
      this.state.currentUser = {
        name: 'Aulia Larasati, S.Sn.',
        initials: 'AL',
        roleTitle: 'Lead Script Supervisor & Continuity',
        idBadge: 'SP-8842',
        studio: 'Lifelike Pictures',
        prodName,
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
        prodName,
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
        prodName,
        email: 'sound.rama@lifelikepictures.com'
      };
      this.state.roles = { scriptSupervisor: false, videoEditor: false, soundRecordist: true, directorProducer: false, autoExportMeta: true };
    }

    this.savePersistedSettings();
    this.renderProfileRoles();
    this.closeLoginAccounts();
    this.navigate('dashboard', 'home');
    this.showToast(`Masuk sebagai ${this.state.currentUser.name}`);
  },

  async signInWithSupabaseEmail(mode = 'signin') {
    this.triggerHaptic();
    const nameEl = document.getElementById('supa-name-input');
    const roleEl = document.getElementById('supa-role-select');
    const emailEl = document.getElementById('supa-email-input');
    const passEl = document.getElementById('supa-password-input');
    const fbEl = document.getElementById('supa-auth-feedback');
    const email = emailEl ? emailEl.value.trim() : '';
    const password = passEl ? passEl.value : '';

    const setFeedback = (msg, isError = false) => {
      if (!fbEl) return;
      fbEl.textContent = msg;
      fbEl.classList.remove('hidden');
      fbEl.style.color = isError ? 'var(--red-text)' : 'var(--good-text)';
    };

    if (!email || !email.includes('@') || !password || password.length < 6) {
      setFeedback('Masukkan email valid dan kata sandi minimal 6 karakter.', true);
      return;
    }

    if (!this.supabase) {
      setFeedback('Klien Supabase belum siap. Coba beberapa detik lagi.', true);
      return;
    }

    setFeedback(mode === 'signup' ? 'Menyimpan akun kru ke Supabase...' : 'Memeriksa kredensial...', false);

    try {
      if (mode === 'signup') {
        const rawName = nameEl && nameEl.value.trim() ? nameEl.value.trim() : email.split('@')[0];
        const roleKey = roleEl && roleEl.value ? roleEl.value : 'scriptSupervisor';
        const roleMap = {
          scriptSupervisor: 'Script Supervisor & Continuity',
          videoEditor: 'Offline Video Editor',
          soundRecordist: 'Production Sound Mixer',
          directorProducer: 'Director & Producer'
        };
        const roleTitle = roleMap[roleKey] || 'Script Supervisor & Continuity';
        const initials = rawName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'SP';
        const personaKey = 'crew_' + email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const idBadge = 'SP-' + String(Math.floor(1000 + (Date.now() % 9000)));
        const rolesObj = {
          scriptSupervisor: roleKey === 'scriptSupervisor',
          videoEditor: roleKey === 'videoEditor',
          soundRecordist: roleKey === 'soundRecordist',
          directorProducer: roleKey === 'directorProducer',
          autoExportMeta: true
        };

        const authRes = await this.supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: rawName,
              persona_key: personaKey,
              role_key: roleKey
            }
          }
        });

        if (authRes.error) {
          setFeedback(authRes.error.message, true);
          return;
        }

        const profileRow = {
          user_id: authRes.data && authRes.data.user ? authRes.data.user.id : null,
          persona_key: personaKey,
          full_name: rawName,
          initials,
          role_title: roleTitle,
          id_badge: idBadge,
          studio: 'Lifelike Pictures',
          prod_name: this.state.currentUser.prodName || 'Senjakala Merah',
          email,
          roles: rolesObj
        };

        await this.supabase.from('crew_profiles').upsert(profileRow, { onConflict: 'persona_key' });

        const localProfile = {
          personaKey,
          fullName: rawName,
          initials,
          roleTitle,
          idBadge,
          studio: 'Lifelike Pictures',
          prodName: profileRow.prod_name,
          email,
          roles: rolesObj
        };
        const existingIdx = this.db.crewProfiles.findIndex(c => c.personaKey === personaKey || c.email.toLowerCase() === email.toLowerCase());
        if (existingIdx >= 0) {
          this.db.crewProfiles[existingIdx] = localProfile;
        } else {
          this.db.crewProfiles.push(localProfile);
        }
        this.renderCrewAccountsList();

        if (authRes.data && authRes.data.session) {
          this.state.supabaseUser = authRes.data.user;
          this.loginAs(personaKey);
          this.showToast(`Akun ${rawName} disimpan ke Supabase`);
        } else {
          setFeedback(`Profil ${rawName} tersimpan di database. Periksa email konfirmasi untuk aktivasi login.`, false);
        }
        return;
      }

      const result = await this.supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        setFeedback(result.error.message, true);
        return;
      }

      if (result.data && result.data.user) {
        this.state.supabaseUser = result.data.user;
        const { data: matchedRows } = await this.supabase.from('crew_profiles').select('*').ilike('email', email).limit(1);
        if (matchedRows && matchedRows.length > 0) {
          const m = matchedRows[0];
          const mapped = {
            personaKey: m.persona_key,
            fullName: m.full_name,
            initials: m.initials,
            roleTitle: m.role_title,
            idBadge: m.id_badge,
            studio: m.studio,
            prodName: m.prod_name,
            email: m.email,
            roles: m.roles || {}
          };
          const idx = this.db.crewProfiles.findIndex(c => c.personaKey === mapped.personaKey);
          if (idx >= 0) this.db.crewProfiles[idx] = mapped;
          else this.db.crewProfiles.push(mapped);
          this.renderCrewAccountsList();
          this.loginAs(mapped.personaKey);
        } else {
          this.applyAuthenticatedSupabaseUser(result.data.user);
          this.closeLoginAccounts();
          this.navigate('dashboard', 'home');
          this.showToast(`Masuk via Supabase: ${email}`);
        }
      }
    } catch (err) {
      setFeedback('Gagal menghubungi layanan autentikasi Supabase.', true);
    }
  },

  loginWithGoogle() {
    this.triggerHaptic();
    this.showToast('Masuk dengan akun studio...');
    setTimeout(() => {
      this.loginAs('scriptSupervisor');
    }, 450);
  },

  handleLogout() {
    this.triggerHaptic();
    const btn = document.getElementById('logout-btn');
    if (!btn) return;

    const originalContent = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]" aria-hidden="true">progress_activity</span><span>Menyimpan Sesi Lokal...</span>`;
    btn.disabled = true;

    if (this.supabase) {
      this.supabase.auth.signOut().catch(() => {});
    }

    setTimeout(() => {
      btn.innerHTML = originalContent;
      btn.disabled = false;
      this.navigate('login');
      this.showToast('Keluar dari sesi produksi');
    }, 600);
  },

  updateStatusBarClock() {
    const clockEl = document.getElementById('mobile-clock');
    if (!clockEl) return;
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${hrs}:${mins}`;
  },

  startLiveClocks() {
    clearInterval(this.state._clocks.clockTimer);
    this.state._clocks.clockTimer = setInterval(() => {
      this.updateStatusBarClock();
    }, 30000);
    if (this.state._clocks.clockTimer && typeof this.state._clocks.clockTimer.unref === 'function') {
      this.state._clocks.clockTimer.unref();
    }
  },

  bindEvents() {
    if (typeof document === 'undefined') return;

    const scrollContainers = document.querySelectorAll('.screen-viewport');
    scrollContainers.forEach(container => {
      let lastScrollTop = 0;
      container.addEventListener('scroll', () => {
        const currentScrollTop = container.scrollTop;
        const navbar = document.getElementById('floating-navbar');
        const quickDock = document.getElementById('floating-quick-dock');

        if (navbar && this.state.currentScreen !== 'login') {
          if (currentScrollTop > lastScrollTop && currentScrollTop > 40) {
            navbar.classList.add('hidden-scroll');
            if (quickDock) quickDock.classList.add('opacity-90');
          } else if (currentScrollTop < lastScrollTop - 4 || currentScrollTop <= 20) {
            navbar.classList.remove('hidden-scroll');
            if (quickDock) quickDock.classList.remove('opacity-90');
          }
        }
        lastScrollTop = Math.max(0, currentScrollTop);
      }, { passive: true });
    });

    this.setupSwipeableSheet('sheet-view-settings');
    this.setupSwipeableSheet('sheet-audio-panel');
    this.setupSwipeableSheet('sheet-notifications');
    this.setupSwipeableSheet('sheet-login-accounts');

    const overlay = document.getElementById('sheet-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        this.closeAllModals();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024 && this.state.currentScreen === 'script-reader') {
          const audioSheet = document.getElementById('sheet-audio-panel');
          const overlayEl = document.getElementById('sheet-overlay');
          if (audioSheet && audioSheet.classList.contains('open')) {
            audioSheet.classList.remove('open');
            audioSheet.style.transform = '';
            if (overlayEl) overlayEl.classList.remove('active');
          }
        }
      });
    }
  },

  setupSwipeableSheet(sheetId) {
    if (typeof document === 'undefined') return;
    const sheet = document.getElementById(sheetId);
    if (!sheet) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const handle = sheet.querySelector('.bottom-sheet-handle') || sheet;

    handle.addEventListener('touchstart', (e) => {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
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

    handle.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      sheet.style.transition = '';
      const deltaY = currentY - startY;

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
        sheet.style.transform = '';
      }
      startY = 0;
      currentY = 0;
    }, { passive: true });
  }
};

StoryPad.db.scriptData = StoryPad.db.scriptDataProjects['proj-1'];

if (typeof window !== 'undefined') {
  window.StoryPad = StoryPad;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StoryPad;
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    StoryPad.init();
  });
}
