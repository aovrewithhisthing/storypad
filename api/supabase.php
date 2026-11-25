<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$config = require __DIR__ . '/../config/supabase.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../lib/SupabaseClient.php';

$client = new SupabaseClient(
    $config['supabase']['url'],
    $config['supabase']['anon_key']
);

$action = isset($_GET['action']) && is_string($_GET['action']) ? trim($_GET['action']) : 'health';

if ($action === 'client_config') {
    echo json_encode([
        'ok' => true,
        'studioName' => $config['studio_name'] ?? 'Kelompok 10',
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
    $probe = $client->select('projects', ['select' => 'id', 'is_archived' => 'eq.false', 'limit' => '1']);
    $latencyMs = (int) round((microtime(true) - $start) * 1000);
    echo json_encode([
        'ok' => $probe['ok'],
        'php_version' => PHP_VERSION,
        'app_version' => $config['app_version'],
        'supabase_project_id' => $config['supabase']['project_id'],
        'supabase_status' => $probe['status'] ?? 0,
        'latency_ms' => $latencyMs,
        'error' => $probe['error'] ?? null,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'bootstrap') {
    $result = $client->fetchBootstrap();
    if (!$result['ok']) {
        http_response_code(502);
    }
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'update_note' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload) || empty($payload['dialogue_id'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'dialogue_id wajib diisi']);
        exit;
    }

    $res = $client->update(
        'script_lines',
        ['id' => 'eq.' . (string) $payload['dialogue_id']],
        ['continuity_note' => (string) ($payload['continuity_note'] ?? '')]
    );
    if (!$res['ok']) {
        http_response_code(502);
    }
    echo json_encode($res, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'archive_project' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    $projectId = is_array($payload) ? trim((string) ($payload['project_id'] ?? '')) : '';
    if ($projectId === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'project_id wajib diisi']);
        exit;
    }

    $client->update('takes', ['project_id' => 'eq.' . $projectId], ['is_archived' => true]);
    $client->update('script_lines', ['project_id' => 'eq.' . $projectId], ['is_archived' => true]);
    $res = $client->update('projects', ['id' => 'eq.' . $projectId], ['is_archived' => true]);
    if (!$res['ok']) {
        http_response_code(502);
    }
    echo json_encode(['ok' => $res['ok'], 'archived' => $projectId, 'error' => $res['error'] ?? null], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Action tidak dikenal']);
