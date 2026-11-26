<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$config = require __DIR__ . '/../config/supabase.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../lib/SupabaseClient.php';
storypad_send_security_headers();

$client = new SupabaseClient(
    $config['supabase']['url'],
    $config['supabase']['anon_key']
);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = isset($_GET['action']) && is_string($_GET['action']) ? trim($_GET['action']) : 'health';

if ($action === 'client_config') {
    echo json_encode([
        'ok' => true,
        'studioName' => $config['studio_name'] ?? 'StoryPad Studio',
        'supabase' => [
            'url' => $config['supabase']['url'],
            'anonKey' => $config['supabase']['anon_key'],
            'projectId' => $config['supabase']['project_id'],
            'storageBucket' => $config['supabase']['storage_bucket'] ?? 'storypad-media',
        ],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'health') {
    $start = microtime(true);
    $probe = $client->authHealth();
    $latencyMs = (int) round((microtime(true) - $start) * 1000);
    echo json_encode([
        'ok' => (bool) ($probe['ok'] ?? false),
        'php_version' => PHP_VERSION,
        'app_version' => $config['app_version'],
        'supabase_project_id' => $config['supabase']['project_id'],
        'supabase_status' => $probe['status'] ?? 0,
        'latency_ms' => $latencyMs,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$auth = storypad_require_authenticated_api($client);
$accessToken = (string) $auth['access_token'];

if ($method === 'POST') {
    $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!storypad_verify_csrf(is_string($csrfHeader) ? $csrfHeader : null)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Token keamanan tidak valid.']);
        exit;
    }
}

if ($action === 'bootstrap') {
    $result = $client->fetchBootstrap($accessToken);
    if (!$result['ok']) {
        http_response_code(502);
        echo json_encode(['ok' => false, 'error' => 'Gagal memuat data produksi.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'update_note' && $method === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    $dialogueId = is_array($payload) ? trim((string) ($payload['dialogue_id'] ?? '')) : '';
    if ($dialogueId === '' || strlen($dialogueId) > 128) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'dialogue_id tidak valid']);
        exit;
    }

    $res = $client->update(
        'script_lines',
        ['id' => 'eq.' . $dialogueId],
        ['continuity_note' => (string) ($payload['continuity_note'] ?? '')],
        $accessToken
    );
    if (!$res['ok']) {
        http_response_code(502);
        echo json_encode(['ok' => false, 'error' => 'Gagal menyimpan catatan kontinuitas.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode(['ok' => true, 'data' => $res['data']], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'archive_project' && $method === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    $projectId = is_array($payload) ? trim((string) ($payload['project_id'] ?? '')) : '';
    if ($projectId === '' || !preg_match('/^[a-zA-Z0-9_-]{1,128}$/', $projectId)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'project_id tidak valid']);
        exit;
    }

    $client->update('takes', ['project_id' => 'eq.' . $projectId], ['is_archived' => true], $accessToken);
    $client->update('script_lines', ['project_id' => 'eq.' . $projectId], ['is_archived' => true], $accessToken);
    $res = $client->update('projects', ['id' => 'eq.' . $projectId], ['is_archived' => true], $accessToken);
    if (!$res['ok']) {
        http_response_code(502);
        echo json_encode(['ok' => false, 'error' => 'Gagal mengarsipkan proyek.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode(['ok' => true, 'archived' => $projectId], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Action tidak dikenal']);
