# StoryPad Security Operations & Hardening Runbook

Dokumen operasional ini mendefinisikan prosedur backup, rotasi secret, pemisahan environment, respons insiden dasar, serta privasi data akun pada perangkat bersama untuk arsitektur StoryPad (Static SPA Vercel + PHP Native + Supabase).

---

## 1. Environment Separation (Production, Preview, Development)

- **Aturan Dasar:** Pisahkan project Supabase dan kredensial antara `Production`, `Preview`, dan `Development`. Jangan pernah memakai kredensial atau database production untuk uji coba lokal.
- **Pemisahan Rahasia:**
  - Frontend SPA (`app.js`, `index.html`, `server.js`) hanya boleh menerima `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_ID`, dan `SUPABASE_STORAGE_BUCKET`.
  - Backend PHP (`config/supabase.php`, `api/admin.php`, `admin.php`) menjaga `SUPABASE_SERVICE_ROLE_KEY` dan `STORYPAD_ADMIN_PASSWORD_HASH` hanya di server environment. Jangan pernah meneruskan `service_role` key ke template HTML atau JSON response publik.
  - Berkas `.env` wajib selalu berada dalam `.gitignore` dan tidak pernah di-commit ke repository Git.

---

## 2. Backup & Restore Procedures

### A. Database Postgres (Supabase)
- **Backup Otomatis:** Verifikasi jadwal daily backup / Point-in-Time Recovery (PITR) di **Supabase Dashboard -> Database -> Backups**.
- **Ekspor Manual Sebelum Migrasi Berisiko:** Sebelum menjalankan perubahan skema besar di SQL Editor, buat snapshot skema dan tabel inti (`projects`, `project_members`, `script_lines`, `takes`, `crew_profiles`, `notifications`, `security_audit_logs`).
- **Uji Restore Berkala (Minimal per Kuartal):**
  1. Restore snapshot ke project Supabase staging/development terpisah (bukan ke production).
  2. Verifikasi integritas foreign key (`projects -> project_members`, `script_lines`, `takes`) dan cek jumlah baris.
  3. Jalankan skrip verifikasi non-destruktif di SQL Editor:
     - `supabase/verify_p0_rls.sql`
     - `supabase/verify_p1_sessions_audit.sql`
     - `supabase/verify_p2_storage_policies.sql`

### B. Media Storage (`storypad-media`)
- Bucket `storypad-media` bersifat privat (`public = false`) dengan struktur path `<project_id>/<dialogue_id>_T<take>_<timestamp>_<filename>`.
- Pastikan backup eksternal untuk berkas audio/footage produksi mentah tetap tersimpan di media penyimpanan lokal studio, karena signed URL bersifat sementara (TTL 3600 detik).

---

## 3. Secret & API Key Rotation Runbook

Lakukan rotasi minimal setiap 90 hari atau segera jika dicurigai terjadi kebocoran:

1. **Rotasi Password Admin Studio PHP (`STORYPAD_ADMIN_PASSWORD_HASH`):**
   - Buat hash bcrypt/argon2id baru via PHP CLI aman (tanpa menyimpan plaintext di shell history):
     `php -r "echo password_hash(readline('New password: '), PASSWORD_DEFAULT), PHP_EOL;"`
   - Perbarui environment variable `STORYPAD_ADMIN_PASSWORD_HASH` di server PHP.
   - Uji login ulang ke `admin-login.php` dan pastikan sesi admin lama ditutup.
2. **Rotasi `SUPABASE_SERVICE_ROLE_KEY` / JWT Secret:**
   - Lakukan melalui **Supabase Dashboard -> Project Settings -> API**.
   - Perbarui `SUPABASE_SERVICE_ROLE_KEY` di environment PHP (`admin.php`, `api/admin.php`) terlebih dahulu sebelum mencabut key lama jika memakai grace window.
   - Catatan: rotasi JWT secret akan membatalkan semua JWT sesi aktif pengguna dan memaksa login ulang.
3. **Rotasi `SUPABASE_ANON_KEY`:**
   - Perbarui `.env` lokal, server PHP, dan Vercel Environment Variables secara bersamaan lalu redeploy aplikasi statis Vercel.

---

## 4. Incident Response Basics

### Skenario 1: Indikasi Akun Kru Terkompromi
1. Minta pengguna segera mengganti kata sandi dari menu **Profil -> Ubah Kata Sandi** (memerlukan kata sandi aktif atau recovery email) atau jalankan **Keluar Perangkat Lain**.
2. Jika pelaku sudah mengubah kata sandi, admin proyek mencabut sesi dari **Supabase Dashboard -> Authentication -> Users -> Revoke sessions / Ban user sementara**, lalu memicu password recovery resmi.
3. Periksa riwayat kejadian pada `public.security_audit_logs` untuk akun terkait (`login_success`, `password_changed`, `session_revoked`, `role_mode_*`).

### Skenario 2: Kebocoran `SUPABASE_SERVICE_ROLE_KEY` atau Kredensial Admin
1. Segera rotasi key yang bocor melalui Supabase Dashboard atau server env.
2. Periksa daftar user admin di `public.crew_profiles` (`is_studio_admin = true`, `granted_roles`) dan keanggotaan proyek (`public.project_members`) untuk memastikan tidak ada eskalasi hak akses tidak sah.
3. Audit log API Supabase dan hapus sesi mencurigakan.

### Skenario 3: Upaya Upload File Berbahaya / Konten Non-Media
1. Tolak di layer aplikasi (`api/media.php` memvalidasi ekstensi, MIME allowlist, `is_uploaded_file`, dan signature biner) serta layer storage (`storypad-media` bucket MIME & size limit 50 MB).
2. Jika file mencurigakan ditemukan di `storage.objects`, hapus objek langsung melalui Dashboard/Storage API agar signed URL tidak lagi berlaku.

---

## 5. Remembered Accounts & Data Retention Policy

- **Remembered Accounts (`storypad_remembered_accounts_v1`):**
  - Hanya menyimpan metadata tampilan minimal di browser lokal: `id`, `display_name`, `email`, `initials`, `last_used_at`.
  - **Dilarang keras** menyimpan password, PIN, `access_token`, `refresh_token`, atau role otorisasi di penyimpanan remembered accounts.
  - Pada perangkat bersama, kru disarankan menonaktifkan opsi ingat akun saat login atau menekan **Hapus Semua dari Perangkat** di layar Profil.
  - Menghapus akun dari perangkat hanya menghapus daftar lokal browser dan tidak menghapus akun/data server.
- **Retensi Audit Log (`public.security_audit_logs`):**
  - Data audit log terkait ke akun user via `ON DELETE CASCADE`, sehingga penghapusan user di `auth.users` ikut membersihkan audit log miliknya sesuai kebijakan penghapusan akun.
  - Metadata audit dibersihkan di frontend dan di RPC server untuk memblokir field sensitif (`password`, `token`, `secret`, `authorization`, `cookie`, `jwt`).
