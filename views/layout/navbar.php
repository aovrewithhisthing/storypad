<?php
declare(strict_types=1);

$navUserName = $session['user']['name'] ?? 'Kru Produksi';
$navProdName = $session['user']['prodName'] ?? 'JADI?';
$navHiddenClass = ($initialScreen ?? 'login') === 'login' ? ' hidden' : '';
$navThemeLabel = ($activeTheme ?? 'daylight') === 'slate' ? 'Mode Kertas Editorial' : 'Mode Slate Gelap';
?>
    <!-- ========================================== -->
    <!-- NAVIGATION RAIL (DESKTOP) / BOTTOM BAR (MOBILE) -->
    <!-- ========================================== -->
    <nav class="app-nav<?= $navHiddenClass ?>" id="floating-navbar" aria-label="Navigasi Utama StoryPad">
      <div class="app-nav-brand">
        <div class="w-9 h-9 rounded bg-[#1E222B] border border-[#373C4A] flex items-center justify-center shrink-0">
          <svg class="w-5 h-5 text-[#60A5FA]" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="6" y="16" width="36" height="26" rx="3" fill="#161920" stroke="#60A5FA" stroke-width="2.5"></rect>
            <path d="M6 18L13 6H42L36 18H6Z" fill="#1E222B" stroke="#60A5FA" stroke-width="2.5" stroke-linejoin="round"></path>
            <path d="M17 6L14 18M27 6L24 18M37 6L34 18" stroke="#34D399" stroke-width="2.5" stroke-linecap="round"></path>
          </svg>
        </div>
        <div class="app-nav-brand-sub min-w-0">
          <p class="font-sans text-sm font-bold text-[#F3F4F6] leading-tight truncate">StoryPad</p>
          <p class="font-mono text-[11px] text-[#A1A9B8] truncate"><?= e($config['studio_name'] ?? 'Kelompok 10') ?></p>
        </div>
      </div>

      <div class="app-nav-inner">
        <button type="button" class="nav-capsule-tab<?= ($initialScreen ?? '') === 'dashboard' ? ' active' : '' ?>" data-tab="home" onclick="StoryPad.navigate('dashboard', 'home')">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">dashboard</span>
          <span>Beranda</span>
        </button>

        <button type="button" class="nav-capsule-tab<?= ($initialScreen ?? '') === 'projects' ? ' active' : '' ?>" data-tab="project-list" onclick="StoryPad.navigate('projects', 'project-list')">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">movie</span>
          <span>Proyek</span>
        </button>

        <button type="button" class="nav-capsule-tab<?= ($initialScreen ?? '') === 'script-reader' ? ' active' : '' ?>" data-tab="script-reader" onclick="StoryPad.navigate('script-reader', 'script-reader')">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">edit_note</span>
          <span>Naskah</span>
        </button>

        <button type="button" class="nav-capsule-tab<?= ($initialScreen ?? '') === 'profile' ? ' active' : '' ?>" data-tab="profile" onclick="StoryPad.navigate('profile', 'profile')">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">badge</span>
          <span>Profil</span>
        </button>
      </div>

      <div class="app-nav-footer">
        <div class="app-nav-footer-meta px-2 py-1.5 rounded bg-[#161920] border border-[#2A2E39]">
          <span class="font-sans text-[11px] font-semibold text-[#F3F4F6] truncate" id="nav-user-name"><?= e($navUserName) ?></span>
          <span class="font-mono text-[11px] text-[#A1A9B8] truncate" id="nav-prod-name"><?= e($navProdName) ?></span>
        </div>
        <button type="button" class="sp-btn sp-btn-primary sp-btn-compact w-full" onclick="StoryPad.openScriptImportModal()" aria-label="Impor atau Tambah Naskah Baru">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">upload_file</span>
          <span class="app-nav-brand-sub">Impor Naskah</span>
        </button>
        <button type="button" id="nav-theme-btn" class="sp-btn sp-btn-monitor sp-btn-compact w-full" onclick="StoryPad.toggleTheme()" aria-label="Ganti Tema Tampilan">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">contrast</span>
          <span class="app-nav-brand-sub theme-label-text"><?= e($navThemeLabel) ?></span>
        </button>
        <a href="<?= !empty($isAdminLoggedIn) ? 'admin.php' : 'admin-login.php' ?>" class="sp-btn sp-btn-monitor sp-btn-compact w-full no-underline" aria-label="Buka Portal Admin Produksi">
          <span class="material-symbols-outlined text-[16px] text-[#FBBF24]" aria-hidden="true">admin_panel_settings</span>
          <span class="app-nav-brand-sub"><?= !empty($isAdminLoggedIn) ? 'Panel Admin' : 'Portal Admin' ?></span>
        </a>
      </div>
    </nav>
