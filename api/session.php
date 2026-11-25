<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../includes/session.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    echo json_encode([
        'ok' => true,
        'session' => storypad_get_session(),
        'admin_logged_in' => storypad_is_admin_logged_in(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
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
    echo json_encode(['ok' => true, 'session' => $session], JSON_UNESCAPED_UNICODE);
    exit;
}

$session = storypad_update_session($payload);
echo json_encode(['ok' => true, 'session' => $session], JSON_UNESCAPED_UNICODE);

