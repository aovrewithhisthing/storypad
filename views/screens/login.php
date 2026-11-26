<?php
declare(strict_types=1);

$loginHidden = ($initialScreen ?? 'login') === 'login' ? '' : ' hidden';
$loginThemeLabel = ($activeTheme ?? 'daylight') === 'slate' ? 'Mode Kertas Editorial' : 'Mode Slate Gelap';
$studioLabel = $config['studio_name'] ?? 'StoryPad Studio';
?>
          <!-- ========================================== -->
          <!-- LAYAR 1: SIGN-IN KRU PRODUKSI -->
          <!-- ========================================== -->
          <section class="screen-view<?= $loginHidden ?> flex items-center justify-center p-4 md:p-8" id="screen-login" aria-labelledby="login-heading">
            <div class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              <!-- Left Column: Product Identity & Real Database Status -->
              <div class="md:col-span-7 sp-panel p-6 md:p-8 flex flex-col justify-between gap-6">
                <div>
                  <div class="flex items-center gap-3 mb-6">
                    <div class="w-12 h-12 rounded bg-[#0F1115] border border-[#373C4A] flex items-center justify-center shrink-0">
                      <svg class="w-7 h-7 text-[#60A5FA]" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                        <rect x="6" y="16" width="36" height="26" rx="3" fill="#161920" stroke="#60A5FA" stroke-width="2.5"></rect>
                        <path d="M6 18L13 6H42L36 18H6Z" fill="#1E222B" stroke="#60A5FA" stroke-width="2.5" stroke-linejoin="round"></path>
                        <path d="M17 6L14 18M27 6L24 18M37 6L34 18" stroke="#34D399" stroke-width="2.5" stroke-linecap="round"></path>
                      </svg>
                    </div>
                    <div>
                      <h1 id="login-heading" class="font-sans text-2xl md:text-3xl font-bold tracking-tight" style="color: var(--text-primary);">
                        StoryPad
                      </h1>
                      <p class="font-sans text-sm" style="color: var(--text-secondary);">
                        Meja Pencatatan Kontinuitas Naskah, Audio, Footage, dan Metadata Timeline NLE
                      </p>
                    </div>
                  </div>

                  <p class="font-sans text-sm leading-relaxed mb-6" style="color: var(--text-secondary);">
                    Impor naskah dari format Word (<code class="font-mono">.docx</code>), Fountain, atau teks biasa, pantau adegan per scene, unggah rekaman audio maupun klip footage ke setiap take, dan hasilkan penamaan file standar untuk Premiere Pro atau DaVinci Resolve.
                  </p>

                  <!-- Real Server & Database Summary -->
                  <div class="sp-panel-muted p-4">
                    <h2 class="font-sans text-xs font-bold uppercase tracking-wide mb-3" style="color: var(--text-secondary);">
                      Status Sesi Produksi
                    </h2>
                    <dl class="grid grid-cols-3 gap-3 text-left">
                      <div>
                        <dt class="font-sans text-[11px]" style="color: var(--text-muted);">Unit Produksi</dt>
                        <dd class="font-sans text-xs font-semibold mt-0.5" id="login-studio-name" style="color: var(--text-primary);"><?= e($studioLabel) ?></dd>
                      </div>
                      <div>
                        <dt class="font-sans text-[11px]" style="color: var(--text-muted);">Naskah Aktif</dt>
                        <dd class="font-mono text-xs font-semibold mt-0.5 tabular-nums" id="login-projects-count" style="color: var(--text-primary);">Memuat...</dd>
                      </div>
                      <div>
                        <dt class="font-sans text-[11px]" style="color: var(--text-muted);">Jam Sistem</dt>
                        <dd class="font-mono text-xs font-semibold mt-0.5 tabular-nums" id="master-tc-live" style="color: var(--good-text);">00:00:00</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3 pt-4 border-t" style="border-color: var(--border-flat);">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="sp-badge sp-badge-neutral font-mono" id="supabase-status-badge">Menghubungkan...</span>
                    <span class="font-mono text-xs" style="color: var(--text-muted);">DOCX Converter &amp; Media Storage</span>
                  </div>
                  <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.toggleTheme()" aria-label="Ganti Tema Tampilan">
                    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">contrast</span>
                    <span class="theme-label-text"><?= e($loginThemeLabel) ?></span>
                  </button>
                </div>
              </div>

              <!-- Right Column: Dynamic Crew Login & Admin Portal Link -->
              <div class="md:col-span-5 sp-panel p-6 md:p-8 flex flex-col justify-between gap-6">
                <div>
                  <h2 class="font-sans text-lg font-bold mb-1" style="color: var(--text-primary);">
                    Masuk ke Sesi Produksi
                  </h2>
                  <p class="font-sans text-xs mb-4" style="color: var(--text-secondary);">
                    Pilih akun kru yang terdaftar di database produksi atau daftarkan akun kru baru untuk mulai mengelola naskah dan take.
                  </p>

                  <!-- Dynamic Registered Crew List (Empty State if 0 crew in Supabase) -->
                  <div class="flex flex-col gap-2.5 mb-4" id="login-crew-quicklist" role="region" aria-label="Daftar akun kru terdaftar">
                    <div class="sp-panel-muted p-3.5 text-xs" style="color: var(--text-secondary);">
                      Memeriksa daftar akun kru terdaftar di database...
                    </div>
                  </div>

                  <div class="flex flex-col gap-2.5">
                    <button class="sp-btn sp-btn-primary w-full btn-press" id="btn-login-email" onclick="StoryPad.openLoginAccounts()" type="button">
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">person_add</span>
                      <span>Daftar atau Masuk Akun Kru</span>
                    </button>
                  </div>
                </div>

                <div class="pt-3 border-t flex flex-col gap-2" style="border-color: var(--border-flat);">
                  <a href="<?= !empty($isAdminLoggedIn) ? 'admin.php' : 'admin-login.php' ?>" id="link-admin-portal" class="sp-btn sp-btn-secondary sp-btn-compact w-full no-underline">
                    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">admin_panel_settings</span>
                    <span><?= !empty($isAdminLoggedIn) ? 'Buka Panel Admin Produksi' : 'Masuk sebagai Admin Produksi' ?></span>
                  </a>
                </div>
              </div>
            </div>
          </section>
