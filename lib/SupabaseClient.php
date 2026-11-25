<?php
declare(strict_types=1);

/**
 * Klien REST, Auth, & Storage Supabase ringan berbasis PHP Native (cURL dengan fallback stream).
 */
class SupabaseClient
{
    private string $url;
    private string $anonKey;
    private int $timeout;

    public function __construct(string $url, string $anonKey, int $timeout = 12)
    {
        $this->url = rtrim($url, '/');
        $this->anonKey = $anonKey;
        $this->timeout = $timeout;
    }

    /* ============================================================
     * POSTGREST CRUD HELPERS
     * ============================================================ */

    public function select(string $table, array $query = [], ?string $accessToken = null): array
    {
        $qs = http_build_query($query);
        $endpoint = '/rest/v1/' . rawurlencode($table) . ($qs !== '' ? '?' . $qs : '');
        return $this->request('GET', $endpoint, null, $accessToken);
    }

    public function insert(string $table, array $payload, ?string $accessToken = null): array
    {
        $endpoint = '/rest/v1/' . rawurlencode($table);
        return $this->request('POST', $endpoint, $payload, $accessToken, [
            'Prefer: return=representation',
        ]);
    }

    public function upsert(string $table, array $payload, ?string $onConflict = null, ?string $accessToken = null): array
    {
        $endpoint = '/rest/v1/' . rawurlencode($table);
        if ($onConflict !== null && $onConflict !== '') {
            $endpoint .= '?on_conflict=' . rawurlencode($onConflict);
        }
        return $this->request('POST', $endpoint, $payload, $accessToken, [
            'Prefer: resolution=merge-duplicates,return=representation',
        ]);
    }

    public function update(string $table, array $filters, array $payload, ?string $accessToken = null): array
    {
        $qs = http_build_query($filters);
        $endpoint = '/rest/v1/' . rawurlencode($table) . ($qs !== '' ? '?' . $qs : '');
        return $this->request('PATCH', $endpoint, $payload, $accessToken, [
            'Prefer: return=representation',
        ]);
    }

    public function delete(string $table, array $filters, ?string $accessToken = null): array
    {
        $qs = http_build_query($filters);
        $endpoint = '/rest/v1/' . rawurlencode($table) . ($qs !== '' ? '?' . $qs : '');
        return $this->request('DELETE', $endpoint, null, $accessToken, [
            'Prefer: return=representation',
        ]);
    }

    /* ============================================================
     * SUPABASE STORAGE HELPERS (AUDIO & FOOTAGE)
     * ============================================================ */

    public function uploadStorageObject(
        string $bucket,
        string $objectPath,
        string $binaryBody,
        string $contentType,
        ?string $accessToken = null
    ): array {
        $encodedSegments = array_map('rawurlencode', explode('/', ltrim($objectPath, '/')));
        $endpoint = '/storage/v1/object/' . rawurlencode($bucket) . '/' . implode('/', $encodedSegments);
        return $this->requestRaw('POST', $endpoint, $binaryBody, $contentType, $accessToken, [
            'x-upsert: true',
        ]);
    }

    public function publicStorageUrl(string $bucket, string $objectPath): string
    {
        $encodedSegments = array_map('rawurlencode', explode('/', ltrim($objectPath, '/')));
        return $this->url . '/storage/v1/object/public/' . rawurlencode($bucket) . '/' . implode('/', $encodedSegments);
    }

    /* ============================================================
     * GOTRUE AUTH HELPER
     * ============================================================ */

    public function signInWithPassword(string $email, string $password): array
    {
        return $this->request('POST', '/auth/v1/token?grant_type=password', [
            'email' => $email,
            'password' => $password,
        ]);
    }

    /* ============================================================
     * BOOTSTRAP DATA PRODUKSI (HANYA BARIS AKTIF NON-ARSIP)
     * ============================================================ */

