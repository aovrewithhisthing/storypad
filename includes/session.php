<?php
declare(strict_types=1);

/**
 * Manajemen Sesi PHP Native untuk Kru Produksi & Admin Studio StoryPad.
 */
if (session_status() === PHP_SESSION_NONE) {
    $isHttps = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';

    @ini_set('session.use_strict_mode', '1');
    session_name('STORYPAD_SESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

const STORYPAD_ALLOWED_SCREENS = ['login', 'dashboard', 'projects', 'script-reader', 'profile'];
const STORYPAD_SESSION_IDLE_TIMEOUT = 1800;      // 30 menit
const STORYPAD_SESSION_ABSOLUTE_TIMEOUT = 28800; // 8 jam

/* ============================================================
 * HELPER UMUM, SECURITY HEADERS & CSRF
 * ============================================================ */

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function storypad_send_security_headers(): void
{
    if (headers_sent()) {
        return;
    }
    $isHttps = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';

    $csp = "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; "
        . "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; "
        . "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        . "font-src 'self' https://fonts.gstatic.com data:; "
        . "img-src 'self' data: blob: https:; "
        . "media-src 'self' blob: https:; "
        . "connect-src 'self' https://*.supabase.co wss://*.supabase.co";
    if ($isHttps) {
        $csp .= '; upgrade-insecure-requests';
        header('Strict-Transport-Security: max-age=63072000; includeSubDomains');
    }

    header('Content-Security-Policy: ' . $csp);
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('X-Frame-Options: DENY');
    header("Permissions-Policy: camera=(), microphone=(), geolocation=()");
    header('Cross-Origin-Opener-Policy: same-origin');
}

function storypad_verify_same_origin(): bool
{
    $hostHeader = strtolower(trim((string) ($_SERVER['HTTP_HOST'] ?? '')));
    if ($hostHeader === '') {
        return true;
    }

    $sourceUrl = '';
    if (!empty($_SERVER['HTTP_ORIGIN']) && is_string($_SERVER['HTTP_ORIGIN'])) {
        $sourceUrl = trim($_SERVER['HTTP_ORIGIN']);
    } elseif (!empty($_SERVER['HTTP_REFERER']) && is_string($_SERVER['HTTP_REFERER'])) {
        $sourceUrl = trim($_SERVER['HTTP_REFERER']);
    }

    if ($sourceUrl === '') {
        return true;
    }

    $parts = parse_url($sourceUrl);
    if (!is_array($parts)) {
        return false;
    }
    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $srcHost = strtolower((string) ($parts['host'] ?? ''));
    if ($srcHost === '' || !in_array($scheme, ['http', 'https'], true)) {
        return false;
    }
    $srcPort = isset($parts['port']) ? (int) $parts['port'] : ($scheme === 'https' ? 443 : 80);

    $expectedHostParts = explode(':', $hostHeader, 2);
    $expectedHost = $expectedHostParts[0];
    $expectedPort = isset($expectedHostParts[1])
        ? (int) $expectedHostParts[1]
        : ($scheme === 'https' ? 443 : 80);

    return $srcHost === $expectedHost && $srcPort === $expectedPort;
}

function storypad_csrf_token(): string
{
    if (empty($_SESSION['storypad_csrf']) || !is_string($_SESSION['storypad_csrf'])) {
        $_SESSION['storypad_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['storypad_csrf'];
}

function storypad_verify_csrf(?string $token): bool
{
    if (!is_string($token) || $token === '' || empty($_SESSION['storypad_csrf'])) {
        return false;
    }
    return hash_equals((string) $_SESSION['storypad_csrf'], $token);
}

function storypad_extract_bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!is_string($header) || $header === '') {
        return null;
    }
    if (preg_match('/^\s*Bearer\s+(.+)\s*$/i', $header, $m)) {
        $tok = trim($m[1]);
        return $tok !== '' ? $tok : null;
    }
    return null;
}

/* ============================================================
 * RATE LIMITING SEDERHANA (BRUTE FORCE PROTECTION)
 * ============================================================ */

function storypad_rate_limit_path(string $bucketKey): string
{
    return rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'storypad_rl_' . hash('sha256', $bucketKey) . '.json';
}

function storypad_check_rate_limit(string $bucketKey, int $maxAttempts = 5, int $windowSec = 900): array
{
    $path = storypad_rate_limit_path($bucketKey);
    $now = time();
    $attempts = [];

    if (is_file($path) && is_readable($path)) {
        $raw = @file_get_contents($path);
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        if (is_array($decoded)) {
            foreach ($decoded as $ts) {
                if (is_int($ts) && ($now - $ts) < $windowSec) {
                    $attempts[] = $ts;
                }
            }
        }
    }

    $count = count($attempts);
    $retryAfter = 0;
    if ($count >= $maxAttempts && $count > 0) {
        $oldest = min($attempts);
        $retryAfter = max(1, $windowSec - ($now - $oldest));
    }

    return [
        'allowed' => $count < $maxAttempts,
        'attempts' => $count,
        'retry_after' => $retryAfter,
    ];
}

function storypad_record_failed_attempt(string $bucketKey, int $windowSec = 900): void
{
    $path = storypad_rate_limit_path($bucketKey);
    $now = time();
    $attempts = [];

    if (is_file($path) && is_readable($path)) {
        $raw = @file_get_contents($path);
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        if (is_array($decoded)) {
            foreach ($decoded as $ts) {
                if (is_int($ts) && ($now - $ts) < $windowSec) {
                    $attempts[] = $ts;
                }
            }
        }
    }

    $attempts[] = $now;
    @file_put_contents($path, json_encode($attempts), LOCK_EX);
}

function storypad_clear_rate_limit(string $bucketKey): void
{
    $path = storypad_rate_limit_path($bucketKey);
    if (is_file($path)) {
        @unlink($path);
    }
}

/* ============================================================
 * SESI KRU PRODUKSI
 * ============================================================ */

function storypad_default_session(): array
{
    return [
        'logged_in' => false,
        'screen' => 'login',
        'persona_key' => '',
        'active_project_id' => '',
        'theme' => 'daylight',
        'user_id' => '',
        'access_token' => '',
        'logged_in_at' => 0,
        'last_activity_at' => 0,
        'user' => [
            'name' => 'Kru Produksi',
            'initials' => 'KP',
            'roleTitle' => 'Script Supervisor & Continuity',
            'idBadge' => 'SP-01',
            'studio' => 'StoryPad Studio',
            'prodName' => '-',
            'email' => '',
        ],
    ];
}

function storypad_is_session_expired(array $sess): bool
{
    if (empty($sess['logged_in'])) {
        return false;
    }
    $now = time();
    $loggedInAt = (int) ($sess['logged_in_at'] ?? 0);
    $lastActivityAt = (int) ($sess['last_activity_at'] ?? 0);
    if ($loggedInAt > 0 && ($now - $loggedInAt) > STORYPAD_SESSION_ABSOLUTE_TIMEOUT) {
        return true;
    }
    if ($lastActivityAt > 0 && ($now - $lastActivityAt) > STORYPAD_SESSION_IDLE_TIMEOUT) {
        return true;
    }
    return false;
}

function storypad_get_session(): array
{
    $defaults = storypad_default_session();
    if (!isset($_SESSION['storypad']) || !is_array($_SESSION['storypad'])) {
        $_SESSION['storypad'] = $defaults;
    }

    $_SESSION['storypad'] = array_merge($defaults, $_SESSION['storypad']);
    if (!isset($_SESSION['storypad']['user']) || !is_array($_SESSION['storypad']['user'])) {
        $_SESSION['storypad']['user'] = $defaults['user'];
    }

    if (storypad_is_session_expired($_SESSION['storypad'])) {
        return storypad_logout_session();
    }

    if (!empty($_SESSION['storypad']['logged_in'])) {
        if (empty($_SESSION['storypad']['user_id']) || empty($_SESSION['storypad']['access_token'])) {
            return storypad_logout_session();
        }
        $_SESSION['storypad']['last_activity_at'] = time();
    }

    return $_SESSION['storypad'];
}

function storypad_public_session_view(?array $session = null): array
{
    $s = $session ?? storypad_get_session();
    unset($s['access_token']);
    return $s;
}

function storypad_login_crew(array $verifiedUser, string $accessToken): array
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }

    $current = storypad_get_session();
    $theme = $current['theme'] ?? 'daylight';
    $userId = (string) ($verifiedUser['id'] ?? '');
    $email = (string) ($verifiedUser['email'] ?? '');
    $meta = is_array($verifiedUser['user_metadata'] ?? null) ? $verifiedUser['user_metadata'] : [];
    $displayName = trim((string) ($meta['full_name'] ?? ''));
    if ($displayName === '') {
        $displayName = $email !== '' ? explode('@', $email)[0] : 'Kru Produksi';
    }

    $words = preg_split('/\s+/', $displayName) ?: [];
    $initials = '';
    foreach (array_slice($words, 0, 2) as $w) {
        if ($w !== '') {
            $initials .= strtoupper($w[0]);
        }
    }
    if ($initials === '') {
        $initials = 'KP';
    }

    $now = time();
    $session = storypad_default_session();
    $session['logged_in'] = true;
    $session['screen'] = 'dashboard';
    $session['theme'] = $theme;
    $session['user_id'] = $userId;
    $session['access_token'] = $accessToken;
    $session['logged_in_at'] = $now;
    $session['last_activity_at'] = $now;
    $session['user'] = [
        'name' => $displayName,
        'initials' => $initials,
        'roleTitle' => 'Script Supervisor & Continuity',
        'idBadge' => 'SP-' . strtoupper(substr(str_replace('-', '', $userId), 0, 4)),
        'studio' => 'StoryPad Studio',
        'prodName' => '-',
        'email' => $email,
    ];

    $_SESSION['storypad'] = $session;
    return $session;
}

