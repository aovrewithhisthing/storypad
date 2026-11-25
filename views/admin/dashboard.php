<?php
declare(strict_types=1);

/**
 * Tampilan Panel Admin Studio StoryPad (PHP Native + Supabase)
 * Mematuhi StoryPad Production Slate / Editorial Daylight design system.
 */
$nextThemeLabel = ($activeTheme ?? 'slate') === 'daylight' ? 'Mode Slate Gelap' : 'Mode Kertas Editorial';
$projectsCount = count($initialData['projects'] ?? []);
$crewCount = count($initialData['crew_profiles'] ?? []);
$takesCount = count($initialData['takes'] ?? []);
$notifCount = count($initialData['notifications'] ?? []);
?>
<!DOCTYPE html>
<html lang="id" data-theme="<?= e($activeTheme ?? 'slate') ?>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title><?= e($pageTitle ?? 'Panel Admin Studio | StoryPad') ?></title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet">

  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <script id="tailwind-config">
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            "primary": "#2563EB",
            "secondary": "#047857",
            "tertiary": "#D97706",
            "error": "#DC2626"
          },
          fontFamily: {
            sans: ["Inter", "sans-serif"],
            mono: ["JetBrains Mono", "monospace"]
          }
        }
      }
    };
  </script>
  <link rel="stylesheet" href="app.css">
  <script>
    window.STORYPAD_ADMIN_BOOT = <?= $adminBootJson ?>;
  </script>
