# StoryPad Admin Console Architecture & Operations Guide

## 1. Arsitektur & Komponen

- **Route UI:** `/admin` (`admin.html` + `admin.js`, styling `app.css`)
- **Trusted Server API:** `/api/admin-console` (`api/admin-console.js`, berjalan sebagai Vercel Serverless Function dan melalui `server.js` saat development lokal)
- **Database & RBAC:** `supabase/migrations/20261126000004_admin_console_rbac_invitations_audit.sql`
- **Verifikasi Non-Destruktif:** `supabase/verify_admin_console.sql`

Seluruh operasi administratif memverifikasi token JWT Supabase pengguna pada `/api/admin-console` (`GET /auth/v1/user`), lalu memanggil RPC Postgres `SECURITY DEFINER` (`SET search_path = ''`) menggunakan JWT pengguna tersebut sehingga pemeriksaan aktor, permission, dan cakupan proyek (`production_admin`) dijalankan oleh database tanpa pernah mengirim `SUPABASE_SERVICE_ROLE_KEY` ke browser.

---

## 2. Pemisahan Production Role vs System Role

- **Production Role** (`project_members.production_role` dan `crew_profiles.role_title`): Jabatan produksi seperti Director, Producer, Script Supervisor, Video Editor, atau Sound Recordist.
- **System Role** (`user_system_roles.system_role`): Hak akses administratif sistem:
  - `system_owner`: Pemilik sistem, pengelola kebijakan keamanan (`security.manage`), dan penetap `system_admin`/`system_owner`.
  - `system_admin`: Pengelola akun, sesi, audit log, dan keanggotaan lintas proyek tanpa akses mengubah `system_owner` atau kebijakan keamanan sistem.
  - `production_admin`: Hanya mengelola keanggotaan (`projects.manage_members`) dan undangan (`accounts.invite`) pada proyek yang berada di bawah cakupannya.
  - `crew_member` & `viewer`: Hanya dapat mengelola sesi miliknya sendiri (`sessions.read_own`, `sessions.revoke_own`) dan ditolak masuk ke Admin Console.

---

## 3. Batasan Auth Provider (Sessions & MFA)

- **Sessions & Devices:** Daftar sesi bersumber dari `auth.sessions`. Pencabutan sesi menghapus baris sesi refresh sehingga perangkat tidak dapat memperbarui token akses. Access token JWT yang masih aktif tetap berlaku sampai waktu kedaluwarsa JWT habis (lihat `docs/SECURITY_OPERATIONS.md`).
- **IP & User-Agent:** IP disamarkan `/24` (`regexp_replace(..., '.xxx')`) dan tidak pernah dipakai untuk menggabungkan akun atau menentukan kepemilikan identitas.
- **MFA & Leaked Password Protection:** Dikonfigurasi pada Supabase Dashboard -> Authentication. UI pendaftaran MFA di Admin Console belum tersedia pada fase ini.

---

## 4. Urutan Migrasi & Bootstrap System Owner Pertama

1. Jalankan migrasi secara berurutan di Supabase SQL Editor (`pwhrfuxwhydjiqfgjnts`):
   - `20261126000001_p0_ownership_strict_rls_and_role_protection.sql`
   - `20261126000002_p1_sessions_audit_and_identity_rpcs.sql`
   - `20261126000003_p2_storage_and_upload_constraints.sql`
   - `20261126000004_admin_console_rbac_invitations_audit.sql`
2. Daftarkan akun pemilik utama melalui alur registrasi normal di aplikasi (agar akun tercatat di `auth.users`).
3. Jalankan fungsi bootstrap satu kali melalui Supabase SQL Editor (hanya berhasil jika belum ada `system_owner`):
   ```sql
   SELECT private.bootstrap_first_system_owner('email-pemilik@domain-anda.com');
   ```
4. Verifikasi kebijakan dengan menjalankan `supabase/verify_admin_console.sql` (menggunakan `BEGIN; ... ROLLBACK;` tanpa meninggalkan data uji).

---

## 5. Pengujian Lokal

1. Pastikan `.env` memiliki `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_PROJECT_ID`.
2. Jalankan suite unit dan negative security tests:
   - `node test_admin_console.js`
   - `node test_auth_security.js`
   - `node test_storypad.js`
   - `node test_full_features.js`
3. Jalankan server lokal:
   - `node server.js`
   - Buka `http://127.0.0.1:3000/admin` di browser.
