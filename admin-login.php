<?php
declare(strict_types=1);

/**
 * StoryPad - Halaman Autentikasi Admin Studio (PHP Native)
 */
$config = require __DIR__ . '/config/supabase.php';
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/lib/SupabaseClient.php';
storypad_send_security_headers();

$client = new SupabaseClient(
    $config['supabase']['url'],
    $config['supabase']['anon_key'],
    5
);

$session = storypad_get_session();
$activeTheme = isset($_GET['theme']) && in_array($_GET['theme'], ['daylight', 'slate'], true)
    ? $_GET['theme']
    : ($session['theme'] ?? 'slate');

$errorMsg = '';
$statusMsg = '';
$submittedEmail = '';

// Handle Logout Admin (wajib metode POST dengan same-origin dan CSRF token)
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'logout') {
    if (!storypad_verify_same_origin() || !storypad_verify_csrf($_POST['csrf_token'] ?? null)) {
        $errorMsg = 'Token keamanan tidak valid. Muat ulang halaman lalu coba lagi.';
    } else {
        storypad_logout_admin();
        $statusMsg = 'Sesi Admin Studio telah ditutup dengan aman.';
    }
}

// Jika sudah login admin dan tidak sedang logout, arahkan ke dashboard admin
if (storypad_is_admin_logged_in() && $statusMsg === '') {
    header('Location: admin.php');
    exit;
}

// Handle POST Login Admin
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? 'login') === 'login') {
    $csrf = isset($_POST['csrf_token']) && is_string($_POST['csrf_token']) ? $_POST['csrf_token'] : '';
    $submittedEmail = isset($_POST['email']) && is_string($_POST['email']) ? trim($_POST['email']) : '';
    $password = isset($_POST['password']) && is_string($_POST['password']) ? $_POST['password'] : '';
    $rateKey = 'admin_login_' . ($_SERVER['REMOTE_ADDR'] ?? 'local');
    $rateStatus = storypad_check_rate_limit($rateKey, 5, 900);

    if (!storypad_verify_csrf($csrf)) {
        $errorMsg = 'Sesi formulir kedaluwarsa. Silakan kirim ulang formulir login.';
    } elseif (!$rateStatus['allowed']) {
        $mins = (int) ceil($rateStatus['retry_after'] / 60);
        $errorMsg = "Terlalu banyak percobaan login gagal. Coba lagi dalam {$mins} menit.";
    } elseif ($submittedEmail === '' || $password === '') {
        $errorMsg = 'Masukkan email admin dan kata sandi terlebih dahulu.';
    } else {
        $adminConfig = $config['admin'] ?? [];
        $authMode = (string) ($adminConfig['auth_mode'] ?? 'hybrid');
        $allowedEmails = array_map('strtolower', (array) ($adminConfig['allowed_emails'] ?? []));
        $defaultAcc = (array) ($adminConfig['default_account'] ?? []);
        $authenticatedAdmin = null;

        // 1. Coba Supabase Auth jika mode hybrid atau supabase dan email termasuk daftar admin
        if (in_array($authMode, ['hybrid', 'supabase'], true) && in_array(strtolower($submittedEmail), $allowedEmails, true)) {
            $authRes = $client->signInWithPassword($submittedEmail, $password);
            if ($authRes['ok'] && is_array($authRes['data']) && !empty($authRes['data']['access_token'])) {
                $userMeta = $authRes['data']['user']['user_metadata'] ?? [];
                $name = (string) ($userMeta['full_name'] ?? ($defaultAcc['name'] ?? 'Admin Studio'));
                $words = preg_split('/\s+/', trim($name)) ?: [];
                $initials = '';
                foreach (array_slice($words, 0, 2) as $w) {
                    if ($w !== '') {
                        $initials .= strtoupper($w[0]);
                    }
                }
                $authenticatedAdmin = [
                    'name' => $name,
                    'initials' => $initials !== '' ? $initials : 'AD',
                    'email' => $submittedEmail,
                    'role' => 'Studio Super Admin',
                    'auth_source' => 'supabase',
                    'access_token' => (string) $authRes['data']['access_token'],
                ];
            }
        }

        // 2. Fallback / Local Mode: verifikasi akun admin di config PHP dengan password_verify
        if ($authenticatedAdmin === null && in_array($authMode, ['hybrid', 'local'], true)) {
            $defaultEmail = (string) ($defaultAcc['email'] ?? '');
            $defaultHash = (string) ($defaultAcc['password_hash'] ?? '');
            if (
                $defaultEmail !== ''
                && strcasecmp($submittedEmail, $defaultEmail) === 0
                && $defaultHash !== ''
                && password_verify($password, $defaultHash)
            ) {
                $authenticatedAdmin = [
                    'name' => (string) ($defaultAcc['name'] ?? 'Admin Studio'),
                    'initials' => (string) ($defaultAcc['initials'] ?? 'AD'),
                    'email' => $defaultEmail,
                    'role' => (string) ($defaultAcc['role'] ?? 'Studio Super Admin'),
                    'auth_source' => 'local',
                    'access_token' => null,
                ];
            }
        }

        if ($authenticatedAdmin !== null) {
            storypad_clear_rate_limit($rateKey);
            storypad_login_admin($authenticatedAdmin);
            header('Location: admin.php');
            exit;
        }

        storypad_record_failed_attempt($rateKey, 900);
        $errorMsg = 'Email atau kata sandi Admin Studio tidak cocok.';
    }
}

// Probe cepat status Supabase Auth untuk ditampilkan jujur di kolom kiri
$probeStart = microtime(true);
$probeRes = $client->authHealth();
$probeLatencyMs = (int) round((microtime(true) - $probeStart) * 1000);
$supabaseReachable = (bool) ($probeRes['ok'] ?? false);

$csrfToken = storypad_csrf_token();
$pageTitle = 'Admin Login | StoryPad Studio Control';

require __DIR__ . '/views/admin/login.php';

