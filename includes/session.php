<?php
declare(strict_types=1);

/**
 * Manajemen Sesi PHP Native untuk Kru Produksi & Admin Studio StoryPad.
 */
if (session_status() === PHP_SESSION_NONE) {
    session_name('STORYPAD_SESSID');
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

const STORYPAD_ALLOWED_SCREENS = ['login', 'dashboard', 'projects', 'script-reader', 'profile'];

/* ============================================================
 * HELPER UMUM & CSRF
 * ============================================================ */

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
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

/* ============================================================
 * SESI KRU PRODUKSI
 * ============================================================ */

function storypad_default_session(): array
{
    return [
        'logged_in' => false,
        'screen' => 'login',
        'persona_key' => '',
        'active_project_id' => 'proj-jadi',
        'theme' => 'daylight',
        'user' => [
            'name' => 'Kru Produksi',
            'initials' => 'KP',
            'roleTitle' => 'Script Supervisor & Continuity',
            'idBadge' => 'K10-01',
            'studio' => 'Kelompok 10',
            'prodName' => 'JADI?',
            'email' => '',
        ],
    ];
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

    // Bersihkan residu sesi dummy lama apabila tersimpan di cookie sesi lama
    $legacyEmails = ['aulia@lifelikepictures.com', 'dimas.edit@lifelikepictures.com', 'sound.rama@lifelikepictures.com'];
    $curEmail = strtolower((string) ($_SESSION['storypad']['user']['email'] ?? ''));
    if (in_array($curEmail, $legacyEmails, true) || ($_SESSION['storypad']['active_project_id'] ?? '') === 'proj-1') {
        $_SESSION['storypad']['active_project_id'] = 'proj-jadi';
        if (in_array($curEmail, $legacyEmails, true)) {
            $_SESSION['storypad']['user'] = $defaults['user'];
            $_SESSION['storypad']['persona_key'] = '';
        }
    }

    return $_SESSION['storypad'];
}

function storypad_update_session(array $patch): array
{
    $current = storypad_get_session();

    if (isset($patch['logged_in'])) {
        $current['logged_in'] = (bool) $patch['logged_in'];
    }

    if (isset($patch['screen']) && in_array($patch['screen'], STORYPAD_ALLOWED_SCREENS, true)) {
        $current['screen'] = $patch['screen'];
    }

    if (isset($patch['persona_key']) && is_string($patch['persona_key'])) {
        $current['persona_key'] = $patch['persona_key'];
    }

    if (isset($patch['active_project_id']) && is_string($patch['active_project_id']) && $patch['active_project_id'] !== '') {
        $current['active_project_id'] = $patch['active_project_id'];
    }

    if (isset($patch['theme']) && in_array($patch['theme'], ['daylight', 'slate'], true)) {
        $current['theme'] = $patch['theme'];
    }

    if (isset($patch['user']) && is_array($patch['user'])) {
        $allowedUserKeys = ['name', 'initials', 'roleTitle', 'idBadge', 'studio', 'prodName', 'email'];
        foreach ($allowedUserKeys as $key) {
            if (isset($patch['user'][$key]) && is_string($patch['user'][$key])) {
                $current['user'][$key] = $patch['user'][$key];
            }
        }
    }

    $_SESSION['storypad'] = $current;
    return $current;
}

function storypad_logout_session(): array
{
    $theme = storypad_get_session()['theme'] ?? 'daylight';
    $_SESSION['storypad'] = storypad_default_session();
    $_SESSION['storypad']['theme'] = $theme;
    return $_SESSION['storypad'];
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

    $adminSession = [
        'logged_in' => true,
        'name' => (string) ($adminInfo['name'] ?? 'Admin Produksi'),
        'initials' => (string) ($adminInfo['initials'] ?? 'AD'),
        'email' => (string) ($adminInfo['email'] ?? ''),
        'role' => (string) ($adminInfo['role'] ?? 'Koordinator Produksi'),
        'auth_source' => (string) ($adminInfo['auth_source'] ?? 'local'),
        'access_token' => isset($adminInfo['access_token']) ? (string) $adminInfo['access_token'] : null,
        'logged_in_at' => date('c'),
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
