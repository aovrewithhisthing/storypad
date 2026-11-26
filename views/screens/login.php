<?php
declare(strict_types=1);

$loginHidden = ($initialScreen ?? 'login') === 'login' ? '' : ' hidden';
$loginThemeLabel = ($activeTheme ?? 'daylight') === 'slate' ? 'Mode Kertas Editorial' : 'Mode Slate Gelap';
$studioLabel = $config['studio_name'] ?? 'StoryPad Studio';
?>
          <!-- ========================================== -->
          <!-- LAYAR 1: ACCOUNT HUB & AUTENTIKASI KRU -->
          <!-- ========================================== -->
          <section class="screen-view<?= $loginHidden ?> flex items-center justify-center p-4 md:p-8" id="screen-login" aria-labelledby="login-heading">
            <div class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              <!-- Left Column: Product Identity & Connection Status -->
              <div class="md:col-span-6 sp-panel p-6 md:p-8 flex flex-col justify-between gap-6">
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
                        <dt class="font-sans text-[11px]" style="color: var(--text-muted);">Akses Data</dt>
                        <dd class="font-mono text-xs font-semibold mt-0.5 tabular-nums" id="login-projects-count" style="color: var(--text-primary);">Terproteksi</dd>
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
                    <span class="font-mono text-xs" style="color: var(--text-muted);">Auth &amp; Private Storage</span>
                  </div>
                  <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.toggleTheme()" aria-label="Ganti Tema Tampilan">
                    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">contrast</span>
                    <span class="theme-label-text"><?= e($loginThemeLabel) ?></span>
                  </button>
                </div>
              </div>

              <!-- Right Column: Account Hub & Secure Auth Views -->
              <div class="md:col-span-6 sp-panel p-6 md:p-8 flex flex-col justify-between gap-5">
                <!-- STATE 1: ACCOUNT HUB (REMEMBERED ACCOUNTS ON THIS BROWSER) -->
                <div id="auth-view-hub" class="hidden flex-col gap-4">
                  <div>
                    <h2 class="font-sans text-lg font-bold m-0 mb-1" style="color: var(--text-primary);">
                      Selamat datang kembali
                    </h2>
                    <p class="font-sans text-xs m-0 leading-relaxed" style="color: var(--text-secondary);">
                      Akun berikut pernah digunakan di browser ini. Memilih akun tetap memerlukan kata sandi dan verifikasi sesi server.
                    </p>
                  </div>

                  <div class="flex flex-col gap-2" id="account-hub-list" role="region" aria-label="Daftar akun yang diingat di browser ini"></div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" id="btn-hub-use-another" class="sp-btn sp-btn-primary sp-btn-compact w-full" onclick="StoryPad.openAuthView('credentials', 'signin')">
                      <span class="material-symbols-outlined text-[17px]" aria-hidden="true">login</span>
                      <span>Gunakan akun lain</span>
                    </button>
                    <button type="button" id="btn-hub-create-account" class="sp-btn sp-btn-secondary sp-btn-compact w-full" onclick="StoryPad.openAuthView('credentials', 'signup')">
                      <span class="material-symbols-outlined text-[17px]" aria-hidden="true">person_add</span>
                      <span>Daftar akun baru</span>
                    </button>
                  </div>

                  <details class="sp-panel-muted p-3 text-xs">
                    <summary class="font-sans font-semibold select-none" style="color: var(--text-primary);">
                      Tentang akun yang diingat
                    </summary>
                    <p class="font-sans text-[11px] m-0 mt-2 leading-relaxed" style="color: var(--text-secondary);">
                      StoryPad hanya menyimpan nama tampilan, inisial, email, dan waktu terakhir digunakan di perangkat ini. Kata sandi dan token autentikasi tidak pernah disimpan di daftar akun. Pada komputer bersama, hapus akun setelah selesai atau matikan opsi ingat akun saat masuk.
                    </p>
                  </details>
                </div>

                <!-- STATE 2: SELECTED ACCOUNT PASSWORD LOGIN -->
                <div id="auth-view-selected" class="hidden flex-col gap-4">
                  <div class="flex items-center justify-between gap-2">
                    <button type="button" id="btn-selected-back-hub" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.openAuthView('hub')">
                      <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
                      <span>Kembali ke Account Hub</span>
                    </button>
                  </div>

                  <div>
                    <h2 class="font-sans text-lg font-bold m-0 mb-1" style="color: var(--text-primary);">
                      Verifikasi kata sandi
                    </h2>
                    <p class="font-sans text-xs m-0" style="color: var(--text-secondary);">
                      Masukkan kata sandi untuk membuka sesi produksi akun ini.
                    </p>
                  </div>

                  <div class="sp-panel-muted p-3 flex items-center gap-3">
                    <span class="w-10 h-10 rounded bg-[#2563EB] text-white font-sans text-xs font-bold flex items-center justify-center shrink-0" id="selected-account-avatar">KP</span>
                    <div class="min-w-0">
                      <p class="font-sans text-sm font-bold truncate m-0" id="selected-account-name" style="color: var(--text-primary);">Kru Produksi</p>
                      <p class="font-mono text-xs truncate m-0" id="selected-account-email" style="color: var(--text-secondary);"></p>
                    </div>
                  </div>

                  <form id="selected-login-form" class="flex flex-col gap-3" onsubmit="event.preventDefault(); StoryPad.submitSelectedAccountLogin();" novalidate>
                    <div class="flex flex-col gap-1">
                      <label for="selected-password-input" class="font-sans text-xs font-semibold" style="color: var(--text-primary);">Kata Sandi</label>
                      <div class="sp-password-wrap">
                        <input type="password" id="selected-password-input" class="sp-input pr-12" placeholder="Masukkan kata sandi Anda" autocomplete="current-password" required>
                        <button type="button" id="toggle-selected-password" class="sp-password-toggle" aria-label="Tampilkan kata sandi" aria-pressed="false" onclick="StoryPad.togglePasswordVisibility('selected-password-input', this)">
                          <span class="material-symbols-outlined text-[19px]" aria-hidden="true">visibility</span>
                        </button>
                      </div>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <label for="selected-remember-checkbox" class="sp-checkbox-row">
                        <input type="checkbox" id="selected-remember-checkbox" class="w-4 h-4 rounded border-[#736F63] text-[#2563EB]" checked>
                        <span class="font-sans text-xs" style="color: var(--text-secondary);">Ingat akun di perangkat ini</span>
                      </label>
                      <button type="button" class="font-sans text-xs font-semibold bg-transparent border-0 p-1 hover:underline" style="color: var(--primary-text);" onclick="StoryPad.openAuthView('forgot')">
                        Lupa kata sandi?
                      </button>
                    </div>

                    <div id="selected-auth-feedback" class="hidden p-3 rounded border text-xs font-medium" role="alert"></div>

                    <button type="submit" id="selected-signin-btn" class="sp-btn sp-btn-primary w-full btn-press">
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">lock_open</span>
                      <span>Masuk ke Sesi Produksi</span>
                    </button>
                  </form>
                </div>

                <!-- STATE 3: STANDARD LOGIN & SIGNUP -->
                <div id="auth-view-credentials" class="flex flex-col gap-4">
                  <div class="flex items-center justify-between gap-2">
                    <div>
                      <h2 class="font-sans text-lg font-bold m-0 mb-1" id="cred-heading" style="color: var(--text-primary);">
                        Masuk ke Sesi Produksi
                      </h2>
                      <p class="font-sans text-xs m-0" id="cred-subheading" style="color: var(--text-secondary);">
                        Masuk dengan akun kru terdaftar atau daftarkan akun baru.
                      </p>
                    </div>
                    <button type="button" id="cred-back-hub-btn" class="hidden sp-btn sp-btn-secondary sp-btn-compact shrink-0" onclick="StoryPad.openAuthView('hub')">
                      <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
                      <span>Daftar Akun</span>
                    </button>
                  </div>

                  <div class="grid grid-cols-2 gap-1.5 p-1 rounded border" style="background-color: var(--panel-lowest); border-color: var(--border-flat);" role="tablist" aria-label="Pilih mode autentikasi">
                    <button type="button" role="tab" id="auth-tab-signin" aria-selected="true" class="sp-btn sp-btn-primary sp-btn-compact" onclick="StoryPad.setAuthMode('signin')">
                      Masuk
                    </button>
                    <button type="button" role="tab" id="auth-tab-signup" aria-selected="false" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.setAuthMode('signup')">
                      Daftar Akun
                    </button>
                  </div>

                  <form id="credentials-auth-form" class="flex flex-col gap-3" onsubmit="event.preventDefault(); StoryPad.submitCredentialsAuth();" novalidate>
                    <div id="credentials-signup-fields" class="hidden grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div class="flex flex-col gap-1">
                        <label for="cred-name-input" class="font-sans text-xs font-semibold" style="color: var(--text-primary);">Nama Lengkap Kru</label>
                        <input type="text" id="cred-name-input" class="sp-input" placeholder="Nama lengkap" autocomplete="name">
                      </div>
                      <div class="flex flex-col gap-1">
                        <label for="cred-role-select" class="font-sans text-xs font-semibold" style="color: var(--text-primary);">Peran Utama</label>
                        <select id="cred-role-select" class="sp-input">
                          <option value="scriptSupervisor">Script Supervisor</option>
                          <option value="videoEditor">Offline Video Editor</option>
                          <option value="soundRecordist">Production Sound Mixer</option>
                        </select>
                      </div>
                    </div>

                    <div class="flex flex-col gap-1">
                      <label for="cred-email-input" class="font-sans text-xs font-semibold" style="color: var(--text-primary);">Email Kru</label>
                      <input type="email" id="cred-email-input" class="sp-input" placeholder="nama@domain.id" autocomplete="email" required>
                    </div>

                    <div class="flex flex-col gap-1">
                      <label for="cred-password-input" class="font-sans text-xs font-semibold" style="color: var(--text-primary);">Kata Sandi</label>
                      <div class="sp-password-wrap">
                        <input type="password" id="cred-password-input" class="sp-input pr-12" placeholder="Masukkan kata sandi" autocomplete="current-password" required>
                        <button type="button" id="toggle-cred-password" class="sp-password-toggle" aria-label="Tampilkan kata sandi" aria-pressed="false" onclick="StoryPad.togglePasswordVisibility('cred-password-input', this)">
                          <span class="material-symbols-outlined text-[19px]" aria-hidden="true">visibility</span>
                        </button>
                      </div>
                      <p id="cred-password-hint" class="hidden font-sans text-[11px] m-0 mt-0.5" style="color: var(--text-secondary);">
                        Minimal 12 karakter. Gunakan frasa sandi agar mudah diingat dan kuat (maksimal 128 karakter).
                      </p>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <label for="cred-remember-checkbox" class="sp-checkbox-row">
                        <input type="checkbox" id="cred-remember-checkbox" class="w-4 h-4 rounded border-[#736F63] text-[#2563EB]">
                        <span class="font-sans text-xs" style="color: var(--text-secondary);">Ingat akun di perangkat ini</span>
                      </label>
                      <button type="button" id="cred-forgot-btn" class="font-sans text-xs font-semibold bg-transparent border-0 p-1 hover:underline" style="color: var(--primary-text);" onclick="StoryPad.openAuthView('forgot')">
                        Lupa kata sandi?
                      </button>
                    </div>

                    <div id="cred-auth-feedback" class="hidden p-3 rounded border text-xs font-medium" role="alert"></div>

                    <button type="submit" id="cred-submit-btn" class="sp-btn sp-btn-primary w-full btn-press">
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">login</span>
                      <span id="cred-submit-label">Masuk ke Sesi Produksi</span>
                    </button>
                  </form>
                </div>

                <!-- STATE 4A: FORGOT PASSWORD -->
                <div id="auth-view-forgot" class="hidden flex-col gap-4">
                  <div>
                    <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact mb-3" onclick="StoryPad.openAuthView('credentials', 'signin')">
                      <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
                      <span>Kembali ke halaman masuk</span>
                    </button>
                    <h2 class="font-sans text-lg font-bold m-0 mb-1" style="color: var(--text-primary);">
                      Atur ulang kata sandi
                    </h2>
                    <p class="font-sans text-xs m-0 leading-relaxed" style="color: var(--text-secondary);">
                      Masukkan email akun Anda. Jika terdaftar, sistem akan mengirim tautan atur ulang sekali pakai ke email tersebut.
                    </p>
                  </div>

                  <form id="forgot-password-form" class="flex flex-col gap-3" onsubmit="event.preventDefault(); StoryPad.submitForgotPassword();" novalidate>
                    <div class="flex flex-col gap-1">
                      <label for="forgot-email-input" class="font-sans text-xs font-semibold" style="color: var(--text-primary);">Email Akun</label>
                      <input type="email" id="forgot-email-input" class="sp-input" placeholder="nama@domain.id" autocomplete="email" required>
                    </div>

                    <div id="forgot-auth-feedback" class="hidden p-3 rounded border text-xs font-medium" role="status"></div>

                    <button type="submit" id="forgot-submit-btn" class="sp-btn sp-btn-primary w-full">
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">mail</span>
                      <span>Kirim Tautan Atur Ulang</span>
                    </button>
                  </form>
                </div>

                <!-- STATE 4B: PASSWORD RECOVERY -->
                <div id="auth-view-recovery" class="hidden flex-col gap-4">
                  <div>
                    <h2 class="font-sans text-lg font-bold m-0 mb-1" style="color: var(--text-primary);">
                      Buat kata sandi baru
                    </h2>
                    <p class="font-sans text-xs m-0 leading-relaxed" style="color: var(--text-secondary);">
                      Tautan pemulihan terverifikasi. Tetapkan kata sandi baru minimal 12 karakter (disarankan frasa sandi).
                    </p>
                  </div>

                  <form id="recovery-password-form" class="flex flex-col gap-3" onsubmit="event.preventDefault(); StoryPad.submitPasswordRecovery();" novalidate>
                    <div class="flex flex-col gap-1">
                      <label for="recovery-password-input" class="font-sans text-xs font-semibold" style="color: var(--text-primary);">Kata Sandi Baru</label>
                      <div class="sp-password-wrap">
                        <input type="password" id="recovery-password-input" class="sp-input pr-12" placeholder="Minimal 12 karakter" autocomplete="new-password" required>
                        <button type="button" class="sp-password-toggle" aria-label="Tampilkan kata sandi baru" aria-pressed="false" onclick="StoryPad.togglePasswordVisibility('recovery-password-input', this)">
                          <span class="material-symbols-outlined text-[19px]" aria-hidden="true">visibility</span>
                        </button>
                      </div>
                    </div>

                    <div class="flex flex-col gap-1">
                      <label for="recovery-password-confirm" class="font-sans text-xs font-semibold" style="color: var(--text-primary);">Konfirmasi Kata Sandi Baru</label>
                      <div class="sp-password-wrap">
                        <input type="password" id="recovery-password-confirm" class="sp-input pr-12" placeholder="Ulangi kata sandi baru" autocomplete="new-password" required>
                        <button type="button" class="sp-password-toggle" aria-label="Tampilkan konfirmasi kata sandi" aria-pressed="false" onclick="StoryPad.togglePasswordVisibility('recovery-password-confirm', this)">
                          <span class="material-symbols-outlined text-[19px]" aria-hidden="true">visibility</span>
                        </button>
                      </div>
                    </div>

                    <div id="recovery-auth-feedback" class="hidden p-3 rounded border text-xs font-medium" role="alert"></div>

                    <button type="submit" id="recovery-submit-btn" class="sp-btn sp-btn-primary w-full">
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">check_circle</span>
                      <span>Simpan Kata Sandi Baru</span>
                    </button>
                  </form>
                </div>

                <!-- Admin Portal Link -->
                <div class="pt-3 border-t flex flex-col gap-2" style="border-color: var(--border-flat);">
                  <a href="<?= !empty($isAdminLoggedIn) ? 'admin.php' : 'admin-login.php' ?>" id="link-admin-portal" class="sp-btn sp-btn-secondary sp-btn-compact w-full no-underline">
                    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">admin_panel_settings</span>
                    <span><?= !empty($isAdminLoggedIn) ? 'Buka Panel Admin Produksi' : 'Masuk sebagai Admin Produksi' ?></span>
                  </a>
                </div>
              </div>
            </div>
          </section>
