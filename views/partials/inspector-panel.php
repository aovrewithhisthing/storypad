<?php
declare(strict_types=1);
?>
        <!-- ========================================== -->
        <!-- INSPECTOR DECK: AUDIO, FOOTAGE, TAKE & NOTES -->
        <!-- ========================================== -->
        <aside class="bottom-sheet-drawer monitor-deck inspector-drawer" id="sheet-audio-panel" aria-label="Panel Monitor Audio, Footage, Take, dan Catatan">
          <div class="bottom-sheet-handle"></div>
          <div class="bottom-sheet-content keyboard-avoiding-container" id="panel-scroll-container">
            <!-- Panel Header -->
            <div class="flex items-center justify-between gap-2 pb-2 border-b border-[#2A2E39]">
              <h2 class="font-sans text-sm font-bold text-[#F3F4F6] truncate" id="panel-scene-title">
                Panel Media &amp; Take <span class="text-xs text-[#A1A9B8] font-normal font-mono">(Scene 01 / Shot 01)</span>
              </h2>
              <button aria-label="Tutup panel monitor" class="drawer-only-close sp-icon-btn sp-icon-btn-monitor" onclick="StoryPad.closeAudioPanel()" type="button">
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
              </button>
            </div>

            <!-- Hidden Native Audio Player & File Inputs for Real Media -->
            <audio id="panel-real-audio" preload="metadata" class="hidden"></audio>
            <input type="file" id="input-upload-audio" accept=".wav,.mp3,.m4a,.aac,.ogg,.webm,audio/*" class="sr-only" onchange="StoryPad.handleMediaFileSelected('audio', this)">
            <input type="file" id="input-upload-video" accept=".mp4,.mov,.webm,.mkv,video/*" class="sr-only" onchange="StoryPad.handleMediaFileSelected('video', this)">

            <!-- Media Tabs -->
            <div class="grid grid-cols-2 gap-1.5 p-1 bg-[#0F1115] border border-[#2A2E39] rounded" role="tablist" aria-label="Mode Pemantauan Media">
              <button type="button" role="tab" aria-selected="true" id="panel-tab-audio" class="min-h-[40px] py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors bg-[#2563EB] text-white" onclick="StoryPad.switchPanelMediaTab('audio')">
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">graphic_eq</span>
                <span>Audio Take</span>
              </button>
              <button type="button" role="tab" aria-selected="false" id="panel-tab-video" class="min-h-[40px] py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors text-[#A1A9B8] hover:text-white" onclick="StoryPad.switchPanelMediaTab('video')">
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">videocam</span>
                <span>Footage Kamera</span>
              </button>
            </div>

            <!-- Component 1: Audio Monitor + Upload -->
            <div class="bg-[#12151B] border border-[#2A2E39] p-3 rounded flex flex-col gap-2.5" id="panel-audio-container">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[#F3F4F6] font-sans text-xs font-bold">Monitor Audio Take</span>
                <span class="font-mono text-[11px] px-2 py-0.5 rounded bg-[#1E222B] border border-[#2A2E39] text-[#A1A9B8]" id="panel-audio-source-badge">Belum Ada File</span>
              </div>

              <p class="font-mono text-[11px] text-[#A1A9B8] m-0 truncate" id="panel-audio-file-label">
                Unggah rekaman audio (.wav / .mp3 / .m4a) untuk memutar suara asli take ini.
              </p>

              <div class="flex items-center gap-2.5">
                <button aria-label="Putar atau jeda audio take" class="btn-press w-11 h-11 shrink-0 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center" id="audio-play-btn" onclick="StoryPad.togglePanelAudioPlayback()" type="button">
                  <span class="material-symbols-outlined text-[20px]" id="panel-play-icon" aria-hidden="true">play_arrow</span>
                </button>

                <div class="flex flex-col flex-1 min-w-0 gap-1">
                  <button type="button" aria-label="Putar atau jeda waveform" class="relative w-full h-9 bg-[#0F1115] border border-[#2A2E39] rounded flex items-center px-1.5 overflow-hidden text-left" id="panel-waveform" onclick="StoryPad.togglePanelAudioPlayback()">
                    <span class="flex items-center justify-between w-full h-full gap-[2px]" aria-hidden="true">
                      <span class="waveform-bar w-[3px] h-[35%] bg-[#60A5FA]"></span>
                      <span class="waveform-bar w-[3px] h-[60%] bg-[#60A5FA]"></span>
                      <span class="waveform-bar w-[3px] h-[45%] bg-[#60A5FA]"></span>
                      <span class="waveform-bar w-[3px] h-[85%] bg-[#60A5FA]"></span>
                      <span class="waveform-bar w-[3px] h-[70%] bg-[#60A5FA]"></span>
                      <span class="waveform-bar w-[3px] h-[95%] bg-[#34D399]"></span>
                      <span class="waveform-bar w-[3px] h-[65%] bg-[#60A5FA]"></span>
                      <span class="waveform-bar w-[3px] h-[40%] bg-[#60A5FA]"></span>
                      <span class="waveform-bar w-[3px] h-[55%] bg-[#60A5FA]"></span>
                      <span class="waveform-bar w-[3px] h-[30%] bg-[#6A748B]"></span>
                      <span class="waveform-bar w-[3px] h-[75%] bg-[#6A748B]"></span>
                      <span class="waveform-bar w-[3px] h-[90%] bg-[#6A748B]"></span>
                      <span class="waveform-bar w-[3px] h-[50%] bg-[#6A748B]"></span>
                      <span class="waveform-bar w-[3px] h-[35%] bg-[#6A748B]"></span>
                      <span class="waveform-bar w-[3px] h-[65%] bg-[#6A748B]"></span>
                      <span class="waveform-bar w-[3px] h-[40%] bg-[#6A748B]"></span>
                      <span class="waveform-bar w-[3px] h-[80%] bg-[#6A748B]"></span>
                      <span class="waveform-bar w-[3px] h-[45%] bg-[#6A748B]"></span>
                      <span class="waveform-bar w-[3px] h-[30%] bg-[#6A748B]"></span>
                    </span>
                    <span class="absolute left-[0%] top-0 bottom-0 w-[2px] bg-[#34D399]" id="panel-audio-playhead" aria-hidden="true"></span>
                  </button>

                  <div class="flex items-center justify-between font-mono text-[11px] tabular-nums">
                    <span class="text-[#34D399] font-semibold" id="panel-elapsed-tc">00:00:00:00</span>
                    <span class="text-[#A1A9B8]" id="panel-total-tc">00:00:00:00</span>
                  </div>
                </div>
              </div>

              <!-- Audio Upload & URL Toolbar -->
              <div class="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#2A2E39]">
                <button type="button" class="sp-btn sp-btn-primary sp-btn-compact flex-1" id="btn-trigger-audio-upload" onclick="StoryPad.triggerMediaPicker('audio')">
                  <span class="material-symbols-outlined text-[15px]" aria-hidden="true">upload</span>
                  <span>Unggah Audio</span>
                </button>
                <button type="button" class="sp-btn sp-btn-monitor sp-btn-compact" onclick="StoryPad.toggleMediaUrlInput('audio')">
                  <span class="material-symbols-outlined text-[15px]" aria-hidden="true">link</span>
                  <span>URL</span>
                </button>
                <button type="button" id="btn-clear-audio" class="hidden sp-btn sp-btn-monitor sp-btn-compact text-[#F87171]" onclick="StoryPad.clearTakeMedia('audio')" aria-label="Lepas berkas audio dari take ini">
                  <span class="material-symbols-outlined text-[15px]" aria-hidden="true">delete</span>
                </button>
              </div>

              <!-- Optional Audio URL Input Box -->
              <div id="audio-url-box" class="hidden flex-col gap-1.5 p-2 rounded bg-[#0F1115] border border-[#2A2E39]">
                <label for="input-audio-url" class="font-sans text-[11px] font-semibold text-[#A1A9B8]">Tautkan URL Audio Langsung (.wav / .mp3)</label>
                <div class="flex items-center gap-1.5">
                  <input type="url" id="input-audio-url" class="sp-input-monitor flex-1" placeholder="https://.../take01_audio.wav">
                  <button type="button" class="sp-btn sp-btn-primary sp-btn-compact" onclick="StoryPad.attachMediaByUrl('audio')">Simpan</button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 pt-1">
                <div class="flex flex-col gap-1 bg-[#0F1115] px-2.5 py-1.5 rounded border border-[#2A2E39]">
                  <div class="flex items-center justify-between font-mono text-[11px]">
                    <span class="text-[#A1A9B8]">CH 1 BOOM</span>
                    <span class="text-[#34D399] font-bold tabular-nums" id="vu-val-ch1">-- dB</span>
                  </div>
                  <div class="w-full bg-[#1E222B] h-1.5 rounded overflow-hidden">
                    <div class="vu-meter-bar h-full w-[0%]" id="vu-meter-ch1"></div>
                  </div>
                </div>
                <div class="flex flex-col gap-1 bg-[#0F1115] px-2.5 py-1.5 rounded border border-[#2A2E39]">
                  <div class="flex items-center justify-between font-mono text-[11px]">
                    <span class="text-[#A1A9B8]">CH 2 LAV</span>
                    <span class="text-[#34D399] font-bold tabular-nums" id="vu-val-ch2">-- dB</span>
                  </div>
                  <div class="w-full bg-[#1E222B] h-1.5 rounded overflow-hidden">
                    <div class="vu-meter-bar h-full w-[0%]" id="vu-meter-ch2"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Component 2: Footage Preview Monitor + Video Upload (Sharp 0px corners) -->
            <div class="hidden bg-[#12151B] border border-[#2A2E39] p-3 rounded flex flex-col gap-2.5" id="panel-footage-container">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[#F3F4F6] font-sans text-xs font-bold">Monitor Footage Kamera</span>
                <span class="font-mono text-[11px] px-2 py-0.5 rounded bg-[#1E222B] border border-[#2A2E39] text-[#A1A9B8]" id="panel-video-source-badge">Mode Slate</span>
              </div>

              <div class="relative w-full aspect-video camera-monitor-screen overflow-hidden flex flex-col justify-between p-2.5 select-none">
                <!-- Real HTML5 Video Element (Strict 0px corners, intrinsic 640x360 dimensions) -->
                <video id="panel-real-video" width="640" height="360" playsinline preload="metadata" class="hidden absolute inset-0 w-full h-full object-contain bg-black z-0"></video>

                <div class="flex items-center justify-between text-[11px] font-mono z-10 relative">
                  <div class="flex items-center gap-1.5 bg-[#0F1115]/90 border border-[#2A2E39] px-2 py-0.5">
                    <span class="text-[#F3F4F6] font-bold">CAM-A</span>
                    <span class="text-[#A1A9B8]">|</span>
                    <span class="text-[#60A5FA]" id="footage-fps-badge">24 FPS</span>
                  </div>
                  <div class="bg-[#0F1115]/90 border border-[#2A2E39] px-2 py-0.5 text-[#34D399] font-bold tabular-nums" id="footage-live-tc">
                    00:00:00:00
                  </div>
                </div>

                <div class="camera-safe-frame" id="footage-hud-frame" aria-hidden="true"></div>
                <div class="camera-crosshair" id="footage-hud-crosshair" aria-hidden="true"></div>

                <div class="flex flex-col items-center justify-center text-center pointer-events-none my-auto z-10 relative" id="footage-slate-placeholder">
                  <span class="font-sans text-[11px] text-[#A1A9B8] tracking-wide uppercase">Pratinjau Slate Kamera</span>
                  <div class="flex items-center gap-1.5 mt-1.5">
                    <span class="font-mono text-xs font-bold text-[#F3F4F6] bg-[#161920] px-2 py-0.5 border border-[#373C4A]" id="footage-scene-badge">SC 01</span>
                    <span class="font-mono text-xs font-bold text-[#60A5FA] bg-[#161920] px-2 py-0.5 border border-[#373C4A]" id="footage-shot-badge">SH 01</span>
                    <span class="font-mono text-xs font-bold text-[#34D399] bg-[#161920] px-2 py-0.5 border border-[#373C4A]" id="footage-take-badge">TK 01</span>
                  </div>
                  <span class="font-mono text-[10px] text-[#A1A9B8] mt-2" id="footage-empty-hint">Unggah klip .mp4 / .mov untuk memutar gambar asli</span>
                </div>

                <div class="flex items-center justify-between text-[10px] font-mono text-[#A1A9B8] z-10 relative bg-[#0F1115]/90 border border-[#2A2E39] px-2 py-0.5">
                  <span class="truncate max-w-[65%]" id="footage-file-caption">Belum ada klip video terlampir</span>
                  <span class="text-[#60A5FA] shrink-0">REC MONITOR</span>
                </div>
              </div>

              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5">
                  <button type="button" onclick="StoryPad.stepFootage(-1)" aria-label="Mundur 1 frame" title="Mundur 1 Frame" class="sp-icon-btn sp-icon-btn-monitor">
                    <span class="material-symbols-outlined text-[18px]" aria-hidden="true">fast_rewind</span>
                  </button>
                  <button type="button" onclick="StoryPad.toggleFootagePlayback()" id="footage-play-btn" aria-label="Putar atau jeda footage" class="sp-btn sp-btn-primary sp-btn-compact px-3">
                    <span class="material-symbols-outlined text-[18px]" id="footage-play-icon" aria-hidden="true">play_arrow</span>
                  </button>
                  <button type="button" onclick="StoryPad.stepFootage(1)" aria-label="Maju 1 frame" title="Maju 1 Frame" class="sp-icon-btn sp-icon-btn-monitor">
                    <span class="material-symbols-outlined text-[18px]" aria-hidden="true">fast_forward</span>
                  </button>
                </div>
                <div class="flex items-center gap-1.5 font-mono text-xs tabular-nums">
                  <span class="text-[#34D399]" id="footage-elapsed-tc">00:00:00:00</span>
                  <span class="text-[#A1A9B8]" id="footage-total-tc">/ 00:00:00:00</span>
                </div>
              </div>

              <!-- Video Upload & URL Toolbar -->
              <div class="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#2A2E39]">
                <button type="button" class="sp-btn sp-btn-primary sp-btn-compact flex-1" id="btn-trigger-video-upload" onclick="StoryPad.triggerMediaPicker('video')">
                  <span class="material-symbols-outlined text-[15px]" aria-hidden="true">video_call</span>
                  <span>Unggah Footage</span>
                </button>
                <button type="button" class="sp-btn sp-btn-monitor sp-btn-compact" onclick="StoryPad.toggleMediaUrlInput('video')">
                  <span class="material-symbols-outlined text-[15px]" aria-hidden="true">link</span>
                  <span>URL</span>
                </button>
                <button type="button" id="btn-clear-video" class="hidden sp-btn sp-btn-monitor sp-btn-compact text-[#F87171]" onclick="StoryPad.clearTakeMedia('video')" aria-label="Lepas klip footage dari take ini">
                  <span class="material-symbols-outlined text-[15px]" aria-hidden="true">delete</span>
                </button>
              </div>

              <div id="video-url-box" class="hidden flex-col gap-1.5 p-2 rounded bg-[#0F1115] border border-[#2A2E39]">
                <label for="input-video-url" class="font-sans text-[11px] font-semibold text-[#A1A9B8]">Tautkan URL Video Footage (.mp4 / .webm)</label>
                <div class="flex items-center gap-1.5">
                  <input type="url" id="input-video-url" class="sp-input-monitor flex-1" placeholder="https://.../take01_camA.mp4">
                  <button type="button" class="sp-btn sp-btn-primary sp-btn-compact" onclick="StoryPad.attachMediaByUrl('video')">Simpan</button>
                </div>
              </div>
            </div>

            <!-- Upload Progress Status Banner -->
            <div id="panel-media-upload-status" class="hidden p-2.5 rounded bg-[#172554] border border-[#3B82F6] text-xs font-mono text-[#DBEAFE]" role="status" aria-live="polite"></div>

            <!-- Component 3: Take Management -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-sans text-xs font-bold text-[#F3F4F6] m-0" id="panel-takes-header-label">
                  Daftar Rekaman Take (Scene 01 / Shot 01)
                </h3>
                <div class="flex items-center gap-2">
                  <span class="font-mono text-[11px] text-[#60A5FA] bg-[#12151B] px-2 py-0.5 rounded border border-[#2A2E39] tabular-nums" id="panel-takes-count-badge">
                    0 Take
                  </span>
                  <button type="button" class="font-sans text-[11px] font-semibold min-h-[36px] px-2.5 py-1 rounded bg-[#1E222B] border border-[#6A748B] text-[#F3F4F6] hover:bg-[#2A303C]" onclick="StoryPad.logNewTake()">
                    + Take Baru
                  </button>
                </div>
              </div>

              <div class="flex flex-col gap-1.5" id="panel-takes-list"></div>
            </div>

            <!-- Component 4: Auto-Naming Engine -->
            <div class="bg-[#12151B] border border-[#2A2E39] p-3 rounded flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-sans text-xs font-bold text-[#60A5FA] m-0" id="panel-naming-title">
                  Kode Penamaan Otomatis (Take 01)
                </h3>
                <button class="sp-btn sp-btn-monitor sp-btn-compact px-2.5" id="copy-btn" onclick="StoryPad.copyFileNames()" type="button">
                  <span class="material-symbols-outlined text-[15px]" id="copy-icon" aria-hidden="true">content_copy</span>
                  <span id="copy-text">Salin Semua</span>
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <span class="px-2 py-0.5 rounded bg-[#1E222B] border border-[#2A2E39] font-mono text-[11px] text-[#A1A9B8]" id="panel-naming-sc">SC: 01</span>
                <span class="px-2 py-0.5 rounded bg-[#1E222B] border border-[#2A2E39] font-mono text-[11px] text-[#A1A9B8]" id="panel-naming-sh">SH: 01</span>
                <span class="px-2 py-0.5 rounded bg-[#1E222B] border border-[#2A2E39] font-mono text-[11px] text-[#34D399] font-bold" id="panel-naming-tk">TK: 01</span>
                <span class="px-2 py-0.5 rounded bg-[#1E222B] border border-[#2A2E39] font-mono text-[11px] text-[#A1A9B8]" id="panel-naming-cam">CAM: A</span>
              </div>

              <div class="flex flex-col gap-1 bg-[#0F1115] border border-[#2A2E39] p-2 rounded font-mono text-[11px]">
                <button type="button" class="w-full text-left flex items-center justify-between gap-2 py-1 px-1.5 rounded hover:bg-[#1E222B] transition-colors" onclick="StoryPad.copySpecificFilename('video')" title="Klik untuk menyalin nama file video">
                  <span class="text-[#A1A9B8] font-sans text-[10px] uppercase shrink-0 font-bold">VIDEO:</span>
                  <span class="text-[#F3F4F6] font-medium truncate flex-1" id="filename-video">SC01_SH01_T01_Dialog_CAM-A.mp4</span>
                  <span class="material-symbols-outlined text-[14px] text-[#A1A9B8]" aria-hidden="true">content_copy</span>
                </button>
                <button type="button" class="w-full text-left flex items-center justify-between gap-2 py-1 px-1.5 rounded hover:bg-[#1E222B] transition-colors" onclick="StoryPad.copySpecificFilename('audio')" title="Klik untuk menyalin nama file audio">
                  <span class="text-[#A1A9B8] font-sans text-[10px] uppercase shrink-0 font-bold">AUDIO:</span>
                  <span class="text-[#34D399] font-medium truncate flex-1" id="filename-audio">SC01_SH01_T01_Dialog_AUD.wav</span>
                  <span class="material-symbols-outlined text-[14px] text-[#A1A9B8]" aria-hidden="true">content_copy</span>
                </button>
              </div>
            </div>

            <!-- Component 5: Continuity Notes & NLE Sync -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <label class="font-sans text-xs font-bold text-[#F3F4F6]" for="panel-script-notes">
                  Catatan Kontinuitas Lapangan
                </label>
                <span class="font-mono text-[11px] text-[#34D399]" id="panel-autosave-status">Siap mencatat</span>
              </div>

              <textarea class="sp-textarea-monitor resize-y" id="panel-script-notes" placeholder="Tulis catatan kontinuitas prop, posisi aktor, lensa, atau kualitas audio pada dialog ini..." oninput="StoryPad.updateActiveNote(this.value)" rows="3"></textarea>

              <div class="flex items-center gap-2 pt-1">
                <button class="sp-btn sp-btn-monitor sp-btn-compact" onclick="StoryPad.saveNotes()" type="button">
                  <span class="material-symbols-outlined text-[16px]" aria-hidden="true">bookmark</span>
                  <span>Simpan Catatan</span>
                </button>
                <button class="sp-btn sp-btn-primary sp-btn-compact flex-1" id="send-nle-btn" onclick="StoryPad.syncToNle()" type="button">
                  <span class="material-symbols-outlined text-[16px]" aria-hidden="true">send_time_extension</span>
                  <span>Kirim ke Editor NLE</span>
                </button>
              </div>
              <div id="nle-sync-status" class="font-mono text-[11px] text-[#A1A9B8]" aria-live="polite"></div>
            </div>
          </div>
        </aside>
