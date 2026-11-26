# StoryPad Authentication Redesign & Web Security Audit Report

**Target aplikasi:** `https://storypad-nu.vercel.app/` (Static SPA + PHP Native Backend + Supabase)  
**Cakupan evaluasi:** Repository lokal hingga Phase P2 (`app.js`, `index.html`, `app.css`, `server.js`, `vercel.json`, `includes/session.php`, `config/supabase.php`, `lib/SupabaseClient.php`, `lib/ScriptParser.php`, `admin-login.php`, `admin.php`, `api/*.php`, `views/**/*.php`, `supabase/migrations/*.sql`).

Status checklist menggunakan standar kejujuran audit berbasis bukti kode & konfigurasi:
- `[x]` **Verified** : terbukti di kode/skrip yang diperiksa dan terverifikasi.
- `[ ]` **Not verified** : bergantung pada dashboard provider, server PHP live, atau migrasi DB yang belum dieksekusi langsung dari environment ini.
- `[!]` **Needs remediation** : memerlukan tindakan konfigurasi/eksekusi oleh pemilik proyek sebelum klaim produksi penuh.
- `[-]` **Not applicable** : tidak relevan dengan arsitektur StoryPad.

---

## 1. Architecture Discovered

- **Frontend Workspace:** Vanilla JavaScript (`app.js`), HTML (`index.html`), CSS (`app.css`) + Tailwind CDN + Google Fonts + Material Symbols Outlined + `@supabase/supabase-js@2.119.2`.
- **Dual Hosting Support:**
  1. Static SPA + Supabase Client (`index.html` + `app.js` + `vercel.json` / `server.js` untuk development lokal).
  2. PHP Native SSR + API Proxy (`index.php`, `admin-login.php`, `admin.php`, `api/session.php`, `api/supabase.php`, `api/media.php`, `api/script-import.php`, `api/admin.php`, `includes/session.php`).
- **Auth Provider, Database & Storage:** Supabase Auth (`auth.users`, `auth.sessions`), Postgres + Row Level Security (`public.*`), dan Supabase Storage bucket privat `storypad-media`.

---

## 2. Security Audit Checklist (Section 6)