function storypad_update_session(array $patch): array
{
    $current = storypad_get_session();

    if (isset($patch['theme']) && in_array($patch['theme'], ['daylight', 'slate'], true)) {
        $current['theme'] = $patch['theme'];
    }

    if (!empty($current['logged_in'])) {
        if (isset($patch['screen']) && in_array($patch['screen'], STORYPAD_ALLOWED_SCREENS, true)) {
            $current['screen'] = $patch['screen'];
        }

        if (isset($patch['active_project_id']) && is_string($patch['active_project_id']) && $patch['active_project_id'] !== '') {
            $current['active_project_id'] = preg_replace('/[^a-zA-Z0-9_-]/', '', $patch['active_project_id']) ?? '';
        }
    }

    $_SESSION['storypad'] = $current;
    return $current;
}

function storypad_logout_session(): array
{
    $theme = $_SESSION['storypad']['theme'] ?? 'daylight';
    $_SESSION['storypad'] = storypad_default_session();
    $_SESSION['storypad']['theme'] = in_array($theme, ['daylight', 'slate'], true) ? $theme : 'daylight';
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }
    return $_SESSION['storypad'];
}

function storypad_get_crew_access_token(): ?string
{
    $session = storypad_get_session();
    if (empty($session['logged_in']) || empty($session['access_token'])) {
        return null;
    }
    return (string) $session['access_token'];
}

