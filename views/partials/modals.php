<?php
declare(strict_types=1);
?>
    <!-- ========================================== -->
    <!-- BACKDROP OVERLAY -->
    <!-- ========================================== -->
    <div class="bottom-sheet-overlay" id="sheet-overlay"></div>

    <!-- ========================================== -->
    <!-- MODAL 1: VIEW (PENGATURAN TAMPILAN SKRIP) -->
    <!-- ========================================== -->
    <div class="bottom-sheet-drawer modal-dialog" id="sheet-view-settings" role="dialog" aria-modal="true" aria-labelledby="view-settings-title">
      <div class="bottom-sheet-handle"></div>
      <div class="bottom-sheet-content">
        <div class="flex items-center justify-between pb-2 border-b" style="border-color: var(--border-flat);">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[20px]" style="color: var(--primary-text);" aria-hidden="true">display_settings</span>
            <h2 id="view-settings-title" class="font-sans text-sm font-bold m-0" style="color: var(--text-primary);">Pengaturan Tampilan Skrip</h2>
          </div>
          <button type="button" aria-label="Tutup pengaturan tampilan" class="sp-icon-btn" onclick="StoryPad.closeViewSettings()">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
        </div>

        <div class="flex flex-col gap-2">
          <label class="flex items-center justify-between gap-3 p-3 rounded border" style="background-color: var(--panel-lowest); border-color: var(--border-flat);" for="filter-toggle-filecode">
            <span class="flex flex-col">
              <span class="font-sans text-xs font-bold" style="color: var(--text-primary);">Tampilkan Kode File</span>
              <span class="font-sans text-[11px]" style="color: var(--text-secondary);">Tampilkan kode penamaan otomatis di bawah setiap baris dialog</span>
            </span>
            <input id="filter-toggle-filecode" type="checkbox" checked class="w-5 h-5 rounded border-[#736F63] text-[#2563EB]" onchange="StoryPad.handleViewToggle('showFileCode', this.checked)">
          </label>

          <label class="flex items-center justify-between gap-3 p-3 rounded border" style="background-color: var(--panel-lowest); border-color: var(--border-flat);" for="filter-toggle-goodtake">
            <span class="flex flex-col">
              <span class="font-sans text-xs font-bold" style="color: var(--text-primary);">Filter Good Take Only</span>
              <span class="font-sans text-[11px]" style="color: var(--text-secondary);">Sembunyikan take NG dan non-Circle di panel daftar take</span>
            </span>
            <input id="filter-toggle-goodtake" type="checkbox" class="w-5 h-5 rounded border-[#736F63] text-[#2563EB]" onchange="StoryPad.handleViewToggle('filterGoodTakeOnly', this.checked)">
          </label>

          <label class="flex items-center justify-between gap-3 p-3 rounded border" style="background-color: var(--panel-lowest); border-color: var(--border-flat);" for="filter-toggle-highlight">
            <span class="flex flex-col">
              <span class="font-sans text-xs font-bold" style="color: var(--text-primary);">Highlight Status Syuting</span>
              <span class="font-sans text-[11px]" style="color: var(--text-secondary);">Tampilkan penanda warna status pada tepi baris dialog</span>
            </span>
            <input id="filter-toggle-highlight" type="checkbox" checked class="w-5 h-5 rounded border-[#736F63] text-[#2563EB]" onchange="StoryPad.handleViewToggle('highlightStatus', this.checked)">
          </label>

          <label class="flex items-center justify-between gap-3 p-3 rounded border" style="background-color: var(--panel-lowest); border-color: var(--border-flat);" for="filter-toggle-focusdialog">
            <span class="flex flex-col">
              <span class="font-sans text-xs font-bold" style="color: var(--text-primary);">Mode Fokus Dialog</span>
              <span class="font-sans text-[11px]" style="color: var(--text-secondary);">Sembunyikan deskripsi aksi dan tampilkan dialog pemeran saja</span>
            </span>
            <input id="filter-toggle-focusdialog" type="checkbox" class="w-5 h-5 rounded border-[#736F63] text-[#2563EB]" onchange="StoryPad.handleViewToggle('focusDialogueMode', this.checked)">
          </label>
        </div>

        <div class="pt-2 border-t flex flex-wrap items-center justify-between gap-2" style="border-color: var(--border-flat);">
          <div class="flex items-center gap-1.5">
            <button type="button" id="view-theme-daylight" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.setTheme('daylight')">Kertas</button>
            <button type="button" id="view-theme-slate" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.setTheme('slate')">Slate Gelap</button>
          </div>
          <button class="sp-btn sp-btn-secondary sp-btn-compact" id="resetFiltersBtn" onclick="StoryPad.resetViewFilters()" type="button">
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">restart_alt</span>
            <span>Reset View</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- MODAL 2: NOTIFIKASI PRODUKSI -->
    <!-- ========================================== -->
    <div class="bottom-sheet-drawer modal-dialog" id="sheet-notifications" role="dialog" aria-modal="true" aria-labelledby="notif-modal-title">
      <div class="bottom-sheet-handle"></div>
      <div class="bottom-sheet-content">
        <div class="flex items-center justify-between pb-2 border-b" style="border-color: var(--border-flat);">
          <div>
            <h2 id="notif-modal-title" class="font-sans text-sm font-bold m-0" style="color: var(--text-primary);">Notifikasi Produksi &amp; NLE</h2>
            <p class="font-sans text-[11px] m-0" id="notif-filter-summary" style="color: var(--text-secondary);">Riwayat sinkronisasi metadata, impor naskah, dan unggahan media.</p>
          </div>
          <button type="button" aria-label="Tutup panel notifikasi" class="sp-icon-btn" onclick="StoryPad.closeNotifications()">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
        </div>

        <div class="flex flex-col gap-2" id="notifications-list"></div>

        <div class="pt-2 border-t flex items-center justify-between gap-2" style="border-color: var(--border-flat);">
          <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.markAllNotificationsRead()">
            Tandai Semua Dibaca
          </button>
          <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.restoreDismissedNotifications()">
            Pulihkan Terhapus
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- MODAL 3: KELOLA AKUN & PERANGKAT LOKAL -->
    <!-- ========================================== -->
    <div class="bottom-sheet-drawer modal-dialog" id="sheet-login-accounts" role="dialog" aria-modal="true" aria-labelledby="accounts-modal-title">
      <div class="bottom-sheet-handle"></div>
      <div class="bottom-sheet-content">
        <div class="flex items-center justify-between pb-2 border-b" style="border-color: var(--border-flat);">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[20px]" style="color: var(--primary-text);" aria-hidden="true">badge</span>
            <h2 id="accounts-modal-title" class="font-sans text-sm font-bold m-0" style="color: var(--text-primary);">Kelola Akun &amp; Perangkat</h2>
          </div>
          <button type="button" aria-label="Tutup daftar akun" class="sp-icon-btn" onclick="StoryPad.closeLoginAccounts()">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
        </div>

        <div id="modal-current-account-box" class="sp-panel-muted p-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-sans text-xs font-bold m-0 truncate" id="modal-current-account-name" style="color: var(--text-primary);">Belum masuk</p>
            <p class="font-mono text-[11px] m-0 truncate" id="modal-current-account-email" style="color: var(--text-secondary);">Silakan masuk melalui Account Hub</p>
          </div>
          <button type="button" id="modal-switch-account-btn" class="sp-btn sp-btn-secondary sp-btn-compact shrink-0" onclick="StoryPad.switchAccountViaHub()">
            Keluar &amp; Ganti Akun
          </button>
        </div>

        <div class="flex flex-col gap-1.5">
          <h3 class="font-sans text-xs font-bold m-0" style="color: var(--text-primary);">Akun yang diingat di browser ini</h3>
          <p class="font-sans text-[11px] m-0" style="color: var(--text-secondary);">
            Hanya menyimpan identitas non-sensitif untuk mempercepat pemilihan akun. Menghapus dari sini tidak menghapus akun di server.
          </p>
        </div>

        <div class="flex flex-col gap-2" id="crew-accounts-list"></div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- MODAL KONFIRMASI AKSI SENSITIF -->
    <!-- ========================================== -->
    <div class="bottom-sheet-drawer modal-dialog" id="sheet-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
      <div class="bottom-sheet-handle"></div>
      <div class="bottom-sheet-content">
        <div class="flex items-center justify-between pb-2 border-b" style="border-color: var(--border-flat);">
          <h2 id="confirm-dialog-title" class="font-sans text-sm font-bold m-0" style="color: var(--text-primary);">Konfirmasi Tindakan</h2>
          <button type="button" aria-label="Tutup dialog konfirmasi" class="sp-icon-btn" onclick="StoryPad.resolveConfirmDialog(false)">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
        </div>
        <p id="confirm-dialog-message" class="font-sans text-xs leading-relaxed m-0" style="color: var(--text-secondary);"></p>
        <div class="pt-2 border-t flex items-center justify-end gap-2" style="border-color: var(--border-flat);">
          <button type="button" id="confirm-dialog-cancel" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.resolveConfirmDialog(false)">Batal</button>
          <button type="button" id="confirm-dialog-confirm" class="sp-btn sp-btn-danger sp-btn-compact" onclick="StoryPad.resolveConfirmDialog(true)">Lanjutkan</button>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- MODAL 4: TAMBAH / KONVERSI NASKAH (.DOCX, .TXT, .FOUNTAIN, TEKS) -->
    <!-- ========================================== -->
    <div class="bottom-sheet-drawer modal-dialog modal-dialog-wide" id="sheet-import-script" role="dialog" aria-modal="true" aria-labelledby="import-script-title">
      <div class="bottom-sheet-handle"></div>
      <div class="bottom-sheet-content">
        <div class="flex items-center justify-between pb-2 border-b" style="border-color: var(--border-flat);">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[20px]" style="color: var(--primary-text);" aria-hidden="true">upload_file</span>
            <div>
              <h2 id="import-script-title" class="font-sans text-sm font-bold m-0" style="color: var(--text-primary);">Tambah &amp; Konversi Naskah Produksi</h2>
              <p class="font-sans text-[11px] m-0" style="color: var(--text-secondary);">Konversi otomatis dokumen Word (.docx), Fountain (.fountain), Markdown (.md), atau teks biasa menjadi skrip interaktif.</p>
            </div>
          </div>
          <button type="button" aria-label="Tutup jendela impor naskah" class="sp-icon-btn" onclick="StoryPad.closeScriptImportModal()">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
        </div>

        <!-- Mode Source Tabs: Upload File vs Paste Text -->
        <div class="grid grid-cols-2 gap-1.5 p-1 rounded border" style="background-color: var(--panel-lowest); border-color: var(--border-flat);" role="tablist" aria-label="Metode input naskah">
          <button type="button" role="tab" aria-selected="true" id="import-tab-file" class="sp-btn sp-btn-primary sp-btn-compact" onclick="StoryPad.switchImportSourceTab('file')">
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">description</span>
            <span>Unggah Berkas (.docx / .txt)</span>
          </button>
          <button type="button" role="tab" aria-selected="false" id="import-tab-text" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.switchImportSourceTab('text')">
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">notes</span>
            <span>Tulis / Tempel Teks Naskah</span>
          </button>
        </div>

        <!-- Source Panel A: File Picker -->
        <div id="import-source-file" class="flex flex-col gap-2">
          <label for="input-script-file" class="sp-dropzone p-4 rounded border text-center flex flex-col items-center gap-1.5">
            <span class="material-symbols-outlined text-[28px]" style="color: var(--primary-text);" aria-hidden="true">upload_file</span>
            <span class="font-sans text-xs font-bold" id="import-file-picked-name" style="color: var(--text-primary);">Klik untuk memilih berkas naskah (.docx, .txt, .fountain, .md)</span>
            <span class="font-sans text-[11px]" style="color: var(--text-secondary);">Heading Scene, Nama Pemeran, Dialog, dan Catatan Ekspresi/Gesture akan diekstrak otomatis.</span>
          </label>
          <input type="file" id="input-script-file" accept=".docx,.txt,.fountain,.md" class="sr-only" onchange="StoryPad.handleScriptFileChosen(this)">
        </div>

        <!-- Source Panel B: Raw Script Textarea -->
        <div id="import-source-text" class="hidden flex flex-col gap-1.5">
          <label for="import-raw-textarea" class="font-sans text-xs font-semibold" style="color: var(--text-primary);">Teks Naskah (mendukung format Scene, KARAKTER, Dialog, dan Parenthetical)</label>
          <textarea id="import-raw-textarea" rows="6" class="sp-textarea font-mono text-xs" placeholder="JUDUL NASKAH&#10;Genre: Drama | Lokasi: Ruang Kelas&#10;&#10;SCENE 1 - PEMBUKA&#10;[SHOT: Wide shot ruangan kelas pagi hari]&#10;&#10;RAKA&#10;&quot;Semua kamera sudah siap merekam?&quot;&#10;(Emosi: Fokus | Gesture: Memeriksa monitor)" oninput="StoryPad.previewRawScriptDebounced()"></textarea>
        </div>

        <!-- Project Metadata Overrides -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div class="sm:col-span-2 flex flex-col gap-1">
            <label for="import-proj-title" class="font-sans text-[11px] font-semibold" style="color: var(--text-secondary);">Judul Naskah / Produksi</label>
            <input type="text" id="import-proj-title" class="sp-input" placeholder="Terdeteksi otomatis dari judul dokumen">
          </div>
          <div class="flex flex-col gap-1">
            <label for="import-proj-code" class="font-sans text-[11px] font-semibold" style="color: var(--text-secondary);">Kode Proyek</label>
            <input type="text" id="import-proj-code" class="sp-input font-mono" placeholder="Otomatis (mis. PRJ-01)">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div class="flex flex-col gap-1">
            <label for="import-proj-category" class="font-sans text-[11px] font-semibold" style="color: var(--text-secondary);">Kategori / Genre</label>
            <input type="text" id="import-proj-category" class="sp-input" placeholder="Film Pendek / Serial Web">
          </div>
          <div class="flex flex-col gap-1">
            <label for="import-proj-location" class="font-sans text-[11px] font-semibold" style="color: var(--text-secondary);">Lokasi Utama</label>
            <input type="text" id="import-proj-location" class="sp-input" placeholder="Mis. Studio Utama">
          </div>
          <div class="flex flex-col gap-1">
            <label for="import-proj-fps" class="font-sans text-[11px] font-semibold" style="color: var(--text-secondary);">Frame Rate</label>
            <select id="import-proj-fps" class="sp-input font-mono">
              <option value="24 fps">24 fps</option>
              <option value="25 fps">25 fps</option>
              <option value="23.98 fps">23.98 fps</option>
              <option value="30 fps">30 fps</option>
              <option value="60 fps">60 fps</option>
            </select>
          </div>
        </div>

        <!-- Live Conversion Preview -->
        <div id="import-preview-box" class="hidden sp-panel-muted p-3 flex flex-col gap-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-sans text-xs font-bold" style="color: var(--text-primary);">Pratinjau Hasil Konversi Naskah</span>
            <span class="sp-badge sp-badge-good font-mono tabular-nums" id="import-preview-counts">0 Scene | 0 Dialog</span>
          </div>
          <p class="font-mono text-[11px] m-0" id="import-preview-chars" style="color: var(--text-secondary);"></p>
          <div class="max-h-36 overflow-y-auto flex flex-col gap-1.5 pt-1 border-t" id="import-preview-lines" style="border-color: var(--border-flat);"></div>
        </div>

        <p id="import-script-feedback" class="hidden font-sans text-xs font-medium m-0" role="alert"></p>

        <div class="pt-2 border-t flex flex-wrap items-center justify-between gap-2" style="border-color: var(--border-flat);">
          <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.runScriptPreview()">
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">preview</span>
            <span>Uji Konversi</span>
          </button>
          <div class="flex items-center gap-2">
            <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.closeScriptImportModal()">Batal</button>
            <button type="button" id="btn-submit-import-script" class="sp-btn sp-btn-primary sp-btn-compact" onclick="StoryPad.submitScriptImport()">
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">cloud_upload</span>
              <span>Simpan &amp; Buka Naskah</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- MODAL 5: TAMBAH BARIS DIALOG / AKSI MANUAL -->
    <!-- ========================================== -->
    <div class="bottom-sheet-drawer modal-dialog" id="sheet-add-line" role="dialog" aria-modal="true" aria-labelledby="add-line-title">
      <div class="bottom-sheet-handle"></div>
      <div class="bottom-sheet-content">
        <div class="flex items-center justify-between pb-2 border-b" style="border-color: var(--border-flat);">
          <h2 id="add-line-title" class="font-sans text-sm font-bold m-0" style="color: var(--text-primary);">Tambah Baris ke Naskah Aktif</h2>
          <button type="button" aria-label="Tutup formulir baris baru" class="sp-icon-btn" onclick="StoryPad.closeAddLineModal()">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div class="flex flex-col gap-1">
            <label for="addline-scene-num" class="font-sans text-[11px] font-semibold" style="color: var(--text-secondary);">Nomor Scene</label>
            <input type="text" id="addline-scene-num" class="sp-input font-mono" value="01" placeholder="01">
          </div>
          <div class="flex flex-col gap-1">
            <label for="addline-type" class="font-sans text-[11px] font-semibold" style="color: var(--text-secondary);">Jenis Baris</label>
            <select id="addline-type" class="sp-input" onchange="StoryPad.toggleAddLineTypeFields(this.value)">
              <option value="dialogue">Dialog Pemeran</option>
              <option value="action">Deskripsi Aksi / Shot</option>
            </select>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label for="addline-scene-title" class="font-sans text-[11px] font-semibold" style="color: var(--text-secondary);">Judul Scene (Slugline)</label>
          <input type="text" id="addline-scene-title" class="sp-input font-mono" placeholder="SCENE 01 - BRIEFING">
        </div>

        <div id="addline-dialogue-fields" class="flex flex-col gap-2.5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div class="flex flex-col gap-1">
              <label for="addline-character" class="font-sans text-[11px] font-semibold" style="color: var(--text-secondary);">Nama Pemeran</label>
              <input type="text" id="addline-character" class="sp-input font-mono uppercase" placeholder="Mis. RAKA">
            </div>
            <div class="flex flex-col gap-1">
              <label for="addline-shot" class="font-sans text-[11px] font-semibold" style="color: var(--text-secondary);">Nomor Shot</label>
              <input type="text" id="addline-shot" class="sp-input font-mono" value="01" placeholder="01">
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label for="addline-dialogue-text" class="font-sans text-[11px] font-semibold" style="color: var(--text-secondary);">Teks Dialog</label>
            <textarea id="addline-dialogue-text" rows="2" class="sp-textarea font-mono" placeholder="Masukkan kalimat dialog pemeran..."></textarea>
          </div>
          <div class="flex flex-col gap-1">
            <label for="addline-parenthetical" class="font-sans text-[11px] font-semibold" style="color: var(--text-secondary);">Arahan Akting / Ekspresi (Opsional)</label>
            <input type="text" id="addline-parenthetical" class="sp-input" placeholder="Mis. Emosi: Serius | Gesture: Mengangkat tangan">
          </div>
        </div>

        <div id="addline-action-fields" class="hidden flex flex-col gap-1">
          <label for="addline-action-content" class="font-sans text-[11px] font-semibold" style="color: var(--text-secondary);">Deskripsi Aksi / Arahan Kamera</label>
          <textarea id="addline-action-content" rows="3" class="sp-textarea font-mono" placeholder="Mis. [SHOT: Wide shot interior lokasi utama]"></textarea>
        </div>

        <p id="addline-feedback" class="hidden font-sans text-xs font-medium m-0" role="alert"></p>

        <div class="pt-2 border-t flex items-center justify-end gap-2" style="border-color: var(--border-flat);">
          <button type="button" class="sp-btn sp-btn-secondary sp-btn-compact" onclick="StoryPad.closeAddLineModal()">Batal</button>
          <button type="button" class="sp-btn sp-btn-primary sp-btn-compact" onclick="StoryPad.submitAddLine()">
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
            <span>Tambahkan ke Naskah</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- TOAST SNACKBAR -->
    <!-- ========================================== -->
    <div class="toast-snackbar" id="toast-snackbar" role="status" aria-live="polite" aria-atomic="true">
      <span class="material-symbols-outlined text-[16px] text-[#34D399]" aria-hidden="true">check_circle</span>
      <span id="toast-message">Perubahan tersimpan</span>
    </div>