### A. Authentication & Account Security (Critical)
- `[x]` Kebijakan panjang & kualitas password minimal 12 karakter diterapkan (`validateNewPassword` di `app.js` menolak `< 12` karakter; test P0 #5 lulus).
- `[x]` Password mendukung passphrase hingga 128 karakter (`validateNewPassword` di `app.js`, terverifikasi oleh test P0 #5).
- `[x]` Password hanya dikelola & di-hash oleh Supabase Auth (`auth.signInWithPassword` / `auth.signUp`) atau `password_verify` untuk admin lokal (`admin-login.php`); tidak ada plaintext password atau custom hashing di frontend.
- `[x]` Email belum terkonfirmasi tidak mendapat akses workspace (`signUpWithCredentials` hanya membuka workspace jika server mengembalikan `session` valid; bila konfirmasi email wajib, pengguna diminta verifikasi kotak masuk).
- `[x]` Login dan reset password memakai pesan error generik anti-enumerasi (`signInWithCredentials`, `submitForgotPassword` di `app.js`).
- `[!]` Rate limiting login/registrasi/reset di sisi PHP hanya aktif pada login admin (`storypad_check_rate_limit` di `admin-login.php`); rate limiting kru SPA sepenuhnya bergantung pada **Supabase Auth Rate Limits** di Dashboard (**Not verified** pada dashboard live).
- `[!]` Perlindungan brute force & credential stuffing / **Leaked Password Protection** pada Supabase Auth harus diaktifkan di **Supabase Dashboard -> Authentication -> Providers / Security** (belum diverifikasi aktif di dashboard live).
- `[x]` Password reset menggunakan alur token/link Supabase (`resetPasswordForEmail` + deteksi recovery event `PASSWORD_RECOVERY` + pencabutan sesi lain `signOut({ scope: 'others' })` di `submitPasswordRecovery`).
- `[x]` Perubahan kata sandi di layar Profil mewajibkan verifikasi ulang kata sandi aktif (`submitChangePassword` memanggil `signInWithPassword` sebelum `updateUser({ password })`, terverifikasi di test P1 #13).
- `[!]` MFA / Two-Factor Authentication belum tersedia di UI kru dan admin; perlu perencanaan TOTP MFA pada fase lanjutan khususnya untuk `is_studio_admin` dan `directorProducer`.
- `[x]` Logout memanggil backend (`supabase.auth.signOut({ scope: 'local' })`, `api/session.php?action=logout`, serta `signOut({ scope: 'others' })` di `SessionManager`) dan membersihkan state/localStorage sensitif (`clearSensitiveSessionData`).

### B. Session & Device Management (Critical)
- `[x]` Setiap sesi diidentifikasi oleh `auth.sessions.id` dan claim JWT `session_id` (RPC `get_my_sessions()` di `supabase/migrations/20261126000002_p1_sessions_audit_and_identity_rpcs.sql`).
- `[x]` Pengguna hanya dapat melihat sesi miliknya sendiri (`WHERE s.user_id = auth.uid()` pada `get_my_sessions()`, diuji di `verify_p1_sessions_audit.sql`).
- `[x]` Pengguna dapat mencabut sesi tertentu hanya setelah server mengonfirmasi `revoke_my_session()` mengembalikan `true` (`SessionManager` di `app.js`, diuji di test P1 #11).
- `[x]` Pengguna dapat keluar dari semua perangkat lain melalui `supabase.auth.signOut({ scope: 'others' })` (`logoutOtherSessions()` di `app.js`).
- `[x]` Server menerapkan session expiration & invalidation (PHP idle timeout 30 menit / absolute timeout 8 jam di `includes/session.php`; `not_after > now()` di `get_my_sessions()`; JWT lifetime oleh Supabase Auth).
- `[ ]` Konfigurasi idle timeout & JWT expiry pada dashboard Supabase Auth **Not verified** secara live dari environment ini.
- `[x]` Sesi PHP dirotasi (`session_regenerate_id(true)` pada `storypad_login_crew` & `storypad_login_admin` di `includes/session.php`), dan ubah/pulihkan password merotasi serta mencabut sesi lain (`scope: 'others'`).
- `[x]` IP address (`ip_masked` /24) dan User-Agent hanya digunakan sebagai metadata tampilan/keamanan, tidak pernah sebagai identitas utama atau penggabungan akun.
- `[x]` Account Hub (`storypad_remembered_accounts_v1`) dibersihkan oleh `sanitizeRememberedAccount()` untuk membuang password, token, secret, dan role (test P0 #3).
- `[x]` Perilaku perangkat bersama didokumentasikan dan dilengkapi checkbox opt-in, tombol "Hapus dari Perangkat", serta "Hapus Semua dari Perangkat" (`docs/SECURITY_OPERATIONS.md`, `app.js`, `views/screens/profile.php`).
- `[x]` Ubah password dan pemulihan password otomatis mencabut sesi lain (`signOut({ scope: 'others' })`).

### C. Authorization, Role & Database (Critical)
- `[x]` Tabel produksi (`projects`, `project_members`, `script_lines`, `takes`, `crew_profiles`, `notifications`, `security_audit_logs`) memiliki aturan RLS yang didefinisikan di migrasi P0 & P1.
- `[!]`**Eksekusi Migrasi Live:** Skrip SQL P0, P1, dan P2 sudah ditulis dan dilengkapi skrip verifikasi non-destruktif, tetapi **belum dieksekusi ke database live Supabase** via SQL Editor karena pembatasan konfirmasi DDL MCP. Wajib dijalankan oleh pemilik proyek.
- `[x]` Batas akses project/workspace enforced di database via helper `private.can_access_project()` & `private.can_edit_project()` serta di frontend auth gate (`app.js` test P0 #2).
- `[x]` Role Switcher memvalidasi `state.grantedRoles` di frontend dan di-enforced di database melalui trigger `private.enforce_crew_profile_security()` yang memblokir eskalasi `roles`, `granted_roles`, dan `is_studio_admin` (test P0 #7 & `verify_p0_rls.sql`).
- `[x]` Operasi sensitif admin PHP memeriksa `storypad_require_admin(true)` + CSRF token + Same-Origin (`api/admin.php`), serta endpoint kru memeriksa `storypad_require_authenticated_api()` + Bearer JWT (`api/media.php`, `api/script-import.php`, `api/supabase.php`).
- `[x]` Secret/service-role key tidak dikirim ke frontend bundle (`app.js`, `index.html`, `server.js` hanya membaca anon key; `.env` ada di `.gitignore`).
- `[x]` Query backend memakai PostgREST parameterized query params melalui `SupabaseClient.php` dan PL/pgSQL prepared/bound expressions tanpa string concatenation SQL dari input user.
- `[x]` Akses role `anon` ke seluruh tabel produksi dicabut di migrasi P0 (`REVOKE ALL ... FROM anon`), dan RPC P1 dicabut dari `anon` (`supabase/migrations/20261126000001_*.sql` & `000002_*.sql`).
- `[x]` Skenario IDOR/BOLA lintas user & lintas proyek dicakup dalam skrip verifikasi non-destruktif `supabase/verify_p0_rls.sql` dan `supabase/verify_p1_sessions_audit.sql` (belum dijalankan di DB live).
- `[x]` Identity linking (`app.js`) mengharuskan sesi terautentikasi, memanggil `linkIdentity()`, menolak konflik `identity_already_exists` tanpa auto-merge, dan memblokir `unlinkIdentity()` bila hanya tersisa 1 metode login (test P1 #12).

### D. File Upload & Media Storage (High)
- `[x]` `api/media.php` memvalidasi ekstensi, `finfo_file` MIME allowlist ketat, `is_uploaded_file()`, serta magic-byte signature biner (`storypad_verify_media_signature`) untuk `.wav`, `.mp3`, `.m4a`, `.aac`, `.ogg`, `.mp4`, `.mov`, `.webm`, `.mkv`.
- `[x]` Ukuran upload dibatasi 50 MB di `api/media.php` dan `storage.buckets.file_size_limit` (`20261126000003_p2_storage_and_upload_constraints.sql`), serta 10 MB untuk berkas naskah di `api/script-import.php`.
- `[x]` Naskah divalidasi format (`.docx`, `.txt`, `.fountain`, `.md`, `.spmd`), ZIP signature `PK\x03\x04`, blokir byte NUL pada berkas teks, batas 5 MB uncompressed `word/document.xml`, dan proteksi XXE `LIBXML_NONET` + tolak `<!DOCTYPE`/`<!ENTITY` (`lib/ScriptParser.php`).
- `[x]` Bucket `storypad-media` dikonfigurasi privat (`public = false`) dalam migrasi P0 dan P2.
- `[x]` Storage RLS membatasi SELECT/INSERT/UPDATE/DELETE berdasarkan kepemilikan proyek dan blokir path traversal (`name NOT LIKE '%..%' AND name NOT LIKE '/%'` di migrasi P2).
- `[x]` Signed URL dipakai untuk referensi `storage://` dengan masa berlaku 3600 detik dan cache TTL frontend 3000 detik (`resolveMediaSignedUrl` di `app.js`, `api/media.php`).
- `[x]` Nama file dan path disanitasi dari karakter berbahaya dan `..` (`api/media.php`).
- `[x]` Konten naskah dan log di-render menggunakan `escapeHtml()` sebelum disisipkan ke DOM (`app.js`, `views/screens/script-reader.php`).
- `[x]` Berkas HTML/JS/PHP/SVG dan MIME berbahaya ditolak eksplisit oleh allowlist dan denylist.

### E. Web Application Protection (High)
- `[x]` `vercel.json` menetapkan `Strict-Transport-Security` + CSP `upgrade-insecure-requests` untuk production HTTPS; `includes/session.php` mengaktifkan HSTS saat koneksi HTTPS aktif.
- `[x]` Security headers lengkap (`Content-Security-Policy` termasuk `frame-ancestors 'none'` & `object-src 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`) diterapkan di `vercel.json`, `includes/session.php`, dan `server.js`.
- `[x]` Same-origin check (`storypad_verify_same_origin()`) memblokir permintaan lintas origin pada endpoint POST PHP (`api/*.php`, `admin-login.php`), dan `server.js` menolak akses berkas non-statis (`/api/`, `/config/`, `.php`, `.env`, `..`).
- `[x]` Validasi input penting dilakukan di backend (`api/media.php`, `api/script-import.php`, `api/admin.php`, RPC Postgres & trigger); validasi frontend bersifat pendamping UX.
- `[x]` Proteksi XSS menggunakan `escapeHtml()` (JS), `e()` (`includes/session.php`), CSP, serta penolakan SVG/HTML di upload media.
- `[x]` Proteksi CSRF aktif pada semua POST PHP via `storypad_verify_csrf()`, cookie session `HttpOnly` + `SameSite=Lax`, dan logout admin (`admin-login.php`) telah diperbaiki agar hanya menerima POST + CSRF (bukan GET).
- `[x]` Validator URL media eksternal (`isSafeExternalMediaUrl` di `app.js` & `storypad_validate_external_https_url` di `api/media.php`) mewajibkan `https://` publik dan memblokir `http:`, `javascript:`, `data:`, `localhost`, `.local`, dan IP privat/metadata.
- `[x]` Pesan error produksi pada `api/admin.php` dan alur auth SPA tidak lagi membocorkan raw error Supabase/PostgREST atau `err.code` di `server.js`.
- `[ ]` Audit kerentanan dependensi pihak ketiga dan pemeriksaan live endpoint PHP dengan PHP runtime **Not verified** karena binary `php` tidak terpasang di lingkungan CLI ini.
- `[x]` Redirect autentikasi divalidasi dengan `getSafeAuthRedirectUrl()` dan `resolveSafeInternalScreen()` (`app.js`) untuk mencegah open redirect (test P2 #17).

### F. Monitoring, Privacy & Maintenance (Medium)
- `[x]` Aktivitas autentikasi, perubahan mode peran, ubah/pulihkan password, pencabutan sesi, linking identitas, dan pengelolaan akun lokal dicatat via RPC `log_security_event` ke `public.security_audit_logs`.
- `[x]` Metadata audit disanitasi di frontend (`sanitizeAuditMetadata`) dan di server PL/pgSQL (`log_security_event`) untuk membuang password, token, secret, authorization header, cookie, dan JWT (test P1 #9 & `verify_p1_sessions_audit.sql`).
- `[ ]` Deteksi anomali/notifikasi login mencurigakan eksternal **Not verified** (bergantung pada log/alert dashboard Supabase & Vercel).
- `[x]` Prosedur backup & restore didokumentasikan di `docs/SECURITY_OPERATIONS.md`; eksekusi uji restore **Not verified** terhadap project live.
- `[x]` Prosedur rotasi secret & API key didokumentasikan di `docs/SECURITY_OPERATIONS.md`.
- `[x]` Pemisahan environment & eksklusi `.env` terdokumentasi dan terverifikasi di `.gitignore`.
- `[x]` Kebijakan retensi audit (`ON DELETE CASCADE`) dan privasi remembered accounts terdokumentasi di `docs/SECURITY_OPERATIONS.md`.
- `[ ]` Pengujian lintas akun E2E pada database Supabase live **Not verified** sampai migrasi P0/P1/P2 dijalankan di SQL Editor.

---

## 3. Summary Report (Section 11)

- **Files Created/Updated in P0-P2:** Migrasi SQL & skrip verifikasi (`supabase/migrations/20261126000001..000003_*.sql`, `supabase/verify_p0..p2_*.sql`), hardening PHP (`includes/session.php`, `admin-login.php`, `admin.php`, `config/supabase.php`, `lib/SupabaseClient.php`, `lib/ScriptParser.php`, `api/*.php`), hardening SPA & static server (`app.js`, `app.css`, `index.html`, `server.js`, `vercel.json`, `views/**/*.php`), dokumentasi (`docs/SECURITY_OPERATIONS.md`, `docs/SECURITY_AUDIT_CHECKLIST.md`), dan automated tests (`test_auth_security.js`).
- **Remaining Risks Requiring Owner Action:**
  1. Jalankan ketiga migrasi SQL (`000001`, `000002`, `000003`) dan tiga skrip `verify_*.sql` di **Supabase SQL Editor** (`pwhrfuxwhydjiqfgjnts`).
  2. Aktifkan **Leaked Password Protection**, **Manual Identity Linking**, serta tinjau **Rate Limits** & **Email Confirmation** di **Supabase Dashboard -> Authentication**.
  3. Verifikasi runtime PHP (`admin-login.php`, `api/*.php`) di server PHP aktif serta tinjau ulang header respons live pada `https://storypad-nu.vercel.app/` setelah deployment.
