<?php
declare(strict_types=1);

$dashHidden = ($initialScreen ?? 'login') === 'dashboard' ? '' : ' hidden';
$dashInitials = $session['user']['initials'] ?? 'KP';
?>
          <!-- ========================================== -->
          <!-- LAYAR 2: DASHBOARD PRODUKSI -->
          <!-- ========================================== -->
          <section class="screen-view<?= $dashHidden ?> flex-col" id="screen-dashboard" aria-labelledby="dash-heading">
            <header class="sp-topbar">
              <div class="flex items-center gap-3 min-w-0">
                <h1 id="dash-heading" class="font-sans text-base md:text-lg font-bold tracking-tight truncate" style="color: var(--text-primary);">
                  Beranda Produksi
                </h1>
                <span class="font-mono text-xs px-2 py-0.5 rounded border tabular-nums hidden sm:inline-flex" style="background-color: var(--panel-lowest); border-color: var(--border-flat); color: var(--text-secondary);" id="mobile-clock">00:00</span>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact hidden sm:inline-flex" onclick="StoryPad.openScriptImportModal()">
                  <span class="material-symbols-outlined text-[17px]" aria-hidden="true">upload_file</span>
                  <span>Impor Naskah</span>
                </button>
                <button type="button" class="sp-icon-btn" onclick="StoryPad.toggleTheme()" aria-label="Ganti Tema Tampilan" title="Ganti Tema Tampilan">
                  <span class="material-symbols-outlined text-[19px]" aria-hidden="true">contrast</span>
                </button>
                <button type="button" class="sp-icon-btn" onclick="StoryPad.openViewSettings()" aria-label="Pengaturan Tampilan Skrip" title="Pengaturan Tampilan">
                  <span class="material-symbols-outlined text-[19px]" aria-hidden="true">tune</span>
                </button>
                <button type="button" class="sp-icon-btn relative" onclick="StoryPad.openNotifications()" aria-label="Buka Notifikasi">
                  <span class="material-symbols-outlined text-[19px]" aria-hidden="true">notifications</span>
                  <span class="notif-unread-dot hidden absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2563EB]" aria-hidden="true"></span>
                </button>
                <button type="button" class="sp-icon-btn font-sans text-xs font-bold" id="header-avatar-dash" onclick="StoryPad.navigate('profile', 'profile')" aria-label="Buka Profil Kru">
                  <?= e($dashInitials) ?>
                </button>
              </div>
            </header>

            <div class="screen-content-wrap">
              <!-- Primary Question Block: Active Production, Status, and Next Action -->
              <div class="dash-top-grid">
                <article class="sp-panel p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span class="sp-badge sp-badge-blue">Produksi Aktif</span>
                      <span class="font-mono text-xs tabular-nums" style="color: var(--text-secondary);" id="dash-active-proj-meta">
                        Memuat metadata proyek...
                      </span>
                    </div>
                    <h2 class="font-sans text-xl md:text-2xl font-bold tracking-tight" id="dash-active-proj-title" style="color: var(--text-primary);">
                      Memuat Naskah...
                    </h2>
                    <p class="font-mono text-xs mt-1 font-medium" id="dash-active-scene-line" style="color: var(--text-secondary);">
                      Menghubungkan ke database naskah...
                    </p>
                    <p class="font-sans text-xs mt-2 leading-relaxed hidden" id="dash-active-synopsis" style="color: var(--text-secondary);"></p>
                  </div>

                  <div class="sp-panel-muted p-3.5">
                    <p class="font-sans text-xs font-bold mb-1" style="color: var(--text-primary);">Langkah Berikutnya</p>
                    <p class="font-sans text-xs leading-relaxed" id="dash-next-action" style="color: var(--text-secondary);">
                      Pilih proyek naskah atau unggah dokumen naskah baru untuk memulai pencatatan shot dan take.
                    </p>
                  </div>

                  <div class="flex flex-wrap items-center gap-2.5">
                    <button type="button" id="dash-open-active-btn" class="sp-btn sp-btn-primary btn-press" onclick="StoryPad.openProject(StoryPad.state.activeProjectId)">
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit_note</span>
                      <span>Buka Meja Naskah Aktif</span>
                    </button>
                    <button type="button" class="sp-btn sp-btn-secondary btn-press" onclick="StoryPad.openAudioPanel(StoryPad.state.activeDialogueId, 'audio')">
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">perm_media</span>
                      <span>Kelola Audio &amp; Footage</span>
                    </button>
                    <button type="button" class="sp-btn sp-btn-secondary btn-press" onclick="StoryPad.openScriptImportModal()">
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">upload_file</span>
                      <span>Tambah Naskah (.docx)</span>
                    </button>
                  </div>
                </article>

                <!-- Continuity Progress Gauge (Calculated strictly from Script Data) -->
                <article class="sp-panel p-5 flex flex-col justify-between gap-3">
                  <div class="flex items-center justify-between gap-2">
                    <h2 class="sp-section-heading">Status Kontinuitas Naskah</h2>
                    <span class="sp-badge sp-badge-neutral font-mono tabular-nums" id="dash-scene-badge">Scene 01</span>
                  </div>

                  <div class="relative w-48 h-24 mx-auto flex flex-col items-center justify-end my-1">
                    <svg class="w-48 h-24 overflow-visible" viewBox="0 0 200 100" aria-hidden="true">
                      <path class="radial-progress-track" d="M 20 95 A 80 80 0 0 1 180 95" fill="none" stroke-linecap="round" stroke-width="14"></path>
                      <path class="radial-progress-fill" id="hero-gauge-fill" d="M 20 95 A 80 80 0 0 1 180 95" fill="none" stroke-linecap="round" stroke-width="14" stroke-dasharray="251.32" stroke-dashoffset="251.32"></path>
                    </svg>
                    <div class="absolute bottom-0 flex flex-col items-center text-center">
                      <span class="font-mono text-2xl font-bold leading-none tabular-nums" id="hero-gauge-pct" style="color: var(--primary-text);">0%</span>
                      <span class="font-sans text-[11px] font-medium mt-1" style="color: var(--text-secondary);">Dialog Selesai</span>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-2 pt-3 border-t" style="border-color: var(--border-flat);">
                    <div class="sp-panel-muted p-2.5 text-center">
                      <span class="block font-sans text-[11px]" style="color: var(--text-muted);">Cakupan Dialog</span>
                      <span class="block font-mono text-xs font-bold mt-0.5 tabular-nums" id="hero-gauge-takes" style="color: var(--text-primary);">0 / 0 Dialog</span>
                    </div>
                    <div class="sp-panel-muted p-2.5 text-center">
                      <span class="block font-sans text-[11px]" style="color: var(--text-muted);">Circle Good Take</span>
                      <span class="block font-mono text-xs font-bold mt-0.5 tabular-nums" id="hero-gauge-circle" style="color: var(--good-text);">0 Confirmed</span>
                    </div>
                  </div>
                </article>
              </div>

              <!-- Secondary Workspace Columns: Production List & Audio/Footage Monitor -->
              <div class="dash-work-grid">
                <!-- Active Projects Summary -->
                <section class="sp-panel p-5 flex flex-col gap-3" aria-labelledby="dash-projects-title">
                  <div class="flex items-center justify-between gap-2 pb-2 border-b" style="border-color: var(--border-flat);">
                    <h2 id="dash-projects-title" class="sp-section-heading">Daftar Proyek Naskah</h2>
                    <div class="flex items-center gap-2">
                      <button type="button" class="font-sans text-xs font-semibold hover:underline bg-transparent border-0 px-2 py-1" id="dash-all-projects-btn" style="color: var(--primary-text);" onclick="StoryPad.navigate('projects', 'project-list')">
                        Lihat Semua
                      </button>
                    </div>
                  </div>

                  <div class="flex flex-col gap-2.5" id="dash-projects-list">
                    <div class="sp-panel-muted p-4 text-xs font-mono" style="color: var(--text-secondary);">
                      Memuat daftar proyek dari database...
                    </div>
                  </div>
                </section>

                <!-- Real Take Media Deck (Populated strictly from uploaded/logged takes) -->
                <section class="sp-monitor-panel p-5 flex flex-col gap-3" aria-labelledby="dash-audio-title">
                  <div class="flex items-center justify-between gap-2 pb-2 border-b border-[#2A2E39]">
                    <h2 id="dash-audio-title" class="font-sans text-sm font-bold text-[#F3F4F6]">Rekaman Audio &amp; Footage Take</h2>
                    <span class="font-mono text-[11px] text-[#A1A9B8] tabular-nums" id="dash-media-count-badge">0 Klip</span>
                  </div>

                  <div class="flex flex-col gap-2.5" id="dash-media-tracks-list">
                    <div class="p-4 rounded bg-[#12151B] border border-[#2A2E39] flex flex-col items-start gap-2.5">
                      <p class="font-sans text-xs font-semibold text-[#F3F4F6] m-0">Belum ada berkas audio atau footage yang diunggah</p>
                      <p class="font-sans text-xs text-[#A1A9B8] m-0 leading-relaxed">
                        Buka dialog pada meja naskah lalu unggah rekaman audio (<code class="font-mono">.wav</code>/<code class="font-mono">.mp3</code>) atau footage kamera (<code class="font-mono">.mp4</code>/<code class="font-mono">.mov</code>) untuk memutarnya langsung di sini.
                      </p>
                      <button type="button" class="sp-btn sp-btn-primary sp-btn-compact" onclick="StoryPad.openAudioPanel(StoryPad.state.activeDialogueId, 'audio')">
                        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">upload</span>
                        <span>Unggah Audio / Footage</span>
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              <!-- Operational Status Strip -->
              <div class="sp-panel-muted px-4 py-3 flex flex-wrap items-center justify-between gap-2 transition-all duration-200" id="floating-quick-dock">
                <div class="flex items-center gap-2 text-xs">
                  <span class="font-semibold" style="color: var(--text-primary);">Konverter Naskah &amp; NLE Bridge:</span>
                  <span style="color: var(--text-secondary);">Mendukung impor dokumen Word (.docx), Fountain, Markdown, dan teks naskah multi-scene.</span>
                </div>
                <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.openViewSettings()">
                  <span class="material-symbols-outlined text-[16px]" aria-hidden="true">display_settings</span>
                  <span>Pengaturan Tampilan Skrip</span>
                </button>
              </div>
            </div>
          </section>
