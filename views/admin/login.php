<?php
declare(strict_types=1);

/**
 * Tampilan Layar Login Admin Studio (PHP Native)
 * Selaras dengan design system StoryPad (Production Slate Dark & Editorial Daylight)
 */
$themeMode = ($activeTheme ?? 'slate') === 'daylight' ? 'daylight' : 'slate';
$nextThemeLabel = $themeMode === 'daylight' ? 'Mode Slate Gelap' : 'Mode Kertas Editorial';
?>
<!DOCTYPE html>
<html lang="id" data-theme="<?= e($themeMode) ?>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title><?= e($pageTitle ?? 'Admin Login | StoryPad') ?></title>

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
</head>
<body class="min-h-screen flex flex-col" style="background-color: var(--app-bg); color: var(--text-primary);">
  <a href="#admin-login-main" class="skip-link">Lewati ke formulir login admin</a>

  <!-- Top Utility Header -->
  <header class="sp-topbar">
    <div class="flex items-center gap-3 min-w-0">
      <a href="index.php" class="flex items-center gap-2.5 no-underline min-w-0">
        <span class="w-8 h-8 rounded bg-[#0F1115] border border-[#373C4A] flex items-center justify-center shrink-0">
          <svg class="w-5 h-5 text-[#60A5FA]" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="6" y="16" width="36" height="26" rx="3" fill="#161920" stroke="#60A5FA" stroke-width="2.5"></rect>
            <path d="M6 18L13 6H42L36 18H6Z" fill="#1E222B" stroke="#60A5FA" stroke-width="2.5" stroke-linejoin="round"></path>
            <path d="M17 6L14 18M27 6L24 18M37 6L34 18" stroke="#34D399" stroke-width="2.5" stroke-linecap="round"></path>
          </svg>
        </span>
        <span class="font-sans text-sm font-bold truncate" style="color: var(--text-primary);">StoryPad</span>
      </a>
      <span class="sp-badge sp-badge-amber font-mono">ADMIN PORTAL</span>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <button type="button" id="admin-theme-toggle" class="sp-btn sp-btn-secondary sp-btn-compact" aria-label="Ganti Tema Tampilan">
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">contrast</span>
        <span class="hidden sm:inline" id="admin-theme-label"><?= e($nextThemeLabel) ?></span>
      </button>
      <a href="index.php" class="sp-btn sp-btn-secondary sp-btn-compact no-underline">
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
        <span>Login Kru</span>
      </a>
    </div>
  </header>

  <main id="admin-login-main" tabindex="-1" class="flex-1 flex items-center justify-center p-4 md:p-8">
    <div class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
      <!-- Left Column: Studio Control Identity & Real System Status -->
      <section class="md:col-span-6 sp-panel p-6 md:p-8 flex flex-col justify-between gap-6" aria-labelledby="admin-portal-heading">
        <div>
          <div class="flex items-center gap-3 mb-5">
            <div class="w-11 h-11 rounded bg-[#0F1115] border border-[#373C4A] flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[24px] text-[#FBBF24]" aria-hidden="true">admin_panel_settings</span>
            </div>
            <div>
              <h1 id="admin-portal-heading" class="font-sans text-xl md:text-2xl font-bold tracking-tight" style="color: var(--text-primary);">
                Studio Control Room
              </h1>
              <p class="font-sans text-xs md:text-sm" style="color: var(--text-secondary);">
                Administrasi Kru, Proyek, dan Sinkronisasi Supabase
              </p>
            </div>
          </div>

          <p class="font-sans text-sm leading-relaxed mb-6" style="color: var(--text-secondary);">
            Panel khusus produser, koordinator produksi, dan admin teknis studio untuk menambah atau mencabut akses kru, mengatur daftar proyek aktif, serta memantau konektivitas database.
          </p>

          <!-- Real Server & Database Status Block -->
          <div class="sp-panel-muted p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-sans text-xs font-bold uppercase tracking-wide" style="color: var(--text-secondary);">
                Status Server &amp; Koneksi
              </h2>
              <?php if ($supabaseReachable): ?>
                <span class="sp-badge sp-badge-good font-mono">Supabase Aktif</span>
              <?php else: ?>
                <span class="sp-badge sp-badge-amber font-mono">Offline / Tertunda</span>
              <?php endif; ?>
            </div>

            <dl class="divide-y text-xs" style="border-color: var(--border-flat);">
              <div class="py-2 flex items-center justify-between gap-2">
                <dt style="color: var(--text-muted);">Engine Backend</dt>
                <dd class="font-mono font-semibold tabular-nums" style="color: var(--text-primary);">PHP <?= e(PHP_VERSION) ?> Native</dd>
              </div>
              <div class="py-2 flex items-center justify-between gap-2">
                <dt style="color: var(--text-muted);">Database Target</dt>
                <dd class="font-mono font-semibold" style="color: var(--text-primary);">Supabase (<?= e($config['supabase']['project_id'] ?? '-') ?>)</dd>
              </div>
              <div class="py-2 flex items-center justify-between gap-2">
                <dt style="color: var(--text-muted);">Latensi Probe</dt>
                <dd class="font-mono font-semibold tabular-nums" style="color: <?= $supabaseReachable ? 'var(--good-text)' : 'var(--amber-text)' ?>;">
                  <?= $supabaseReachable ? e($probeLatencyMs . ' ms') : 'Tidak terjangkau' ?>
                </dd>
              </div>
              <div class="py-2 flex items-center justify-between gap-2">
                <dt style="color: var(--text-muted);">Isolasi Sesi</dt>
                <dd class="font-sans font-medium" style="color: var(--text-primary);">Terpisah dari sesi kru lapangan</dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="pt-4 border-t flex items-center justify-between gap-2 text-xs" style="border-color: var(--border-flat); color: var(--text-muted);">
          <span class="font-mono"><?= e($config['studio_name'] ?? 'StoryPad Studio') ?></span>
          <span class="font-mono">Build <?= e($config['app_version'] ?? '4.0.0-php') ?></span>
        </div>
      </section>

      <!-- Right Column: Admin Authentication Form -->
      <section class="md:col-span-6 sp-panel p-6 md:p-8 flex flex-col justify-between gap-6" aria-labelledby="admin-form-heading">
        <div>
          <h2 id="admin-form-heading" class="font-sans text-lg font-bold mb-1" style="color: var(--text-primary);">
            Masuk sebagai Admin Studio
          </h2>
          <p class="font-sans text-xs mb-5" style="color: var(--text-secondary);">
            Masukkan kredensial admin terdaftar. Verifikasi mendukung Supabase Auth maupun akun admin lokal.
          </p>

          <?php if ($errorMsg !== ''): ?>
            <div class="mb-4 p-3 rounded border text-xs font-medium flex items-start gap-2" role="alert" style="background-color: var(--red-tint); border-color: var(--red-tint-border); color: var(--red-text);">
              <span class="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">error</span>
              <span><?= e($errorMsg) ?></span>
            </div>
          <?php endif; ?>

          <?php if ($statusMsg !== ''): ?>
            <div class="mb-4 p-3 rounded border text-xs font-medium flex items-start gap-2" role="status" style="background-color: var(--good-tint); border-color: var(--good-tint-border); color: var(--good-text);">
              <span class="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">check_circle</span>
              <span><?= e($statusMsg) ?></span>
            </div>
          <?php endif; ?>

          <form method="post" action="admin-login.php" id="admin-login-form" class="flex flex-col gap-4" novalidate>
            <input type="hidden" name="csrf_token" value="<?= e($csrfToken) ?>">
            <input type="hidden" name="action" value="login">

            <div class="flex flex-col gap-1.5">
              <label for="admin-email" class="font-sans text-xs font-semibold" style="color: var(--text-primary);">
                Email Admin
              </label>
              <input
                type="email"
                id="admin-email"
                name="email"
                value="<?= e($submittedEmail) ?>"
                class="sp-input"
                placeholder="admin@storypad.local"
                autocomplete="username"
                required
              >
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="admin-password" class="font-sans text-xs font-semibold" style="color: var(--text-primary);">
                Kata Sandi
              </label>
              <div class="relative flex items-center">
                <input
                  type="password"
                  id="admin-password"
                  name="password"
                  class="sp-input pr-12"
                  placeholder="Masukkan kata sandi admin"
                  autocomplete="current-password"
                  required
                >
                <button
                  type="button"
                  id="toggle-admin-password"
                  class="absolute right-1.5 w-10 h-10 flex items-center justify-center rounded bg-transparent border-0"
                  style="color: var(--text-secondary);"
                  aria-label="Tampilkan kata sandi"
                  aria-pressed="false"
                >
                  <span class="material-symbols-outlined text-[19px]" id="toggle-password-icon" aria-hidden="true">visibility</span>
                </button>
              </div>
            </div>

            <p id="admin-client-error" class="hidden font-sans text-xs font-medium" role="alert" style="color: var(--red-text);"></p>

            <button type="submit" id="admin-submit-btn" class="sp-btn sp-btn-primary w-full btn-press mt-1">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">lock_open</span>
              <span>Masuk ke Panel Admin</span>
            </button>
          </form>

          <!-- Configuration Reference (tanpa kredensial hardcoded) -->
          <details class="mt-5 sp-panel-muted p-3 text-xs">
            <summary class="font-sans font-semibold select-none" style="color: var(--text-primary);">
              Konfigurasi Akses Admin
            </summary>
            <div class="mt-2.5 flex flex-col gap-1.5 font-sans text-[11px]" style="color: var(--text-secondary);">
              <p>
                Kredensial admin dikonfigurasi melalui environment variable (<code class="font-mono">STORYPAD_ADMIN_EMAIL</code> &amp; <code class="font-mono">STORYPAD_ADMIN_PASSWORD_HASH</code> pada <code class="font-mono">.env</code>) atau akun terdaftar di Supabase Auth.
              </p>
            </div>
          </details>
        </div>

        <div class="pt-4 border-t flex items-center justify-between gap-2" style="border-color: var(--border-flat);">
          <a href="index.php" class="font-sans text-xs font-semibold hover:underline no-underline flex items-center gap-1" style="color: var(--primary-text);">
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
            <span>Kembali ke Workspace Kru</span>
          </a>
          <span class="font-mono text-[11px]" style="color: var(--text-muted);">CSRF Protected</span>
        </div>
      </section>
    </div>
  </main>

  <script>
    (function () {
      const root = document.documentElement;
      const themeBtn = document.getElementById('admin-theme-toggle');
      const themeLabel = document.getElementById('admin-theme-label');
      const passInput = document.getElementById('admin-password');
      const togglePassBtn = document.getElementById('toggle-admin-password');
      const togglePassIcon = document.getElementById('toggle-password-icon');
      const form = document.getElementById('admin-login-form');
      const emailInput = document.getElementById('admin-email');
      const clientErr = document.getElementById('admin-client-error');

      function applyAdminTheme(theme) {
        const next = theme === 'daylight' ? 'daylight' : 'slate';
        root.setAttribute('data-theme', next);
        if (themeLabel) {
          themeLabel.textContent = next === 'daylight' ? 'Mode Slate Gelap' : 'Mode Kertas Editorial';
        }
        try { localStorage.setItem('storypad_theme', next); } catch (e) {}
        fetch('api/session.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: next })
        }).catch(() => {});
      }

      if (themeBtn) {
        themeBtn.addEventListener('click', () => {
          const cur = root.getAttribute('data-theme') === 'daylight' ? 'daylight' : 'slate';
          applyAdminTheme(cur === 'daylight' ? 'slate' : 'daylight');
        });
      }

      if (togglePassBtn && passInput) {
        togglePassBtn.addEventListener('click', () => {
          const showing = passInput.type === 'text';
          passInput.type = showing ? 'password' : 'text';
          togglePassBtn.setAttribute('aria-pressed', String(!showing));
          togglePassBtn.setAttribute('aria-label', showing ? 'Tampilkan kata sandi' : 'Sembunyikan kata sandi');
          if (togglePassIcon) {
            togglePassIcon.textContent = showing ? 'visibility' : 'visibility_off';
          }
        });
      }

      if (form) {
        form.addEventListener('submit', (ev) => {
          const email = emailInput ? emailInput.value.trim() : '';
          const pass = passInput ? passInput.value : '';
          if (!email || !email.includes('@') || !pass) {
            ev.preventDefault();
            if (clientErr) {
              clientErr.textContent = 'Masukkan alamat email admin yang valid dan kata sandi.';
              clientErr.classList.remove('hidden');
            }
          }
        });
      }
    })();
  </script>
</body>
</html>