function storypad_resolve_initial_screen(array $session): string
{
    $requested = isset($_GET['page']) && is_string($_GET['page']) ? trim($_GET['page']) : '';
    if ($requested !== '' && in_array($requested, STORYPAD_ALLOWED_SCREENS, true)) {
        if ($requested === 'login') {
            return 'login';
        }
        return !empty($session['logged_in']) ? $requested : 'login';
    }

    if (!empty($session['logged_in'])) {
        $saved = $session['screen'] ?? 'dashboard';
        return ($saved !== 'login' && in_array($saved, STORYPAD_ALLOWED_SCREENS, true)) ? $saved : 'dashboard';
    }

    return 'login';
}

/* ============================================================
 * SESI ADMIN STUDIO (TERPISAH DARI SESI KRU)
 * ============================================================ */

function storypad_get_admin_session(): ?array
{
    if (!isset($_SESSION['storypad_admin']) || !is_array($_SESSION['storypad_admin'])) {
        return null;
    }
    if (empty($_SESSION['storypad_admin']['logged_in'])) {
        return null;
    }
    $now = time();
    $loggedInAt = (int) ($_SESSION['storypad_admin']['logged_in_at_ts'] ?? 0);
    $lastActivityAt = (int) ($_SESSION['storypad_admin']['last_activity_at'] ?? 0);
    if (($loggedInAt > 0 && ($now - $loggedInAt) > STORYPAD_SESSION_ABSOLUTE_TIMEOUT)
        || ($lastActivityAt > 0 && ($now - $lastActivityAt) > STORYPAD_SESSION_IDLE_TIMEOUT)) {
        storypad_logout_admin();
        return null;
    }
    $_SESSION['storypad_admin']['last_activity_at'] = $now;
    return $_SESSION['storypad_admin'];
}

function storypad_is_admin_logged_in(): bool
{
    return storypad_get_admin_session() !== null;
}

function storypad_login_admin(array $adminInfo): array
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }

    $now = time();
    $adminSession = [
        'logged_in' => true,
        'name' => (string) ($adminInfo['name'] ?? 'Admin Produksi'),
        'initials' => (string) ($adminInfo['initials'] ?? 'AD'),
        'email' => (string) ($adminInfo['email'] ?? ''),
        'role' => (string) ($adminInfo['role'] ?? 'Koordinator Produksi'),
        'auth_source' => (string) ($adminInfo['auth_source'] ?? 'local'),
        'access_token' => isset($adminInfo['access_token']) ? (string) $adminInfo['access_token'] : null,
        'logged_in_at' => date('c'),
        'logged_in_at_ts' => $now,
        'last_activity_at' => $now,
    ];

    $_SESSION['storypad_admin'] = $adminSession;
    return $adminSession;
}

function storypad_logout_admin(): void
{
    unset($_SESSION['storypad_admin']);
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }
}

function storypad_require_admin(bool $jsonResponse = false): array
{
    $admin = storypad_get_admin_session();
    if ($admin !== null) {
        return $admin;
    }

    if ($jsonResponse) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok' => false,
            'error' => 'Akses ditolak. Silakan login sebagai Admin terlebih dahulu.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    header('Location: admin-login.php');
    exit;
}

function storypad_require_authenticated_api(SupabaseClient $client): array
{
    $token = storypad_extract_bearer_token();
    if ($token === null) {
        $token = storypad_get_crew_access_token();
    }
    if ($token === null) {
        $admin = storypad_get_admin_session();
        if ($admin !== null && !empty($admin['access_token'])) {
            $token = (string) $admin['access_token'];
        }
    }

    if ($token !== null) {
        $userRes = $client->getUser($token);
        if (!empty($userRes['ok']) && is_array($userRes['data']) && !empty($userRes['data']['id'])) {
            return [
                'user' => $userRes['data'],
                'access_token' => $token,
            ];
        }
    }

    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'error' => 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
