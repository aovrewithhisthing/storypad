<?php
declare(strict_types=1);

/**
 * Endpoint Pengunggahan & Penautan Berkas Audio / Video Footage ke Take Produksi.
 * Menyimpan berkas fisik ke Supabase Storage bucket privat (storypad-media) dan memperbarui public.takes.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$config = require __DIR__ . '/../config/supabase.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../lib/SupabaseClient.php';
storypad_send_security_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Gunakan metode POST untuk mengelola media take.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!storypad_verify_csrf(is_string($csrfHeader) ? $csrfHeader : null)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Token keamanan tidak valid.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$bucket = (string) ($config['supabase']['storage_bucket'] ?? 'storypad-media');
$client = new SupabaseClient(
    $config['supabase']['url'],
    $config['supabase']['anon_key'],
    30
);

$auth = storypad_require_authenticated_api($client);
$accessToken = (string) $auth['access_token'];
$contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));

const STORYPAD_MAX_MEDIA_BYTES = 52428800; // 50 MB

function storypad_validate_external_https_url(string $url): bool
{
    $parts = parse_url($url);
    if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https') {
        return false;
    }
    $host = strtolower((string) ($parts['host'] ?? ''));
    if ($host === '' || $host === 'localhost' || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
        return false;
    }
    if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
        return filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
    }
    return filter_var($url, FILTER_VALIDATE_URL) !== false;
}

try {
    if (str_contains($contentType, 'multipart/form-data')) {
        $rawProjectId = trim((string) ($_POST['project_id'] ?? ''));
        $rawDialogueId = trim((string) ($_POST['dialogue_id'] ?? ''));
        $projectId = preg_replace('/[^a-zA-Z0-9_-]/', '', $rawProjectId) ?? '';
        $dialogueId = preg_replace('/[^a-zA-Z0-9_-]/', '', $rawDialogueId) ?? '';
        $takeNumber = max(1, (int) ($_POST['take_number'] ?? 1));
        $mediaType = strtolower(trim((string) ($_POST['media_type'] ?? 'audio')));
        $standardName = trim((string) ($_POST['standardized_filename'] ?? ''));
        $durationSec = isset($_POST['duration_seconds']) && $_POST['duration_seconds'] !== ''
            ? round((float) $_POST['duration_seconds'], 2)
            : null;

        if ($projectId === '' || $dialogueId === '' || !in_array($mediaType, ['audio', 'video'], true)) {
            throw new RuntimeException('Parameter project_id, dialogue_id, dan media_type (audio/video) tidak valid.');
        }

        if (empty($_FILES['media_file']) || !is_array($_FILES['media_file']) || ($_FILES['media_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new RuntimeException('Berkas media gagal diterima server.');
        }

        $tmpPath = (string) $_FILES['media_file']['tmp_name'];
        $origName = basename((string) ($_FILES['media_file']['name'] ?? ($mediaType === 'video' ? 'clip.mp4' : 'track.wav')));
        $fileSize = (int) ($_FILES['media_file']['size'] ?? filesize($tmpPath));

        if ($fileSize <= 0 || $fileSize > STORYPAD_MAX_MEDIA_BYTES) {
            throw new RuntimeException('Ukuran berkas melebihi batas maksimum 50 MB.');
        }

        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $allowedAudioExt = ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'webm'];
        $allowedVideoExt = ['mp4', 'mov', 'webm', 'mkv'];

        if ($mediaType === 'audio' && !in_array($ext, $allowedAudioExt, true)) {
            throw new RuntimeException('Format audio tidak didukung. Gunakan .wav, .mp3, .m4a, .aac, atau .ogg.');
        }
        if ($mediaType === 'video' && !in_array($ext, $allowedVideoExt, true)) {
            throw new RuntimeException('Format footage tidak didukung. Gunakan .mp4, .mov, atau .webm.');
        }

        $detectedMime = '';
        if (function_exists('finfo_open')) {
            $finfo = @finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo !== false) {
                $detectedMime = (string) (@finfo_file($finfo, $tmpPath) ?: '');
                @finfo_close($finfo);
            }
        }
        $mime = $detectedMime !== '' ? strtolower($detectedMime) : strtolower(trim((string) ($_FILES['media_file']['type'] ?? '')));

        $forbiddenMimes = ['text/html', 'text/javascript', 'application/javascript', 'application/x-httpd-php', 'image/svg+xml'];
        if (in_array($mime, $forbiddenMimes, true)) {
            throw new RuntimeException('Tipe konten berkas ditolak demi keamanan.');
        }

        if ($mime === '' || $mime === 'application/octet-stream') {
            $mimeMap = [
                'wav' => 'audio/wav',
                'mp3' => 'audio/mpeg',
                'm4a' => 'audio/mp4',
                'aac' => 'audio/aac',
                'ogg' => 'audio/ogg',
                'mp4' => 'video/mp4',
                'mov' => 'video/quicktime',
                'webm' => $mediaType === 'video' ? 'video/webm' : 'audio/webm',
                'mkv' => 'video/x-matroska',
            ];
            $mime = $mimeMap[$ext] ?? ($mediaType === 'video' ? 'video/mp4' : 'audio/wav');
        }

        $safeBase = $standardName !== ''
            ? preg_replace('/[^a-zA-Z0-9._-]+/', '_', pathinfo($standardName, PATHINFO_FILENAME)) . '.' . $ext
            : preg_replace('/[^a-zA-Z0-9._-]+/', '_', $origName);

        $objectPath = $projectId . '/' . $dialogueId . '_T' . str_pad((string) $takeNumber, 2, '0', STR_PAD_LEFT) . '_' . time() . '_' . $safeBase;
        $binary = file_get_contents($tmpPath);
        if ($binary === false) {
            throw new RuntimeException('Gagal membaca berkas media sementara.');
        }

        $uploadRes = $client->uploadStorageObject($bucket, $objectPath, $binary, $mime, $accessToken);
        if (!$uploadRes['ok']) {
            throw new RuntimeException('Gagal mengunggah berkas ke penyimpanan produksi.');
        }

        $storageRef = 'storage://' . $bucket . '/' . $objectPath;
        $signedRes = $client->createSignedStorageUrl($bucket, $objectPath, 3600, $accessToken);
        $signedUrl = !empty($signedRes['signed_url']) ? (string) $signedRes['signed_url'] : $storageRef;

        $takePatch = [
            'dialogue_id' => $dialogueId,
            'project_id' => $projectId,
            'take_number' => $takeNumber,
            'label' => trim((string) ($_POST['label'] ?? ('Take ' . str_pad((string) $takeNumber, 2, '0', STR_PAD_LEFT) . ' | CAM-A / BOOM'))),
            'tc' => trim((string) ($_POST['tc'] ?? '00:00 SMPTE')),
            'status_label' => trim((string) ($_POST['status_label'] ?? 'Hold')),
            'is_archived' => false,
        ];

        if ($mediaType === 'audio') {
            $takePatch['audio_url'] = $storageRef;
            $takePatch['audio_filename'] = $safeBase;
            $takePatch['audio_mime'] = $mime;
            $takePatch['audio_size_bytes'] = $fileSize;
        } else {
            $takePatch['video_url'] = $storageRef;
            $takePatch['video_filename'] = $safeBase;
            $takePatch['video_mime'] = $mime;
            $takePatch['video_size_bytes'] = $fileSize;
        }
        if ($durationSec !== null && $durationSec > 0) {
            $takePatch['duration_seconds'] = $durationSec;
        }

        $dbRes = $client->upsert('takes', $takePatch, 'dialogue_id,take_number', $accessToken);
        if (!$dbRes['ok']) {
            throw new RuntimeException('Berkas terunggah tetapi gagal memperbarui data take.');
        }

        echo json_encode([
            'ok' => true,
            'media_type' => $mediaType,
            'url' => $signedUrl,
            'storage_ref' => $storageRef,
            'filename' => $safeBase,
            'mime' => $mime,
            'size_bytes' => $fileSize,
            'duration_seconds' => $durationSec,
            'take' => is_array($dbRes['data']) && isset($dbRes['data'][0]) ? $dbRes['data'][0] : $takePatch,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Mode JSON: tautkan URL eksternal atau hapus lampiran media dari take
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($payload)) {
        throw new RuntimeException('Payload JSON tidak valid.');
    }

    $action = trim((string) ($payload['action'] ?? 'attach_url'));
    $projectId = preg_replace('/[^a-zA-Z0-9_-]/', '', trim((string) ($payload['project_id'] ?? ''))) ?? '';
    $dialogueId = preg_replace('/[^a-zA-Z0-9_-]/', '', trim((string) ($payload['dialogue_id'] ?? ''))) ?? '';
    $takeNumber = max(1, (int) ($payload['take_number'] ?? 1));
    $mediaType = strtolower(trim((string) ($payload['media_type'] ?? 'audio')));

    if ($dialogueId === '' || !in_array($mediaType, ['audio', 'video'], true)) {
        throw new RuntimeException('dialogue_id dan media_type wajib diisi.');
    }

    if ($action === 'clear_media') {
        $patch = $mediaType === 'audio'
            ? ['audio_url' => null, 'audio_filename' => null, 'audio_mime' => null, 'audio_size_bytes' => null]
            : ['video_url' => null, 'video_filename' => null, 'video_mime' => null, 'video_size_bytes' => null];
        $res = $client->update('takes', [
            'dialogue_id' => 'eq.' . $dialogueId,
            'take_number' => 'eq.' . $takeNumber,
        ], $patch, $accessToken);
        if (!$res['ok']) {
            throw new RuntimeException('Gagal menghapus tautan media.');
        }
        echo json_encode(['ok' => true, 'cleared' => $mediaType], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($projectId === '') {
        throw new RuntimeException('project_id wajib diisi.');
    }

    $url = trim((string) ($payload['url'] ?? ''));
    if ($url === '' || !storypad_validate_external_https_url($url)) {
        throw new RuntimeException('Masukkan URL media https:// eksternal yang valid.');
    }
    $filename = trim((string) ($payload['filename'] ?? basename(parse_url($url, PHP_URL_PATH) ?: ($mediaType === 'video' ? 'footage.mp4' : 'audio.wav'))));

    $upsertRow = [
        'dialogue_id' => $dialogueId,
        'project_id' => $projectId,
        'take_number' => $takeNumber,
        'label' => trim((string) ($payload['label'] ?? ('Take ' . str_pad((string) $takeNumber, 2, '0', STR_PAD_LEFT) . ' | CAM-A / BOOM'))),
        'tc' => trim((string) ($payload['tc'] ?? '00:00 SMPTE')),
        'status_label' => trim((string) ($payload['status_label'] ?? 'Hold')),
        'is_archived' => false,
    ];
    if ($mediaType === 'audio') {
        $upsertRow['audio_url'] = $url;
        $upsertRow['audio_filename'] = $filename;
    } else {
        $upsertRow['video_url'] = $url;
        $upsertRow['video_filename'] = $filename;
    }

    $res = $client->upsert('takes', $upsertRow, 'dialogue_id,take_number', $accessToken);
    if (!$res['ok']) {
        throw new RuntimeException('Gagal menautkan URL media ke take.');
    }

    echo json_encode([
        'ok' => true,
        'media_type' => $mediaType,
        'url' => $url,
        'filename' => $filename,
        'take' => is_array($res['data']) && isset($res['data'][0]) ? $res['data'][0] : $upsertRow,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(422);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
