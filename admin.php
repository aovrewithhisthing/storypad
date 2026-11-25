<?php
declare(strict_types=1);

/**
 * StoryPad - Dashboard Panel Admin Studio (PHP Native + Supabase)
 */
$config = require __DIR__ . '/config/supabase.php';
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/lib/SupabaseClient.php';

$admin = storypad_require_admin(false);
$session = storypad_get_session();
$activeTheme = ($session['theme'] ?? 'slate') === 'daylight' ? 'daylight' : 'slate';

$client = new SupabaseClient(
    $config['supabase']['url'],
    $config['supabase']['anon_key'],
    6
);
$accessToken = !empty($admin['access_token']) ? (string) $admin['access_token'] : null;

$start = microtime(true);
$bootstrap = $client->fetchBootstrap($accessToken);
$initialLatencyMs = (int) round((microtime(true) - $start) * 1000);

$supabaseConnected = (bool) ($bootstrap['ok'] ?? false);
$supabaseError = $supabaseConnected ? '' : (string) ($bootstrap['error'] ?? 'Gagal menghubungi Supabase.');
$initialData = $supabaseConnected ? $bootstrap['data'] : [
    'projects' => [],
    'script_lines' => [],
    'takes' => [],
    'crew_profiles' => [],
    'notifications' => [],
];

$csrfToken = storypad_csrf_token();
$pageTitle = 'Panel Admin Studio | StoryPad';

$adminBootJson = json_encode([
    'csrfToken' => $csrfToken,
    'supabaseConnected' => $supabaseConnected,
    'supabaseError' => $supabaseError,
    'initialLatencyMs' => $initialLatencyMs,
    'phpVersion' => PHP_VERSION,
    'appVersion' => $config['app_version'],
    'studioName' => $config['studio_name'],
    'projectId' => $config['supabase']['project_id'],
    'data' => $initialData,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);

require __DIR__ . '/views/admin/dashboard.php';

