<?php
declare(strict_types=1);

/**
 * Endpoint Konversi & Impor Naskah StoryPad (.docx, .txt, .fountain, .md, atau teks langsung).
 * Mendukung:
 *   POST ?action=parse  -> Ekstrak & pratinjau struktur scene/dialog tanpa menyimpan
 *   POST ?action=import -> Konversi & simpan langsung ke Supabase (projects + script_lines)
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$config = require __DIR__ . '/../config/supabase.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../lib/SupabaseClient.php';
require_once __DIR__ . '/../lib/ScriptParser.php';
storypad_send_security_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Gunakan metode POST untuk memproses naskah.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!storypad_verify_same_origin()) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Permintaan lintas origin ditolak.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!storypad_verify_csrf(is_string($csrfHeader) ? $csrfHeader : null)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Token keamanan tidak valid.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$client = new SupabaseClient(
    $config['supabase']['url'],
    $config['supabase']['anon_key'],
    15
);
$auth = storypad_require_authenticated_api($client);
$accessToken = (string) $auth['access_token'];
$userId = (string) ($auth['user']['id'] ?? '');

const STORYPAD_MAX_SCRIPT_BYTES = 10485760; // 10 MB

$action = isset($_GET['action']) && is_string($_GET['action']) ? trim($_GET['action']) : 'parse';
$contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));

$overrides = [];
$parsed = null;

try {
    if (str_contains($contentType, 'multipart/form-data')) {
        $overrides = [
            'id' => preg_replace('/[^a-zA-Z0-9_-]/', '', trim((string) ($_POST['project_id'] ?? ''))) ?? '',
            'code' => trim((string) ($_POST['code'] ?? '')),
            'title' => trim((string) ($_POST['title'] ?? '')),
            'category' => trim((string) ($_POST['category'] ?? '')),
            'fps' => trim((string) ($_POST['fps'] ?? '24 fps')),
            'day' => trim((string) ($_POST['day'] ?? 'Day 01')),
            'draft' => trim((string) ($_POST['draft'] ?? 'Draft v1.0')),
            'location' => trim((string) ($_POST['location'] ?? '')),
        ];

        if (!empty($_FILES['script_file']) && is_array($_FILES['script_file']) && ($_FILES['script_file']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
            $tmpPath = (string) $_FILES['script_file']['tmp_name'];
            if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
                throw new RuntimeException('Sumber unggahan berkas naskah tidak valid.');
            }
            $fileSize = (int) ($_FILES['script_file']['size'] ?? filesize($tmpPath));
            if ($fileSize <= 0 || $fileSize > STORYPAD_MAX_SCRIPT_BYTES) {
                throw new RuntimeException('Ukuran berkas naskah melebihi batas maksimum 10 MB.');
            }
            $origName = basename((string) ($_FILES['script_file']['name'] ?? 'naskah.docx'));
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            $overrides['source_filename'] = $origName;
            if ($overrides['draft'] === 'Draft v1.0') {
                $overrides['draft'] = 'Draft (' . $origName . ')';
            }

            if ($ext === 'docx') {
                $fh = @fopen($tmpPath, 'rb');
                $sig = $fh !== false ? (string) @fread($fh, 4) : '';
                if ($fh !== false) @fclose($fh);
                if ($sig !== "PK\x03\x04") {
                    throw new RuntimeException('Signature berkas .docx tidak valid.');
                }
                $blocks = ScriptParser::extractDocxBlocks($tmpPath);
                $parsed = ScriptParser::parseBlocks($blocks, $overrides);
            } elseif (in_array($ext, ['txt', 'fountain', 'md', 'spmd'], true)) {
                $raw = file_get_contents($tmpPath);
                if ($raw === false) {
                    throw new RuntimeException('Gagal membaca berkas teks yang diunggah.');
                }
                if (str_contains($raw, "\0")) {
                    throw new RuntimeException('Berkas naskah teks mengandung byte biner tidak valid.');
                }
                $parsed = ScriptParser::parseRawText($raw, $overrides);
            } else {
                throw new RuntimeException('Format berkas tidak didukung. Gunakan .docx, .txt, .fountain, atau .md.');
            }
        } elseif (!empty($_POST['raw_text']) && is_string($_POST['raw_text'])) {
            $parsed = ScriptParser::parseRawText($_POST['raw_text'], $overrides);
        } else {
            throw new RuntimeException('Pilih berkas naskah (.docx/.txt/.fountain) atau tempel teks naskah terlebih dahulu.');
        }
    } else {
        $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
        if (!is_array($payload)) {
            throw new RuntimeException('Payload JSON tidak valid.');
        }

        if (isset($payload['project'], $payload['lines']) && is_array($payload['project']) && is_array($payload['lines'])) {
            $parsed = [
                'project' => $payload['project'],
                'lines' => $payload['lines'],
                'summary' => $payload['summary'] ?? [
                    'line_count' => count($payload['lines']),
                ],
                'is_update' => !empty($payload['is_update']),
            ];
        } else {
            $rawText = trim((string) ($payload['raw_text'] ?? ''));
            if ($rawText === '') {
                throw new RuntimeException('Teks naskah kosong.');
            }
            $overrides = [
                'id' => preg_replace('/[^a-zA-Z0-9_-]/', '', trim((string) ($payload['project_id'] ?? ''))) ?? '',
                'code' => trim((string) ($payload['code'] ?? '')),
                'title' => trim((string) ($payload['title'] ?? '')),
                'category' => trim((string) ($payload['category'] ?? '')),
                'fps' => trim((string) ($payload['fps'] ?? '24 fps')),
                'day' => trim((string) ($payload['day'] ?? 'Day 01')),
                'draft' => trim((string) ($payload['draft'] ?? 'Draft v1.0')),
                'location' => trim((string) ($payload['location'] ?? '')),
                'source_filename' => trim((string) ($payload['source_filename'] ?? '')),
            ];
            $parsed = ScriptParser::parseRawText($rawText, $overrides);
            $parsed['is_update'] = ($overrides['id'] !== '');
        }
    }

    if (empty($parsed['lines'])) {
        throw new RuntimeException('Tidak ada baris adegan atau dialog yang terdeteksi dari naskah tersebut.');
    }

    if ($action === 'parse') {
        echo json_encode([
            'ok' => true,
            'project' => $parsed['project'],
            'lines' => $parsed['lines'],
            'summary' => $parsed['summary'],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'import') {
        $projectRow = $parsed['project'];
        $projectId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($projectRow['id'] ?? '')) ?? '';
        if ($projectId === '') {
            throw new RuntimeException('ID proyek tidak valid.');
        }
        $projectRow['id'] = $projectId;
        $isUpdate = !empty($overrides['id']) || !empty($parsed['is_update']);

        if ($isUpdate) {
            $updatePayload = $projectRow;
            unset($updatePayload['id'], $updatePayload['owner_id']);
            $projRes = $client->update('projects', ['id' => 'eq.' . $projectId], $updatePayload, $accessToken);
        } else {
            if ($userId !== '') {
                $projectRow['owner_id'] = $userId;
            }
            $projRes = $client->insert('projects', $projectRow, $accessToken);
        }
        if (!$projRes['ok']) {
            throw new RuntimeException('Gagal menyimpan proyek ke database.');
        }

        if ($isUpdate) {
            $archRes = $client->update('script_lines', ['project_id' => 'eq.' . $projectId], ['is_archived' => true], $accessToken);
            if (!$archRes['ok']) {
                throw new RuntimeException('Gagal mengarsipkan baris naskah lama.');
            }
            $linesRes = $client->upsert('script_lines', $parsed['lines'], 'id', $accessToken);
        } else {
            $linesRes = $client->insert('script_lines', $parsed['lines'], $accessToken);
        }
        if (!$linesRes['ok']) {
            throw new RuntimeException('Gagal menyimpan baris naskah ke database.');
        }

        storypad_update_session(['active_project_id' => $projectId]);

        echo json_encode([
            'ok' => true,
            'project' => $projectRow,
            'lines' => $parsed['lines'],
            'summary' => $parsed['summary'],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Action konverter tidak dikenal.'], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(422);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
