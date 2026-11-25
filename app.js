/**
 * StoryPad (Script Continuity, DOCX Converter & NLE Timeline Bridge)
 * Core Application Engine - 100% Database-Driven (Zero Dummy Context)
 */

const StoryPad = {
  supabaseConfig: {
    url: '',
    anonKey: '',
    projectId: '',
    storageBucket: 'storypad-media'
  },
  phpBoot: null,
  supabase: null,
  _realtimeChannel: null,
  _syncDebounceTimer: null,
  _noteSyncTimer: null,
  _previewDebounceTimer: null,
  _supabaseLoadListenerAdded: false,

  state: {
    currentScreen: 'login', // 'login' | 'dashboard' | 'projects' | 'script-reader' | 'profile'
    previousScreen: 'dashboard',
    activeTab: 'home',      // 'home' | 'project-list' | 'script-reader' | 'profile'
    activeProjectId: '',
    activeSceneFilter: 'all',
    activeMediaTab: 'audio', // 'audio' | 'video'
    theme: 'daylight',       // 'daylight' | 'slate'
    activeProjectCategory: 'all',
    projectSearchQuery: '',
    activePersonaKey: '',
    supabaseConnected: false,
    supabaseLoading: true,
    supabaseUser: null,
    studioName: 'Kelompok 10',

    // Active Crew Session (neutral until crew logs in)
    currentUser: {
      name: 'Kru Produksi',
      initials: 'KP',
      roleTitle: 'Script Supervisor & Continuity',
      idBadge: 'K10-01',
      studio: 'Kelompok 10',
      prodName: '-',
      email: ''
    },

    // View Filters (4 Live Filter Toggles)
    viewSettings: {
      showFileCode: true,
      filterGoodTakeOnly: false,
      highlightStatus: true,
      focusDialogueMode: false
    },

    // Active selected dialogue and take in Script Reader
    activeDialogueId: '',
    activeTakeNumber: 1,

    // Role Switcher configuration (5 roles)
    roles: {
      scriptSupervisor: true,
      videoEditor: true,
      soundRecordist: false,
      directorProducer: false,
      autoExportMeta: true
    },

    // Script Import Modal State
    importModal: {
      sourceTab: 'file', // 'file' | 'text'
      selectedFile: null,
      lastParsed: null,
      targetProjectId: ''
    },

    // Audio Player State
    audio: {
      isPlaying: false,
      activeDashUrl: null,
      animInterval: null,
      levelInterval: null
    },

    // Video Footage Playback State
    footage: {
      isPlaying: false,
      interval: null,
      frame: 0,
      seconds: 0
    },

    // Purely DB-driven stores (zero dummy items)
    notifications: [],
    scriptNotes: {},

    _clocks: {
      clockTimer: null
    }
  },

  // Single source of truth populated from Supabase
  db: {
    crewProfiles: [],
    projects: [],
    scriptDataProjects: {},
    scriptData: null
  },

  /* ============================================================
   * INITIALIZATION & PHP / SUPABASE BOOTSTRAP
   * ============================================================ */

  init() {
    this.hydratePhpBoot();
    this.loadPersistedSettings();
    this.applyTheme(this.state.theme);
    this.bindEvents();
    this.bindMediaElementEvents();

    const startScreen = (this.phpBoot && this.phpBoot.initialScreen) ? this.phpBoot.initialScreen : 'login';
    this.state.currentScreen = startScreen;
    this.syncTabFromScreen(startScreen);

    this.renderLoginCrewList();
    this.renderCrewAccountsList();
    this.renderProjectsScreen();
    this.updateDashboardData();
    this.updateProgressGauge();
    this.renderProfileRoles();
    this.updateNotificationIndicators();
    this.updateStatusBarClock();
    this.startLiveClocks();
    this.renderScreen(startScreen);
    this.updateNavbarVisibility();
    this.updateActiveTabStyles();

    this.initSupabase();

    if (this.phpBoot && this.phpBoot.openImportOnLoad) {
      setTimeout(() => this.openScriptImportModal(), 250);
    }
  },

  hydratePhpBoot() {
    if (typeof window === 'undefined' || !window.STORYPAD_PHP_BOOT) return;
    const boot = window.STORYPAD_PHP_BOOT;
    this.phpBoot = boot;

    if (boot.studioName) {
      this.state.studioName = boot.studioName;
      this.state.currentUser.studio = boot.studioName;
    }
    if (boot.supabase) {
      this.supabaseConfig = {
        ...this.supabaseConfig,
        ...boot.supabase
      };
    }
    if (boot.theme === 'daylight' || boot.theme === 'slate') {
      this.state.theme = boot.theme;
    }
    if (boot.activeProjectId) {
      this.state.activeProjectId = boot.activeProjectId;
    }
    if (typeof boot.personaKey === 'string') {
      this.state.activePersonaKey = boot.personaKey;
    }
    if (boot.user && typeof boot.user === 'object') {
      this.state.currentUser = {
        ...this.state.currentUser,
        ...boot.user
      };
    }
  },

  syncPhpSession(patch) {
    if (!this.phpBoot || !this.phpBoot.phpEnabled || typeof fetch !== 'function') return;
    const endpoint = (this.phpBoot.endpoints && this.phpBoot.endpoints.session) || 'api/session.php';
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).catch(() => {});
  },

  initSupabase() {
    if (typeof window === 'undefined') return;

    // Jika PHP backend aktif, ambil bootstrap awal via endpoint lokal sambil menunggu SDK JS siap
    if (this.phpBoot && this.phpBoot.phpEnabled && typeof fetch === 'function') {
      this.fetchBootstrapViaPhp();
    }

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      if (!this._supabaseLoadListenerAdded && typeof window.addEventListener === 'function') {
        this._supabaseLoadListenerAdded = true;
        window.addEventListener('load', () => this.initSupabase(), { once: true });
      }
      return;
    }

    if (this.supabase) return;
    if (!this.supabaseConfig.url || !this.supabaseConfig.anonKey) {
      this.updateSupabaseStatusBadge('Konfigurasi Supabase belum diatur', 'warn');
      return;
    }
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
      this.updateSupabaseStatusBadge('Mode Lokal', 'amber');
    }
  },

  async fetchBootstrapViaPhp() {
    try {
      const endpoint = (this.phpBoot && this.phpBoot.endpoints && this.phpBoot.endpoints.supabase)
        ? `${this.phpBoot.endpoints.supabase}?action=bootstrap`
        : 'api/supabase.php?action=bootstrap';
      const res = await fetch(endpoint);
      const json = await res.json();
      if (res.ok && json && json.ok && json.data) {
        this.applyBootstrapPayload(
          json.data.projects || [],
          json.data.script_lines || [],
          json.data.takes || [],
          json.data.crew_profiles || [],
          json.data.notifications || []
        );
        this.state.supabaseConnected = true;
        this.state.supabaseLoading = false;
        this.updateSupabaseStatusBadge('Supabase Terhubung', 'good');
      }
    } catch (e) {}
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
    const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'KP';
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
        this.supabase.from('projects').select('*').eq('is_archived', false).order('sort_order', { ascending: true }),
        this.supabase.from('script_lines').select('*').eq('is_archived', false).order('sort_order', { ascending: true }),
        this.supabase.from('takes').select('*').eq('is_archived', false).order('take_number', { ascending: true }),
        this.supabase.from('crew_profiles').select('*').eq('is_archived', false),
        this.supabase.from('notifications').select('*').eq('is_archived', false).order('id', { ascending: true })
      ]);

      if (projRes.error || linesRes.error || takesRes.error) {
        this.state.supabaseLoading = false;
        this.updateSupabaseStatusBadge('Sinkronisasi Tertunda', 'amber');
        return;
      }

      this.applyBootstrapPayload(
        projRes.data || [],
        linesRes.data || [],
        takesRes.data || [],
        (crewRes && !crewRes.error && Array.isArray(crewRes.data)) ? crewRes.data : [],
        (notifRes && !notifRes.error && Array.isArray(notifRes.data)) ? notifRes.data : []
      );

      this.state.supabaseConnected = true;
      this.state.supabaseLoading = false;
      this.updateSupabaseStatusBadge('Supabase Terhubung', 'good');
    } catch (e) {
      this.state.supabaseLoading = false;
      this.updateSupabaseStatusBadge('Mode Lokal', 'amber');
    }
  },

  applyBootstrapPayload(projRows, lineRows, takeRows, crewRows, notifRows) {
    const takesByDialogue = {};
    takeRows.forEach(t => {
      if (!takesByDialogue[t.dialogue_id]) takesByDialogue[t.dialogue_id] = [];
      takesByDialogue[t.dialogue_id].push({
        id: t.id,
        number: t.take_number,
        label: t.label,
        tc: t.tc,
        statusLabel: t.status_label,
        isGood: !!t.is_good,
        isNg: !!t.is_ng,
        directorPick: !!t.director_pick,
        audioUrl: t.audio_url || null,
        audioFilename: t.audio_filename || null,
        audioMime: t.audio_mime || null,
        audioSizeBytes: t.audio_size_bytes || null,
        videoUrl: t.video_url || null,
        videoFilename: t.video_filename || null,
        videoMime: t.video_mime || null,
        videoSizeBytes: t.video_size_bytes || null,
        durationSeconds: t.duration_seconds !== null && t.duration_seconds !== undefined ? Number(t.duration_seconds) : null
      });
    });

    const rebuiltProjects = {};
    const mappedProjects = projRows.map(p => {
      const pLinesRaw = lineRows.filter(l => l.project_id === p.id);
      const scenesMap = {};
      let totalDialogues = 0;
      let goodDialogues = 0;
      let reviewDialogues = 0;
      let projectTakesTotal = 0;

      const pLines = pLinesRaw.map(l => {
        const scNum = l.scene_number || p.scene_number || '01';
        const scTitle = l.scene_title || p.scene_title || `SCENE ${scNum}`;
        if (!scenesMap[scNum]) {
          scenesMap[scNum] = scTitle;
        }

        if (l.line_type === 'action') {
          return {
            id: l.id,
            type: 'action',
            sceneNumber: scNum,
            sceneTitle: scTitle,
            content: l.content || ''
          };
        }

        if (l.continuity_note !== undefined && l.continuity_note !== null) {
          this.state.scriptNotes[l.id] = l.continuity_note;
        }

        const dlgTakes = takesByDialogue[l.id] || [];
        projectTakesTotal += dlgTakes.length;
        totalDialogues++;

        const hasCircled = l.status === 'good' || dlgTakes.some(tk => tk.isGood);
        const hasReview = !hasCircled && (l.status === 'warning' || dlgTakes.length > 0);
        if (hasCircled) goodDialogues++;
        else if (hasReview) reviewDialogues++;

        return {
          id: l.id,
          type: 'dialogue',
          sceneNumber: scNum,
          sceneTitle: scTitle,
          character: l.character_name || '',
          timecode: l.timecode || '00:00:00',
          text: l.dialogue_text || '',
          parenthetical: l.parenthetical || '',
          keyword: l.keyword || 'Dialog',
          shot: l.shot || '01',
          status: hasCircled ? 'good' : (hasReview ? 'warning' : (l.status || 'pending')),
          statusLabel: hasCircled ? 'Good Take' : (hasReview ? 'Review' : (l.status_label || 'Pending Shoot')),
          takes: dlgTakes
        };
      });

      const sceneEntries = Object.entries(scenesMap).map(([number, title]) => ({ number, title }));
      if (sceneEntries.length === 0) {
        sceneEntries.push({
          number: p.scene_number || '01',
          title: p.scene_title || 'SCENE 01'
        });
      }

      const goodPct = totalDialogues > 0 ? Math.round((goodDialogues / totalDialogues) * 100) : 0;
      const revPct = totalDialogues > 0 ? Math.round((reviewDialogues / totalDialogues) * 100) : 0;

      rebuiltProjects[p.id] = {
        projectId: p.id,
        projectTitle: p.title,
        subtitle: p.subtitle || p.title,
        synopsis: p.synopsis || '',
        location: p.location || '',
        durationTarget: p.duration_target || '',
        sourceFilename: p.source_filename || '',
        draft: p.draft || 'Draft v1.0',
        scenes: sceneEntries,
        scene: {
          number: sceneEntries[0].number,
          shotNumber: p.shot_number || '01',
          slugNumber: `SCENE ${sceneEntries[0].number}`,
          title: sceneEntries[0].title,
          timecode: p.scene_timecode || '00:00:00:00',
          takeInfo: `${projectTakesTotal} TAKE`
        },
        lines: pLines
      };

      return {
        id: p.id,
        code: p.code || 'SCRP-01',
        title: p.title,
        category: p.category || 'Film Pendek',
        subtitle: p.subtitle || p.title,
        synopsis: p.synopsis || '',
        location: p.location || '',
        durationTarget: p.duration_target || '',
        sourceFilename: p.source_filename || '',
        tag: `${sceneEntries.length} Scene`,
        day: p.day || 'Day 01',
        takesLogged: projectTakesTotal,
        fps: p.fps || '24 fps',
        goodTakePercentage: goodPct,
        reviewPercentage: revPct,
        syncStatus: p.sync_status || 'Ready',
        sceneCount: sceneEntries.length,
        dialogueCount: totalDialogues
      };
    });

    // Selalu timpa state lokal dengan hasil aktual database (termasuk bila 0 baris)
    this.db.projects = mappedProjects;
    this.db.scriptDataProjects = rebuiltProjects;

    if (this.db.projects.length > 0) {
      const exists = this.db.projects.some(p => p.id === this.state.activeProjectId);
      if (!exists) {
        this.state.activeProjectId = this.db.projects[0].id;
      }
      this.db.scriptData = this.db.scriptDataProjects[this.state.activeProjectId] || null;
      const activeProj = this.db.projects.find(p => p.id === this.state.activeProjectId);
      if (activeProj) {
        this.state.currentUser.prodName = activeProj.title;
      }

      if (this.db.scriptData && this.db.scriptData.lines) {
        const dialogues = this.db.scriptData.lines.filter(l => l.type === 'dialogue');
        const activeDlgExists = dialogues.some(d => d.id === this.state.activeDialogueId);
        if (!activeDlgExists && dialogues.length > 0) {
          this.state.activeDialogueId = dialogues[0].id;
          this.state.activeTakeNumber = (dialogues[0].takes && dialogues[0].takes[0]) ? dialogues[0].takes[0].number : 1;
        }
      }
    } else {
      this.state.activeProjectId = '';
      this.state.activeDialogueId = '';
      this.db.scriptData = null;
      this.state.currentUser.prodName = '-';
    }

    // Crew Profiles (selalu sinkron penuh, termasuk saat kosong)
    this.db.crewProfiles = crewRows.map(c => ({
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

    if (this.state.activePersonaKey) {
      const activeCrew = this.db.crewProfiles.find(c => c.personaKey === this.state.activePersonaKey);
      if (activeCrew && activeCrew.roles) {
        this.state.roles = { ...this.state.roles, ...activeCrew.roles };
      } else if (!this.state.supabaseUser) {
        // Bersihkan kunci persona lama yang sudah tidak ada di database
        this.state.activePersonaKey = '';
      }
    }

    // Notifications (selalu sinkron penuh, termasuk saat kosong)
    this.state.notifications = notifRows.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      time: n.time_label,
      type: n.notif_type,
      priority: n.priority,
      unread: !!n.unread,
      dismissed: !!n.dismissed
    }));

    const loginCountEl = document.getElementById('login-projects-count');
    if (loginCountEl) {
      loginCountEl.textContent = `${this.db.projects.length} Naskah`;
    }

    this.renderLoginCrewList();
    this.renderCrewAccountsList();
    this.renderProjectsScreen();
    this.updateDashboardData();
    this.updateProgressGauge();
    this.renderScriptContent();
    this.renderPanelContent();
    this.renderProfileRoles();
    this.renderNotificationsList();
  },

  subscribeRealtime() {
    if (!this.supabase || this._realtimeChannel) return;
    const scheduleSync = () => {
      clearTimeout(this._syncDebounceTimer);
      this._syncDebounceTimer = setTimeout(() => {
        this.syncFromSupabase();
      }, 220);
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

  /* ============================================================
   * LOCAL STORAGE & THEME PREFERENCES
   * ============================================================ */

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
          const parsedUser = JSON.parse(savedUser);
          const legacyEmails = ['aulia@lifelikepictures.com', 'dimas.edit@lifelikepictures.com', 'sound.rama@lifelikepictures.com'];
          if (parsedUser && legacyEmails.includes(String(parsedUser.email || '').toLowerCase())) {
            localStorage.removeItem('storypad_user');
            localStorage.removeItem('storypad_persona_key');
          } else if (parsedUser && typeof parsedUser === 'object') {
            this.state.currentUser = { ...this.state.currentUser, ...parsedUser };
          }
        }
        const savedPersona = localStorage.getItem('storypad_persona_key');
        if (savedPersona && !['scriptSupervisor', 'videoEditor', 'soundRecordist'].includes(savedPersona)) {
          this.state.activePersonaKey = savedPersona;
        }
        const savedTheme = localStorage.getItem('storypad_theme');
        if (savedTheme === 'daylight' || savedTheme === 'slate') {
          this.state.theme = savedTheme;
        }
      }
    } catch (e) {}
  },

  savePersistedSettings() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('storypad_view_settings', JSON.stringify(this.state.viewSettings));
        localStorage.setItem('storypad_roles', JSON.stringify(this.state.roles));
        localStorage.setItem('storypad_user', JSON.stringify(this.state.currentUser));
        localStorage.setItem('storypad_persona_key', this.state.activePersonaKey || '');
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
    this.syncPhpSession({ theme: this.state.theme });
    this.showToast(themeName === 'slate' ? 'Tema Slate Gelap diaktifkan' : 'Tema Kertas Editorial diaktifkan');
  },

  toggleTheme() {
    this.setTheme(this.state.theme === 'daylight' ? 'slate' : 'daylight');
  },

  /* ============================================================
   * UTILITIES, HAPTICS & CLIPBOARD
   * ============================================================ */

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  triggerHaptic() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(15); } catch (e) {}
    }
  },

  showToast(message = 'Perubahan tersimpan') {
    const toast = document.getElementById('toast-snackbar');
    const toastMsg = document.getElementById('toast-message');
    if (!toast) return;
    if (toastMsg) toastMsg.textContent = message;
    toast.classList.add('show');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2600);
  },

  writeClipboardText(text, successMessage = 'Berhasil disalin!') {
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

  fallbackCopy(text, successMessage = 'Berhasil disalin!') {
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

  formatSecondsToTc(secondsInput, fps = 24) {
    const secTotal = Math.max(0, Number(secondsInput) || 0);
    const wholeSec = Math.floor(secTotal);
    const frames = Math.floor((secTotal - wholeSec) * fps);
    const hrs = Math.floor(wholeSec / 3600);
    const mins = Math.floor((wholeSec % 3600) / 60);
    const secs = wholeSec % 60;
    return [hrs, mins, secs, frames].map(v => String(v).padStart(2, '0')).join(':');
  },

  getNumericFps() {
    const proj = this.db.projects.find(p => p.id === this.state.activeProjectId);
    if (!proj || !proj.fps) return 24;
    const m = String(proj.fps).match(/(\d+(?:\.\d+)?)/);
    return m ? Math.max(1, Math.round(parseFloat(m[1]))) : 24;
  },

  /* ============================================================
   * NAVIGATION & ROUTING
   * ============================================================ */

  syncTabFromScreen(screenId) {
    if (screenId === 'dashboard') this.state.activeTab = 'home';
    else if (screenId === 'projects') this.state.activeTab = 'project-list';
    else if (screenId === 'script-reader') this.state.activeTab = 'script-reader';
    else if (screenId === 'profile') this.state.activeTab = 'profile';
  },

  navigate(screenId, tabId = null) {
    this.triggerHaptic();
    if (this.state.currentScreen !== screenId) {
      this.state.previousScreen = this.state.currentScreen;
    }
    this.state.currentScreen = screenId;
    if (tabId) {
      this.state.activeTab = tabId;
    } else {
      this.syncTabFromScreen(screenId);
    }

    this.closeAllModals(true);
    this.renderScreen(screenId);
    this.updateNavbarVisibility();
    this.updateActiveTabStyles();

    if (screenId !== 'login') {
      this.syncPhpSession({ screen: screenId });
    }
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
    if (!projectId || !this.db.scriptDataProjects[projectId]) {
      if (this.db.projects.length === 0) {
        this.openScriptImportModal();
        return;
      }
      projectId = this.db.projects[0].id;
    }

    this.state.activeProjectId = projectId;
    this.state.activeSceneFilter = 'all';
    this.db.scriptData = this.db.scriptDataProjects[projectId];

    const firstDialogue = this.db.scriptData.lines.find(l => l.type === 'dialogue');
    if (firstDialogue) {
      this.state.activeDialogueId = firstDialogue.id;
      this.state.activeTakeNumber = (firstDialogue.takes && firstDialogue.takes.length > 0) ? firstDialogue.takes[0].number : 1;
    } else {
      this.state.activeDialogueId = '';
      this.state.activeTakeNumber = 1;
    }

    const proj = this.db.projects.find(p => p.id === projectId);
    if (proj) {
      this.state.currentUser.prodName = proj.title;
    }

    this.syncPhpSession({ active_project_id: projectId, user: this.state.currentUser });
    this.updateProgressGauge();
    this.updateDashboardData();
    this.navigate('script-reader', 'script-reader');
  },

  openProjectPanel(projectId, dialogueId, focusTarget = 'audio') {
    if (projectId && this.db.scriptDataProjects[projectId]) {
      this.state.activeProjectId = projectId;
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

    if (screenId === 'login') {
      this.renderLoginCrewList();
    } else if (screenId === 'dashboard') {
      this.updateDashboardData();
      this.updateProgressGauge();
    } else if (screenId === 'projects') {
      this.renderProjectsScreen();
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

  /* ============================================================
   * DASHBOARD & RADIAL CONTINUITY GAUGE
   * ============================================================ */

  updateDashboardData() {
    const proj = this.db.projects.find(p => p.id === this.state.activeProjectId) || this.db.projects[0] || null;
    const script = proj ? this.db.scriptDataProjects[proj.id] : null;

    const titleEl = document.getElementById('dash-active-proj-title');
    const metaEl = document.getElementById('dash-active-proj-meta');
    const sceneLineEl = document.getElementById('dash-active-scene-line');
    const synopsisEl = document.getElementById('dash-active-synopsis');
    const sceneBadgeEl = document.getElementById('dash-scene-badge');
    const nextActionEl = document.getElementById('dash-next-action');
    const navProdEl = document.getElementById('nav-prod-name');
    const allBtnEl = document.getElementById('dash-all-projects-btn');

    if (allBtnEl) {
      allBtnEl.textContent = `Semua (${this.db.projects.length})`;
    }

    if (!proj || !script) {
      if (titleEl) titleEl.textContent = this.state.supabaseLoading ? 'Memuat Naskah...' : 'Belum Ada Naskah Aktif';
      if (metaEl) metaEl.textContent = this.state.supabaseLoading ? 'Menghubungkan ke Supabase...' : '0 Proyek';
      if (sceneLineEl) sceneLineEl.textContent = 'Unggah dokumen .docx atau tulis naskah baru untuk memulai produksi.';
      if (synopsisEl) synopsisEl.classList.add('hidden');
      if (sceneBadgeEl) sceneBadgeEl.textContent = '0 Scene';
      if (nextActionEl) nextActionEl.textContent = 'Klik tombol "Tambah Naskah (.docx)" di bawah untuk mengonversi file naskah pertama Anda ke dalam StoryPad.';
      if (navProdEl) navProdEl.textContent = '-';
      this.renderDashboardProjectsList();
      this.renderDashboardMediaList();
      return;
    }

    if (titleEl) titleEl.textContent = proj.title;
    if (metaEl) metaEl.textContent = `${proj.category} | ${proj.location ? proj.location + ' | ' : ''}${proj.day} | ${proj.fps}`;
    if (sceneLineEl && script.scenes && script.scenes.length > 0) {
      sceneLineEl.textContent = `${script.scenes.length} Scene Terdaftar · Aktif: ${script.scenes[0].title}`;
    }
    if (synopsisEl) {
      if (proj.synopsis) {
        synopsisEl.textContent = proj.synopsis;
        synopsisEl.classList.remove('hidden');
      } else {
        synopsisEl.classList.add('hidden');
      }
    }
    if (sceneBadgeEl) sceneBadgeEl.textContent = `${script.scenes ? script.scenes.length : 1} Scene`;
    if (navProdEl) navProdEl.textContent = proj.title;

    const dialogues = script.lines.filter(l => l.type === 'dialogue');
    const goodCount = dialogues.filter(d => d.status === 'good').length;
    const pendingDialogue = dialogues.find(d => d.status !== 'good');

    if (nextActionEl) {
      if (dialogues.length === 0) {
        nextActionEl.textContent = 'Naskah ini belum memiliki baris dialog. Tambahkan dialog melalui tombol "+ Baris" di meja naskah.';
      } else if (pendingDialogue) {
        nextActionEl.textContent = `${goodCount} dari ${dialogues.length} dialog telah ditandai Good Take. Lanjutkan syuting pada Scene ${pendingDialogue.sceneNumber} (${pendingDialogue.character}, Shot ${pendingDialogue.shot}).`;
      } else {
        nextActionEl.textContent = `Seluruh ${dialogues.length} dialog pada naskah "${proj.title}" telah berstatus Good Take dan siap disinkronkan ke NLE.`;
      }
    }

    this.renderDashboardProjectsList();
    this.renderDashboardMediaList();
  },

  renderDashboardProjectsList() {
    const listEl = document.getElementById('dash-projects-list');
    if (!listEl) return;

    if (this.db.projects.length === 0) {
      listEl.innerHTML = `
        <div class="sp-panel-muted p-4 flex flex-col items-start gap-2.5">
          <p class="font-sans text-xs font-semibold m-0" style="color: var(--text-primary);">Daftar proyek masih kosong</p>
          <p class="font-sans text-xs m-0" style="color: var(--text-secondary);">Impor dokumen naskah (.docx, .txt, .fountain) agar proyek langsung tampil dan siap dicatat.</p>
          <button type="button" class="sp-btn sp-btn-primary sp-btn-compact" onclick="StoryPad.openScriptImportModal()">
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">upload_file</span>
            <span>Impor Naskah Sekarang</span>
          </button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = this.db.projects.map(p => {
      const sc = this.db.scriptDataProjects[p.id];
      const firstDlg = sc && sc.lines ? sc.lines.find(l => l.type === 'dialogue') : null;
      const firstDlgId = firstDlg ? firstDlg.id : '';
      const statusCls = p.syncStatus === 'In Sync' ? 'sp-badge-good' : (p.syncStatus === 'Review' ? 'sp-badge-amber' : 'sp-badge-blue');
      return `
        <div class="p-3 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5" style="background-color: var(--panel-lowest); border-color: var(--border-flat);">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="font-sans text-sm font-bold text-left hover:underline bg-transparent border-0 p-0" style="color: var(--text-primary);" onclick="StoryPad.openProject('${this.escapeHtml(p.id)}')">
                ${this.escapeHtml(p.title)}
              </button>
              <span class="sp-badge ${statusCls}">${this.escapeHtml(p.syncStatus)}</span>
            </div>
            <p class="font-mono text-[11px] mt-0.5 mb-0 tabular-nums" style="color: var(--text-secondary);">
              ${this.escapeHtml(p.category)} | ${p.sceneCount || 1} Scene | ${p.dialogueCount || 0} Dialog | ${p.takesLogged || 0} Take | ${this.escapeHtml(p.fps)}
            </p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.openProject('${this.escapeHtml(p.id)}')">Buka Naskah</button>
            <button type="button" class="sp-icon-btn" aria-label="Kelola audio ${this.escapeHtml(p.title)}" onclick="StoryPad.openProjectPanel('${this.escapeHtml(p.id)}', '${this.escapeHtml(firstDlgId)}', 'audio')">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">graphic_eq</span>
            </button>
            <button type="button" class="sp-icon-btn" aria-label="Kelola footage ${this.escapeHtml(p.title)}" onclick="StoryPad.openProjectPanel('${this.escapeHtml(p.id)}', '${this.escapeHtml(firstDlgId)}', 'video')">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">videocam</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  renderDashboardMediaList() {
    const container = document.getElementById('dash-media-tracks-list');
    const countBadge = document.getElementById('dash-media-count-badge');
    if (!container) return;

    const script = this.db.scriptData;
    const mediaItems = [];
    if (script && Array.isArray(script.lines)) {
      script.lines.forEach(line => {
        if (line.type !== 'dialogue' || !Array.isArray(line.takes)) return;
        line.takes.forEach(tk => {
          if (tk.audioUrl) {
            mediaItems.push({
              kind: 'audio',
              dialogueId: line.id,
              takeNumber: tk.number,
              character: line.character,
              sceneNumber: line.sceneNumber,
              shot: line.shot,
              filename: tk.audioFilename || this.generateFileNames(line.id, tk.number).audioName,
              url: tk.audioUrl,
              durationSeconds: tk.durationSeconds
            });
          }
          if (tk.videoUrl) {
            mediaItems.push({
              kind: 'video',
              dialogueId: line.id,
              takeNumber: tk.number,
              character: line.character,
              sceneNumber: line.sceneNumber,
              shot: line.shot,
              filename: tk.videoFilename || this.generateFileNames(line.id, tk.number).videoName,
              url: tk.videoUrl,
              durationSeconds: tk.durationSeconds
            });
          }
        });
      });
    }

    if (countBadge) {
      countBadge.textContent = `${mediaItems.length} Klip`;
    }

    if (mediaItems.length === 0) {
      container.innerHTML = `
        <div class="p-4 rounded bg-[#12151B] border border-[#2A2E39] flex flex-col items-start gap-2.5">
          <p class="font-sans text-xs font-semibold text-[#F3F4F6] m-0">Belum ada berkas audio atau footage yang diunggah</p>
          <p class="font-sans text-xs text-[#A1A9B8] m-0 leading-relaxed">
            Pilih baris dialog pada naskah aktif lalu unggah rekaman audio (.wav/.mp3) atau footage kamera (.mp4/.mov) agar dapat diputar langsung dari beranda.
          </p>
          <button type="button" class="sp-btn sp-btn-primary sp-btn-compact" onclick="StoryPad.openAudioPanel(StoryPad.state.activeDialogueId, 'audio')">
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">upload</span>
            <span>Unggah Audio / Footage</span>
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = mediaItems.slice(0, 5).map(item => {
      const isAudio = item.kind === 'audio';
      const durLabel = item.durationSeconds ? this.formatSecondsToTc(item.durationSeconds, this.getNumericFps()).slice(3, 8) : `T${String(item.takeNumber).padStart(2, '0')}`;
      return `
        <div class="p-3 rounded bg-[#12151B] border border-[#2A2E39] flex items-center justify-between gap-2.5">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="material-symbols-outlined ${isAudio ? 'text-[#34D399]' : 'text-[#60A5FA]'} text-[18px] shrink-0" aria-hidden="true">${isAudio ? 'graphic_eq' : 'videocam'}</span>
            <div class="min-w-0">
              <p class="font-mono text-xs text-[#F3F4F6] truncate m-0">${this.escapeHtml(item.filename)}</p>
              <p class="font-sans text-[11px] text-[#A1A9B8] truncate m-0">SC ${this.escapeHtml(item.sceneNumber)} · SH ${this.escapeHtml(item.shot)} · ${this.escapeHtml(item.character)} (${durLabel})</p>
            </div>
          </div>
          <button type="button" class="sp-btn sp-btn-primary sp-btn-compact shrink-0" onclick="StoryPad.openAudioPanel('${this.escapeHtml(item.dialogueId)}', '${item.kind}')">
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">play_arrow</span>
            <span>Buka</span>
          </button>
        </div>
      `;
    }).join('');
  },

  updateProgressGauge() {
    const dialogues = (this.db.scriptData && Array.isArray(this.db.scriptData.lines))
      ? this.db.scriptData.lines.filter(l => l.type === 'dialogue')
      : [];

    const goodTakeCount = dialogues.filter(d => d.status === 'good').length;
    const totalCount = dialogues.length;
    const percentage = totalCount > 0 ? Math.round((goodTakeCount / totalCount) * 100) : 0;

    const circumference = 251.32;
    const offset = circumference - (percentage / 100) * circumference;

    const progressFill = document.getElementById('hero-gauge-fill');
    const progressText = document.getElementById('hero-gauge-pct');
    const takesBadge = document.getElementById('hero-gauge-takes');
    const circleBadge = document.getElementById('hero-gauge-circle');

    if (progressFill) progressFill.style.strokeDashoffset = offset.toFixed(2);
    if (progressText) progressText.textContent = `${percentage}%`;
    if (takesBadge) takesBadge.textContent = `${goodTakeCount} / ${totalCount} Dialog`;
    if (circleBadge) circleBadge.textContent = `${goodTakeCount} Confirmed`;
  },

  /* ============================================================
   * DYNAMIC PROJECTS SCREEN & ARCHIVE
   * ============================================================ */

  renderProjectsScreen() {
    const cardsContainer = document.getElementById('projects-cards-list');
    const chipsContainer = document.getElementById('project-category-chips');
    const countLabel = document.getElementById('projects-count-label');
    const emptyBox = document.getElementById('project-search-empty');
    const emptyHeading = document.getElementById('project-empty-heading');
    const emptyDesc = document.getElementById('project-empty-desc');

    if (!cardsContainer) return;

    // Render dynamic category filter chips
    if (chipsContainer) {
      const categories = [...new Set(this.db.projects.map(p => p.category).filter(Boolean))];
      let chipsHtml = `<button type="button" class="project-category-btn ${this.state.activeProjectCategory === 'all' ? 'is-active' : ''}" onclick="StoryPad.filterProjectsByCategory('all', this)">Semua (${this.db.projects.length})</button>`;
      categories.forEach(cat => {
        const isActive = this.state.activeProjectCategory.toLowerCase() === cat.toLowerCase();
        chipsHtml += `<button type="button" class="project-category-btn ${isActive ? 'is-active' : ''}" onclick="StoryPad.filterProjectsByCategory('${this.escapeHtml(cat)}', this)">${this.escapeHtml(cat)}</button>`;
      });
      chipsContainer.innerHTML = chipsHtml;
    }

    const q = this.state.projectSearchQuery;
    const category = this.state.activeProjectCategory;

    const filtered = this.db.projects.filter(p => {
      const hay = `${p.code} ${p.title} ${p.category} ${p.subtitle} ${p.location} ${p.fps} ${p.syncStatus}`.toLowerCase();
      const matchesCat = category === 'all' || (p.category || '').toLowerCase().includes(category.toLowerCase());
      const matchesQ = !q || hay.includes(q);
      return matchesCat && matchesQ;
    });

    if (countLabel) {
      countLabel.textContent = `${filtered.length} Aktif`;
    }

    if (this.db.projects.length === 0) {
      cardsContainer.innerHTML = '';
      if (emptyBox) {
        emptyBox.classList.remove('hidden');
        emptyBox.style.display = 'block';
      }
      if (emptyHeading) emptyHeading.textContent = this.state.supabaseLoading ? 'Memuat naskah dari database...' : 'Belum ada naskah produksi di database';
      if (emptyDesc) emptyDesc.textContent = 'Unggah dokumen naskah (.docx, .txt, .fountain) untuk mengonversinya menjadi proyek produksi siap syuting.';
      return;
    }

    if (filtered.length === 0) {
      cardsContainer.innerHTML = '';
      if (emptyBox) {
        emptyBox.classList.remove('hidden');
        emptyBox.style.display = 'block';
      }
      if (emptyHeading) emptyHeading.textContent = 'Tidak ada proyek yang cocok dengan filter aktif';
      if (emptyDesc) emptyDesc.textContent = 'Ubah kata kunci pencarian, pilih kategori Semua, atau impor naskah baru.';
      return;
    }

    if (emptyBox) {
      emptyBox.classList.add('hidden');
      emptyBox.style.display = 'none';
    }

    cardsContainer.innerHTML = filtered.map(p => {
      const sc = this.db.scriptDataProjects[p.id];
      const firstDlg = sc && sc.lines ? sc.lines.find(l => l.type === 'dialogue') : null;
      const firstDlgId = firstDlg ? firstDlg.id : '';
      const statusCls = p.syncStatus === 'In Sync' ? 'sp-badge-good' : (p.syncStatus === 'Review' ? 'sp-badge-amber' : 'sp-badge-blue');
      const goodPct = Math.min(100, Math.max(0, Number(p.goodTakePercentage) || 0));
      const revPct = Math.min(100 - goodPct, Math.max(0, Number(p.reviewPercentage) || 0));

      return `
        <article class="project-card-item sp-panel p-4 md:p-5 flex flex-col gap-3">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="flex flex-col gap-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-mono text-xs font-bold px-1.5 py-0.5 rounded border" style="background-color: var(--panel-lowest); border-color: var(--border-flat); color: var(--text-secondary);">${this.escapeHtml(p.code)}</span>
                <h2 class="font-sans text-base font-bold m-0" style="color: var(--text-primary);">${this.escapeHtml(p.title)}</h2>
                <span class="sp-badge sp-badge-blue">${this.escapeHtml(p.category)}</span>
                <span class="sp-badge ${statusCls}">${this.escapeHtml(p.syncStatus)}</span>
              </div>
              <p class="font-sans text-xs m-0" style="color: var(--text-secondary);">
                ${this.escapeHtml(sc ? sc.draft : 'Draft v1.0')} · ${p.sceneCount || 1} Scene · ${p.dialogueCount || 0} Dialog · ${p.takesLogged || 0} Take · ${this.escapeHtml(p.fps)}${p.location ? ' · Lokasi: ' + this.escapeHtml(p.location) : ''}
              </p>
              ${p.synopsis ? `<p class="font-sans text-xs m-0 mt-0.5 leading-relaxed" style="color: var(--text-muted);">${this.escapeHtml(p.synopsis)}</p>` : ''}
            </div>

            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <button type="button" class="sp-btn sp-btn-primary sp-btn-compact btn-press" onclick="StoryPad.openProject('${this.escapeHtml(p.id)}')">
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit_note</span>
                <span>Buka Naskah</span>
              </button>
              <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact btn-press" onclick="StoryPad.openProjectPanel('${this.escapeHtml(p.id)}', '${this.escapeHtml(firstDlgId)}', 'audio')">
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">graphic_eq</span>
                <span>Audio</span>
              </button>
              <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact btn-press" onclick="StoryPad.openProjectPanel('${this.escapeHtml(p.id)}', '${this.escapeHtml(firstDlgId)}', 'video')">
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">videocam</span>
                <span>Footage</span>
              </button>
              <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" title="Perbarui naskah proyek ini dari berkas baru" onclick="StoryPad.openScriptImportModal('${this.escapeHtml(p.id)}')">
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">upload_file</span>
                <span>Revisi</span>
              </button>
              <button type="button" class="sp-btn sp-btn-danger sp-btn-compact" aria-label="Arsipkan proyek ${this.escapeHtml(p.title)}" onclick="StoryPad.archiveProject('${this.escapeHtml(p.id)}')">
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">archive</span>
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5 pt-2 border-t" style="border-color: var(--border-flat);">
            <div class="flex items-center justify-between text-xs font-mono tabular-nums">
              <span style="color: var(--good-text);">Circle Takes: ${goodPct}%</span>
              <span style="color: var(--primary-text);">Review: ${revPct}%</span>
            </div>
            <div class="w-full h-2 rounded overflow-hidden flex" style="background-color: var(--panel-elevated);">
              <div class="bg-[#047857] h-full" style="width: ${goodPct}%;" title="Circle Takes ${goodPct}%"></div>
              <div class="bg-[#2563EB] h-full" style="width: ${revPct}%;" title="Review ${revPct}%"></div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  },

  async archiveProject(projectId) {
    const proj = this.db.projects.find(p => p.id === projectId);
    if (!proj) return;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const ok = window.confirm(`Arsipkan naskah "${proj.title}" dari daftar proyek aktif?`);
      if (!ok) return;
    }

    this.db.projects = this.db.projects.filter(p => p.id !== projectId);
    delete this.db.scriptDataProjects[projectId];
    if (this.state.activeProjectId === projectId) {
      this.state.activeProjectId = this.db.projects[0] ? this.db.projects[0].id : '';
      this.db.scriptData = this.state.activeProjectId ? this.db.scriptDataProjects[this.state.activeProjectId] : null;
    }

    this.renderProjectsScreen();
    this.updateDashboardData();
    this.updateProgressGauge();
    this.showToast(`Naskah "${proj.title}" diarsipkan`);

    if (this.supabase) {
      await Promise.all([
        this.supabase.from('takes').update({ is_archived: true }).eq('project_id', projectId),
        this.supabase.from('script_lines').update({ is_archived: true }).eq('project_id', projectId),
        this.supabase.from('projects').update({ is_archived: true }).eq('id', projectId)
      ]).catch(() => {});
    } else if (this.phpBoot && this.phpBoot.phpEnabled && typeof fetch === 'function') {
      fetch('api/supabase.php?action=archive_project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      }).catch(() => {});
    }
  },

  /* ============================================================
   * AUTO-NAMING ENGINE & INTERACTIVE MULTI-SCENE SCRIPT READER
   * ============================================================ */

  generateFileNames(dialogueId = this.state.activeDialogueId, takeNum = this.state.activeTakeNumber) {
    const lines = (this.db.scriptData && Array.isArray(this.db.scriptData.lines)) ? this.db.scriptData.lines : [];
    const dialogue = lines.find(l => l.id === dialogueId && l.type === 'dialogue')
      || lines.find(l => l.type === 'dialogue')
      || { sceneNumber: '01', shot: '01', keyword: 'Dialog' };

    const rawScene = dialogue.sceneNumber || (this.db.scriptData && this.db.scriptData.scene ? this.db.scriptData.scene.number : '01');
    const sceneCode = `SC${String(rawScene).padStart(2, '0')}`;
    const shotCode = `SH${String(dialogue.shot || '01').padStart(2, '0')}`;
    const takeCode = `T${String(takeNum || 1).padStart(2, '0')}`;
    const keyword = String(dialogue.keyword || 'Dialog').replace(/[^a-zA-Z0-9_-]/g, '') || 'Dialog';

    return {
      sceneCode,
      shotCode,
      takeCode,
      keyword,
      videoName: `${sceneCode}_${shotCode}_${takeCode}_${keyword}_CAM-A.mp4`,
      audioName: `${sceneCode}_${shotCode}_${takeCode}_${keyword}_AUD.wav`
    };
  },

  selectSceneFilter(sceneNumber) {
    this.triggerHaptic();
    this.state.activeSceneFilter = sceneNumber || 'all';
    if (this.db.scriptData && Array.isArray(this.db.scriptData.lines)) {
      const candidateDialogues = this.db.scriptData.lines.filter(l =>
        l.type === 'dialogue' && (this.state.activeSceneFilter === 'all' || l.sceneNumber === this.state.activeSceneFilter)
      );
      if (candidateDialogues.length > 0 && !candidateDialogues.some(d => d.id === this.state.activeDialogueId)) {
        this.state.activeDialogueId = candidateDialogues[0].id;
        this.state.activeTakeNumber = (candidateDialogues[0].takes && candidateDialogues[0].takes[0]) ? candidateDialogues[0].takes[0].number : 1;
      }
    }
    this.renderScriptContent();
    this.renderPanelContent();
  },

  renderScriptContent() {
    const container = document.getElementById('script-lines-container');
    const projSwitcher = document.getElementById('script-project-switcher');
    const sceneSwitcher = document.getElementById('script-scene-switcher');
    if (!container) return;

    // Render Dynamic Project Switcher
    if (projSwitcher) {
      let swHtml = this.db.projects.map(p => `
        <button type="button" class="script-proj-switch project-category-btn ${p.id === this.state.activeProjectId ? 'is-active' : ''}" data-project-id="${this.escapeHtml(p.id)}" onclick="StoryPad.openProject('${this.escapeHtml(p.id)}')">
          ${this.escapeHtml(p.title)}
        </button>
      `).join('');
      swHtml += `
        <button type="button" class="project-category-btn" onclick="StoryPad.openScriptImportModal()">
          + Impor Naskah
        </button>
      `;
      projSwitcher.innerHTML = swHtml;
    }

    if (!this.db.scriptData) {
      if (sceneSwitcher) sceneSwitcher.innerHTML = '';
      container.innerHTML = `
        <div class="p-6 rounded border text-center flex flex-col items-center gap-3" style="background-color: var(--panel-lowest); border-color: var(--border-flat);">
          <p class="font-sans text-sm font-semibold m-0" style="color: var(--text-primary);">Belum ada naskah yang dipilih</p>
          <p class="font-sans text-xs m-0" style="color: var(--text-secondary);">Impor dokumen naskah (.docx, .txt, .fountain) untuk menampilkan adegan dan dialog di lembar kerja ini.</p>
          <button type="button" class="sp-btn sp-btn-primary sp-btn-compact" onclick="StoryPad.openScriptImportModal()">
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">upload_file</span>
            <span>Impor Naskah Sekarang</span>
          </button>
        </div>
      `;
      return;
    }

    const { lines, scenes = [] } = this.db.scriptData;

    // Render Multi-Scene Switcher Strip
    if (sceneSwitcher) {
      if (scenes.length > 1) {
        let scHtml = `
          <button type="button" role="tab" aria-selected="${this.state.activeSceneFilter === 'all' ? 'true' : 'false'}" class="script-filter-chip ${this.state.activeSceneFilter === 'all' ? 'is-active' : ''}" onclick="StoryPad.selectSceneFilter('all')">
            Semua Scene (${scenes.length})
          </button>
        `;
        scenes.forEach(sc => {
          const shortTitle = sc.title.replace(/^SCENE\s*\d+\s*-\s*/i, '').replace(/\s*\([^)]*\)\s*$/, '');
          const isSel = this.state.activeSceneFilter === sc.number;
          scHtml += `
            <button type="button" role="tab" aria-selected="${isSel ? 'true' : 'false'}" class="script-filter-chip ${isSel ? 'is-active' : ''}" onclick="StoryPad.selectSceneFilter('${this.escapeHtml(sc.number)}')">
              SC ${this.escapeHtml(sc.number)}${shortTitle ? ': ' + this.escapeHtml(shortTitle) : ''}
            </button>
          `;
        });
        sceneSwitcher.innerHTML = scHtml;
      } else {
        sceneSwitcher.innerHTML = '';
      }
    }

    const filteredByScene = this.state.activeSceneFilter === 'all'
      ? lines
      : lines.filter(l => l.sceneNumber === this.state.activeSceneFilter);

    const allDialogues = filteredByScene.filter(l => l.type === 'dialogue');
    const goodDialogueCount = allDialogues.filter(d => d.status === 'good' || (d.takes && d.takes.some(t => t.isGood))).length;
    const activeCue = allDialogues.find(d => d.id === this.state.activeDialogueId) || allDialogues[0] || null;
    const activeCueIndex = activeCue ? (allDialogues.indexOf(activeCue) + 1) : 0;

    const currentSceneObj = this.state.activeSceneFilter !== 'all'
      ? (scenes.find(s => s.number === this.state.activeSceneFilter) || scenes[0])
      : (activeCue ? { number: activeCue.sceneNumber, title: activeCue.sceneTitle } : (scenes[0] || this.db.scriptData.scene));

    let totalTakesInScope = 0;
    allDialogues.forEach(d => { totalTakesInScope += (d.takes ? d.takes.length : 0); });

    const titleEl = document.getElementById('script-project-title');
    const draftEl = document.getElementById('script-project-draft');
    const slugEl = document.getElementById('script-slug-badge');
    const headerTcEl = document.getElementById('script-header-tc');
    const takeInfoEl = document.getElementById('script-take-info');
    const sceneTitleEl = document.getElementById('script-scene-title');
    const boxSceneTitleEl = document.getElementById('script-box-scenename');
    const coverageBadgeEl = document.getElementById('script-scene-coverage-badge');

    if (titleEl) titleEl.textContent = this.db.scriptData.projectTitle;
    if (draftEl) draftEl.textContent = this.db.scriptData.draft;
    if (slugEl && currentSceneObj) slugEl.textContent = `SCENE ${currentSceneObj.number}`;
    if (headerTcEl) headerTcEl.textContent = activeCue ? activeCue.timecode : '00:00:00';
    if (takeInfoEl) takeInfoEl.textContent = `${totalTakesInScope} TAKE TERCATAT`;
    if (sceneTitleEl && currentSceneObj) {
      sceneTitleEl.textContent = this.state.activeSceneFilter === 'all' && scenes.length > 1
        ? `${this.db.scriptData.projectTitle} - SEMUA ADEGAN (${scenes.length} SCENE)`
        : currentSceneObj.title;
    }
    if (coverageBadgeEl) coverageBadgeEl.textContent = `${goodDialogueCount} / ${allDialogues.length} GOOD TAKE`;
    if (boxSceneTitleEl) {
      if (activeCue) {
        boxSceneTitleEl.textContent = `SC ${activeCue.sceneNumber} · SHOT ${activeCue.shot} AKTIF (${activeCue.character}) · DIALOG ${activeCueIndex} DARI ${allDialogues.length}`;
      } else {
        boxSceneTitleEl.textContent = 'LEMBAR NASKAH INTERAKTIF';
      }
    }

    this.syncInlineFilterChipsUI();

    const { showFileCode, highlightStatus, focusDialogueMode, filterGoodTakeOnly } = this.state.viewSettings;

    let html = '';
    let renderedDialogues = 0;
    let lastRenderedScene = null;

    filteredByScene.forEach(line => {
      if (focusDialogueMode && line.type === 'action') {
        return;
      }

      if (line.type === 'dialogue') {
        const hasGoodTakeCheck = line.status === 'good' || (line.takes && line.takes.some(t => t.isGood));
        if (filterGoodTakeOnly && !hasGoodTakeCheck) {
          return;
        }
      }

      // Tampilkan pembatas adegan saat berganti scene
      if (line.sceneNumber && line.sceneNumber !== lastRenderedScene) {
        lastRenderedScene = line.sceneNumber;
        html += `
          <div class="scene-divider-banner flex flex-wrap items-center justify-between gap-2 mt-1">
            <span class="font-mono text-xs font-bold uppercase tracking-wide" style="color: var(--text-primary);">${this.escapeHtml(line.sceneTitle || ('SCENE ' + line.sceneNumber))}</span>
            <span class="sp-badge sp-badge-blue font-mono">SC ${this.escapeHtml(line.sceneNumber)}</span>
          </div>
        `;
      }

      if (line.type === 'action') {
        html += `
          <div class="font-mono text-xs leading-relaxed px-3 py-2 rounded border-l-2" style="color: var(--text-secondary); background-color: var(--panel-lowest); border-left-color: var(--border-control);">
            ${this.escapeHtml(line.content)}
          </div>
        `;
      } else if (line.type === 'dialogue') {
        renderedDialogues++;
        const isSelected = line.id === this.state.activeDialogueId;
        const statusClass = highlightStatus ? `status-${line.status}` : '';
        const preferredTakeNum = isSelected
          ? this.state.activeTakeNumber
          : ((line.takes && line.takes.find(t => t.isGood)?.number) || (line.takes && line.takes[0]?.number) || 1);
        const naming = this.generateFileNames(line.id, preferredTakeNum);
        const hasGoodTake = line.status === 'good' || (line.takes && line.takes.some(t => t.isGood));
        const hasAudioFile = Array.isArray(line.takes) && line.takes.some(t => !!t.audioUrl);
        const hasVideoFile = Array.isArray(line.takes) && line.takes.some(t => !!t.videoUrl);

        const badgeHtml = hasGoodTake
          ? `<span class="sp-badge sp-badge-good">GOOD TAKE</span>`
          : (line.status === 'warning'
            ? `<span class="sp-badge sp-badge-amber">REVIEW</span>`
            : `<span class="sp-badge sp-badge-neutral">PENDING</span>`);

        const mediaBadges = `
          ${hasAudioFile ? `<span class="sp-badge sp-badge-good font-mono" title="Memiliki berkas audio terunggah">AUD</span>` : ''}
          ${hasVideoFile ? `<span class="sp-badge sp-badge-blue font-mono" title="Memiliki klip footage terunggah">VID</span>` : ''}
        `;

        const takeCount = line.takes ? line.takes.length : 0;
        const activeTakeObj = (line.takes || []).find(t => t.number === this.state.activeTakeNumber);
        const isCurrentTakeCircled = !!(activeTakeObj && activeTakeObj.isGood);
        const takePad = String(this.state.activeTakeNumber).padStart(2, '0');

        html += `
          <article class="script-line-card p-3.5 md:p-4 ${statusClass} ${isSelected ? 'selected' : ''}"
                   id="script-cue-${this.escapeHtml(line.id)}"
                   role="button"
                   tabindex="0"
                   aria-pressed="${isSelected ? 'true' : 'false'}"
                   onclick="StoryPad.selectDialogueLine('${this.escapeHtml(line.id)}')"
                   onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();StoryPad.selectDialogueLine('${this.escapeHtml(line.id)}');}">
            <div class="flex flex-col gap-1.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-sans text-xs font-bold uppercase tracking-wide"
                        style="color: ${isSelected ? 'var(--primary-text)' : 'var(--text-primary)'};">
                    ${this.escapeHtml(line.character)}
                  </span>
                  <span class="font-mono text-xs tabular-nums" style="color: var(--text-secondary);">SH ${this.escapeHtml(line.shot)}</span>
                  <span class="font-mono text-xs tabular-nums" style="color: var(--text-muted);">${this.escapeHtml(line.timecode)}</span>
                  ${badgeHtml}
                  ${mediaBadges}
                  ${isSelected ? `<span class="sp-badge sp-badge-blue">Aktif di Deck</span>` : ''}
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="font-mono text-xs font-semibold tabular-nums" style="color: var(--text-secondary);">${takeCount} Take</span>
                </div>
              </div>

              <p class="m-0 font-mono text-sm leading-relaxed select-text" style="color: var(--text-script);">
                "${this.escapeHtml(line.text)}"
              </p>

              ${line.parenthetical ? `
                <p class="m-0 script-parenthetical">
                  (${this.escapeHtml(line.parenthetical)})
                </p>
              ` : ''}

              ${showFileCode ? `
                <div class="pt-1 flex flex-wrap items-center gap-2">
                  <button type="button"
                          class="script-filecode-btn truncate"
                          title="Salin nama file video (${this.escapeHtml(naming.videoName)})"
                          onclick="event.stopPropagation(); StoryPad.selectDialogueLine('${this.escapeHtml(line.id)}'); StoryPad.copySpecificFilename('video')">
                    <span class="material-symbols-outlined text-[13px]" aria-hidden="true">content_copy</span>
                    <span class="truncate">${this.escapeHtml(naming.videoName)}</span>
                  </button>
                </div>
              ` : ''}

              ${isSelected ? `
                <div class="script-cue-toolbar" onclick="event.stopPropagation()">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <button type="button"
                            class="sp-btn sp-btn-primary sp-btn-compact"
                            onclick="StoryPad.logNewTake()">
                      <span class="material-symbols-outlined text-[15px]" aria-hidden="true">add</span>
                      <span>+ Take</span>
                    </button>
                    ${takeCount > 0 ? `
                      <button type="button"
                              class="sp-btn sp-btn-compact ${isCurrentTakeCircled ? 'bg-[#047857] border-[#047857] text-white' : 'sp-btn-secondary'}"
                              onclick="StoryPad.toggleCircleTake(${this.state.activeTakeNumber})">
                        <span class="material-symbols-outlined text-[15px]" aria-hidden="true">${isCurrentTakeCircled ? 'verified' : 'check_circle'}</span>
                        <span>${isCurrentTakeCircled ? `Circle T${takePad}` : `Tandai Good T${takePad}`}</span>
                      </button>
                    ` : ''}
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" aria-label="Kelola Audio ${this.escapeHtml(line.character)}" onclick="StoryPad.openAudioPanel('${this.escapeHtml(line.id)}', 'audio')">
                      <span class="material-symbols-outlined text-[15px]" aria-hidden="true">graphic_eq</span>
                      <span>Audio</span>
                    </button>
                    <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" aria-label="Kelola Footage ${this.escapeHtml(line.character)}" onclick="StoryPad.openAudioPanel('${this.escapeHtml(line.id)}', 'video')">
                      <span class="material-symbols-outlined text-[15px]" aria-hidden="true">videocam</span>
                      <span>Footage</span>
                    </button>
                    <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" aria-label="Catatan Kontinuitas ${this.escapeHtml(line.character)}" onclick="StoryPad.openAudioPanel('${this.escapeHtml(line.id)}', 'notes')">
                      <span class="material-symbols-outlined text-[15px]" aria-hidden="true">edit_note</span>
                      <span>Catatan</span>
                    </button>
                  </div>
                </div>
              ` : ''}
            </div>
          </article>
        `;
      }
    });

    const filterSummaryEl = document.getElementById('script-filter-summary');
    if (filterSummaryEl) {
      filterSummaryEl.textContent = `${renderedDialogues} dari ${allDialogues.length} dialog ditampilkan`;
    }

    if (renderedDialogues === 0 && filterGoodTakeOnly && allDialogues.length > 0) {
      html += `
        <div class="p-6 rounded border text-center" style="background-color: var(--panel-lowest); border-color: var(--border-flat);">
          <p class="font-sans text-sm font-semibold mb-1" style="color: var(--text-primary);">Belum ada dialog berstatus Good Take pada adegan ini</p>
          <p class="font-sans text-xs mb-4" style="color: var(--text-secondary);">Filter Good Take Saja sedang menyembunyikan ${allDialogues.length} dialog berstatus Review dan Pending.</p>
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
    this.stopAudioPlayback();
    this.stopFootagePlayback();
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

  /* ============================================================
   * VIEW SETTINGS MODAL & INLINE FILTER CHIPS
   * ============================================================ */

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
    this.syncInlineFilterChipsUI();
  },

  syncInlineFilterChipsUI() {
    const map = [
      { id: 'inline-chip-focusdialog', key: 'focusDialogueMode' },
      { id: 'inline-chip-goodtake', key: 'filterGoodTakeOnly' },
      { id: 'inline-chip-filecode', key: 'showFileCode' },
      { id: 'inline-chip-highlight', key: 'highlightStatus' }
    ];
    map.forEach(({ id, key }) => {
      const chip = document.getElementById(id);
      if (!chip) return;
      const active = !!this.state.viewSettings[key];
      if (active) chip.classList.add('is-active');
      else chip.classList.remove('is-active');
      if (typeof chip.setAttribute === 'function') {
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
      }
    });
  },

  toggleInlineViewFilter(settingKey) {
    const nextState = !this.state.viewSettings[settingKey];
    this.handleViewToggle(settingKey, nextState);
    this.syncViewTogglesUI();
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

  /* ============================================================
   * INSPECTOR DECK: REAL AUDIO, REAL VIDEO FOOTAGE, TAKES & NOTES
   * ============================================================ */

  getActiveDialogueObject() {
    if (!this.db.scriptData || !Array.isArray(this.db.scriptData.lines)) return null;
    return this.db.scriptData.lines.find(l => l.id === this.state.activeDialogueId && l.type === 'dialogue')
      || this.db.scriptData.lines.find(l => l.type === 'dialogue')
      || null;
  },

  getActiveTakeObject() {
    const dlg = this.getActiveDialogueObject();
    if (!dlg || !Array.isArray(dlg.takes) || dlg.takes.length === 0) return null;
    return dlg.takes.find(t => t.number === this.state.activeTakeNumber) || dlg.takes[0];
  },

  switchPanelMediaTab(tab = 'audio') {
    this.triggerHaptic();
    this.state.activeMediaTab = tab;

    const audioBtn = document.getElementById('panel-tab-audio');
    const videoBtn = document.getElementById('panel-tab-video');
    const audioContainer = document.getElementById('panel-audio-container');
    const footageContainer = document.getElementById('panel-footage-container');

    if (tab === 'video') {
      this.stopAudioPlayback();
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
      this.stopFootagePlayback();
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

  openAudioPanel(dialogueId = this.state.activeDialogueId, focusTarget = 'audio') {
    this.triggerHaptic();
    if (dialogueId) {
      this.state.activeDialogueId = dialogueId;
    }

    const dialogue = this.getActiveDialogueObject();
    if (dialogue) {
      this.state.activeDialogueId = dialogue.id;
      if (dialogue.takes && dialogue.takes.length > 0) {
        const preferred = dialogue.takes.find(t => t.isGood) || dialogue.takes[0];
        this.state.activeTakeNumber = preferred.number;
      } else {
        this.state.activeTakeNumber = 1;
      }
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
        }, 220);
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
    const dialogue = this.getActiveDialogueObject();
    const take = this.getActiveTakeObject();
    const sceneNum = dialogue ? (dialogue.sceneNumber || '01') : '01';
    const shotNum = dialogue ? (dialogue.shot || '01') : '01';
    const takePad = String(this.state.activeTakeNumber || 1).padStart(2, '0');

    const titleEl = document.getElementById('panel-scene-title');
    if (titleEl) {
      titleEl.innerHTML = `Panel Media &amp; Take <span class="text-xs text-[#A1A9B8] font-normal font-mono">(SC ${this.escapeHtml(sceneNum)} / SH ${this.escapeHtml(shotNum)})</span>`;
    }

    const slateSc = document.getElementById('footage-scene-badge');
    const slateSh = document.getElementById('footage-shot-badge');
    const slateTk = document.getElementById('footage-take-badge');
    const fpsBadge = document.getElementById('footage-fps-badge');
    if (slateSc) slateSc.textContent = `SC ${sceneNum}`;
    if (slateSh) slateSh.textContent = `SH ${shotNum}`;
    if (slateTk) slateTk.textContent = `TK ${takePad}`;
    if (fpsBadge) fpsBadge.textContent = `${this.getNumericFps()} FPS`;

    this.syncPanelMediaBindings(take);
    this.renderPanelTakes();
    this.updatePanelAutoNaming();

    const notesEl = document.getElementById('panel-script-notes');
    if (notesEl) {
      notesEl.value = dialogue && this.state.scriptNotes[dialogue.id] !== undefined
        ? this.state.scriptNotes[dialogue.id]
        : '';
    }
  },

  syncPanelMediaBindings(take) {
    const audioEl = document.getElementById('panel-real-audio');
    const audioBadge = document.getElementById('panel-audio-source-badge');
    const audioLabel = document.getElementById('panel-audio-file-label');
    const clearAudioBtn = document.getElementById('btn-clear-audio');
    const elapsedTcEl = document.getElementById('panel-elapsed-tc');
    const totalTcEl = document.getElementById('panel-total-tc');

    if (take && take.audioUrl) {
      if (audioBadge) {
        audioBadge.textContent = 'Berkas Audio Asli';
        audioBadge.className = 'font-mono text-[11px] px-2 py-0.5 rounded bg-[#064E3B] border border-[#10B981] text-[#34D399]';
      }
      if (audioLabel) {
        audioLabel.textContent = take.audioFilename || take.audioUrl;
      }
      if (clearAudioBtn) clearAudioBtn.classList.remove('hidden');
      if (audioEl && audioEl.getAttribute('data-bound-url') !== take.audioUrl) {
        audioEl.src = take.audioUrl;
        audioEl.setAttribute('data-bound-url', take.audioUrl);
      }
      if (totalTcEl) {
        totalTcEl.textContent = take.durationSeconds ? this.formatSecondsToTc(take.durationSeconds, this.getNumericFps()) : '00:00:00:00';
      }
    } else {
      if (audioBadge) {
        audioBadge.textContent = 'Belum Ada File';
        audioBadge.className = 'font-mono text-[11px] px-2 py-0.5 rounded bg-[#1E222B] border border-[#2A2E39] text-[#A1A9B8]';
      }
      if (audioLabel) {
        audioLabel.textContent = 'Unggah rekaman audio (.wav / .mp3 / .m4a) untuk memutar suara asli take ini.';
      }
      if (clearAudioBtn) clearAudioBtn.classList.add('hidden');
      if (audioEl) {
        audioEl.removeAttribute('src');
        audioEl.removeAttribute('data-bound-url');
      }
      if (elapsedTcEl) elapsedTcEl.textContent = '00:00:00:00';
      if (totalTcEl) totalTcEl.textContent = '00:00:00:00';
    }

    const videoEl = document.getElementById('panel-real-video');
    const videoBadge = document.getElementById('panel-video-source-badge');
    const slatePlaceholder = document.getElementById('footage-slate-placeholder');
    const fileCaption = document.getElementById('footage-file-caption');
    const clearVideoBtn = document.getElementById('btn-clear-video');
    const footageTotalTc = document.getElementById('footage-total-tc');
    const footageElapsedTc = document.getElementById('footage-elapsed-tc');
    const footageLiveTc = document.getElementById('footage-live-tc');

    if (take && take.videoUrl) {
      if (videoBadge) {
        videoBadge.textContent = 'Klip Footage Asli';
        videoBadge.className = 'font-mono text-[11px] px-2 py-0.5 rounded bg-[#064E3B] border border-[#10B981] text-[#34D399]';
      }
      if (videoEl) {
        videoEl.classList.remove('hidden');
        if (videoEl.getAttribute('data-bound-url') !== take.videoUrl) {
          videoEl.src = take.videoUrl;
          videoEl.setAttribute('data-bound-url', take.videoUrl);
        }
      }
      if (slatePlaceholder) slatePlaceholder.classList.add('hidden');
      if (fileCaption) fileCaption.textContent = take.videoFilename || take.videoUrl;
      if (clearVideoBtn) clearVideoBtn.classList.remove('hidden');
      if (footageTotalTc) {
        footageTotalTc.textContent = `/ ${take.durationSeconds ? this.formatSecondsToTc(take.durationSeconds, this.getNumericFps()) : '00:00:00:00'}`;
      }
    } else {
      if (videoBadge) {
        videoBadge.textContent = 'Mode Slate';
        videoBadge.className = 'font-mono text-[11px] px-2 py-0.5 rounded bg-[#1E222B] border border-[#2A2E39] text-[#A1A9B8]';
      }
      if (videoEl) {
        videoEl.classList.add('hidden');
        videoEl.removeAttribute('src');
        videoEl.removeAttribute('data-bound-url');
      }
      if (slatePlaceholder) slatePlaceholder.classList.remove('hidden');
      if (fileCaption) fileCaption.textContent = 'Belum ada klip video terlampir';
      if (clearVideoBtn) clearVideoBtn.classList.add('hidden');
      if (footageElapsedTc) footageElapsedTc.textContent = '00:00:00:00';
      if (footageLiveTc) footageLiveTc.textContent = '00:00:00:00';
      if (footageTotalTc) footageTotalTc.textContent = '/ 00:00:00:00';
    }
  },

  bindMediaElementEvents() {
    if (typeof document === 'undefined') return;
    const audioEl = document.getElementById('panel-real-audio');
    if (audioEl && typeof audioEl.addEventListener === 'function') {
      audioEl.addEventListener('loadedmetadata', () => {
        const totalTcEl = document.getElementById('panel-total-tc');
        if (totalTcEl && isFinite(audioEl.duration)) {
          totalTcEl.textContent = this.formatSecondsToTc(audioEl.duration, this.getNumericFps());
        }
      });
      audioEl.addEventListener('timeupdate', () => {
        const elapsedTcEl = document.getElementById('panel-elapsed-tc');
        const playhead = document.getElementById('panel-audio-playhead');
        if (elapsedTcEl) {
          elapsedTcEl.textContent = this.formatSecondsToTc(audioEl.currentTime, this.getNumericFps());
        }
        if (playhead && isFinite(audioEl.duration) && audioEl.duration > 0) {
          const pct = Math.min(100, Math.max(0, (audioEl.currentTime / audioEl.duration) * 100));
          playhead.style.left = `${pct.toFixed(1)}%`;
        }
      });
      audioEl.addEventListener('ended', () => {
        this.stopAudioPlayback();
      });
    }

    const videoEl = document.getElementById('panel-real-video');
    if (videoEl && typeof videoEl.addEventListener === 'function') {
      videoEl.addEventListener('loadedmetadata', () => {
        const totalEl = document.getElementById('footage-total-tc');
        if (totalEl && isFinite(videoEl.duration)) {
          totalEl.textContent = `/ ${this.formatSecondsToTc(videoEl.duration, this.getNumericFps())}`;
        }
      });
      videoEl.addEventListener('timeupdate', () => {
        const tc = this.formatSecondsToTc(videoEl.currentTime, this.getNumericFps());
        const liveEl = document.getElementById('footage-live-tc');
        const elapEl = document.getElementById('footage-elapsed-tc');
        if (liveEl) liveEl.textContent = tc;
        if (elapEl) elapEl.textContent = tc;
      });
      videoEl.addEventListener('ended', () => {
        this.stopFootagePlayback();
      });
    }
  },

  renderPanelTakes() {
    const listEl = document.getElementById('panel-takes-list');
    if (!listEl) return;

    const dialogue = this.getActiveDialogueObject();
    const sceneNum = dialogue ? (dialogue.sceneNumber || '01') : '01';
    const shotNum = dialogue ? (dialogue.shot || '01') : '01';
    const allTakes = (dialogue && Array.isArray(dialogue.takes)) ? dialogue.takes : [];

    const headerLabel = document.getElementById('panel-takes-header-label');
    const countBadge = document.getElementById('panel-takes-count-badge');
    if (headerLabel) headerLabel.textContent = `Daftar Rekaman Take (SC ${sceneNum} / SH ${shotNum})`;
    if (countBadge) countBadge.textContent = `${allTakes.length} Take`;

    if (!dialogue) {
      listEl.innerHTML = `
        <div class="p-3 bg-[#12151B] border border-[#2A2E39] rounded text-center text-xs text-[#A1A9B8]">
          Pilih baris dialog pada naskah untuk mencatat take dan mengunggah media.
        </div>
      `;
      return;
    }

    let takes = allTakes;
    if (this.state.viewSettings.filterGoodTakeOnly) {
      takes = takes.filter(t => t.isGood);
    }

    if (allTakes.length === 0) {
      listEl.innerHTML = `
        <div class="p-3 bg-[#12151B] border border-[#2A2E39] rounded text-center flex flex-col items-center gap-2">
          <p class="font-sans text-xs text-[#F3F4F6] font-semibold m-0">Belum ada take terekam pada dialog ini</p>
          <p class="font-sans text-[11px] text-[#A1A9B8] m-0">Catat Take 01 atau langsung unggah berkas audio/footage untuk membuat Take 01 otomatis.</p>
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
          <p class="font-sans text-xs text-[#F3F4F6] font-semibold m-0">Tidak ada Good Take pada dialog ini</p>
          <p class="font-sans text-[11px] text-[#A1A9B8] m-0">Filter Good Take Only sedang menyembunyikan ${allTakes.length} take lainnya.</p>
          <button type="button" class="sp-btn sp-btn-monitor sp-btn-compact" onclick="StoryPad.handleViewToggle('filterGoodTakeOnly', false); StoryPad.syncViewTogglesUI();">
            Tampilkan Semua Take
          </button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = takes.map(t => {
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
          ? `<span class="px-2 py-0.5 rounded bg-[#450A0A] border border-[#EF4444] text-[#F87171] font-sans text-[10px] font-semibold">${this.escapeHtml(t.statusLabel)}</span>`
          : `<span class="px-2 py-0.5 rounded bg-[#1E222B] border border-[#6A748B] text-[#F3F4F6] font-sans text-[10px]">${this.escapeHtml(t.statusLabel)}</span>`);

      const mediaChips = `
        ${t.audioUrl ? `<span class="px-1.5 py-0.5 rounded bg-[#064E3B] border border-[#10B981] text-[#34D399] font-mono text-[10px]">AUD</span>` : ''}
        ${t.videoUrl ? `<span class="px-1.5 py-0.5 rounded bg-[#172554] border border-[#3B82F6] text-[#93C5FD] font-mono text-[10px]">VID</span>` : ''}
      `;

      return `
        <div class="border ${rowBorder} p-2.5 rounded flex items-center justify-between gap-2 transition-colors">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <button aria-label="Pilih atau putar Take ${takePad}"
                    type="button"
                    onclick="StoryPad.previewTakeAudio(${t.number})"
                    class="w-10 h-10 rounded ${isGood ? 'bg-[#047857] text-white' : 'bg-[#1E222B] text-[#F3F4F6] border border-[#6A748B]'} flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">${isSelected && StoryPad.state.audio.isPlaying ? 'volume_up' : 'play_arrow'}</span>
            </button>
            <button type="button"
                    onclick="StoryPad.selectTake(${t.number})"
                    class="min-w-0 flex-1 text-left bg-transparent border-0 p-1 rounded">
              <span class="flex items-center gap-1.5 font-sans text-xs font-bold text-[#F3F4F6] truncate">
                <span>T${takePad} | ${this.escapeHtml(t.label)}</span>
                ${mediaChips}
              </span>
              <span class="block font-mono text-[11px] ${isGood ? 'text-[#A7F3D0]' : 'text-[#A1A9B8]'} tabular-nums truncate">
                ${this.escapeHtml(t.tc)}
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
    }).join('');
  },

  ensureActiveTakeExists() {
    const dialogue = this.getActiveDialogueObject();
    if (!dialogue) return null;
    if (!Array.isArray(dialogue.takes)) dialogue.takes = [];
    let take = dialogue.takes.find(t => t.number === this.state.activeTakeNumber);
    if (!take) {
      this.logNewTake();
      take = dialogue.takes.find(t => t.number === this.state.activeTakeNumber) || dialogue.takes[0];
    }
    return take;
  },

  logNewTake() {
    this.triggerHaptic();
    const dialogue = this.getActiveDialogueObject();
    if (!dialogue) {
      this.showToast('Pilih baris dialog terlebih dahulu');
      return;
    }
    if (!dialogue.takes) dialogue.takes = [];
    const nextNum = dialogue.takes.length > 0
      ? Math.max(...dialogue.takes.map(t => t.number)) + 1
      : 1;
    const takePad = String(nextNum).padStart(2, '0');
    const newTake = {
      number: nextNum,
      label: `Take ${takePad} | CAM-A / BOOM`,
      tc: `${dialogue.timecode || '00:00:00'} SMPTE`,
      statusLabel: 'Hold',
      isGood: false,
      isNg: false,
      audioUrl: null,
      videoUrl: null
    };
    dialogue.takes.push(newTake);
    if (dialogue.status === 'pending') {
      dialogue.status = 'warning';
      dialogue.statusLabel = 'Review';
    }
    this.state.activeTakeNumber = nextNum;

    const proj = this.db.projects.find(p => p.id === this.state.activeProjectId);
    if (proj) proj.takesLogged = (proj.takesLogged || 0) + 1;

    this.renderPanelContent();
    this.renderScriptContent();
    this.updateProgressGauge();
    this.updateDashboardData();
    this.showToast(`Take ${takePad} dicatat pada Shot ${dialogue.shot}`);

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
        director_pick: false,
        is_archived: false
      }, { onConflict: 'dialogue_id,take_number' }).then(() => {});
      this.supabase.from('script_lines').update({
        status: dialogue.status,
        status_label: dialogue.statusLabel
      }).eq('id', dialogue.id).then(() => {});
    }
  },

  toggleCircleTake(takeNumber) {
    this.triggerHaptic();
    const dialogue = this.getActiveDialogueObject();
    if (!dialogue || !dialogue.takes) return;
    const take = dialogue.takes.find(t => t.number === takeNumber);
    if (!take) return;

    const takePad = String(takeNumber).padStart(2, '0');
    take.isGood = !take.isGood;
    if (take.isGood) {
      take.isNg = false;
      take.statusLabel = 'GOOD TAKE';
      dialogue.status = 'good';
      dialogue.statusLabel = 'Good Take';
      this.showToast(`Take ${takePad} ditandai sebagai Circle Take`);
    } else {
      take.statusLabel = take.directorPick ? 'Director Pick' : 'Hold';
      const hasOtherGood = dialogue.takes.some(t => t.isGood);
      dialogue.status = hasOtherGood ? 'good' : 'warning';
      dialogue.statusLabel = hasOtherGood ? 'Good Take' : 'Review';
      this.showToast(`Tanda Circle Take ${takePad} dibatalkan`);
    }

    this.recomputeProjectPercentages(this.state.activeProjectId);
    this.renderPanelTakes();
    this.renderScriptContent();
    this.updateProgressGauge();
    this.updateDashboardData();
    this.renderProjectsScreen();

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

  recomputeProjectPercentages(projectId) {
    const proj = this.db.projects.find(p => p.id === projectId);
    const script = this.db.scriptDataProjects[projectId];
    if (!proj || !script || !Array.isArray(script.lines)) return;
    const dlgs = script.lines.filter(l => l.type === 'dialogue');
    const total = dlgs.length || 1;
    const good = dlgs.filter(d => d.status === 'good').length;
    const rev = dlgs.filter(d => d.status === 'warning').length;
    proj.goodTakePercentage = Math.round((good / total) * 100);
    proj.reviewPercentage = Math.round((rev / total) * 100);

    if (this.supabase) {
      this.supabase.from('projects').update({
        good_take_percentage: proj.goodTakePercentage,
        review_percentage: proj.reviewPercentage,
        takes_logged: proj.takesLogged || 0
      }).eq('id', projectId).then(() => {});
    }
  },

  selectTake(takeNumber) {
    this.triggerHaptic();
    this.stopAudioPlayback();
    this.stopFootagePlayback();
    this.state.activeTakeNumber = takeNumber;
    this.renderPanelContent();
  },

  previewTakeAudio(takeNumber) {
    this.selectTake(takeNumber);
    const take = this.getActiveTakeObject();
    if (take && take.audioUrl) {
      this.switchPanelMediaTab('audio');
      this.togglePanelAudioPlayback();
    } else if (take && take.videoUrl) {
      this.switchPanelMediaTab('video');
      this.toggleFootagePlayback();
    } else {
      this.showToast(`Take ${String(takeNumber).padStart(2, '0')} dipilih. Unggah audio atau footage untuk memutar.`);
    }
  },

  /* ============================================================
   * REAL AUDIO & VIDEO UPLOAD + URL LINKING
   * ============================================================ */

  triggerMediaPicker(mediaType = 'audio') {
    this.triggerHaptic();
    if (!this.getActiveDialogueObject()) {
      this.showToast('Pilih baris dialog terlebih dahulu');
      return;
    }
    const input = document.getElementById(mediaType === 'video' ? 'input-upload-video' : 'input-upload-audio');
    if (input && typeof input.click === 'function') {
      input.value = '';
      input.click();
    }
  },

  toggleMediaUrlInput(mediaType = 'audio') {
    this.triggerHaptic();
    const box = document.getElementById(mediaType === 'video' ? 'video-url-box' : 'audio-url-box');
    if (!box) return;
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) {
      box.classList.add('flex');
      const input = document.getElementById(mediaType === 'video' ? 'input-video-url' : 'input-audio-url');
      if (input && typeof input.focus === 'function') input.focus();
    } else {
      box.classList.remove('flex');
    }
  },

  probeFileDuration(file, mediaType) {
    return new Promise((resolve) => {
      if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        resolve(null);
        return;
      }
      const el = document.createElement(mediaType === 'video' ? 'video' : 'audio');
      const tempUrl = URL.createObjectURL(file);
      let settled = false;
      const done = (val) => {
        if (settled) return;
        settled = true;
        try { URL.revokeObjectURL(tempUrl); } catch (e) {}
        resolve(val);
      };
      el.preload = 'metadata';
      el.onloadedmetadata = () => done(isFinite(el.duration) ? Math.round(el.duration * 100) / 100 : null);
      el.onerror = () => done(null);
      setTimeout(() => done(null), 3500);
      el.src = tempUrl;
    });
  },

  async handleMediaFileSelected(mediaType, inputEl) {
    if (!inputEl || !inputEl.files || inputEl.files.length === 0) return;
    const file = inputEl.files[0];
    const dialogue = this.getActiveDialogueObject();
    if (!dialogue) return;

    const take = this.ensureActiveTakeExists();
    if (!take) return;

    const statusBanner = document.getElementById('panel-media-upload-status');
    const setStatus = (msg, show = true) => {
      if (!statusBanner) return;
      statusBanner.textContent = msg;
      statusBanner.classList.toggle('hidden', !show);
    };

    const naming = this.generateFileNames(dialogue.id, take.number);
    const ext = (file.name.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'wav')).toLowerCase();
    const baseStem = (mediaType === 'video' ? naming.videoName : naming.audioName).replace(/\.[^.]+$/, '');
    const standardizedName = `${baseStem}.${ext}`;

    setStatus(`Mengukur durasi & mengunggah ${standardizedName}...`, true);

    try {
      const durationSeconds = await this.probeFileDuration(file, mediaType);
      const bucket = this.supabaseConfig.storageBucket || 'storypad-media';
      const takePad = String(take.number).padStart(2, '0');
      const objectPath = `${this.state.activeProjectId}/${dialogue.id}_T${takePad}_${Date.now()}_${standardizedName}`;

      let publicUrl = '';

      if (this.supabase && this.supabase.storage) {
        const upRes = await this.supabase.storage.from(bucket).upload(objectPath, file, {
          upsert: true,
          contentType: file.type || (mediaType === 'video' ? 'video/mp4' : 'audio/wav')
        });
        if (upRes.error) {
          throw new Error(upRes.error.message || 'Gagal mengunggah berkas ke Supabase Storage');
        }
        const pubData = this.supabase.storage.from(bucket).getPublicUrl(objectPath);
        publicUrl = pubData && pubData.data ? pubData.data.publicUrl : '';

        const dbPatch = {
          dialogue_id: dialogue.id,
          project_id: this.state.activeProjectId,
          take_number: take.number,
          label: take.label,
          tc: durationSeconds ? `${this.formatSecondsToTc(durationSeconds, this.getNumericFps())} SMPTE` : take.tc,
          status_label: take.statusLabel,
          is_good: !!take.isGood,
          is_ng: !!take.isNg,
          is_archived: false
        };
        if (mediaType === 'audio') {
          dbPatch.audio_url = publicUrl;
          dbPatch.audio_filename = standardizedName;
          dbPatch.audio_mime = file.type || 'audio/wav';
          dbPatch.audio_size_bytes = file.size;
        } else {
          dbPatch.video_url = publicUrl;
          dbPatch.video_filename = standardizedName;
          dbPatch.video_mime = file.type || 'video/mp4';
          dbPatch.video_size_bytes = file.size;
        }
        if (durationSeconds) {
          dbPatch.duration_seconds = durationSeconds;
        }
        await this.supabase.from('takes').upsert(dbPatch, { onConflict: 'dialogue_id,take_number' });
      } else if (this.phpBoot && this.phpBoot.phpEnabled && typeof fetch === 'function') {
        const form = new FormData();
        form.append('media_file', file);
        form.append('project_id', this.state.activeProjectId);
        form.append('dialogue_id', dialogue.id);
        form.append('take_number', String(take.number));
        form.append('media_type', mediaType);
        form.append('standardized_filename', standardizedName);
        form.append('label', take.label);
        form.append('tc', take.tc);
        form.append('status_label', take.statusLabel);
        if (durationSeconds) form.append('duration_seconds', String(durationSeconds));

        const res = await fetch('api/media.php', { method: 'POST', body: form });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || 'Gagal mengunggah media via server PHP');
        }
        publicUrl = json.url;
      } else if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        publicUrl = URL.createObjectURL(file);
      }

      if (mediaType === 'audio') {
        take.audioUrl = publicUrl;
        take.audioFilename = standardizedName;
        take.audioMime = file.type;
        take.audioSizeBytes = file.size;
      } else {
        take.videoUrl = publicUrl;
        take.videoFilename = standardizedName;
        take.videoMime = file.type;
        take.videoSizeBytes = file.size;
      }
      if (durationSeconds) {
        take.durationSeconds = durationSeconds;
        take.tc = `${this.formatSecondsToTc(durationSeconds, this.getNumericFps())} SMPTE`;
      }

      setStatus('', false);
      this.renderPanelContent();
      this.renderScriptContent();
      this.updateDashboardData();
      this.showToast(`${mediaType === 'video' ? 'Footage' : 'Audio'} ${standardizedName} berhasil dilampirkan`);
    } catch (err) {
      setStatus(`Gagal mengunggah: ${err.message}`, true);
      this.showToast('Gagal mengunggah berkas media');
    }
  },

  async attachMediaByUrl(mediaType = 'audio') {
    this.triggerHaptic();
    const input = document.getElementById(mediaType === 'video' ? 'input-video-url' : 'input-audio-url');
    const url = input ? input.value.trim() : '';
    if (!url || !/^https?:\/\//i.test(url)) {
      this.showToast('Masukkan URL http:// atau https:// yang valid');
      return;
    }

    const dialogue = this.getActiveDialogueObject();
    if (!dialogue) return;
    const take = this.ensureActiveTakeExists();
    if (!take) return;

    const naming = this.generateFileNames(dialogue.id, take.number);
    const filename = mediaType === 'video' ? naming.videoName : naming.audioName;

    if (mediaType === 'audio') {
      take.audioUrl = url;
      take.audioFilename = filename;
    } else {
      take.videoUrl = url;
      take.videoFilename = filename;
    }

    if (input) input.value = '';
    this.toggleMediaUrlInput(mediaType);
    this.renderPanelContent();
    this.renderScriptContent();
    this.updateDashboardData();
    this.showToast(`URL ${mediaType === 'video' ? 'footage' : 'audio'} berhasil ditautkan ke Take 0${take.number}`);

    if (this.supabase) {
      const patch = mediaType === 'audio'
        ? { audio_url: url, audio_filename: filename }
        : { video_url: url, video_filename: filename };
      await this.supabase.from('takes').update(patch).eq('dialogue_id', dialogue.id).eq('take_number', take.number).catch(() => {});
    }
  },

  async clearTakeMedia(mediaType = 'audio') {
    this.triggerHaptic();
    const dialogue = this.getActiveDialogueObject();
    const take = this.getActiveTakeObject();
    if (!dialogue || !take) return;

    this.stopAudioPlayback();
    this.stopFootagePlayback();

    if (mediaType === 'audio') {
      take.audioUrl = null;
      take.audioFilename = null;
      take.audioMime = null;
      take.audioSizeBytes = null;
    } else {
      take.videoUrl = null;
      take.videoFilename = null;
      take.videoMime = null;
      take.videoSizeBytes = null;
    }

    this.renderPanelContent();
    this.renderScriptContent();
    this.updateDashboardData();
    this.showToast(`Lampiran ${mediaType === 'video' ? 'footage' : 'audio'} dilepas dari Take 0${take.number}`);

    if (this.supabase) {
      const patch = mediaType === 'audio'
        ? { audio_url: null, audio_filename: null, audio_mime: null, audio_size_bytes: null }
        : { video_url: null, video_filename: null, video_mime: null, video_size_bytes: null };
      await this.supabase.from('takes').update(patch).eq('dialogue_id', dialogue.id).eq('take_number', take.number).catch(() => {});
    }
  },

  /* ============================================================
   * REAL AUDIO & VIDEO PLAYBACK ENGINE
   * ============================================================ */

  togglePanelAudioPlayback() {
    this.triggerHaptic();
    if (this.state.audio.isPlaying) {
      this.stopAudioPlayback();
    } else {
      this.startAudioPlayback('panel-waveform');
    }
  },

  startAudioPlayback(waveformContainerId) {
    const take = this.getActiveTakeObject();
    const audioEl = document.getElementById('panel-real-audio');

    if (!take || !take.audioUrl) {
      this.showToast('Belum ada berkas audio pada take ini. Klik "Unggah Audio" terlebih dahulu.');
      const upBtn = document.getElementById('btn-trigger-audio-upload');
      if (upBtn && typeof upBtn.focus === 'function') upBtn.focus();
      return;
    }

    this.state.audio.isPlaying = true;
    const playIcon = document.getElementById('panel-play-icon');
    if (playIcon) playIcon.textContent = 'pause';

    if (audioEl && typeof audioEl.play === 'function') {
      if (audioEl.getAttribute('data-bound-url') !== take.audioUrl) {
        audioEl.src = take.audioUrl;
        audioEl.setAttribute('data-bound-url', take.audioUrl);
      }
      audioEl.play().catch(() => {});
    }

    const container = document.getElementById(waveformContainerId);
    const bars = container ? container.querySelectorAll('.waveform-bar') : [];
    clearInterval(this.state.audio.animInterval);
    this.state.audio.animInterval = setInterval(() => {
      bars.forEach(bar => {
        bar.style.height = `${Math.floor(Math.random() * 68 + 24)}%`;
      });
    }, 110);

    const ch1Meter = document.getElementById('vu-meter-ch1');
    const ch2Meter = document.getElementById('vu-meter-ch2');
    const ch1Db = document.getElementById('vu-val-ch1');
    const ch2Db = document.getElementById('vu-val-ch2');

    clearInterval(this.state.audio.levelInterval);
    this.state.audio.levelInterval = setInterval(() => {
      const db1 = -(Math.floor(Math.random() * 10 + 6));
      const db2 = -(Math.floor(Math.random() * 12 + 9));
      if (ch1Db) ch1Db.textContent = `${db1} dB`;
      if (ch2Db) ch2Db.textContent = `${db2} dB`;
      if (ch1Meter) ch1Meter.style.width = `${Math.min(100, Math.max(12, 100 + db1 * 4))}%`;
      if (ch2Meter) ch2Meter.style.width = `${Math.min(100, Math.max(12, 100 + db2 * 4))}%`;
    }, 125);
  },

  stopAudioPlayback() {
    this.state.audio.isPlaying = false;
    clearInterval(this.state.audio.animInterval);
    clearInterval(this.state.audio.levelInterval);

    const audioEl = document.getElementById('panel-real-audio');
    if (audioEl && typeof audioEl.pause === 'function') {
      try { audioEl.pause(); } catch (e) {}
    }

    const playIcon = document.getElementById('panel-play-icon');
    if (playIcon) playIcon.textContent = 'play_arrow';

    const ch1Meter = document.getElementById('vu-meter-ch1');
    const ch2Meter = document.getElementById('vu-meter-ch2');
    const ch1Db = document.getElementById('vu-val-ch1');
    const ch2Db = document.getElementById('vu-val-ch2');
    if (ch1Meter) ch1Meter.style.width = '0%';
    if (ch2Meter) ch2Meter.style.width = '0%';
    if (ch1Db) ch1Db.textContent = '-- dB';
    if (ch2Db) ch2Db.textContent = '-- dB';
  },

  toggleFootagePlayback() {
    this.triggerHaptic();
    const take = this.getActiveTakeObject();
    const videoEl = document.getElementById('panel-real-video');

    if (take && take.videoUrl && videoEl && typeof videoEl.play === 'function') {
      if (this.state.footage.isPlaying) {
        this.stopFootagePlayback();
      } else {
        this.state.footage.isPlaying = true;
        const playIcon = document.getElementById('footage-play-icon');
        if (playIcon) playIcon.textContent = 'pause';
        videoEl.play().catch(() => {});
      }
      return;
    }

    // Mode pratinjau slate ketika belum ada file video terunggah
    this.state.footage.isPlaying = !this.state.footage.isPlaying;
    const playIcon = document.getElementById('footage-play-icon');
    if (playIcon) playIcon.textContent = this.state.footage.isPlaying ? 'pause' : 'play_arrow';

    if (this.state.footage.isPlaying) {
      clearInterval(this.state.footage.interval);
      this.state.footage.interval = setInterval(() => {
        this.stepFootage(1);
      }, Math.round(1000 / this.getNumericFps()));
    } else {
      clearInterval(this.state.footage.interval);
    }
  },

  stopFootagePlayback() {
    this.state.footage.isPlaying = false;
    clearInterval(this.state.footage.interval);
    const videoEl = document.getElementById('panel-real-video');
    if (videoEl && typeof videoEl.pause === 'function') {
      try { videoEl.pause(); } catch (e) {}
    }
    const playIcon = document.getElementById('footage-play-icon');
    if (playIcon) playIcon.textContent = 'play_arrow';
  },

  stepFootage(direction) {
    const fps = this.getNumericFps();
    const take = this.getActiveTakeObject();
    const videoEl = document.getElementById('panel-real-video');

    if (take && take.videoUrl && videoEl && typeof videoEl.pause === 'function' && videoEl.readyState >= 1) {
      videoEl.pause();
      this.state.footage.isPlaying = false;
      const playIcon = document.getElementById('footage-play-icon');
      if (playIcon) playIcon.textContent = 'play_arrow';
      const nextTime = Math.max(0, Math.min(videoEl.duration || 3600, (videoEl.currentTime || 0) + direction * (1 / fps)));
      videoEl.currentTime = nextTime;
      const tc = this.formatSecondsToTc(nextTime, fps);
      const tcLive = document.getElementById('footage-live-tc');
      const tcElapsed = document.getElementById('footage-elapsed-tc');
      if (tcLive) tcLive.textContent = tc;
      if (tcElapsed) tcElapsed.textContent = tc;
      return;
    }

    this.state.footage.frame = (this.state.footage.frame || 0) + direction;
    if (this.state.footage.frame >= fps) {
      this.state.footage.frame = 0;
      this.state.footage.seconds = (this.state.footage.seconds || 0) + 1;
    } else if (this.state.footage.frame < 0) {
      this.state.footage.frame = fps - 1;
      this.state.footage.seconds = Math.max(0, (this.state.footage.seconds || 0) - 1);
    }
    const frameStr = String(this.state.footage.frame).padStart(2, '0');
    const minsStr = String(Math.floor((this.state.footage.seconds || 0) / 60)).padStart(2, '0');
    const secStr = String((this.state.footage.seconds || 0) % 60).padStart(2, '0');
    const tc = `00:${minsStr}:${secStr}:${frameStr}`;
    const tcLive = document.getElementById('footage-live-tc');
    const tcElapsed = document.getElementById('footage-elapsed-tc');
    if (tcLive) tcLive.textContent = tc;
    if (tcElapsed) tcElapsed.textContent = tc;
  },

  updatePanelAutoNaming() {
    const naming = this.generateFileNames(this.state.activeDialogueId, this.state.activeTakeNumber);
    const takePad = String(this.state.activeTakeNumber || 1).padStart(2, '0');

    const titleEl = document.getElementById('panel-naming-title');
    const scEl = document.getElementById('panel-naming-sc');
    const shEl = document.getElementById('panel-naming-sh');
    const tkEl = document.getElementById('panel-naming-tk');
    const camEl = document.getElementById('panel-naming-cam');
    const videoEl = document.getElementById('filename-video');
    const audioEl = document.getElementById('filename-audio');

    if (titleEl) titleEl.textContent = `Kode Penamaan Otomatis (Take ${takePad})`;
    if (scEl) scEl.textContent = `SC: ${naming.sceneCode.replace('SC', '')}`;
    if (shEl) shEl.textContent = `SH: ${naming.shotCode.replace('SH', '')}`;
    if (tkEl) tkEl.textContent = `TK: ${takePad}`;
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
    if (!dialogueId) return;
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
          if (statusEl && !error) statusEl.textContent = 'Tersimpan di Supabase';
        });
      }, 450);
    }
  },

  saveNotes() {
    const notesEl = document.getElementById('panel-script-notes');
    const dialogueId = this.state.activeDialogueId;
    if (!notesEl || !dialogueId) return;
    this.state.scriptNotes[dialogueId] = notesEl.value;
    const statusEl = document.getElementById('panel-autosave-status');
    if (statusEl) statusEl.textContent = this.supabase ? 'Disimpan ke Supabase' : 'Catatan disimpan';
    this.showToast('Catatan kontinuitas disimpan');
    if (this.supabase) {
      this.supabase.from('script_lines').update({
        continuity_note: notesEl.value
      }).eq('id', dialogueId).then(() => {});
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

    setTimeout(() => {
      const naming = this.generateFileNames(this.state.activeDialogueId, this.state.activeTakeNumber);
      btn.innerHTML = `<span class="material-symbols-outlined text-[16px]" aria-hidden="true">done_all</span><span>Paket NLE Siap</span>`;
      if (statusEl) {
        statusEl.textContent = `Paket metadata siap untuk ${naming.videoName}`;
      }
      this.showToast('Metadata timeline NLE disinkronkan');

      const proj = this.db.projects.find(p => p.id === this.state.activeProjectId);
      if (proj) proj.syncStatus = 'In Sync';

      if (this.supabase && this.state.activeProjectId) {
        this.supabase.from('projects').update({ sync_status: 'In Sync' }).eq('id', this.state.activeProjectId).then(() => {});
        this.supabase.from('notifications').insert({
          title: 'NLE Bridge: Ekspor Metadata',
          message: `Paket ${naming.videoName} disinkronkan oleh ${this.state.currentUser.name}.`,
          time_label: 'Baru saja',
          notif_type: 'sync',
          priority: 'routine',
          unread: true,
          dismissed: false,
          is_archived: false
        }).then(() => {});
      }

      setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.disabled = false;
      }, 1800);
    }, 650);
  },

  /* ============================================================
   * SCRIPT CONVERTER & IMPORTER (.DOCX, .TXT, .FOUNTAIN, .MD)
   * ============================================================ */

  normalizeScriptText(input) {
    return String(input || '')
      .replace(/[\u2014\u2013]/g, ' - ')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\u2026/g, '...')
      .replace(/\u00B1/g, '+-')
      .replace(/\u2022/g, ',')
      .replace(/\u2192/g, '->')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+-\s+/g, ' - ')
      .trim();
  },

  buildKeyword(dialogueText, character) {
    const clean = String(dialogueText || '').replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
    let words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      const charWords = String(character || '').replace(/[^a-zA-Z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
      words = charWords.length > 0 ? [...charWords, 'Cue'] : ['DialogCue'];
    }
    const camel = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    return (camel || 'DialogCue').slice(0, 24);
  },

  async extractDocxBlocksFromArrayBuffer(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Cari End of Central Directory (PK\x05\x06)
    let eocdPos = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
        eocdPos = i;
        break;
      }
    }
    if (eocdPos < 0) {
      throw new Error('Berkas bukan dokumen .docx (ZIP) yang valid.');
    }

    const totalEntries = view.getUint16(eocdPos + 10, true);
    let cdPos = view.getUint32(eocdPos + 16, true);
    const decoder = new TextDecoder('utf-8');
    let xmlBytes = null;

    for (let idx = 0; idx < totalEntries && cdPos + 46 <= bytes.length; idx++) {
      if (view.getUint32(cdPos, true) !== 0x02014b50) break;
      const method = view.getUint16(cdPos + 10, true);
      const compSize = view.getUint32(cdPos + 20, true);
      const nameLen = view.getUint16(cdPos + 28, true);
      const extraLen = view.getUint16(cdPos + 30, true);
      const commentLen = view.getUint16(cdPos + 32, true);
      const localOffset = view.getUint32(cdPos + 42, true);
      const entryName = decoder.decode(bytes.subarray(cdPos + 46, cdPos + 46 + nameLen));
      cdPos += 46 + nameLen + extraLen + commentLen;

      if (entryName === 'word/document.xml') {
        if (view.getUint32(localOffset, true) !== 0x04034b50) {
          throw new Error('Header entry word/document.xml rusak.');
        }
        const localNameLen = view.getUint16(localOffset + 26, true);
        const localExtraLen = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLen + localExtraLen;
        const compressedSlice = bytes.subarray(dataStart, dataStart + compSize);

        if (method === 0) {
          xmlBytes = compressedSlice;
        } else if (method === 8) {
          if (typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(compressedSlice);
            writer.close();
            const outBuf = await new Response(ds.readable).arrayBuffer();
            xmlBytes = new Uint8Array(outBuf);
          } else if (typeof require === 'function') {
            const zlib = require('zlib');
            xmlBytes = zlib.inflateRawSync(Buffer.from(compressedSlice));
          } else {
            throw new Error('Browser tidak mendukung ekstraksi .docx langsung.');
          }
        }
        break;
      }
    }

    if (!xmlBytes) {
      throw new Error('Tidak menemukan word/document.xml di dalam berkas .docx.');
    }

    const xmlString = decoder.decode(xmlBytes);
    return this.parseWordDocumentXml(xmlString);
  },

  parseWordDocumentXml(xmlString) {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
      const body = doc.getElementsByTagNameNS('*', 'body')[0];
      if (!body) return [];
      const blocks = [];
      Array.from(body.childNodes).forEach(node => {
        const local = node.localName || '';
        if (local === 'p') {
          let style = '';
          const pStyle = node.getElementsByTagNameNS('*', 'pStyle')[0];
          if (pStyle) {
            style = pStyle.getAttribute('w:val') || pStyle.getAttribute('val') || '';
          }
          const text = this.collectDomParagraphText(node);
          blocks.push({ text, style });
        } else if (local === 'tbl') {
          const rows = Array.from(node.getElementsByTagNameNS('*', 'tr'));
          rows.forEach(tr => {
            const cells = Array.from(tr.getElementsByTagNameNS('*', 'tc'))
              .map(tc => this.collectDomParagraphText(tc).trim())
              .filter(Boolean);
            if (cells.length === 2 && /^[A-Z0-9\s/._-]{2,28}$/.test(cells[0])) {
              blocks.push({ text: cells[0].toUpperCase(), style: 'Heading3' });
              blocks.push({ text: cells[1], style: '' });
            } else if (cells.length > 0) {
              blocks.push({ text: cells.join(' | '), style: '' });
            }
          });
        }
      });
      return blocks;
    }

    // Fallback regex parser ringan untuk lingkungan Node.js tanpa DOMParser
    const blocks = [];
    const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
    let match;
    while ((match = pRegex.exec(xmlString)) !== null) {
      const inner = match[1];
      const styleMatch = inner.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/);
      const style = styleMatch ? styleMatch[1] : '';
      const textParts = [];
      const tokenRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g;
      let tm;
      while ((tm = tokenRegex.exec(inner)) !== null) {
        if (tm[0].startsWith('<w:tab')) textParts.push(' ');
        else if (tm[0].startsWith('<w:br')) textParts.push('\n');
        else textParts.push(tm[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
      }
      blocks.push({ text: textParts.join('').trim(), style });
    }
    return blocks;
  },

  collectDomParagraphText(node) {
    const parts = [];
    const walk = (n) => {
      const ln = n.localName || '';
      if (ln === 't') parts.push(n.textContent || '');
      else if (ln === 'tab') parts.push(' ');
      else if (ln === 'br') parts.push('\n');
      else if (n.childNodes) {
        for (let i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]);
      }
    };
    walk(node);
    return parts.join('').trim();
  },

  parseBlocksToProject(blocks, overrides = {}) {
    let detectedTitle = '';
    let detectedCategory = '';
    let detectedLocation = '';
    let detectedDuration = '';
    let detectedSynopsis = '';

    let currentSceneNum = '01';
    let currentSceneTitle = 'SCENE 01';
    let currentSceneDuration = '';
    let shotCounterInScene = 1;
    let hasStartedScenes = false;

    const lines = [];
    let pendingCharacter = null;
    let lastLineIndex = -1;

    const isSceneHeading = (text, style) => {
      if (/^(?:SCENE|ADEGAN|BABAK)\s+\d+/i.test(text)) return true;
      if (/^(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+/i.test(text)) return true;
      if (style === 'heading2' && (/scene|int\.|ext\./i.test(text))) return true;
      if (text.startsWith('.') && text.length > 2 && !text.startsWith('..')) return true;
      return false;
    };

    const isParenthetical = (text) => text.startsWith('(') && text.endsWith(')');

    const isCharacterCue = (text, style, nextText, nextStyle) => {
      if (style === 'heading3') return text.trim() !== '';
      if (!nextText || nextStyle === 'heading2' || nextStyle === 'heading3') return false;
      if (text.startsWith('[') || text.startsWith('(') || text.length > 32) return false;
      if (/[.!?]$/.test(text)) return false;
      const upper = text.toUpperCase();
      if (['TITLE CARD', 'CUT TO BLACK', 'FADE IN', 'FADE OUT', 'END', 'TAMAT', 'SEMUA DIAM'].includes(upper)) return false;
      return text === upper && /^[A-Z][A-Z0-9\s/()._-]*$/.test(text);
    };

    const stripQuotes = (t) => {
      const s = String(t || '').trim();
      if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
        return s.slice(1, -1).trim();
      }
      return s;
    };

    const estimateTc = (durStr, shotIdx) => {
      let baseSec = 0;
      const m = String(durStr || '').match(/(\d{1,2}):(\d{2})/);
      if (m) baseSec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      const sec = baseSec + Math.max(0, (shotIdx - 1) * 2);
      const hrs = String(Math.floor(sec / 3600)).padStart(2, '0');
      const mins = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
      const secs = String(sec % 60).padStart(2, '0');
      return `${hrs}:${mins}:${secs}`;
    };

    for (let i = 0; i < blocks.length; i++) {
      const rawText = String(blocks[i].text || '');
      const style = String(blocks[i].style || '').toLowerCase();
      const text = this.normalizeScriptText(rawText);

      if (!text) {
        pendingCharacter = null;
        continue;
      }

      if (hasStartedScenes && (style === 'heading1' || text.toUpperCase() === 'TITLE CARD')) {
        lines.push({
          type: 'action',
          sceneNumber: currentSceneNum,
          sceneTitle: currentSceneTitle,
          content: text.toUpperCase() === 'TITLE CARD' ? 'TITLE CARD' : `TITLE CARD: ${text}`
        });
        continue;
      }

      if (!hasStartedScenes && !detectedTitle && (style === 'heading1' || style === 'title' || i === 0)) {
        if (!isSceneHeading(text, style)) {
          detectedTitle = text.replace(/^[#*\s]+|[#*\s]+$/g, '');
          continue;
        }
      }

      if (!hasStartedScenes && !isSceneHeading(text, style)) {
        text.split(/\r?\n/).forEach(metaLine => {
          const ml = metaLine.trim();
          if (!ml) return;
          if (/genre:|lokasi:|durasi:/i.test(ml)) {
            ml.split('|').forEach(part => {
              const p = part.trim();
              if (/^genre:/i.test(p)) detectedCategory = p.slice(6).trim();
              else if (/^lokasi:/i.test(p)) detectedLocation = p.slice(7).trim();
              else if (/^durasi:/i.test(p)) detectedDuration = p.slice(7).trim();
            });
          } else if (/^(?:konsep|sinopsis|logline):/i.test(ml)) {
            detectedSynopsis = ml.split(':').slice(1).join(':').trim();
          } else if (!detectedSynopsis) {
            detectedSynopsis = ml;
          }
        });
        continue;
      }

      if (isSceneHeading(text, style)) {
        hasStartedScenes = true;
        pendingCharacter = null;
        shotCounterInScene = 1;
        currentSceneDuration = '';

        const sm = text.match(/^(?:SCENE|ADEGAN|BABAK)\s*0*(\d+)\s*(?:[-:.]\s*(.*))?$/i);
        if (sm) {
          currentSceneNum = String(Math.max(1, parseInt(sm[1], 10))).padStart(2, '0');
          const rest = sm[2] ? sm[2].trim().toUpperCase() : '';
          currentSceneTitle = `SCENE ${currentSceneNum}${rest ? ' - ' + rest : ''}`;
        } else {
          const nextNum = lines.length > 0 ? (parseInt(currentSceneNum, 10) + 1) : 1;
          currentSceneNum = String(nextNum).padStart(2, '0');
          currentSceneTitle = `SCENE ${currentSceneNum} - ${text.replace(/^[.#\s]+/, '').toUpperCase()}`;
        }
        continue;
      }

      hasStartedScenes = true;

      const durMatch = text.match(/^Durasi\s*:\s*(.+)$/i);
      if (durMatch) {
        currentSceneDuration = durMatch[1].trim();
        if (!currentSceneTitle.includes('(') && currentSceneDuration) {
          currentSceneTitle += ` (${currentSceneDuration})`;
          lines.forEach(ln => {
            if (ln.sceneNumber === currentSceneNum) ln.sceneTitle = currentSceneTitle;
          });
        }
        lines.push({
          type: 'action',
          sceneNumber: currentSceneNum,
          sceneTitle: currentSceneTitle,
          content: `Durasi: ${currentSceneDuration}`
        });
        lastLineIndex = lines.length - 1;
        continue;
      }

      // Format inline "KARAKTER: Dialog"
      const inlineMatch = !pendingCharacter && !text.startsWith('[') && !text.startsWith('(')
        ? text.match(/^([A-Z][A-Z0-9\s/._-]{1,26})\s*:\s*(.+)$/)
        : null;
      const nonCharLabels = ['SHOT', 'CUT', 'BEAT', 'DURASI', 'GENRE', 'KONSEP', 'LOKASI', 'SINOPSIS', 'LOGLINE', 'SCENE', 'ADEGAN', 'CATATAN', 'NOTE', 'TITLE CARD'];
      if (inlineMatch && !nonCharLabels.includes(inlineMatch[1].trim().toUpperCase())) {
        const charName = inlineMatch[1].trim().toUpperCase();
        const dlgTxt = stripQuotes(inlineMatch[2].trim());
        const shotStr = String(shotCounterInScene++).padStart(2, '0');
        lines.push({
          type: 'dialogue',
          sceneNumber: currentSceneNum,
          sceneTitle: currentSceneTitle,
          character: charName,
          text: dlgTxt,
          parenthetical: '',
          shot: shotStr,
          timecode: estimateTc(currentSceneDuration, shotCounterInScene - 1),
          keyword: this.buildKeyword(dlgTxt, charName)
        });
        lastLineIndex = lines.length - 1;
        continue;
      }

      const nextText = (i + 1 < blocks.length) ? this.normalizeScriptText(blocks[i + 1].text || '') : '';
      const nextStyle = (i + 1 < blocks.length) ? String(blocks[i + 1].style || '').toLowerCase() : '';

      if (!pendingCharacter && isCharacterCue(text, style, nextText, nextStyle)) {
        pendingCharacter = text.replace(/[:\s]+$/g, '').toUpperCase();
        continue;
      }

      if (pendingCharacter) {
        let parenthetical = '';
        let dialogueText = text;
        if (isParenthetical(text) && nextText && !isSceneHeading(nextText, nextStyle) && nextStyle !== 'heading3') {
          parenthetical = text.slice(1, -1).trim();
          dialogueText = nextText;
          i++;
        }
        const cleanDlg = stripQuotes(dialogueText);
        const shotStr = String(shotCounterInScene++).padStart(2, '0');
        lines.push({
          type: 'dialogue',
          sceneNumber: currentSceneNum,
          sceneTitle: currentSceneTitle,
          character: pendingCharacter,
          text: cleanDlg,
          parenthetical,
          shot: shotStr,
          timecode: estimateTc(currentSceneDuration, shotCounterInScene - 1),
          keyword: this.buildKeyword(cleanDlg, pendingCharacter)
        });
        lastLineIndex = lines.length - 1;
        pendingCharacter = null;
        continue;
      }

      if (isParenthetical(text) && lastLineIndex >= 0 && lines[lastLineIndex].type === 'dialogue') {
        const cleanParen = text.slice(1, -1).trim();
        lines[lastLineIndex].parenthetical = lines[lastLineIndex].parenthetical
          ? `${lines[lastLineIndex].parenthetical} | ${cleanParen}`
          : cleanParen;
        continue;
      }

      lines.push({
        type: 'action',
        sceneNumber: currentSceneNum,
        sceneTitle: currentSceneTitle,
        content: text
      });
      lastLineIndex = lines.length - 1;
    }

    const title = String(overrides.title || detectedTitle || 'Naskah Baru').trim();
    const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'naskah';
    const projectId = String(overrides.id || '').trim() || `proj-${slugBase.slice(0, 20)}-${String(Date.now()).slice(-4)}`;
    const codePrefix = title.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 4) || 'SCRP';
    const code = String(overrides.code || '').trim().toUpperCase() || `${codePrefix}-01`;
    const category = String(overrides.category || detectedCategory || 'Film Pendek').trim();
    const location = String(overrides.location || detectedLocation || '').trim();
    const durationTarget = String(overrides.durationTarget || detectedDuration || '').trim();
    const synopsis = String(overrides.synopsis || detectedSynopsis || '').trim();
    const fps = String(overrides.fps || '24 fps').trim();
    const sourceFilename = String(overrides.sourceFilename || '').trim();
    const draft = String(overrides.draft || (sourceFilename ? `Draft (${sourceFilename})` : 'Draft v1.0')).trim();

    const scenesMap = {};
    lines.forEach(ln => {
      if (!scenesMap[ln.sceneNumber]) scenesMap[ln.sceneNumber] = ln.sceneTitle;
    });
    if (Object.keys(scenesMap).length === 0) scenesMap['01'] = 'SCENE 01';

    const firstSceneNum = Object.keys(scenesMap)[0];
    const sceneCount = Object.keys(scenesMap).length;
    const subtitleParts = [category, location, durationTarget].filter(Boolean);

    let actionIdx = 1;
    let dlgIdx = 1;
    let sortOrder = 10;
    const charactersSet = new Set();

    const dbLines = lines.map(ln => {
      const row = ln.type === 'action'
        ? {
            id: `${slugBase}-s${ln.sceneNumber}-a${String(actionIdx++).padStart(2, '0')}`,
            project_id: projectId,
            line_type: 'action',
            sort_order: sortOrder,
            scene_number: ln.sceneNumber,
            scene_title: ln.sceneTitle,
            content: ln.content,
            character_name: null,
            timecode: null,
            dialogue_text: null,
            parenthetical: '',
            keyword: null,
            shot: null,
            status: null,
            status_label: null,
            continuity_note: '',
            is_archived: false
          }
        : (() => {
            charactersSet.add(ln.character);
            return {
              id: `${slugBase}-s${ln.sceneNumber}-d${String(dlgIdx++).padStart(2, '0')}`,
              project_id: projectId,
              line_type: 'dialogue',
              sort_order: sortOrder,
              scene_number: ln.sceneNumber,
              scene_title: ln.sceneTitle,
              content: null,
              character_name: ln.character,
              timecode: ln.timecode,
              dialogue_text: ln.text,
              parenthetical: ln.parenthetical || '',
              keyword: ln.keyword,
              shot: ln.shot,
              status: 'pending',
              status_label: 'Pending Shoot',
              continuity_note: '',
              is_archived: false
            };
          })();
      sortOrder += 10;
      return row;
    });

    const projectRow = {
      id: projectId,
      code,
      title,
      category,
      subtitle: subtitleParts.length > 0 ? subtitleParts.join(' | ') : title,
      synopsis,
      location,
      duration_target: durationTarget,
      source_filename: sourceFilename,
      tag: `${sceneCount} Scene`,
      day: 'Day 01',
      takes_logged: 0,
      fps,
      good_take_percentage: 0,
      review_percentage: 0,
      sync_status: 'Ready',
      draft,
      scene_number: firstSceneNum,
      shot_number: '01',
      slug_number: `SCENE ${firstSceneNum}`,
      scene_title: scenesMap[firstSceneNum],
      scene_timecode: '00:00:00:00',
      take_info: '0 TAKE',
      sort_order: this.db.projects.length + 1,
      is_archived: false
    };

    return {
      project: projectRow,
      lines: dbLines,
      summary: {
        sceneCount,
        scenes: scenesMap,
        lineCount: dbLines.length,
        dialogueCount: dlgIdx - 1,
        actionCount: actionIdx - 1,
        characters: Array.from(charactersSet)
      }
    };
  },

  parseScriptText(rawText, overrides = {}) {
    const blocks = String(rawText || '').split(/\r?\n/).map(line => {
      const trimmed = line.trim();
      if (/^#\s+(.+)$/.test(trimmed)) return { text: trimmed.replace(/^#\s+/, ''), style: 'Heading1' };
      if (/^##\s+(.+)$/.test(trimmed)) return { text: trimmed.replace(/^##\s+/, ''), style: 'Heading2' };
      if (/^###\s+(.+)$/.test(trimmed)) return { text: trimmed.replace(/^###\s+/, ''), style: 'Heading3' };
      return { text: trimmed, style: '' };
    });
    return this.parseBlocksToProject(blocks, overrides);
  },

  openScriptImportModal(targetProjectId = '') {
    this.triggerHaptic();
    this.state.importModal.targetProjectId = targetProjectId || '';
    this.state.importModal.selectedFile = null;
    this.state.importModal.lastParsed = null;

    const existingProj = targetProjectId ? this.db.projects.find(p => p.id === targetProjectId) : null;
    const titleInput = document.getElementById('import-proj-title');
    const codeInput = document.getElementById('import-proj-code');
    const catInput = document.getElementById('import-proj-category');
    const locInput = document.getElementById('import-proj-location');
    const fileLabel = document.getElementById('import-file-picked-name');
    const previewBox = document.getElementById('import-preview-box');
    const fbEl = document.getElementById('import-script-feedback');

    if (titleInput) titleInput.value = existingProj ? existingProj.title : '';
    if (codeInput) codeInput.value = existingProj ? existingProj.code : '';
    if (catInput) catInput.value = existingProj ? existingProj.category : '';
    if (locInput) locInput.value = existingProj ? (existingProj.location || '') : '';
    if (fileLabel) fileLabel.textContent = 'Klik untuk memilih berkas naskah (.docx, .txt, .fountain, .md)';
    if (previewBox) previewBox.classList.add('hidden');
    if (fbEl) fbEl.classList.add('hidden');

    this.switchImportSourceTab('file');

    const sheet = document.getElementById('sheet-import-script');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet && overlay) {
      overlay.classList.add('active');
      sheet.classList.add('open');
      sheet.style.transform = '';
    }
  },

  closeScriptImportModal() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-import-script');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet) {
      sheet.classList.remove('open');
      sheet.style.transform = '';
    }
    if (overlay) overlay.classList.remove('active');
  },

  switchImportSourceTab(tab = 'file') {
    this.state.importModal.sourceTab = tab;
    const fileBtn = document.getElementById('import-tab-file');
    const textBtn = document.getElementById('import-tab-text');
    const filePanel = document.getElementById('import-source-file');
    const textPanel = document.getElementById('import-source-text');

    if (tab === 'text') {
      if (textBtn) { textBtn.classList.add('sp-btn-primary'); textBtn.classList.remove('sp-btn-secondary'); textBtn.setAttribute('aria-selected', 'true'); }
      if (fileBtn) { fileBtn.classList.remove('sp-btn-primary'); fileBtn.classList.add('sp-btn-secondary'); fileBtn.setAttribute('aria-selected', 'false'); }
      if (textPanel) textPanel.classList.remove('hidden');
      if (filePanel) filePanel.classList.add('hidden');
    } else {
      if (fileBtn) { fileBtn.classList.add('sp-btn-primary'); fileBtn.classList.remove('sp-btn-secondary'); fileBtn.setAttribute('aria-selected', 'true'); }
      if (textBtn) { textBtn.classList.remove('sp-btn-primary'); textBtn.classList.add('sp-btn-secondary'); textBtn.setAttribute('aria-selected', 'false'); }
      if (filePanel) filePanel.classList.remove('hidden');
      if (textPanel) textPanel.classList.add('hidden');
    }
  },

  async handleScriptFileChosen(inputEl) {
    if (!inputEl || !inputEl.files || inputEl.files.length === 0) return;
    const file = inputEl.files[0];
    this.state.importModal.selectedFile = file;
    const fileLabel = document.getElementById('import-file-picked-name');
    if (fileLabel) fileLabel.textContent = `Berkas dipilih: ${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
    await this.runScriptPreview();
  },

  previewRawScriptDebounced() {
    clearTimeout(this._previewDebounceTimer);
    this._previewDebounceTimer = setTimeout(() => {
      this.runScriptPreview();
    }, 320);
  },

  collectImportOverrides() {
    const titleEl = document.getElementById('import-proj-title');
    const codeEl = document.getElementById('import-proj-code');
    const catEl = document.getElementById('import-proj-category');
    const locEl = document.getElementById('import-proj-location');
    const fpsEl = document.getElementById('import-proj-fps');

    return {
      id: this.state.importModal.targetProjectId || '',
      title: titleEl ? titleEl.value.trim() : '',
      code: codeEl ? codeEl.value.trim() : '',
      category: catEl ? catEl.value.trim() : '',
      location: locEl ? locEl.value.trim() : '',
      fps: fpsEl ? fpsEl.value : '24 fps',
      sourceFilename: this.state.importModal.selectedFile ? this.state.importModal.selectedFile.name : ''
    };
  },

  async buildParsedScriptFromModal() {
    const overrides = this.collectImportOverrides();
    if (this.state.importModal.sourceTab === 'file') {
      const file = this.state.importModal.selectedFile;
      if (!file) {
        throw new Error('Pilih berkas naskah (.docx, .txt, .fountain, .md) terlebih dahulu.');
      }
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (ext === 'docx') {
        const buf = await file.arrayBuffer();
        const blocks = await this.extractDocxBlocksFromArrayBuffer(buf);
        return this.parseBlocksToProject(blocks, overrides);
      }
      const rawText = await file.text();
      return this.parseScriptText(rawText, overrides);
    }

    const rawEl = document.getElementById('import-raw-textarea');
    const raw = rawEl ? rawEl.value.trim() : '';
    if (!raw) {
      throw new Error('Masukkan atau tempel teks naskah terlebih dahulu.');
    }
    return this.parseScriptText(raw, overrides);
  },

  async runScriptPreview() {
    const fbEl = document.getElementById('import-script-feedback');
    const previewBox = document.getElementById('import-preview-box');
    const countsEl = document.getElementById('import-preview-counts');
    const charsEl = document.getElementById('import-preview-chars');
    const linesEl = document.getElementById('import-preview-lines');

    try {
      const parsed = await this.buildParsedScriptFromModal();
      if (!parsed.lines || parsed.lines.length === 0) {
        throw new Error('Tidak ada adegan atau dialog yang terdeteksi dari dokumen tersebut.');
      }
      this.state.importModal.lastParsed = parsed;

      // Isi otomatis kolom metadata yang masih kosong dari hasil deteksi dokumen
      const titleEl = document.getElementById('import-proj-title');
      const codeEl = document.getElementById('import-proj-code');
      const catEl = document.getElementById('import-proj-category');
      const locEl = document.getElementById('import-proj-location');
      if (titleEl && !titleEl.value.trim()) titleEl.value = parsed.project.title;
      if (codeEl && !codeEl.value.trim()) codeEl.value = parsed.project.code;
      if (catEl && !catEl.value.trim()) catEl.value = parsed.project.category;
      if (locEl && !locEl.value.trim() && parsed.project.location) locEl.value = parsed.project.location;

      if (fbEl) fbEl.classList.add('hidden');
      if (previewBox) previewBox.classList.remove('hidden');
      if (countsEl) {
        countsEl.textContent = `${parsed.summary.sceneCount} Scene | ${parsed.summary.dialogueCount} Dialog | ${parsed.summary.actionCount} Aksi`;
      }
      if (charsEl) {
        charsEl.textContent = parsed.summary.characters.length > 0
          ? `Pemeran terdeteksi (${parsed.summary.characters.length}): ${parsed.summary.characters.join(', ')}`
          : 'Tidak ada pemeran dialog terdeteksi (hanya deskripsi aksi).';
      }
      if (linesEl) {
        linesEl.innerHTML = parsed.lines.slice(0, 8).map(ln => {
          if (ln.line_type === 'action') {
            return `<div class="font-mono text-[11px]" style="color: var(--text-secondary);">[SC ${this.escapeHtml(ln.scene_number)} · AKSI] ${this.escapeHtml(ln.content)}</div>`;
          }
          return `<div class="font-mono text-[11px]" style="color: var(--text-primary);"><strong>[SC ${this.escapeHtml(ln.scene_number)} · ${this.escapeHtml(ln.character_name)}]</strong> "${this.escapeHtml(ln.dialogue_text)}"</div>`;
        }).join('');
      }
    } catch (err) {
      if (previewBox) previewBox.classList.add('hidden');
      if (fbEl) {
        fbEl.textContent = err.message;
        fbEl.style.color = 'var(--red-text)';
        fbEl.classList.remove('hidden');
      }
    }
  },

  async submitScriptImport() {
    this.triggerHaptic();
    const btn = document.getElementById('btn-submit-import-script');
    const fbEl = document.getElementById('import-script-feedback');
    if (btn) btn.disabled = true;

    try {
      const parsed = await this.buildParsedScriptFromModal();
      if (!parsed.lines || parsed.lines.length === 0) {
        throw new Error('Tidak ada baris naskah yang dapat disimpan.');
      }

      const projectRow = parsed.project;
      const dbLines = parsed.lines;

      if (this.supabase) {
        const pRes = await this.supabase.from('projects').upsert(projectRow, { onConflict: 'id' });
        if (pRes.error) throw new Error(pRes.error.message);

        await this.supabase.from('script_lines').update({ is_archived: true }).eq('project_id', projectRow.id);
        const lRes = await this.supabase.from('script_lines').upsert(dbLines, { onConflict: 'id' });
        if (lRes.error) throw new Error(lRes.error.message);

        await this.supabase.from('notifications').insert({
          title: 'Naskah Baru Diimpor',
          message: `Naskah "${projectRow.title}" (${parsed.summary.sceneCount} Scene, ${parsed.summary.dialogueCount} Dialog) berhasil dikonversi ke database.`,
          time_label: 'Baru saja',
          notif_type: 'script',
          priority: 'important',
          unread: true,
          dismissed: false,
          is_archived: false
        }).catch(() => {});

        await this.syncFromSupabase();
      } else if (this.phpBoot && this.phpBoot.phpEnabled && typeof fetch === 'function') {
        const res = await fetch('api/script-import.php?action=import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed)
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal menyimpan naskah melalui server PHP');
        await this.fetchBootstrapViaPhp();
      } else {
        // Fallback memori lokal bila dijalankan offline penuh
        const nextProjects = [...this.db.projects.filter(p => p.id !== projectRow.id)];
        this.applyBootstrapPayload(
          [...nextProjects.map(p => ({ ...p, sync_status: p.syncStatus })), projectRow],
          dbLines,
          [],
          [],
          []
        );
      }

      this.closeScriptImportModal();
      this.openProject(projectRow.id);
      this.showToast(`Naskah "${projectRow.title}" berhasil dikonversi & dibuka`);
    } catch (err) {
      if (fbEl) {
        fbEl.textContent = err.message;
        fbEl.style.color = 'var(--red-text)';
        fbEl.classList.remove('hidden');
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  /* ============================================================
   * MANUAL ADD SCRIPT LINE MODAL
   * ============================================================ */

  openAddLineModal() {
    this.triggerHaptic();
    if (!this.db.scriptData) {
      this.openScriptImportModal();
      return;
    }
    const scNumEl = document.getElementById('addline-scene-num');
    const scTitleEl = document.getElementById('addline-scene-title');
    const charEl = document.getElementById('addline-character');
    const dlgEl = document.getElementById('addline-dialogue-text');
    const parenEl = document.getElementById('addline-parenthetical');
    const actEl = document.getElementById('addline-action-content');
    const fbEl = document.getElementById('addline-feedback');

    const activeDlg = this.getActiveDialogueObject();
    const curSceneNum = this.state.activeSceneFilter !== 'all'
      ? this.state.activeSceneFilter
      : (activeDlg ? activeDlg.sceneNumber : '01');
    const curSceneObj = (this.db.scriptData.scenes || []).find(s => s.number === curSceneNum);

    if (scNumEl) scNumEl.value = curSceneNum;
    if (scTitleEl) scTitleEl.value = curSceneObj ? curSceneObj.title : `SCENE ${curSceneNum}`;
    if (charEl) charEl.value = '';
    if (dlgEl) dlgEl.value = '';
    if (parenEl) parenEl.value = '';
    if (actEl) actEl.value = '';
    if (fbEl) fbEl.classList.add('hidden');

    this.toggleAddLineTypeFields('dialogue');
    const typeEl = document.getElementById('addline-type');
    if (typeEl) typeEl.value = 'dialogue';

    const sheet = document.getElementById('sheet-add-line');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet && overlay) {
      overlay.classList.add('active');
      sheet.classList.add('open');
      sheet.style.transform = '';
    }
  },

  closeAddLineModal() {
    this.triggerHaptic();
    const sheet = document.getElementById('sheet-add-line');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet) {
      sheet.classList.remove('open');
      sheet.style.transform = '';
    }
    if (overlay) overlay.classList.remove('active');
  },

  toggleAddLineTypeFields(lineType) {
    const dlgFields = document.getElementById('addline-dialogue-fields');
    const actFields = document.getElementById('addline-action-fields');
    if (lineType === 'action') {
      if (dlgFields) dlgFields.classList.add('hidden');
      if (actFields) actFields.classList.remove('hidden');
    } else {
      if (dlgFields) dlgFields.classList.remove('hidden');
      if (actFields) actFields.classList.add('hidden');
    }
  },

  async submitAddLine() {
    this.triggerHaptic();
    if (!this.db.scriptData || !this.state.activeProjectId) return;

    const typeEl = document.getElementById('addline-type');
    const scNumEl = document.getElementById('addline-scene-num');
    const scTitleEl = document.getElementById('addline-scene-title');
    const charEl = document.getElementById('addline-character');
    const shotEl = document.getElementById('addline-shot');
    const dlgEl = document.getElementById('addline-dialogue-text');
    const parenEl = document.getElementById('addline-parenthetical');
    const actEl = document.getElementById('addline-action-content');
    const fbEl = document.getElementById('addline-feedback');

    const lineType = typeEl ? typeEl.value : 'dialogue';
    const sceneNumber = String((scNumEl && scNumEl.value.trim()) || '01').padStart(2, '0');
    const sceneTitle = this.normalizeScriptText((scTitleEl && scTitleEl.value.trim()) || `SCENE ${sceneNumber}`);
    const lineId = `${this.state.activeProjectId}-s${sceneNumber}-${lineType === 'action' ? 'a' : 'd'}-${Date.now().toString().slice(-5)}`;
    const nextSort = (this.db.scriptData.lines.length + 1) * 10 + 500;

    let dbRow;
    let localLine;

    if (lineType === 'action') {
      const content = this.normalizeScriptText(actEl ? actEl.value : '');
      if (!content) {
        if (fbEl) { fbEl.textContent = 'Deskripsi aksi wajib diisi.'; fbEl.style.color = 'var(--red-text)'; fbEl.classList.remove('hidden'); }
        return;
      }
      dbRow = {
        id: lineId,
        project_id: this.state.activeProjectId,
        line_type: 'action',
        sort_order: nextSort,
        scene_number: sceneNumber,
        scene_title: sceneTitle,
        content,
        parenthetical: '',
        continuity_note: '',
        is_archived: false
      };
      localLine = { id: lineId, type: 'action', sceneNumber, sceneTitle, content };
    } else {
      const character = this.normalizeScriptText(charEl ? charEl.value : '').toUpperCase();
      const text = this.normalizeScriptText(dlgEl ? dlgEl.value : '');
      const parenthetical = this.normalizeScriptText(parenEl ? parenEl.value : '');
      const shot = String((shotEl && shotEl.value.trim()) || '01').padStart(2, '0');
      if (!character || !text) {
        if (fbEl) { fbEl.textContent = 'Nama pemeran dan teks dialog wajib diisi.'; fbEl.style.color = 'var(--red-text)'; fbEl.classList.remove('hidden'); }
        return;
      }
      const keyword = this.buildKeyword(text, character);
      dbRow = {
        id: lineId,
        project_id: this.state.activeProjectId,
        line_type: 'dialogue',
        sort_order: nextSort,
        scene_number: sceneNumber,
        scene_title: sceneTitle,
        character_name: character,
        timecode: '00:00:00',
        dialogue_text: text,
        parenthetical,
        keyword,
        shot,
        status: 'pending',
        status_label: 'Pending Shoot',
        continuity_note: '',
        is_archived: false
      };
      localLine = {
        id: lineId,
        type: 'dialogue',
        sceneNumber,
        sceneTitle,
        character,
        timecode: '00:00:00',
        text,
        parenthetical,
        keyword,
        shot,
        status: 'pending',
        statusLabel: 'Pending Shoot',
        takes: []
      };
    }

    this.db.scriptData.lines.push(localLine);
    if (!this.db.scriptData.scenes.some(s => s.number === sceneNumber)) {
      this.db.scriptData.scenes.push({ number: sceneNumber, title: sceneTitle });
    }
    if (localLine.type === 'dialogue') {
      this.state.activeDialogueId = localLine.id;
    }

    if (this.supabase) {
      await this.supabase.from('script_lines').insert(dbRow).catch(() => {});
    }

    this.closeAddLineModal();
    this.renderScriptContent();
    this.renderPanelContent();
    this.updateProgressGauge();
    this.updateDashboardData();
    this.showToast('Baris baru ditambahkan ke naskah');
  },

  /* ============================================================
   * PROFILE ROLES, SEARCH FILTERS & NOTIFICATIONS
   * ============================================================ */

  renderProfileRoles() {
    Object.keys(this.state.roles).forEach(key => {
      const row = document.querySelector(`[data-role-key="${key}"]`);
      if (row) {
        const toggleBtn = row.querySelector('.toggle-box');
        const isChecked = !!this.state.roles[key];
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

    let totalTakes = 0;
    let circledTakes = 0;
    Object.values(this.db.scriptDataProjects).forEach(proj => {
      (proj.lines || []).forEach(line => {
        if (line.type === 'dialogue' && Array.isArray(line.takes)) {
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
      if (btnElement) btnElement.className = 'toggle-box w-6 h-6 rounded bg-[#2563EB] flex items-center justify-center shrink-0 text-white transition-colors';
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

  toggleProjectSearch() {
    this.triggerHaptic();
    const input = document.getElementById('project-search-input');
    if (input && typeof input.focus === 'function') {
      if (input.value) this.clearProjectSearch();
      else input.focus();
    }
  },

  filterProjects(query) {
    this.state.projectSearchQuery = (query || '').toLowerCase().trim();
    this.renderProjectsScreen();
  },

  filterProjectsByCategory(category) {
    this.triggerHaptic();
    this.state.activeProjectCategory = category || 'all';
    this.renderProjectsScreen();
  },

  syncProjectFilterState() {
    this.renderProjectsScreen();
  },

  clearProjectSearch() {
    const input = document.getElementById('project-search-input');
    if (input) input.value = '';
    this.filterProjects('');
  },

  resetProjectFilters() {
    this.state.activeProjectCategory = 'all';
    this.state.projectSearchQuery = '';
    const input = document.getElementById('project-search-input');
    if (input) input.value = '';
    this.renderProjectsScreen();
  },

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
      if (hasUnread) dot.classList.remove('hidden');
      else dot.classList.add('hidden');
    });
  },

  renderNotificationsList() {
    const list = document.getElementById('notifications-list');
    if (!list) {
      this.updateNotificationIndicators();
      return;
    }

    const visible = this.state.notifications.filter(n => !n.dismissed);
    if (visible.length === 0) {
      list.innerHTML = `
        <div class="p-4 rounded border text-center" style="background-color: var(--panel-lowest); border-color: var(--border-flat);">
          <p class="font-sans text-xs font-semibold mb-1 mt-0" style="color: var(--text-primary);">Belum ada notifikasi aktivitas</p>
          <p class="font-sans text-[11px] m-0" style="color: var(--text-secondary);">Aktivitas impor naskah dan sinkronisasi NLE akan tercatat otomatis di sini.</p>
        </div>
      `;
      this.updateNotificationIndicators();
      return;
    }

    const sorted = [...visible].sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      return a.priority === 'important' ? -1 : 1;
    });

    list.innerHTML = sorted.map(n => {
      const priorityBadge = n.priority === 'important'
        ? `<span class="sp-badge sp-badge-amber">Penting</span>`
        : `<span class="sp-badge sp-badge-neutral">Aktivitas</span>`;
      const stateBadge = n.unread
        ? `<span class="sp-badge sp-badge-blue">Baru</span>`
        : `<span class="font-mono text-[10px]" style="color: var(--text-muted);">Dibaca</span>`;

      return `
        <div class="p-3 rounded border flex flex-col gap-2 ${n.unread ? 'border-l-4' : 'opacity-85'}" style="background-color: var(--panel-lowest); border-color: var(--border-flat); ${n.unread ? 'border-left-color: var(--primary-accent);' : ''}">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              ${priorityBadge}
              ${stateBadge}
            </div>
            <span class="font-mono text-[11px] shrink-0" style="color: var(--text-muted);">${this.escapeHtml(n.time)}</span>
          </div>
          <div>
            <p class="font-sans text-xs font-bold m-0" style="color: var(--text-primary);">${this.escapeHtml(n.title)}</p>
            <p class="font-sans text-xs mt-0.5 mb-0 leading-snug" style="color: var(--text-secondary);">${this.escapeHtml(n.message)}</p>
          </div>
          <div class="flex items-center gap-2 pt-1">
            ${n.unread ? `<button type="button" class="font-sans text-[11px] font-semibold hover:underline bg-transparent border-0 p-0" style="color: var(--primary-text);" onclick="StoryPad.markNotificationRead(${n.id})">Tandai Dibaca</button>` : ''}
            <button type="button" class="font-sans text-[11px] font-semibold hover:underline bg-transparent border-0 p-0" style="color: var(--text-secondary);" onclick="StoryPad.dismissNotification(${n.id})">Singkirkan</button>
          </div>
        </div>
      `;
    }).join('');
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
    this.showToast('Notifikasi aktif dipulihkan');
    if (this.supabase) {
      this.supabase.from('notifications').update({ dismissed: false }).eq('is_archived', false).then(() => {});
    }
  },

  markAllNotificationsRead() {
    this.triggerHaptic();
    this.state.notifications.forEach(n => { n.unread = false; });
    this.renderNotificationsList();
    this.showToast('Semua notifikasi ditandai dibaca');
    if (this.supabase) {
      this.supabase.from('notifications').update({ unread: false }).eq('is_archived', false).then(() => {});
    }
  },

  /* ============================================================
   * CREW AUTHENTICATION & DYNAMIC CREW LISTS (ZERO DUMMY CREW)
   * ============================================================ */

  openLoginAccounts() {
    this.triggerHaptic();
    this.renderCrewAccountsList();
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
    ['sheet-view-settings', 'sheet-audio-panel', 'sheet-notifications', 'sheet-login-accounts', 'sheet-import-script', 'sheet-add-line'].forEach(id => {
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

  renderLoginCrewList() {
    const container = document.getElementById('login-crew-quicklist');
    if (!container) return;

    if (this.db.crewProfiles.length === 0) {
      container.innerHTML = `
        <div class="sp-panel-muted p-3.5 flex flex-col gap-1">
          <span class="font-sans text-xs font-bold" style="color: var(--text-primary);">Belum ada profil kru tersimpan</span>
          <span class="font-sans text-[11px] leading-relaxed" style="color: var(--text-secondary);">
            Daftarkan akun kru baru melalui tombol di bawah atau tambahkan daftar kru tim ${this.escapeHtml(this.state.studioName)} melalui Panel Admin.
          </span>
        </div>
      `;
      return;
    }

    container.innerHTML = this.db.crewProfiles.map(c => `
      <button type="button" class="sp-crew-btn w-full p-3 rounded border text-left flex items-center justify-between gap-3" onclick="StoryPad.loginAs('${this.escapeHtml(c.personaKey)}')">
        <span class="flex items-center gap-3 min-w-0">
          <span class="w-9 h-9 rounded bg-[#2563EB] text-white font-sans text-xs font-bold flex items-center justify-center shrink-0">${this.escapeHtml(c.initials)}</span>
          <span class="flex flex-col min-w-0">
            <span class="font-sans text-xs font-bold truncate" style="color: var(--text-primary);">${this.escapeHtml(c.fullName)}</span>
            <span class="font-sans text-[11px] truncate" style="color: var(--text-secondary);">${this.escapeHtml(c.roleTitle)}</span>
          </span>
        </span>
        <span class="sp-badge sp-badge-blue shrink-0">Masuk</span>
      </button>
    `).join('');
  },

  renderCrewAccountsList() {
    const listEl = document.getElementById('crew-accounts-list');
    if (!listEl) return;

    if (this.db.crewProfiles.length === 0) {
      listEl.innerHTML = `
        <div class="sp-panel-muted p-3 text-xs" style="color: var(--text-secondary);">
          Belum ada profil kru terdaftar di database. Isi formulir di bawah untuk mendaftarkan akun kru pertama Anda.
        </div>
      `;
      return;
    }

    listEl.innerHTML = this.db.crewProfiles.map(c => `
      <button type="button" class="sp-crew-btn w-full text-left flex items-center justify-between p-3 rounded border" onclick="StoryPad.loginAs('${this.escapeHtml(c.personaKey)}')">
        <span class="flex items-center gap-3 min-w-0">
          <span class="w-10 h-10 rounded bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs shrink-0">${this.escapeHtml(c.initials)}</span>
          <span class="flex flex-col min-w-0">
            <span class="font-sans text-xs font-bold truncate" style="color: var(--text-primary);">${this.escapeHtml(c.fullName)}</span>
            <span class="font-sans text-[11px] truncate" style="color: var(--primary-text);">${this.escapeHtml(c.roleTitle)}</span>
            <span class="font-mono text-[10px] truncate" style="color: var(--text-muted);">${this.escapeHtml(c.email)}</span>
          </span>
        </span>
        <span class="material-symbols-outlined text-[18px] shrink-0" style="color: var(--primary-text);" aria-hidden="true">chevron_right</span>
      </button>
    `).join('');
  },

  loginQuickSession() {
    this.triggerHaptic();
    const activeProj = this.db.projects.find(p => p.id === this.state.activeProjectId) || this.db.projects[0];
    this.state.activePersonaKey = '';
    this.state.currentUser = {
      name: `Kru ${this.state.studioName}`,
      initials: 'K10',
      roleTitle: 'Script Supervisor & Continuity',
      idBadge: 'K10-01',
      studio: this.state.studioName,
      prodName: activeProj ? activeProj.title : '-',
      email: ''
    };
    this.state.roles = {
      scriptSupervisor: true,
      videoEditor: true,
      soundRecordist: true,
      directorProducer: false,
      autoExportMeta: true
    };
    this.savePersistedSettings();
    this.syncPhpSession({
      logged_in: true,
      screen: 'dashboard',
      persona_key: '',
      active_project_id: this.state.activeProjectId,
      user: this.state.currentUser
    });
    this.renderProfileRoles();
    this.closeLoginAccounts();
    this.navigate('dashboard', 'home');
    this.showToast(`Sesi lapangan ${this.state.studioName} aktif`);
  },

  loginAs(personaKey) {
    this.triggerHaptic();
    const profile = this.db.crewProfiles.find(c => c.personaKey === personaKey);
    if (!profile) {
      this.loginQuickSession();
      return;
    }

    const activeProj = this.db.projects.find(p => p.id === this.state.activeProjectId) || this.db.projects[0];
    const prodName = activeProj ? activeProj.title : (profile.prodName || '-');

    this.state.activePersonaKey = profile.personaKey;
    this.state.currentUser = {
      name: profile.fullName,
      initials: profile.initials,
      roleTitle: profile.roleTitle,
      idBadge: profile.idBadge,
      studio: profile.studio || this.state.studioName,
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

    this.savePersistedSettings();
    this.syncPhpSession({
      logged_in: true,
      screen: 'dashboard',
      persona_key: profile.personaKey,
      active_project_id: this.state.activeProjectId,
      user: this.state.currentUser
    });
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
      const activeProj = this.db.projects.find(p => p.id === this.state.activeProjectId) || this.db.projects[0];
      const prodTitle = activeProj ? activeProj.title : 'JADI?';

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
        const initials = rawName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'KP';
        const personaKey = 'crew_' + email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const idBadge = 'K10-' + String(Math.floor(100 + (Date.now() % 900)));
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
          studio: this.state.studioName,
          prod_name: prodTitle,
          email,
          roles: rolesObj,
          is_archived: false
        };

        await this.supabase.from('crew_profiles').upsert(profileRow, { onConflict: 'persona_key' });

        const localProfile = {
          personaKey,
          fullName: rawName,
          initials,
          roleTitle,
          idBadge,
          studio: this.state.studioName,
          prodName: prodTitle,
          email,
          roles: rolesObj
        };
        const existingIdx = this.db.crewProfiles.findIndex(c => c.personaKey === personaKey || c.email.toLowerCase() === email.toLowerCase());
        if (existingIdx >= 0) this.db.crewProfiles[existingIdx] = localProfile;
        else this.db.crewProfiles.push(localProfile);

        this.renderLoginCrewList();
        this.renderCrewAccountsList();

        if (authRes.data && authRes.data.session) {
          this.state.supabaseUser = authRes.data.user;
          this.loginAs(personaKey);
          this.showToast(`Akun ${rawName} disimpan ke Supabase`);
        } else {
          this.loginAs(personaKey);
          this.showToast(`Profil kru ${rawName} aktif`);
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
        const { data: matchedRows } = await this.supabase.from('crew_profiles').select('*').eq('is_archived', false).ilike('email', email).limit(1);
        if (matchedRows && matchedRows.length > 0) {
          const m = matchedRows[0];
          const mapped = {
            personaKey: m.persona_key,
            fullName: m.full_name,
            initials: m.initials,
            roleTitle: m.role_title,
            idBadge: m.id_badge,
            studio: m.studio || this.state.studioName,
            prodName: m.prod_name || prodTitle,
            email: m.email,
            roles: m.roles || {}
          };
          const idx = this.db.crewProfiles.findIndex(c => c.personaKey === mapped.personaKey);
          if (idx >= 0) this.db.crewProfiles[idx] = mapped;
          else this.db.crewProfiles.push(mapped);
          this.renderLoginCrewList();
          this.renderCrewAccountsList();
          this.loginAs(mapped.personaKey);
        } else {
          this.applyAuthenticatedSupabaseUser(result.data.user);
          this.syncPhpSession({ logged_in: true, screen: 'dashboard', user: this.state.currentUser });
          this.closeLoginAccounts();
          this.navigate('dashboard', 'home');
          this.showToast(`Masuk via Supabase: ${email}`);
        }
      }
    } catch (err) {
      setFeedback('Gagal menghubungi layanan autentikasi Supabase.', true);
    }
  },

  handleLogout() {
    this.triggerHaptic();
    const btn = document.getElementById('logout-btn');
    if (btn) btn.disabled = true;

    if (this.supabase) {
      this.supabase.auth.signOut().catch(() => {});
    }
    this.syncPhpSession({ action: 'logout' });

    setTimeout(() => {
      if (btn) btn.disabled = false;
      this.navigate('login');
      this.showToast('Keluar dari sesi produksi');
    }, 350);
  },

  /* ============================================================
   * CLOCKS & EVENT LISTENERS
   * ============================================================ */

  updateStatusBarClock() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');

    const clockEl = document.getElementById('mobile-clock');
    if (clockEl) clockEl.textContent = `${hrs}:${mins}`;

    const masterTcEl = document.getElementById('master-tc-live');
    if (masterTcEl) masterTcEl.textContent = `${hrs}:${mins}:${secs}`;
  },

  startLiveClocks() {
    clearInterval(this.state._clocks.clockTimer);
    this.state._clocks.clockTimer = setInterval(() => {
      this.updateStatusBarClock();
    }, 1000);
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

    ['sheet-view-settings', 'sheet-audio-panel', 'sheet-notifications', 'sheet-login-accounts', 'sheet-import-script', 'sheet-add-line'].forEach(id => {
      this.setupSwipeableSheet(id);
    });

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
        this.closeAllModals();
      } else {
        sheet.style.transform = '';
      }
      startY = 0;
      currentY = 0;
    }, { passive: true });
  }
};

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