    public function fetchBootstrap(?string $accessToken = null): array
    {
        $projects = $this->select('projects', [
            'select' => '*',
            'is_archived' => 'eq.false',
            'order' => 'sort_order.asc',
        ], $accessToken);
        if (!$projects['ok']) {
            return ['ok' => false, 'error' => $projects['error'] ?? 'Gagal memuat proyek dari Supabase'];
        }

        $lines = $this->select('script_lines', [
            'select' => '*',
            'is_archived' => 'eq.false',
            'order' => 'sort_order.asc',
        ], $accessToken);
        $takes = $this->select('takes', [
            'select' => '*',
            'is_archived' => 'eq.false',
            'order' => 'take_number.asc',
        ], $accessToken);
        $crew = $this->select('crew_profiles', [
            'select' => '*',
            'is_archived' => 'eq.false',
        ], $accessToken);
        $notifications = $this->select('notifications', [
            'select' => '*',
            'is_archived' => 'eq.false',
            'order' => 'id.asc',
        ], $accessToken);

        return [
            'ok' => true,
            'data' => [
                'projects' => is_array($projects['data']) ? $projects['data'] : [],
                'script_lines' => ($lines['ok'] && is_array($lines['data'])) ? $lines['data'] : [],
                'takes' => ($takes['ok'] && is_array($takes['data'])) ? $takes['data'] : [],
                'crew_profiles' => ($crew['ok'] && is_array($crew['data'])) ? $crew['data'] : [],
                'notifications' => ($notifications['ok'] && is_array($notifications['data'])) ? $notifications['data'] : [],
            ],
        ];
    }

    /* ============================================================
     * LOW-LEVEL HTTP TRANSPORT
     * ============================================================ */

    public function request(
        string $method,
        string $endpoint,
        ?array $body = null,
        ?string $accessToken = null,
        array $extraHeaders = []
    ): array {
        $jsonBody = $body !== null ? json_encode($body, JSON_UNESCAPED_UNICODE) : null;
        return $this->requestRaw($method, $endpoint, $jsonBody, 'application/json', $accessToken, $extraHeaders);
    }

    public function requestRaw(
        string $method,
        string $endpoint,
        ?string $rawBody = null,
        string $contentType = 'application/json',
        ?string $accessToken = null,
        array $extraHeaders = []
    ): array {
        $fullUrl = $this->url . $endpoint;
        $bearer = $accessToken ?: $this->anonKey;

        $headers = array_merge([
            'apikey: ' . $this->anonKey,
            'Authorization: Bearer ' . $bearer,
            'Accept: application/json',
            'Content-Type: ' . $contentType,
        ], $extraHeaders);

        if (function_exists('curl_init')) {
            return $this->requestWithCurl($method, $fullUrl, $headers, $rawBody);
        }

        return $this->requestWithStream($method, $fullUrl, $headers, $rawBody);
    }

    private function requestWithCurl(string $method, string $url, array $headers, ?string $rawBody): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => min(5, $this->timeout),
        ]);

        if ($rawBody !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $rawBody);
        }

        $raw = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
            return ['ok' => false, 'status' => 0, 'data' => null, 'error' => $curlErr ?: 'Koneksi cURL gagal'];
        }

        $decoded = json_decode($raw, true);
        $ok = $httpCode >= 200 && $httpCode < 300;
        $errMsg = null;
        if (!$ok) {
            if (is_array($decoded)) {
                $errMsg = (string) ($decoded['error_description'] ?? $decoded['msg'] ?? $decoded['message'] ?? $decoded['error'] ?? "HTTP $httpCode");
            } else {
                $errMsg = "HTTP $httpCode";
            }
        }

        return [
            'ok' => $ok,
            'status' => $httpCode,
            'data' => $decoded !== null ? $decoded : $raw,
            'error' => $errMsg,
        ];
    }

    private function requestWithStream(string $method, string $url, array $headers, ?string $rawBody): array
    {
        $contextOptions = [
            'http' => [
                'method' => $method,
                'header' => implode("\r\n", $headers),
                'timeout' => $this->timeout,
                'ignore_errors' => true,
            ],
        ];
        if ($rawBody !== null) {
            $contextOptions['http']['content'] = $rawBody;
        }

        $context = stream_context_create($contextOptions);
        $raw = @file_get_contents($url, false, $context);
        if ($raw === false) {
            return ['ok' => false, 'status' => 0, 'data' => null, 'error' => 'Gagal menghubungi endpoint Supabase'];
        }

        $httpCode = 200;
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
            $httpCode = (int) $m[1];
        }

        $decoded = json_decode($raw, true);
        $ok = $httpCode >= 200 && $httpCode < 300;
        $errMsg = null;
        if (!$ok) {
            if (is_array($decoded)) {
                $errMsg = (string) ($decoded['error_description'] ?? $decoded['msg'] ?? $decoded['message'] ?? $decoded['error'] ?? "HTTP $httpCode");
            } else {
                $errMsg = "HTTP $httpCode";
            }
        }

        return [
            'ok' => $ok,
            'status' => $httpCode,
            'data' => $decoded !== null ? $decoded : $raw,
            'error' => $errMsg,
        ];
    }
}