</head>
<body class="min-h-screen flex flex-col" style="background-color: var(--app-bg); color: var(--text-primary);">
  <a href="#admin-main-content" class="skip-link">Lewati ke konten panel admin</a>

  <!-- Top Control Bar -->
  <header class="sp-topbar">
    <div class="flex items-center gap-3 min-w-0">
      <div class="w-9 h-9 rounded bg-[#0F1115] border border-[#373C4A] flex items-center justify-center shrink-0">
        <span class="material-symbols-outlined text-[20px] text-[#FBBF24]" aria-hidden="true">admin_panel_settings</span>
      </div>
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h1 class="font-sans text-sm md:text-base font-bold tracking-tight truncate" style="color: var(--text-primary);">
            Studio Admin Console
          </h1>
          <span class="sp-badge <?= $supabaseConnected ? 'sp-badge-good' : 'sp-badge-amber' ?> font-mono hidden sm:inline-flex" id="admin-conn-badge">
            <?= $supabaseConnected ? 'Supabase Terhubung' : 'Koneksi Tertunda' ?>
          </span>
        </div>
        <p class="font-mono text-[11px] truncate" style="color: var(--text-secondary);">
          <?= e($admin['name'] ?? 'Admin Studio') ?> | <?= e($admin['email'] ?? '') ?>
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <button type="button" id="admin-refresh-btn" class="sp-icon-btn" aria-label="Muat ulang data dari Supabase" title="Muat ulang data">
        <span class="material-symbols-outlined text-[19px]" aria-hidden="true">refresh</span>
      </button>
      <button type="button" id="admin-theme-btn" class="sp-icon-btn" aria-label="Ganti Tema Tampilan" title="<?= e($nextThemeLabel) ?>">
        <span class="material-symbols-outlined text-[19px]" aria-hidden="true">contrast</span>
      </button>
      <a href="index.php?page=projects&amp;import=1" class="sp-btn sp-btn-primary sp-btn-compact no-underline hidden md:inline-flex">
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">upload_file</span>
        <span>Impor Naskah (.docx)</span>
      </a>
      <a href="index.php" class="sp-btn sp-btn-secondary sp-btn-compact no-underline hidden sm:inline-flex">
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">movie</span>
        <span>Workspace Kru</span>
      </a>
      <form method="post" action="admin-login.php" class="m-0">
        <input type="hidden" name="csrf_token" value="<?= e($csrfToken) ?>">
        <input type="hidden" name="action" value="logout">
        <button type="submit" id="admin-logout-btn" class="sp-btn sp-btn-danger sp-btn-compact">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">logout</span>
          <span class="hidden sm:inline">Keluar</span>
        </button>
      </form>
    </div>
  </header>

  <main id="admin-main-content" tabindex="-1" class="flex-1 w-full max-w-[1280px] mx-auto p-4 md:p-6 flex flex-col gap-5">
    <!-- Connection Error / Retry Banner -->
    <div id="admin-error-banner" class="<?= $supabaseConnected ? 'hidden ' : '' ?>sp-panel p-4 flex flex-wrap items-center justify-between gap-3" role="alert" style="background-color: var(--red-tint); border-color: var(--red-tint-border); color: var(--red-text);">
      <div class="flex items-center gap-2 text-xs font-medium">
        <span class="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">warning</span>
        <span id="admin-error-text"><?= e($supabaseError !== '' ? $supabaseError : 'Koneksi ke Supabase terputus.') ?></span>
      </div>
      <button type="button" id="admin-retry-btn" class="sp-btn sp-btn-secondary sp-btn-compact">Coba Hubungkan Ulang</button>
    </div>

    <!-- Real KPI Summary Strip (Strictly backed by Supabase response) -->
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Ringkasan Produksi Studio">
      <article class="sp-panel p-4 flex flex-col gap-1">
        <span class="font-sans text-xs font-medium" style="color: var(--text-secondary);">Total Proyek</span>
        <span class="font-mono text-2xl font-bold tabular-nums" id="kpi-projects" style="color: var(--text-primary);"><?= $supabaseConnected ? e((string) $projectsCount) : '--' ?></span>
        <span class="font-mono text-[11px]" style="color: var(--text-muted);">Tabel public.projects</span>
      </article>

      <article class="sp-panel p-4 flex flex-col gap-1">
        <span class="font-sans text-xs font-medium" style="color: var(--text-secondary);">Kru Terdaftar</span>
        <span class="font-mono text-2xl font-bold tabular-nums" id="kpi-crew" style="color: var(--primary-text);"><?= $supabaseConnected ? e((string) $crewCount) : '--' ?></span>
        <span class="font-mono text-[11px]" style="color: var(--text-muted);">Tabel public.crew_profiles</span>
      </article>

      <article class="sp-panel p-4 flex flex-col gap-1">
        <span class="font-sans text-xs font-medium" style="color: var(--text-secondary);">Total Take Tercatat</span>
        <span class="font-mono text-2xl font-bold tabular-nums" id="kpi-takes" style="color: var(--good-text);"><?= $supabaseConnected ? e((string) $takesCount) : '--' ?></span>
        <span class="font-mono text-[11px]" style="color: var(--text-muted);">Tabel public.takes</span>
      </article>

      <article class="sp-panel p-4 flex flex-col gap-1">
        <span class="font-sans text-xs font-medium" style="color: var(--text-secondary);">Backend &amp; Latensi</span>
        <span class="font-mono text-2xl font-bold tabular-nums" id="kpi-latency" style="color: var(--text-primary);"><?= $supabaseConnected ? e($initialLatencyMs . ' ms') : 'Offline' ?></span>
        <span class="font-mono text-[11px]" style="color: var(--text-muted);">PHP <?= e(PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION) ?> Native</span>
      </article>
    </section>

    <!-- Primary Tab Navigation -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-1.5 overflow-x-auto" role="tablist" aria-label="Bagian Administrasi Studio">
        <button type="button" role="tab" id="tab-btn-crew" aria-controls="tab-panel-crew" aria-selected="true" class="project-category-btn is-active" data-admin-tab="crew">
          Manajemen Kru (<span id="tab-count-crew"><?= e((string) $crewCount) ?></span>)
        </button>
        <button type="button" role="tab" id="tab-btn-projects" aria-controls="tab-panel-projects" aria-selected="false" class="project-category-btn" data-admin-tab="projects">
          Manajemen Proyek (<span id="tab-count-projects"><?= e((string) $projectsCount) ?></span>)
        </button>
        <button type="button" role="tab" id="tab-btn-system" aria-controls="tab-panel-system" aria-selected="false" class="project-category-btn" data-admin-tab="system">
          Status Sistem &amp; Log (<span id="tab-count-notifs"><?= e((string) $notifCount) ?></span>)
        </button>
      </div>

      <a href="index.php" class="sp-btn sp-btn-secondary sp-btn-compact no-underline sm:hidden">
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">movie</span>
        <span>Workspace Kru</span>
      </a>
    </div>

    <!-- ========================================== -->
    <!-- TAB 1: MANAJEMEN KRU -->
    <!-- ========================================== -->
    <section id="tab-panel-crew" role="tabpanel" aria-labelledby="tab-btn-crew" class="sp-panel p-4 md:p-5 flex flex-col gap-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="sp-section-heading">Daftar Kru Produksi</h2>
          <p class="font-sans text-xs mt-0.5" style="color: var(--text-secondary);">Kelola akun kru dan izin akses peran yang tampil pada layar login StoryPad.</p>
        </div>
        <button type="button" id="btn-open-add-crew" class="sp-btn sp-btn-primary sp-btn-compact shrink-0">
          <span class="material-symbols-outlined text-[17px]" aria-hidden="true">person_add</span>
          <span>Tambah Kru Baru</span>
        </button>
      </div>

      <div class="relative flex items-center max-w-md">
        <label for="admin-crew-search" class="sr-only">Cari nama, email, atau badge kru</label>
        <span class="material-symbols-outlined absolute left-3 text-[18px]" style="color: var(--text-muted);" aria-hidden="true">search</span>
        <input type="text" id="admin-crew-search" class="sp-input pl-10" placeholder="Cari nama kru, email, atau nomor badge...">
      </div>

      <!-- Loading State -->
      <div id="crew-loading-state" class="hidden sp-panel-muted p-6 text-center text-xs font-mono" style="color: var(--text-secondary);">
        Memuat data kru dari Supabase...
      </div>

      <!-- Empty State -->
      <div id="crew-empty-state" class="hidden sp-panel-muted p-6 text-center flex flex-col items-center gap-2">
        <p class="font-sans text-sm font-semibold" style="color: var(--text-primary);">Belum ada data kru yang cocok</p>
        <p class="font-sans text-xs" style="color: var(--text-secondary);">Tambahkan kru produksi baru atau ubah kata kunci pencarian.</p>
      </div>

      <!-- Crew Table -->
      <div class="admin-table-wrap overflow-x-auto rounded border" style="border-color: var(--border-flat);">
        <table class="admin-table w-full text-left border-collapse">
          <thead>
            <tr style="background-color: var(--panel-lowest); border-bottom: 1px solid var(--border-flat);">
              <th class="py-2.5 px-3 font-sans text-xs font-semibold" style="color: var(--text-secondary);">Kru</th>
              <th class="py-2.5 px-3 font-sans text-xs font-semibold" style="color: var(--text-secondary);">Badge &amp; Studio</th>
              <th class="py-2.5 px-3 font-sans text-xs font-semibold" style="color: var(--text-secondary);">Izin Peran</th>
              <th class="py-2.5 px-3 font-sans text-xs font-semibold text-right" style="color: var(--text-secondary);">Aksi</th>
            </tr>
          </thead>
          <tbody id="admin-crew-tbody" class="divide-y" style="border-color: var(--border-flat);"></tbody>
        </table>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- TAB 2: MANAJEMEN PROYEK -->
    <!-- ========================================== -->
    <section id="tab-panel-projects" role="tabpanel" aria-labelledby="tab-btn-projects" class="hidden sp-panel p-4 md:p-5 flex flex-col gap-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="sp-section-heading">Daftar Proyek Produksi</h2>
          <p class="font-sans text-xs mt-0.5" style="color: var(--text-secondary);">Atur kode produksi, format, frame rate, hari syuting, dan status sinkronisasi NLE.</p>
        </div>
        <button type="button" id="btn-open-add-project" class="sp-btn sp-btn-primary sp-btn-compact shrink-0">
          <span class="material-symbols-outlined text-[17px]" aria-hidden="true">add_box</span>
          <span>Buat Proyek Baru</span>
        </button>
      </div>

      <div class="relative flex items-center max-w-md">
        <label for="admin-project-search" class="sr-only">Cari kode atau judul proyek</label>
        <span class="material-symbols-outlined absolute left-3 text-[18px]" style="color: var(--text-muted);" aria-hidden="true">search</span>
        <input type="text" id="admin-project-search" class="sp-input pl-10" placeholder="Cari kode proyek, judul, kategori, atau FPS...">
      </div>

      <div id="projects-empty-state" class="hidden sp-panel-muted p-6 text-center flex flex-col items-center gap-2">
        <p class="font-sans text-sm font-semibold" style="color: var(--text-primary);">Tidak ada proyek yang ditemukan</p>
        <p class="font-sans text-xs" style="color: var(--text-secondary);">Tambahkan proyek produksi baru atau bersihkan kata kunci pencarian.</p>
      </div>

      <div class="admin-table-wrap overflow-x-auto rounded border" style="border-color: var(--border-flat);">
        <table class="admin-table w-full text-left border-collapse">
          <thead>
            <tr style="background-color: var(--panel-lowest); border-bottom: 1px solid var(--border-flat);">
              <th class="py-2.5 px-3 font-sans text-xs font-semibold" style="color: var(--text-secondary);">Kode &amp; Judul</th>
              <th class="py-2.5 px-3 font-sans text-xs font-semibold" style="color: var(--text-secondary);">Format &amp; Teknis</th>
              <th class="py-2.5 px-3 font-sans text-xs font-semibold" style="color: var(--text-secondary);">Status Sync</th>
              <th class="py-2.5 px-3 font-sans text-xs font-semibold text-right" style="color: var(--text-secondary);">Aksi</th>
            </tr>
          </thead>
          <tbody id="admin-projects-tbody" class="divide-y" style="border-color: var(--border-flat);"></tbody>
        </table>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- TAB 3: STATUS SISTEM & NOTIFIKASI -->
    <!-- ========================================== -->
    <section id="tab-panel-system" role="tabpanel" aria-labelledby="tab-btn-system" class="hidden grid grid-cols-1 lg:grid-cols-12 gap-4">
      <article class="lg:col-span-5 sp-panel p-5 flex flex-col gap-4">
        <div class="flex items-center justify-between gap-2 pb-2 border-b" style="border-color: var(--border-flat);">
          <h2 class="sp-section-heading">Diagnostik PHP &amp; Supabase</h2>
          <button type="button" id="btn-health-check" class="sp-btn sp-btn-secondary sp-btn-compact">
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">network_check</span>
            <span>Uji Koneksi</span>
          </button>
        </div>

        <dl class="divide-y text-xs" style="border-color: var(--border-flat);">
          <div class="py-2.5 flex items-center justify-between gap-2">
            <dt style="color: var(--text-secondary);">Runtime PHP</dt>
            <dd class="font-mono font-semibold" style="color: var(--text-primary);">PHP <?= e(PHP_VERSION) ?></dd>
          </div>
          <div class="py-2.5 flex items-center justify-between gap-2">
            <dt style="color: var(--text-secondary);">Versi Aplikasi</dt>
            <dd class="font-mono font-semibold" style="color: var(--text-primary);"><?= e($config['app_version'] ?? '3.8.4-php') ?></dd>
          </div>
          <div class="py-2.5 flex items-center justify-between gap-2">
            <dt style="color: var(--text-secondary);">Project ID Supabase</dt>
            <dd class="font-mono font-semibold" style="color: var(--text-primary);"><?= e($config['supabase']['project_id'] ?? '-') ?></dd>
          </div>
          <div class="py-2.5 flex items-center justify-between gap-2">
            <dt style="color: var(--text-secondary);">Sumber Login Admin</dt>
            <dd class="font-mono font-semibold uppercase" style="color: var(--primary-text);"><?= e($admin['auth_source'] ?? 'local') ?></dd>
          </div>
          <div class="py-2.5 flex items-center justify-between gap-2">
            <dt style="color: var(--text-secondary);">Hasil Probe Terakhir</dt>
            <dd class="font-mono font-semibold tabular-nums" id="diag-health-result" style="color: <?= $supabaseConnected ? 'var(--good-text)' : 'var(--amber-text)' ?>;">
              <?= $supabaseConnected ? e('HTTP 200 (' . $initialLatencyMs . ' ms)') : 'Belum terhubung' ?>
            </dd>
          </div>
        </dl>
      </article>

      <article class="lg:col-span-7 sp-panel p-5 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2 pb-2 border-b" style="border-color: var(--border-flat);">
          <h2 class="sp-section-heading">Log Notifikasi Produksi Terbaru</h2>
          <span class="font-mono text-xs" style="color: var(--text-muted);">public.notifications</span>
        </div>
        <div id="admin-notifications-list" class="flex flex-col gap-2"></div>
      </article>
    </section>
  </main>

  <!-- Backdrop Overlay -->
  <div class="bottom-sheet-overlay" id="admin-modal-overlay"></div>

  <!-- ========================================== -->
  <!-- MODAL: TAMBAH / EDIT KRU -->
  <!-- ========================================== -->
  <div class="bottom-sheet-drawer modal-dialog" id="modal-crew-form" role="dialog" aria-modal="true" aria-labelledby="modal-crew-title">
    <div class="bottom-sheet-handle"></div>
    <div class="bottom-sheet-content">
      <div class="flex items-center justify-between pb-2 border-b" style="border-color: var(--border-flat);">
        <h2 id="modal-crew-title" class="font-sans text-sm font-bold" style="color: var(--text-primary);">Tambah Kru Produksi</h2>
        <button type="button" class="sp-icon-btn" data-close-modal aria-label="Tutup formulir kru">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
        </button>
      </div>

      <form id="form-crew-editor" class="flex flex-col gap-3">
        <input type="hidden" id="crew-persona-key" value="">

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label for="crew-full-name" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">Nama Lengkap</label>
            <input type="text" id="crew-full-name" class="sp-input" placeholder="Masukkan nama lengkap kru" required>
          </div>
          <div class="flex flex-col gap-1">
            <label for="crew-email" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">Email Kru</label>
            <input type="email" id="crew-email" class="sp-input" placeholder="kru@kelompok10.local" required>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label for="crew-role-title" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">Jabatan Produksi</label>
            <input type="text" id="crew-role-title" class="sp-input" placeholder="Script Supervisor & Continuity" required>
          </div>
          <div class="flex flex-col gap-1">
            <label for="crew-id-badge" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">ID Badge</label>
            <input type="text" id="crew-id-badge" class="sp-input font-mono" placeholder="K10-101">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label for="crew-studio" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">Studio / Unit</label>
            <input type="text" id="crew-studio" class="sp-input" value="<?= e($config['studio_name'] ?? 'Kelompok 10') ?>">
          </div>
          <div class="flex flex-col gap-1">
            <label for="crew-prod-name" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">Proyek Utama</label>
            <input type="text" id="crew-prod-name" class="sp-input" value="JADI?">
          </div>
        </div>

        <fieldset class="sp-panel-muted p-3 flex flex-col gap-2">
          <legend class="font-sans text-xs font-bold px-1" style="color: var(--text-primary);">Izin Peran Aktif</legend>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <label class="flex items-center gap-2"><input type="checkbox" id="role-cb-script" checked> <span>Script Supervisor</span></label>
            <label class="flex items-center gap-2"><input type="checkbox" id="role-cb-editor"> <span>Video Editor</span></label>
            <label class="flex items-center gap-2"><input type="checkbox" id="role-cb-sound"> <span>Sound Recordist</span></label>
            <label class="flex items-center gap-2"><input type="checkbox" id="role-cb-director"> <span>Director / Producer</span></label>
          </div>
        </fieldset>

        <p id="crew-form-error" class="hidden font-sans text-xs font-medium" role="alert" style="color: var(--red-text);"></p>

        <div class="flex items-center justify-end gap-2 pt-2 border-t" style="border-color: var(--border-flat);">
          <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" data-close-modal>Batal</button>
          <button type="submit" id="btn-save-crew" class="sp-btn sp-btn-primary sp-btn-compact">Simpan ke Supabase</button>
        </div>
      </form>
    </div>
  </div>

  <!-- ========================================== -->
  <!-- MODAL: TAMBAH / EDIT PROYEK -->
  <!-- ========================================== -->
  <div class="bottom-sheet-drawer modal-dialog" id="modal-project-form" role="dialog" aria-modal="true" aria-labelledby="modal-project-title">
    <div class="bottom-sheet-handle"></div>
    <div class="bottom-sheet-content">
      <div class="flex items-center justify-between pb-2 border-b" style="border-color: var(--border-flat);">
        <h2 id="modal-project-title" class="font-sans text-sm font-bold" style="color: var(--text-primary);">Buat Proyek Produksi</h2>
        <button type="button" class="sp-icon-btn" data-close-modal aria-label="Tutup formulir proyek">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
        </button>
      </div>

      <form id="form-project-editor" class="flex flex-col gap-3">
        <input type="hidden" id="proj-id" value="">

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="flex flex-col gap-1">
            <label for="proj-code" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">Kode Proyek</label>
            <input type="text" id="proj-code" class="sp-input font-mono" placeholder="JADI-02" required>
          </div>
          <div class="sm:col-span-2 flex flex-col gap-1">
            <label for="proj-title" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">Judul Produksi</label>
            <input type="text" id="proj-title" class="sp-input" placeholder="Masukkan judul produksi" required>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="flex flex-col gap-1">
            <label for="proj-category" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">Kategori</label>
            <select id="proj-category" class="sp-input">
              <option value="Film Pendek">Film Pendek</option>
              <option value="Film Panjang">Film Panjang</option>
              <option value="Serial Web">Serial Web</option>
              <option value="TVC">TVC</option>
              <option value="Dokumenter">Dokumenter</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label for="proj-day" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">Hari Syuting</label>
            <input type="text" id="proj-day" class="sp-input" value="Day 01">
          </div>
          <div class="flex flex-col gap-1">
            <label for="proj-fps" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">Frame Rate</label>
            <input type="text" id="proj-fps" class="sp-input font-mono" value="24 fps">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label for="proj-draft" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">Versi Draft</label>
            <input type="text" id="proj-draft" class="sp-input" value="Draft v1.0 (Shooting Script)">
          </div>
          <div class="flex flex-col gap-1">
            <label for="proj-sync-status" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">Status Sync</label>
            <select id="proj-sync-status" class="sp-input">
              <option value="In Sync">In Sync</option>
              <option value="Review">Review</option>
              <option value="Sync Hub Ready">Sync Hub Ready</option>
            </select>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label for="proj-scene-title" class="font-sans text-xs font-semibold" style="color: var(--text-secondary);">Slugline Scene Aktif</label>
          <input type="text" id="proj-scene-title" class="sp-input font-mono" value="SCENE 01 - INT. STUDIO - SIANG">
        </div>

        <p id="proj-form-error" class="hidden font-sans text-xs font-medium" role="alert" style="color: var(--red-text);"></p>

        <div class="flex items-center justify-end gap-2 pt-2 border-t" style="border-color: var(--border-flat);">
          <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" data-close-modal>Batal</button>
          <button type="submit" id="btn-save-project" class="sp-btn sp-btn-primary sp-btn-compact">Simpan Proyek</button>
        </div>
      </form>
    </div>
  </div>

  <!-- ========================================== -->
  <!-- MODAL: KONFIRMASI HAPUS -->
  <!-- ========================================== -->
  <div class="bottom-sheet-drawer modal-dialog" id="modal-confirm-delete" role="dialog" aria-modal="true" aria-labelledby="modal-delete-title">
    <div class="bottom-sheet-handle"></div>
    <div class="bottom-sheet-content">
      <div class="flex items-center justify-between pb-2 border-b" style="border-color: var(--border-flat);">
        <h2 id="modal-delete-title" class="font-sans text-sm font-bold" style="color: var(--text-primary);">Konfirmasi Hapus Data</h2>
        <button type="button" class="sp-icon-btn" data-close-modal aria-label="Batalkan penghapusan">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
        </button>
      </div>
      <p id="modal-delete-desc" class="font-sans text-xs leading-relaxed" style="color: var(--text-secondary);">
        Data yang dihapus akan langsung hilang dari tabel Supabase.
      </p>
      <div class="flex items-center justify-end gap-2 pt-2 border-t" style="border-color: var(--border-flat);">
        <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" data-close-modal>Batal</button>
        <button type="button" id="btn-confirm-delete" class="sp-btn sp-btn-danger sp-btn-compact">Hapus Permanen</button>
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div class="toast-snackbar" id="admin-toast" role="status" aria-live="polite" aria-atomic="true">
    <span class="material-symbols-outlined text-[16px] text-[#34D399]" aria-hidden="true">check_circle</span>
    <span id="admin-toast-msg">Perubahan tersimpan</span>
  </div>

  <script>
    (function () {
      const boot = window.STORYPAD_ADMIN_BOOT || {};
      const state = {
        csrfToken: boot.csrfToken || '',
        data: boot.data || { projects: [], crew_profiles: [], takes: [], notifications: [] },
        crewSearch: '',
        projectSearch: '',
        pendingDelete: null,
        toastTimer: null
      };

      const el = (id) => document.getElementById(id);

      function escapeHtml(str) {
        return String(str ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function showToast(message) {
        const toast = el('admin-toast');
        const msg = el('admin-toast-msg');
        if (!toast || !msg) return;
        msg.textContent = message;
        toast.classList.add('show');
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
      }

      function openModal(modalId) {
        closeAllModals();
        const modal = el(modalId);
        const overlay = el('admin-modal-overlay');
        if (modal) modal.classList.add('open');
        if (overlay) overlay.classList.add('active');
      }

      function closeAllModals() {
        document.querySelectorAll('.modal-dialog.open').forEach((m) => m.classList.remove('open'));
        const overlay = el('admin-modal-overlay');
        if (overlay) overlay.classList.remove('active');
      }

      function updateKpis(latencyMs = null) {
        const projects = state.data.projects || [];
        const crew = state.data.crew_profiles || [];
        const takes = state.data.takes || [];
        const notifs = state.data.notifications || [];

        if (el('kpi-projects')) el('kpi-projects').textContent = String(projects.length);
        if (el('kpi-crew')) el('kpi-crew').textContent = String(crew.length);
        if (el('kpi-takes')) el('kpi-takes').textContent = String(takes.length);
        if (latencyMs !== null && el('kpi-latency')) el('kpi-latency').textContent = `${latencyMs} ms`;
        if (el('tab-count-crew')) el('tab-count-crew').textContent = String(crew.length);
        if (el('tab-count-projects')) el('tab-count-projects').textContent = String(projects.length);
        if (el('tab-count-notifs')) el('tab-count-notifs').textContent = String(notifs.length);
      }

      function renderCrewTable() {
        const tbody = el('admin-crew-tbody');
        const empty = el('crew-empty-state');
        if (!tbody) return;

        const q = state.crewSearch.trim().toLowerCase();
        const rows = (state.data.crew_profiles || []).filter((c) => {
          if (!q) return true;
          const hay = `${c.full_name || ''} ${c.email || ''} ${c.id_badge || ''} ${c.role_title || ''}`.toLowerCase();
          return hay.includes(q);
        });

        if (rows.length === 0) {
          tbody.innerHTML = '';
          if (empty) empty.classList.remove('hidden');
          return;
        }
        if (empty) empty.classList.add('hidden');

        tbody.innerHTML = rows.map((c) => {
          const roles = c.roles || {};
          const roleChips = [];
          if (roles.scriptSupervisor) roleChips.push('<span class="sp-badge sp-badge-blue">Script Supv</span>');
          if (roles.videoEditor) roleChips.push('<span class="sp-badge sp-badge-good">Editor</span>');
          if (roles.soundRecordist) roleChips.push('<span class="sp-badge sp-badge-amber">Sound</span>');
          if (roles.directorProducer) roleChips.push('<span class="sp-badge sp-badge-neutral">Director</span>');
          if (roleChips.length === 0) roleChips.push('<span class="sp-badge sp-badge-neutral">Umum</span>');

          return `
            <tr class="admin-table-row">
              <td class="py-3 px-3">
                <div class="flex items-center gap-2.5">
                  <span class="w-8 h-8 rounded bg-[#2563EB] text-white font-sans text-xs font-bold flex items-center justify-center shrink-0">${escapeHtml(c.initials || 'SP')}</span>
                  <div class="min-w-0">
                    <div class="font-sans text-xs font-bold" style="color: var(--text-primary);">${escapeHtml(c.full_name)}</div>
                    <div class="font-mono text-[11px]" style="color: var(--text-secondary);">${escapeHtml(c.email)}</div>
                  </div>
                </div>
              </td>
              <td class="py-3 px-3">
                <div class="font-mono text-xs font-semibold" style="color: var(--text-primary);">${escapeHtml(c.id_badge || '-')}</div>
                <div class="font-sans text-[11px]" style="color: var(--text-secondary);">${escapeHtml(c.role_title || '')}</div>
              </td>
              <td class="py-3 px-3">
                <div class="flex flex-wrap gap-1">${roleChips.join('')}</div>
              </td>
              <td class="py-3 px-3 text-right whitespace-nowrap">
                <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact mr-1" data-edit-crew="${escapeHtml(c.persona_key)}">Edit</button>
                <button type="button" class="sp-btn sp-btn-danger sp-btn-compact" data-delete-crew="${escapeHtml(c.persona_key)}" data-delete-label="${escapeHtml(c.full_name)}">Hapus</button>
              </td>
            </tr>
          `;
        }).join('');
      }

      function renderProjectsTable() {
        const tbody = el('admin-projects-tbody');
        const empty = el('projects-empty-state');
        if (!tbody) return;

        const q = state.projectSearch.trim().toLowerCase();
        const rows = (state.data.projects || []).filter((p) => {
          if (!q) return true;
          const hay = `${p.code || ''} ${p.title || ''} ${p.category || ''} ${p.fps || ''} ${p.sync_status || ''}`.toLowerCase();
          return hay.includes(q);
        });

        if (rows.length === 0) {
          tbody.innerHTML = '';
          if (empty) empty.classList.remove('hidden');
          return;
        }
        if (empty) empty.classList.add('hidden');

        tbody.innerHTML = rows.map((p) => {
          const syncClass = p.sync_status === 'In Sync'
            ? 'sp-badge-good'
            : (p.sync_status === 'Review' ? 'sp-badge-amber' : 'sp-badge-blue');

          return `
            <tr class="admin-table-row">
              <td class="py-3 px-3">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border" style="background-color: var(--panel-lowest); border-color: var(--border-flat); color: var(--text-secondary);">${escapeHtml(p.code)}</span>
                  <span class="font-sans text-xs font-bold" style="color: var(--text-primary);">${escapeHtml(p.title)}</span>
                </div>
                <div class="font-mono text-[11px] mt-0.5" style="color: var(--text-muted);">${escapeHtml(p.scene_title || p.draft || '')}</div>
              </td>
              <td class="py-3 px-3">
                <div class="font-sans text-xs font-medium" style="color: var(--text-primary);">${escapeHtml(p.category || '-')}</div>
                <div class="font-mono text-[11px] tabular-nums" style="color: var(--text-secondary);">${escapeHtml(p.day || 'Day 01')} | ${escapeHtml(p.fps || '24 fps')}</div>
              </td>
              <td class="py-3 px-3">
                <span class="sp-badge ${syncClass}">${escapeHtml(p.sync_status || 'Ready')}</span>
              </td>
              <td class="py-3 px-3 text-right whitespace-nowrap">
                <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact mr-1" data-edit-project="${escapeHtml(p.id)}">Edit</button>
                <button type="button" class="sp-btn sp-btn-danger sp-btn-compact" data-delete-project="${escapeHtml(p.id)}" data-delete-label="${escapeHtml(p.title)}">Hapus</button>
              </td>
            </tr>
          `;
        }).join('');
      }

      function renderNotifications() {
        const list = el('admin-notifications-list');
        if (!list) return;
        const items = state.data.notifications || [];
        if (items.length === 0) {
          list.innerHTML = '<p class="font-sans text-xs p-3 sp-panel-muted" style="color: var(--text-secondary);">Belum ada log notifikasi tercatat di Supabase.</p>';
          return;
        }
        list.innerHTML = items.map((n) => `
          <div class="sp-panel-muted p-3 flex flex-col gap-1">
            <div class="flex items-center justify-between gap-2">
              <span class="font-sans text-xs font-bold" style="color: var(--text-primary);">${escapeHtml(n.title)}</span>
              <span class="font-mono text-[11px]" style="color: var(--text-muted);">${escapeHtml(n.time_label || '')}</span>
            </div>
            <p class="font-sans text-xs" style="color: var(--text-secondary);">${escapeHtml(n.message)}</p>
          </div>
        `).join('');
      }

      async function reloadOverview() {
        const loading = el('crew-loading-state');
        if (loading) loading.classList.remove('hidden');
        try {
          const res = await fetch('api/admin.php?action=overview');
          const json = await res.json();
          if (!res.ok || !json.ok) {
            throw new Error(json.error || 'Gagal memuat data Supabase');
          }
          state.data = json.data;
          if (el('admin-error-banner')) el('admin-error-banner').classList.add('hidden');
          if (el('admin-conn-badge')) {
            el('admin-conn-badge').textContent = 'Supabase Terhubung';
            el('admin-conn-badge').className = 'sp-badge sp-badge-good font-mono hidden sm:inline-flex';
          }
          updateKpis(json.latency_ms);
          renderCrewTable();
          renderProjectsTable();
          renderNotifications();
          showToast('Data studio berhasil disinkronkan');
        } catch (err) {
          if (el('admin-error-text')) el('admin-error-text').textContent = err.message;
          if (el('admin-error-banner')) el('admin-error-banner').classList.remove('hidden');
        } finally {
          if (loading) loading.classList.add('hidden');
        }
      }

      // Tab Switching
      document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-admin-tab');
          document.querySelectorAll('[data-admin-tab]').forEach((b) => {
            const active = b === btn;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-selected', String(active));
          });
          ['crew', 'projects', 'system'].forEach((name) => {
            const panel = el(`tab-panel-${name}`);
            if (panel) panel.classList.toggle('hidden', name !== target);
          });
        });
      });

      // Theme Toggle
      if (el('admin-theme-btn')) {
        el('admin-theme-btn').addEventListener('click', () => {
          const cur = document.documentElement.getAttribute('data-theme') === 'daylight' ? 'daylight' : 'slate';
          const next = cur === 'daylight' ? 'slate' : 'daylight';
          document.documentElement.setAttribute('data-theme', next);
          try { localStorage.setItem('storypad_theme', next); } catch (e) {}
          fetch('api/session.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme: next })
          }).catch(() => {});
          showToast(next === 'slate' ? 'Tema Slate Gelap diaktifkan' : 'Tema Kertas Editorial diaktifkan');
        });
      }

      // Refresh & Retry
      if (el('admin-refresh-btn')) el('admin-refresh-btn').addEventListener('click', reloadOverview);
      if (el('admin-retry-btn')) el('admin-retry-btn').addEventListener('click', reloadOverview);

      // Search Filters
      if (el('admin-crew-search')) {
        el('admin-crew-search').addEventListener('input', (e) => {
          state.crewSearch = e.target.value;
          renderCrewTable();
        });
      }
      if (el('admin-project-search')) {
        el('admin-project-search').addEventListener('input', (e) => {
          state.projectSearch = e.target.value;
          renderProjectsTable();
        });
      }

      // Open Add Crew
      if (el('btn-open-add-crew')) {
        el('btn-open-add-crew').addEventListener('click', () => {
          el('modal-crew-title').textContent = 'Tambah Kru Produksi';
          el('crew-persona-key').value = '';
          el('crew-full-name').value = '';
          el('crew-email').value = '';
          el('crew-role-title').value = 'Script Supervisor & Continuity';
          el('crew-id-badge').value = '';
          el('crew-studio').value = boot.studioName || 'Kelompok 10';
          el('crew-prod-name').value = (state.data.projects && state.data.projects[0]) ? state.data.projects[0].title : 'JADI?';
          el('role-cb-script').checked = true;
          el('role-cb-editor').checked = false;
          el('role-cb-sound').checked = false;
          el('role-cb-director').checked = false;
          el('crew-form-error').classList.add('hidden');
          openModal('modal-crew-form');
        });
      }

      // Open Add Project
      if (el('btn-open-add-project')) {
        el('btn-open-add-project').addEventListener('click', () => {
          el('modal-project-title').textContent = 'Buat Proyek Produksi';
          el('proj-id').value = '';
          el('proj-code').value = '';
          el('proj-title').value = '';
          el('proj-category').value = 'Film Panjang';
          el('proj-day').value = 'Day 01';
          el('proj-fps').value = '24 fps';
          el('proj-draft').value = 'Draft v1.0 (Shooting Script)';
          el('proj-sync-status').value = 'In Sync';
          el('proj-scene-title').value = 'SCENE 01 - INT. STUDIO - SIANG';
          el('proj-form-error').classList.add('hidden');
          openModal('modal-project-form');
        });
      }

      // Table Edit / Delete Delegations
      document.addEventListener('click', (e) => {
        const editCrewBtn = e.target.closest('[data-edit-crew]');
        if (editCrewBtn) {
          const key = editCrewBtn.getAttribute('data-edit-crew');
          const crew = (state.data.crew_profiles || []).find((c) => c.persona_key === key);
          if (!crew) return;
          el('modal-crew-title').textContent = 'Edit Profil Kru';
          el('crew-persona-key').value = crew.persona_key || '';
          el('crew-full-name').value = crew.full_name || '';
          el('crew-email').value = crew.email || '';
          el('crew-role-title').value = crew.role_title || '';
          el('crew-id-badge').value = crew.id_badge || '';
          el('crew-studio').value = crew.studio || '';
          el('crew-prod-name').value = crew.prod_name || '';
          const r = crew.roles || {};
          el('role-cb-script').checked = !!r.scriptSupervisor;
          el('role-cb-editor').checked = !!r.videoEditor;
          el('role-cb-sound').checked = !!r.soundRecordist;
          el('role-cb-director').checked = !!r.directorProducer;
          el('crew-form-error').classList.add('hidden');
          openModal('modal-crew-form');
          return;
        }

        const delCrewBtn = e.target.closest('[data-delete-crew]');
        if (delCrewBtn) {
          const key = delCrewBtn.getAttribute('data-delete-crew');
          const label = delCrewBtn.getAttribute('data-delete-label') || key;
          state.pendingDelete = { type: 'crew', id: key, label };
          el('modal-delete-desc').textContent = `Hapus profil kru "${label}" dari tabel Supabase crew_profiles?`;
          openModal('modal-confirm-delete');
          return;
        }

        const editProjBtn = e.target.closest('[data-edit-project]');
        if (editProjBtn) {
          const id = editProjBtn.getAttribute('data-edit-project');
          const proj = (state.data.projects || []).find((p) => p.id === id);
          if (!proj) return;
          el('modal-project-title').textContent = 'Edit Proyek Produksi';
          el('proj-id').value = proj.id || '';
          el('proj-code').value = proj.code || '';
          el('proj-title').value = proj.title || '';
          el('proj-category').value = proj.category || 'Film Panjang';
          el('proj-day').value = proj.day || 'Day 01';
          el('proj-fps').value = proj.fps || '24 fps';
          el('proj-draft').value = proj.draft || '';
          el('proj-sync-status').value = proj.sync_status || 'In Sync';
          el('proj-scene-title').value = proj.scene_title || '';
          el('proj-form-error').classList.add('hidden');
          openModal('modal-project-form');
          return;
        }

        const delProjBtn = e.target.closest('[data-delete-project]');
        if (delProjBtn) {
          const id = delProjBtn.getAttribute('data-delete-project');
          const label = delProjBtn.getAttribute('data-delete-label') || id;
          state.pendingDelete = { type: 'project', id, label };
          el('modal-delete-desc').textContent = `Hapus proyek "${label}" dari tabel Supabase projects?`;
          openModal('modal-confirm-delete');
          return;
        }

        if (e.target.closest('[data-close-modal]')) {
          closeAllModals();
        }
      });

      // Save Crew Submit
      if (el('form-crew-editor')) {
        el('form-crew-editor').addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = el('btn-save-crew');
          const errEl = el('crew-form-error');
          errEl.classList.add('hidden');
          btn.disabled = true;
          btn.textContent = 'Menyimpan...';

          try {
            const res = await fetch('api/admin.php?action=save_crew', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': state.csrfToken
              },
              body: JSON.stringify({
                persona_key: el('crew-persona-key').value,
                full_name: el('crew-full-name').value,
                email: el('crew-email').value,
                role_title: el('crew-role-title').value,
                id_badge: el('crew-id-badge').value,
                studio: el('crew-studio').value,
                prod_name: el('crew-prod-name').value,
                roles: {
                  scriptSupervisor: el('role-cb-script').checked,
                  videoEditor: el('role-cb-editor').checked,
                  soundRecordist: el('role-cb-sound').checked,
                  directorProducer: el('role-cb-director').checked,
                  autoExportMeta: true
                }
              })
            });
            const json = await res.json();
            if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal menyimpan kru');
            closeAllModals();
            await reloadOverview();
            showToast('Data kru tersimpan ke Supabase');
          } catch (err) {
            errEl.textContent = err.message;
            errEl.classList.remove('hidden');
          } finally {
            btn.disabled = false;
            btn.textContent = 'Simpan ke Supabase';
          }
        });
      }

      // Save Project Submit
      if (el('form-project-editor')) {
        el('form-project-editor').addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = el('btn-save-project');
          const errEl = el('proj-form-error');
          errEl.classList.add('hidden');
          btn.disabled = true;
          btn.textContent = 'Menyimpan...';

          try {
            const res = await fetch('api/admin.php?action=save_project', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': state.csrfToken
              },
              body: JSON.stringify({
                id: el('proj-id').value,
                code: el('proj-code').value,
                title: el('proj-title').value,
                category: el('proj-category').value,
                day: el('proj-day').value,
                fps: el('proj-fps').value,
                draft: el('proj-draft').value,
                sync_status: el('proj-sync-status').value,
                scene_title: el('proj-scene-title').value
              })
            });
            const json = await res.json();
            if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal menyimpan proyek');
            closeAllModals();
            await reloadOverview();
            showToast('Proyek tersimpan ke Supabase');
          } catch (err) {
            errEl.textContent = err.message;
            errEl.classList.remove('hidden');
          } finally {
            btn.disabled = false;
            btn.textContent = 'Simpan Proyek';
          }
        });
      }

      // Confirm Delete
      if (el('btn-confirm-delete')) {
        el('btn-confirm-delete').addEventListener('click', async () => {
          if (!state.pendingDelete) return;
          const btn = el('btn-confirm-delete');
          btn.disabled = true;
          btn.textContent = 'Menghapus...';
          try {
            const isCrew = state.pendingDelete.type === 'crew';
            const endpoint = isCrew ? 'api/admin.php?action=delete_crew' : 'api/admin.php?action=delete_project';
            const body = isCrew ? { persona_key: state.pendingDelete.id } : { id: state.pendingDelete.id };
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': state.csrfToken
              },
              body: JSON.stringify(body)
            });
            const json = await res.json();
            if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal menghapus data');
            closeAllModals();
            await reloadOverview();
            showToast(`"${state.pendingDelete.label}" berhasil dihapus`);
          } catch (err) {
            showToast(err.message);
          } finally {
            btn.disabled = false;
            btn.textContent = 'Hapus Permanen';
            state.pendingDelete = null;
          }
        });
      }

      // Live Health Check
      if (el('btn-health-check')) {
        el('btn-health-check').addEventListener('click', async () => {
          const out = el('diag-health-result');
          if (out) out.textContent = 'Menguji...';
          try {
            const res = await fetch('api/admin.php?action=health_check');
            const json = await res.json();
            if (json.ok) {
              out.textContent = `HTTP ${json.status} (${json.latency_ms} ms) @ ${json.checked_at}`;
              out.style.color = 'var(--good-text)';
              if (el('kpi-latency')) el('kpi-latency').textContent = `${json.latency_ms} ms`;
              showToast(`Supabase aktif (${json.latency_ms} ms)`);
            } else {
              out.textContent = json.error || 'Gagal terhubung';
              out.style.color = 'var(--red-text)';
            }
          } catch (err) {
            out.textContent = 'Koneksi gagal';
            out.style.color = 'var(--red-text)';
          }
        });
      }

      // Overlay & Escape close
      if (el('admin-modal-overlay')) {
        el('admin-modal-overlay').addEventListener('click', closeAllModals);
      }
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllModals();
      });

      // Initial render
      renderCrewTable();
      renderProjectsTable();
      renderNotifications();
    })();
  </script>
</body>
</html>

