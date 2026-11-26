<?php
declare(strict_types=1);

/**
 * StoryPad - API Admin Studio (PHP Native -> Supabase)
 * Semua endpoint dilindungi sesi admin & CSRF token.
 */
header('Content-Type: application/json; charset=utf-8');

$config = require __DIR__ . '/../config/supabase.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../lib/SupabaseClient.php';

$admin = storypad_require_admin(true);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = isset($_GET['action']) && is_string($_GET['action']) ? trim($_GET['action']) : 'overview';

$client = new SupabaseClient(
    $config['supabase']['url'],
    $config['supabase']['anon_key'],
    10
);
$accessToken = !empty($admin['access_token']) ? (string) $admin['access_token'] : null;

if ($method === 'POST') {
    $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!storypad_verify_csrf(is_string($csrfHeader) ? $csrfHeader : null)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Token CSRF tidak valid. Muat ulang halaman.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if ($action === 'overview' && $method === 'GET') {
    $start = microtime(true);
    $boot = $client->fetchBootstrap($accessToken);
    $latencyMs = (int) round((microtime(true) - $start) * 1000);

    if (!$boot['ok']) {
        http_response_code(502);
        echo json_encode([
            'ok' => false,
            'error' => $boot['error'] ?? 'Gagal memuat data dari Supabase.',
            'latency_ms' => $latencyMs,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'latency_ms' => $latencyMs,
        'php_version' => PHP_VERSION,
        'data' => $boot['data'],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'health_check') {
    $start = microtime(true);
    $probe = $client->select('projects', ['select' => 'id', 'is_archived' => 'eq.false', 'limit' => '1'], $accessToken);
    $latencyMs = (int) round((microtime(true) - $start) * 1000);

    echo json_encode([
        'ok' => (bool) $probe['ok'],
        'status' => $probe['status'] ?? 0,
        'latency_ms' => $latencyMs,
        'php_version' => PHP_VERSION,
        'supabase_project_id' => $config['supabase']['project_id'],
        'checked_at' => date('H:i:s'),
        'error' => $probe['error'] ?? null,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$payload = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Payload JSON tidak valid'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'save_crew') {
    $fullName = trim((string) ($payload['full_name'] ?? ''));
    $email = trim((string) ($payload['email'] ?? ''));
    $roleTitle = trim((string) ($payload['role_title'] ?? 'Script Supervisor & Continuity'));
    $studio = trim((string) ($payload['studio'] ?? ($config['studio_name'] ?? 'StoryPad Studio')));
    $prodName = trim((string) ($payload['prod_name'] ?? '-'));
    $idBadge = trim((string) ($payload['id_badge'] ?? ''));
    $personaKey = trim((string) ($payload['persona_key'] ?? ''));

    if ($fullName === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'Nama lengkap dan email kru yang valid wajib diisi.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($personaKey === '') {
        $slug = preg_replace('/[^a-z0-9_]+/', '_', strtolower(explode('@', $email)[0]));
        $personaKey = 'crew_' . trim((string) $slug, '_');
    }

    if ($idBadge === '') {
        $idBadge = 'SP-' . random_int(100, 999);
    }

    $words = preg_split('/\s+/', $fullName) ?: [];
    $initials = '';
    foreach (array_slice($words, 0, 2) as $w) {
        if ($w !== '') {
            $initials .= strtoupper($w[0]);
        }
    }
    if ($initials === '') {
        $initials = 'KP';
    }

    $rolesInput = is_array($payload['roles'] ?? null) ? $payload['roles'] : [];
    $roles = [
        'scriptSupervisor' => !empty($rolesInput['scriptSupervisor']),
        'videoEditor' => !empty($rolesInput['videoEditor']),
        'soundRecordist' => !empty($rolesInput['soundRecordist']),
        'directorProducer' => !empty($rolesInput['directorProducer']),
        'autoExportMeta' => isset($rolesInput['autoExportMeta']) ? (bool) $rolesInput['autoExportMeta'] : true,
    ];

    $row = [
        'persona_key' => $personaKey,
        'full_name' => $fullName,
        'initials' => $initials,
        'role_title' => $roleTitle,
        'id_badge' => $idBadge,
        'studio' => $studio,
        'prod_name' => $prodName,
        'email' => $email,
        'roles' => $roles,
        'is_archived' => false,
    ];

    $res = $client->upsert('crew_profiles', $row, 'persona_key', $accessToken);
    if (!$res['ok']) {
        http_response_code(502);
        echo json_encode(['ok' => false, 'error' => $res['error'] ?? 'Gagal menyimpan data kru ke Supabase.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['ok' => true, 'crew' => $row, 'result' => $res['data']], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'delete_crew') {
    $personaKey = trim((string) ($payload['persona_key'] ?? ''));
    if ($personaKey === '') {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'persona_key wajib diisi.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $res = $client->update('crew_profiles', ['persona_key' => 'eq.' . $personaKey], ['is_archived' => true], $accessToken);
    if (!$res['ok']) {
        http_response_code(502);
        echo json_encode(['ok' => false, 'error' => $res['error'] ?? 'Gagal mengarsipkan kru di Supabase.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['ok' => true, 'deleted' => $personaKey], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'save_project') {
    $id = trim((string) ($payload['id'] ?? ''));
    $code = trim((string) ($payload['code'] ?? ''));
    $title = trim((string) ($payload['title'] ?? ''));
    $category = trim((string) ($payload['category'] ?? 'Film Pendek'));
    $day = trim((string) ($payload['day'] ?? 'Day 01'));
    $fps = trim((string) ($payload['fps'] ?? '24 fps'));
    $syncStatus = trim((string) ($payload['sync_status'] ?? 'Ready'));
    $draft = trim((string) ($payload['draft'] ?? 'Draft v1.0'));
    $sceneTitle = trim((string) ($payload['scene_title'] ?? 'SCENE 01'));

    if ($title === '' || $code === '') {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'Kode proyek dan judul proyek wajib diisi.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($id === '') {
        $id = 'proj-' . strtolower((string) preg_replace('/[^a-z0-9]+/i', '', $code)) . '-' . substr((string) time(), -4);
    }

    $row = [
        'id' => $id,
        'code' => strtoupper($code),
        'title' => $title,
        'subtitle' => $category . ' | ' . $title,
        'category' => $category,
        'tag' => $syncStatus,
        'day' => $day,
        'fps' => $fps,
        'sync_status' => $syncStatus,
        'draft' => $draft,
        'scene_number' => trim((string) ($payload['scene_number'] ?? '01')),
        'shot_number' => trim((string) ($payload['shot_number'] ?? '01')),
        'slug_number' => trim((string) ($payload['slug_number'] ?? 'SCENE 01')),
        'scene_title' => $sceneTitle,
        'scene_timecode' => trim((string) ($payload['scene_timecode'] ?? '00:00:00:00')),
        'take_info' => trim((string) ($payload['take_info'] ?? '0 TAKE')),
        'takes_logged' => (int) ($payload['takes_logged'] ?? 0),
        'good_take_percentage' => (int) ($payload['good_take_percentage'] ?? 0),
        'review_percentage' => (int) ($payload['review_percentage'] ?? 0),
        'sort_order' => (int) ($payload['sort_order'] ?? 10),
        'is_archived' => false,
    ];

    $res = $client->upsert('projects', $row, 'id', $accessToken);
    if (!$res['ok']) {
        http_response_code(502);
        echo json_encode(['ok' => false, 'error' => $res['error'] ?? 'Gagal menyimpan proyek ke Supabase.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['ok' => true, 'project' => $row, 'result' => $res['data']], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'delete_project') {
    $id = trim((string) ($payload['id'] ?? ''));
    if ($id === '') {
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => 'ID proyek wajib diisi.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $client->update('takes', ['project_id' => 'eq.' . $id], ['is_archived' => true], $accessToken);
    $client->update('script_lines', ['project_id' => 'eq.' . $id], ['is_archived' => true], $accessToken);
    $res = $client->update('projects', ['id' => 'eq.' . $id], ['is_archived' => true], $accessToken);
    if (!$res['ok']) {
        http_response_code(502);
        echo json_encode(['ok' => false, 'error' => $res['error'] ?? 'Gagal mengarsipkan proyek di Supabase.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['ok' => true, 'deleted' => $id], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Action admin tidak dikenal'], JSON_UNESCAPED_UNICODE);
