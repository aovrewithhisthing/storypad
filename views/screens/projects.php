<?php
declare(strict_types=1);

$projHidden = ($initialScreen ?? 'login') === 'projects' ? '' : ' hidden';
$projInitials = $session['user']['initials'] ?? 'KP';
?>
          <!-- ========================================== -->
          <!-- LAYAR 3: DAFTAR PROYEK & IMPOR NASKAH -->
          <!-- ========================================== -->
          <section class="screen-view<?= $projHidden ?> flex-col" id="screen-projects" aria-labelledby="projects-heading">
            <header class="sp-topbar">
              <div class="flex items-center gap-3 min-w-0">
                <h1 id="projects-heading" class="font-sans text-base md:text-lg font-bold tracking-tight truncate" style="color: var(--text-primary);">
                  Daftar Proyek &amp; Naskah
                </h1>
                <span class="sp-badge sp-badge-blue font-mono tabular-nums" id="projects-count-label">0 Aktif</span>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" class="sp-btn sp-btn-primary sp-btn-compact" onclick="StoryPad.openScriptImportModal()">
                  <span class="material-symbols-outlined text-[17px]" aria-hidden="true">upload_file</span>
                  <span class="hidden sm:inline">Tambah / Impor Naskah</span>
                  <span class="sm:hidden">Impor</span>
                </button>
                <button type="button" class="sp-icon-btn" onclick="StoryPad.toggleProjectSearch()" aria-label="Fokus atau Tutup Pencarian Proyek">
                  <span class="material-symbols-outlined text-[19px]" aria-hidden="true">search</span>
                </button>
                <button type="button" class="sp-icon-btn" onclick="StoryPad.openViewSettings()" aria-label="Pengaturan Tampilan">
                  <span class="material-symbols-outlined text-[19px]" aria-hidden="true">tune</span>
                </button>
                <button type="button" class="sp-icon-btn relative" onclick="StoryPad.openNotifications()" aria-label="Notifikasi">
                  <span class="material-symbols-outlined text-[19px]" aria-hidden="true">notifications</span>
                  <span class="notif-unread-dot hidden absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2563EB]" aria-hidden="true"></span>
                </button>
                <button type="button" class="sp-icon-btn font-sans text-xs font-bold" id="header-avatar-proj" onclick="StoryPad.navigate('profile', 'profile')" aria-label="Buka Profil Kru">
                  <?= e($projInitials) ?>
                </button>
              </div>
            </header>

            <div class="screen-content-wrap">
              <!-- Search & Dynamic Category Filter Toolbar -->
              <div class="sp-panel p-4 flex flex-col gap-3">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div id="project-search-bar" class="flex-1 min-w-0">
                    <label for="project-search-input" class="sr-only">Cari judul naskah, kode proyek, lokasi, atau format</label>
                    <div class="relative flex items-center">
                      <span class="material-symbols-outlined absolute left-3 text-[18px]" style="color: var(--text-muted);" aria-hidden="true">search</span>
                      <input type="text" id="project-search-input" placeholder="Cari judul naskah, kode proyek, lokasi, atau FPS..." class="sp-input pl-10 pr-10" oninput="StoryPad.filterProjects(this.value)">
                      <button type="button" onclick="StoryPad.clearProjectSearch()" aria-label="Hapus kata kunci pencarian" class="absolute right-1.5 w-9 h-9 flex items-center justify-center rounded bg-transparent border-0" style="color: var(--text-secondary);">
                        <span class="material-symbols-outlined text-[17px]" aria-hidden="true">close</span>
                      </button>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 overflow-x-auto" id="project-category-chips" role="group" aria-label="Filter kategori produksi">
                    <button type="button" class="project-category-btn is-active" onclick="StoryPad.filterProjectsByCategory('all', this)">Semua</button>
                  </div>
                </div>
              </div>

              <!-- Async Loading / Error State Region -->
              <div id="projects-status-banner" class="hidden sp-panel p-4" role="status" aria-live="polite"></div>

              <!-- Empty State for Search / Filter -->
              <div id="project-search-empty" class="hidden sp-panel p-6 text-center">
                <p class="font-sans text-sm font-semibold mb-1" id="project-empty-heading" style="color: var(--text-primary);">Tidak ada proyek yang cocok dengan filter aktif</p>
                <p class="font-sans text-xs mb-4" id="project-empty-desc" style="color: var(--text-secondary);">Ubah kata kunci pencarian, tampilkan semua kategori, atau impor dokumen naskah baru.</p>
                <div class="flex flex-wrap items-center justify-center gap-2">
                  <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.resetProjectFilters()">
                    Reset Filter &amp; Pencarian
                  </button>
                  <button type="button" class="sp-btn sp-btn-primary sp-btn-compact" onclick="StoryPad.openScriptImportModal()">
                    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">upload_file</span>
                    <span>Impor Naskah Baru</span>
                  </button>
                </div>
              </div>

              <!-- Dynamic Production Cards List (Rendered strictly from StoryPad.db.projects) -->
              <section class="flex flex-col gap-3" id="projects-cards-list" aria-label="Daftar proyek produksi">
                <div class="sp-panel p-5 text-xs font-mono" style="color: var(--text-secondary);">
                  Memuat daftar naskah dari database Supabase...
                </div>
              </section>

              <div class="sp-panel-muted p-4 flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-col gap-0.5">
                  <span class="font-sans text-xs font-semibold" style="color: var(--text-primary);">Konversi Dokumen Naskah Otomatis</span>
                  <span class="font-sans text-xs" style="color: var(--text-secondary);">Unggah file <code class="font-mono">.docx</code>, <code class="font-mono">.txt</code>, <code class="font-mono">.fountain</code>, atau tempel draf skrip untuk langsung dijadikan lembar kerja interaktif.</span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button type="button" class="sp-btn sp-btn-primary sp-btn-compact" onclick="StoryPad.openScriptImportModal()">
                    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">upload_file</span>
                    <span>Tambah / Impor Naskah</span>
                  </button>
                  <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.openViewSettings()">
                    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">display_settings</span>
                    <span>Pengaturan Tampilan</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
