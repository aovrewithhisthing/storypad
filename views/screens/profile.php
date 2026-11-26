<?php
declare(strict_types=1);

$profileHidden = ($initialScreen ?? 'login') === 'profile' ? '' : ' hidden';
$u = $session['user'] ?? [];
$uName = $u['name'] ?? 'Kru Produksi';
$uInit = $u['initials'] ?? 'KP';
$uRole = $u['roleTitle'] ?? 'Script Supervisor & Continuity';
$uBadge = ($u['idBadge'] ?? 'SP-01') . ' | ' . ($u['studio'] ?? ($config['studio_name'] ?? 'StoryPad Studio'));
$uProd = $u['prodName'] ?? '-';
?>
          <!-- ========================================== -->
          <!-- LAYAR 6: PROFIL KRU & PENGATURAN -->
          <!-- ========================================== -->
          <section class="screen-view<?= $profileHidden ?> flex-col" id="screen-profile" aria-labelledby="profile-heading">
            <header class="sp-topbar">
              <div class="flex items-center gap-3 min-w-0">
                <h1 id="profile-heading" class="font-sans text-base md:text-lg font-bold tracking-tight truncate" style="color: var(--text-primary);">
                  Profil Kru &amp; Izin Produksi
                </h1>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" class="sp-icon-btn" onclick="StoryPad.toggleTheme()" aria-label="Ganti Tema Tampilan">
                  <span class="material-symbols-outlined text-[19px]" aria-hidden="true">contrast</span>
                </button>
                <button type="button" class="sp-icon-btn relative" onclick="StoryPad.openNotifications()" aria-label="Notifikasi">
                  <span class="material-symbols-outlined text-[19px]" aria-hidden="true">notifications</span>
                  <span class="notif-unread-dot hidden absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2563EB]" aria-hidden="true"></span>
                </button>
                <button type="button" class="sp-icon-btn font-sans text-xs font-bold" id="header-avatar-profile" onclick="StoryPad.openLoginAccounts()" aria-label="Pilih Akun Kru">
                  <?= e($uInit) ?>
                </button>
              </div>
            </header>

            <div class="screen-content-wrap">
              <div class="profile-grid">
                <!-- Left Column: Crew Identity & Session Summary -->
                <div class="flex flex-col gap-4">
                  <article class="sp-panel p-5 flex flex-col gap-4">
                    <div class="flex items-center gap-3.5">
                      <div class="w-14 h-14 rounded bg-[#2563EB] text-white flex items-center justify-center text-lg font-bold font-sans shrink-0" id="profile-avatar-initials">
                        <?= e($uInit) ?>
                      </div>
                      <div class="min-w-0">
                        <h2 class="font-sans text-base font-bold truncate m-0" id="profile-user-name" style="color: var(--text-primary);"><?= e($uName) ?></h2>
                        <p class="font-sans text-xs font-semibold truncate m-0 mt-0.5" id="profile-user-role" style="color: var(--primary-text);"><?= e($uRole) ?></p>
                        <p class="font-mono text-xs mt-0.5 truncate m-0" id="profile-user-badge" style="color: var(--text-secondary);"><?= e($uBadge) ?></p>
                      </div>
                    </div>

                    <div class="sp-panel-muted p-3 flex items-center justify-between gap-2 text-xs">
                      <span style="color: var(--text-secondary);">Naskah Aktif</span>
                      <span class="font-sans font-bold" id="profile-active-prod" style="color: var(--text-primary);"><?= e($uProd) ?></span>
                    </div>

                    <!-- Real Totals Computed strictly from StoryPad.db -->
                    <dl class="grid grid-cols-3 gap-2 text-center m-0">
                      <div class="sp-panel-muted p-2.5">
                        <dt class="font-sans text-[11px]" style="color: var(--text-muted);">Naskah</dt>
                        <dd class="font-mono text-sm font-bold mt-0.5 tabular-nums m-0" id="profile-stat-projects" style="color: var(--text-primary);">0</dd>
                      </div>
                      <div class="sp-panel-muted p-2.5">
                        <dt class="font-sans text-[11px]" style="color: var(--text-muted);">Total Take</dt>
                        <dd class="font-mono text-sm font-bold mt-0.5 tabular-nums m-0" id="profile-stat-takes" style="color: var(--text-primary);">0</dd>
                      </div>
                      <div class="sp-panel-muted p-2.5">
                        <dt class="font-sans text-[11px]" style="color: var(--text-muted);">Circle Take</dt>
                        <dd class="font-mono text-sm font-bold mt-0.5 tabular-nums m-0" id="profile-stat-circled" style="color: var(--good-text);">0</dd>
                      </div>
                    </dl>

                    <div class="flex flex-col gap-2 pt-2 border-t" style="border-color: var(--border-flat);">
                      <button type="button" class="sp-btn sp-btn-secondary w-full" onclick="StoryPad.openLoginAccounts()">
                        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">switch_account</span>
                        <span>Kelola / Ganti Akun Kru</span>
                      </button>
                      <a href="<?= !empty($isAdminLoggedIn) ? 'admin.php' : 'admin-login.php' ?>" class="sp-btn sp-btn-secondary w-full no-underline">
                        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">admin_panel_settings</span>
                        <span><?= !empty($isAdminLoggedIn) ? 'Buka Panel Admin Produksi' : 'Portal Admin Produksi' ?></span>
                      </a>
                      <button class="sp-btn sp-btn-danger w-full btn-press" id="logout-btn" onclick="StoryPad.handleLogout()" type="button">
                        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">logout</span>
                        <span>Keluar Sesi Produksi</span>
                      </button>
                    </div>
                  </article>

                  <!-- Theme Preference Card -->
                  <article class="sp-panel p-5 flex flex-col gap-3">
                    <h2 class="sp-section-heading">Preferensi Permukaan Kerja</h2>
                    <p class="font-sans text-xs m-0" style="color: var(--text-secondary);">
                      Gunakan Kertas Editorial untuk keterbacaan naskah di lokasi terang, atau Slate Gelap untuk ruang pemantauan minim cahaya.
                    </p>
                    <div class="grid grid-cols-2 gap-2">
                      <button type="button" id="profile-theme-daylight" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.setTheme('daylight')">
                        Kertas Editorial
                      </button>
                      <button type="button" id="profile-theme-slate" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.setTheme('slate')">
                        Slate Gelap
                      </button>
                    </div>
                  </article>
                </div>

                <!-- Right Column: Role Permissions & Technical Specs -->
                <div class="flex flex-col gap-4">
                  <article class="sp-panel p-5 flex flex-col gap-3">
                    <div class="flex items-center justify-between gap-2 pb-2 border-b" style="border-color: var(--border-flat);">
                      <div>
                        <h2 class="sp-section-heading">Pengaturan Peran (Role Switcher)</h2>
                        <p class="font-sans text-xs mt-0.5 m-0" style="color: var(--text-secondary);">Perubahan peran langsung tersimpan otomatis ke sesi perangkat dan profil kru.</p>
                      </div>
                      <span class="sp-badge sp-badge-blue">Auto-Save</span>
                    </div>

                    <div class="rounded border divide-y overflow-hidden" style="border-color: var(--border-flat);">
                      <!-- Role 1 -->
                      <button type="button" class="role-item flex items-center justify-between p-3.5 transition-colors hover:opacity-95" data-role-key="scriptSupervisor" aria-pressed="true" onclick="StoryPad.toggleRole('scriptSupervisor', this.querySelector('.toggle-box'))">
                        <span class="flex items-center gap-3 min-w-0 pr-3">
                          <span class="w-8 h-8 rounded flex items-center justify-center shrink-0 border" style="background-color: var(--panel-lowest); border-color: var(--border-flat); color: var(--primary-text);">
                            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit_note</span>
                          </span>
                          <span class="flex flex-col min-w-0">
                            <span class="font-sans text-xs font-bold truncate" style="color: var(--text-primary);">Script Supervisor</span>
                            <span class="font-sans text-[11px] truncate" style="color: var(--text-secondary);">Pencatatan adegan lapangan dan status kontinuitas</span>
                          </span>
                        </span>
                        <span class="toggle-box w-6 h-6 rounded bg-[#2563EB] flex items-center justify-center shrink-0 text-white" data-checked="true">
                          <span class="material-symbols-outlined text-[16px] font-bold" aria-hidden="true">check</span>
                        </span>
                      </button>

                      <!-- Role 2 -->
                      <button type="button" class="role-item flex items-center justify-between p-3.5 transition-colors hover:opacity-95" data-role-key="videoEditor" aria-pressed="true" onclick="StoryPad.toggleRole('videoEditor', this.querySelector('.toggle-box'))">
                        <span class="flex items-center gap-3 min-w-0 pr-3">
                          <span class="w-8 h-8 rounded flex items-center justify-center shrink-0 border" style="background-color: var(--panel-lowest); border-color: var(--border-flat); color: var(--primary-text);">
                            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">movie_edit</span>
                          </span>
                          <span class="flex flex-col min-w-0">
                            <span class="font-sans text-xs font-bold truncate" style="color: var(--text-primary);">Video Editor</span>
                            <span class="font-sans text-[11px] truncate" style="color: var(--text-secondary);">Akses sinkronisasi metadata NLE XML dan EDL</span>
                          </span>
                        </span>
                        <span class="toggle-box w-6 h-6 rounded bg-[#2563EB] flex items-center justify-center shrink-0 text-white" data-checked="true">
                          <span class="material-symbols-outlined text-[16px] font-bold" aria-hidden="true">check</span>
                        </span>
                      </button>

                      <!-- Role 3 -->
                      <button type="button" class="role-item flex items-center justify-between p-3.5 transition-colors opacity-70" data-role-key="soundRecordist" aria-pressed="false" onclick="StoryPad.toggleRole('soundRecordist', this.querySelector('.toggle-box'))">
                        <span class="flex items-center gap-3 min-w-0 pr-3">
                          <span class="w-8 h-8 rounded flex items-center justify-center shrink-0 border" style="background-color: var(--panel-lowest); border-color: var(--border-flat); color: var(--text-secondary);">
                            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">graphic_eq</span>
                          </span>
                          <span class="flex flex-col min-w-0">
                            <span class="font-sans text-xs font-bold truncate" style="color: var(--text-primary);">Sound Recordist</span>
                            <span class="font-sans text-[11px] truncate" style="color: var(--text-secondary);">Pengunggah trek audio rekaman lapangan ke take</span>
                          </span>
                        </span>
                        <span class="toggle-box w-6 h-6 rounded border flex items-center justify-center shrink-0 text-transparent" data-checked="false" style="background-color: var(--panel-lowest); border-color: var(--border-control);">
                          <span class="material-symbols-outlined text-[16px] font-bold" aria-hidden="true">check</span>
                        </span>
                      </button>

                      <!-- Role 4 -->
                      <button type="button" class="role-item flex items-center justify-between p-3.5 transition-colors opacity-70" data-role-key="directorProducer" aria-pressed="false" onclick="StoryPad.toggleRole('directorProducer', this.querySelector('.toggle-box'))">
                        <span class="flex items-center gap-3 min-w-0 pr-3">
                          <span class="w-8 h-8 rounded flex items-center justify-center shrink-0 border" style="background-color: var(--panel-lowest); border-color: var(--border-flat); color: var(--text-secondary);">
                            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">visibility</span>
                          </span>
                          <span class="flex flex-col min-w-0">
                            <span class="font-sans text-xs font-bold truncate" style="color: var(--text-primary);">Director &amp; Producer View</span>
                            <span class="font-sans text-[11px] truncate" style="color: var(--text-secondary);">Mode tinjauan take pilihan tanpa mengubah penamaan</span>
                          </span>
                        </span>
                        <span class="toggle-box w-6 h-6 rounded border flex items-center justify-center shrink-0 text-transparent" data-checked="false" style="background-color: var(--panel-lowest); border-color: var(--border-control);">
                          <span class="material-symbols-outlined text-[16px] font-bold" aria-hidden="true">check</span>
                        </span>
                      </button>

                      <!-- Role 5 -->
                      <button type="button" class="role-item flex items-center justify-between p-3.5 transition-colors" data-role-key="autoExportMeta" aria-pressed="true" onclick="StoryPad.toggleRole('autoExportMeta', this.querySelector('.toggle-box'))">
                        <span class="flex items-center gap-3 min-w-0 pr-3">
                          <span class="w-8 h-8 rounded flex items-center justify-center shrink-0 border" style="background-color: var(--panel-lowest); border-color: var(--border-flat); color: var(--primary-text);">
                            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">sync_saved_locally</span>
                          </span>
                          <span class="flex flex-col min-w-0">
                            <span class="font-sans text-xs font-bold truncate" style="color: var(--text-primary);">Auto-Export Meta Naming</span>
                            <span class="font-sans text-[11px] truncate" style="color: var(--text-secondary);">Format penamaan otomatis untuk DaVinci &amp; Premiere Pro</span>
                          </span>
                        </span>
                        <span class="toggle-box w-6 h-6 rounded bg-[#2563EB] flex items-center justify-center shrink-0 text-white" data-checked="true">
                          <span class="material-symbols-outlined text-[16px] font-bold" aria-hidden="true">check</span>
                        </span>
                      </button>
                    </div>
                  </article>

                  <!-- Storage & Format Profile Specs -->
                  <article class="sp-panel p-5 flex flex-col gap-3">
                    <h2 class="sp-section-heading">Spesifikasi Media &amp; Konverter</h2>
                    <dl class="divide-y text-xs m-0" style="border-color: var(--border-flat);">
                      <div class="py-2 flex items-center justify-between gap-2">
                        <dt style="color: var(--text-secondary);">Format Impor Naskah</dt>
                        <dd class="font-mono font-semibold m-0" style="color: var(--text-primary);">.docx, .fountain, .md, .txt</dd>
                      </div>
                      <div class="py-2 flex items-center justify-between gap-2">
                        <dt style="color: var(--text-secondary);">Format Audio &amp; Footage</dt>
                        <dd class="font-mono font-semibold m-0" style="color: var(--text-primary);">WAV/MP3/M4A &amp; MP4/MOV/WebM</dd>
                      </div>
                      <div class="py-2 flex items-center justify-between gap-2">
                        <dt style="color: var(--text-secondary);">Konvensi Nama File</dt>
                        <dd class="font-mono font-semibold m-0" style="color: var(--text-primary);">SC_SH_T_KataKunci_CAM/AUD</dd>
                      </div>
                      <div class="py-2 flex items-center justify-between gap-2">
                        <dt style="color: var(--text-secondary);">Versi Aplikasi</dt>
                        <dd class="font-mono m-0" style="color: var(--text-muted);">StoryPad <?= e($config['app_version'] ?? '4.0.0-php') ?></dd>
                      </div>
                    </dl>
                  </article>
                </div>
              </div>
            </div>
          </section>
