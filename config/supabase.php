<?php
declare(strict_types=1);

/**
 * Konfigurasi Aplikasi, Supabase, Storage Media, dan Portal Admin StoryPad.
 * Semua kredensial sensitif dibaca dari environment variable atau file .env lokal.
 */
$envFile = dirname(__DIR__) . '/.env';
if (is_file($envFile) && is_readable($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#') || !str_contains($trimmed, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $trimmed, 2);
        $key = trim($key);
        $value = trim($value);
        if (
            strlen($value) >= 2
            && (($value[0] === '"' && $value[strlen($value) - 1] === '"')
                || ($value[0] === "'" && $value[strlen($value) - 1] === "'"))
        ) {
            $value = substr($value, 1, -1);
        }
        if ($key !== '' && getenv($key) === false) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
        }
    }
}

$env = static function (string $key, string $default = ''): string {
    $val = getenv($key);
    return ($val !== false && $val !== '') ? (string) $val : $default;
};

return [
    'app_name' => 'StoryPad',
    'app_version' => '4.0.0-php',
    'studio_name' => $env('STORYPAD_STUDIO_NAME', 'Kelompok 10'),
    'supabase' => [
        'url' => $env('SUPABASE_URL', ''),
        'anon_key' => $env('SUPABASE_ANON_KEY', ''),
        'project_id' => $env('SUPABASE_PROJECT_ID', ''),
        'storage_bucket' => $env('SUPABASE_STORAGE_BUCKET', 'storypad-media'),
    ],
    'admin' => [
        'auth_mode' => $env('STORYPAD_ADMIN_AUTH_MODE', 'hybrid'),
        'allowed_emails' => array_filter(array_map('trim', explode(',', $env('STORYPAD_ADMIN_EMAILS', 'admin@storypad.local')))),
        'default_account' => [
            'name' => $env('STORYPAD_ADMIN_NAME', 'Admin Produksi'),
            'initials' => $env('STORYPAD_ADMIN_INITIALS', 'AD'),
            'email' => $env('STORYPAD_ADMIN_EMAIL', ''),
            'role' => $env('STORYPAD_ADMIN_ROLE', 'Koordinator Produksi'),
            'password_hash' => $env('STORYPAD_ADMIN_PASSWORD_HASH', ''),
        ],
    ],
];
