<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$config = require __DIR__ . '/../config/supabase.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../lib/SupabaseClient.php';
storypad_send_security_headers();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    echo json_encode([
        'ok' => true,
        'csrf_token' => storypad_csrf_token(),
        'session' => storypad_public_session_view(),
        'admin_logged_in' => storypad_is_admin_logged_in(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!storypad_verify_csrf(is_string($csrfHeader) ? $csrfHeader : null)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Token keamanan tidak valid. Muat ulang halaman.']);
    exit;
}

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput ?: '{}', true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON payload']);
    exit;
}

$action = isset($payload['action']) && is_string($payload['action']) ? $payload['action'] : 'update';

if ($action === 'logout') {
    $session = storypad_logout_session();
    echo json_encode([
        'ok' => true,
        'csrf_token' => storypad_csrf_token(),
        'session' => storypad_public_session_view($session),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'sync_auth') {
    $token = storypad_extract_bearer_token();
    if ($token === null) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Token autentikasi tidak ditemukan.']);
        exit;
    }

    $client = new SupabaseClient(
        $config['supabase']['url'],
        $config['supabase']['anon_key']
    );
    $userRes = $client->getUser($token);
    if (empty($userRes['ok']) || !is_array($userRes['data']) || empty($userRes['data']['id'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Sesi autentikasi tidak valid.']);
        exit;
    }

    $session = storypad_login_crew($userRes['data'], $token);
    echo json_encode([
        'ok' => true,
        'csrf_token' => storypad_csrf_token(),
        'session' => storypad_public_session_view($session),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$session = storypad_update_session($payload);
echo json_encode([
    'ok' => true,
    'session' => storypad_public_session_view($session),
], JSON_UNESCAPED_UNICODE);
