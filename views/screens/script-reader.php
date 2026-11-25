<?php
declare(strict_types=1);

$scriptHidden = ($initialScreen ?? 'login') === 'script-reader' ? '' : ' hidden';
?>
          <!-- ========================================== -->
          <!-- LAYAR 4: LIVE SCRIPT SUPERVISOR -->
          <!-- ========================================== -->
          <section class="screen-view<?= $scriptHidden ?> flex-col" id="screen-script-reader" aria-labelledby="script-heading">
            <header class="sp-topbar">
              <div class="flex items-center gap-2.5 min-w-0">
                <button aria-label="Kembali ke halaman sebelumnya" class="sp-icon-btn btn-press" onclick="StoryPad.goBack()" type="button">
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
                </button>
                <div class="min-w-0">
                  <h1 id="script-heading" class="font-sans text-sm md:text-base font-bold tracking-tight truncate" style="color: var(--text-primary);">
                    Live Script Supervisor
                  </h1>
                  <p class="font-mono text-[11px] truncate" style="color: var(--text-secondary);">
                    <span id="script-project-title">Memuat Naskah...</span> | <span id="script-project-draft">Draft</span>
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact hidden sm:inline-flex" onclick="StoryPad.openAddLineModal()" title="Tambah baris aksi atau dialog ke naskah aktif">
                  <span class="material-symbols-outlined text-[16px]" aria-hidden="true">playlist_add</span>
                  <span>+ Baris</span>
                </button>
                <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact hidden md:inline-flex" onclick="StoryPad.openScriptImportModal()" title="Impor atau ganti naskah dari berkas">
                  <span class="material-symbols-outlined text-[16px]" aria-hidden="true">upload_file</span>
                  <span>Impor Naskah</span>
                </button>
                <button type="button" class="sp-btn sp-btn-primary sp-btn-compact lg:hidden" onclick="StoryPad.openAudioPanel(StoryPad.state.activeDialogueId, 'audio')">
                  <span class="material-symbols-outlined text-[16px]" aria-hidden="true">perm_media</span>
                  <span>Media &amp; Take</span>
                </button>
                <button type="button" class="sp-icon-btn" onclick="StoryPad.toggleTheme()" aria-label="Ganti Tema Kertas atau Gelap" title="Ganti Tema Tampilan">
                  <span class="material-symbols-outlined text-[19px]" aria-hidden="true">contrast</span>
                </button>
                <button type="button" class="sp-icon-btn" onclick="StoryPad.openViewSettings()" aria-label="Pengaturan Tampilan Skrip" title="Pengaturan Tampilan">
                  <span class="material-symbols-outlined text-[19px]" aria-hidden="true">tune</span>
                </button>
              </div>
            </header>

            <div class="screen-content-wrap">
              <!-- Dynamic Project Switcher & Active Role Mode -->
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 overflow-x-auto" id="script-project-switcher" role="group" aria-label="Pindah proyek naskah"></div>
                <div class="flex items-center gap-2">
                  <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact sm:hidden" onclick="StoryPad.openAddLineModal()">
                    <span class="material-symbols-outlined text-[15px]" aria-hidden="true">playlist_add</span>
                    <span>+ Baris</span>
                  </button>
                  <span class="sp-badge sp-badge-neutral font-mono" id="script-role-indicator">Peran: Script Supv</span>
                </div>
              </div>

              <!-- Multi-Scene Navigation Strip -->
              <div class="flex items-center gap-1.5 overflow-x-auto pb-1" id="script-scene-switcher" role="tablist" aria-label="Pilih adegan (scene) naskah"></div>

              <!-- Scene Slugline, Coverage & Quick Filter Strip -->
              <div class="sp-panel p-4 flex flex-col gap-2.5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="sp-badge sp-badge-blue font-mono" id="script-slug-badge">SCENE 01</span>
                    <span class="font-mono text-xs font-bold tabular-nums" id="script-header-tc" style="color: var(--good-text);">00:00:00</span>
                    <span class="sp-badge sp-badge-good font-mono tabular-nums" id="script-scene-coverage-badge">0 / 0 GOOD TAKE</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-xs font-semibold" id="script-take-info" style="color: var(--text-secondary);">0 TAKE</span>
                  </div>
                </div>
                <h2 class="font-mono text-sm md:text-base font-bold uppercase tracking-wide break-words m-0" id="script-scene-title" style="color: var(--text-primary);">
                  MEMUAT ADEGAN...
                </h2>
                <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div class="text-xs font-mono" id="script-filter-summary" style="color: var(--text-secondary);"></div>
                  <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter cepat tampilan naskah">
                    <button type="button" id="inline-chip-focusdialog" class="script-filter-chip" aria-pressed="false" onclick="StoryPad.toggleInlineViewFilter('focusDialogueMode')">
                      Fokus Dialog
                    </button>
                    <button type="button" id="inline-chip-goodtake" class="script-filter-chip" aria-pressed="false" onclick="StoryPad.toggleInlineViewFilter('filterGoodTakeOnly')">
                      Good Take Saja
                    </button>
                    <button type="button" id="inline-chip-filecode" class="script-filter-chip is-active" aria-pressed="true" onclick="StoryPad.toggleInlineViewFilter('showFileCode')">
                      Kode File
                    </button>
                  </div>
                </div>
              </div>

              <!-- Editorial Screenplay Workspace -->
              <div class="script-paper-sheet p-4 md:p-6 flex flex-col gap-4">
                <div class="pb-3 border-b flex flex-wrap items-center justify-between gap-2" style="border-color: var(--border-flat);">
                  <p class="font-mono text-xs md:text-sm font-bold uppercase tracking-wide m-0" id="script-box-scenename" style="color: var(--text-script);">
                    LEMBAR NASKAH INTERAKTIF
                  </p>
                  <span class="font-mono text-xs" style="color: var(--text-muted);">Klik baris dialog untuk memilih shot, unggah media, atau catat take</span>
                </div>

                <div class="flex flex-col gap-3 w-full" id="script-lines-container">
                  <div class="p-6 text-center text-xs font-mono" style="color: var(--text-secondary);">
                    Memuat baris naskah...
                  </div>
                </div>
              </div>
            </div>
          </section>
