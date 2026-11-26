<?php
declare(strict_types=1);

/**
 * StoryPad - Entry Point Utama (PHP Native + Supabase)
 * Routing: index.php?page=login|dashboard|projects|script-reader|profile
 */
$config = require __DIR__ . '/config/supabase.php';
require_once __DIR__ . '/includes/session.php';
storypad_send_security_headers();

$session = storypad_get_session();
$initialScreen = storypad_resolve_initial_screen($session);
$activeTheme = $session['theme'] ?? 'daylight';
$isAdminLoggedIn = storypad_is_admin_logged_in();

if (!empty($session['logged_in']) && $initialScreen !== 'login') {
    $session = storypad_update_session(['screen' => $initialScreen]);
}

$phpBoot = [
    'phpEnabled' => true,
    'appVersion' => $config['app_version'],
    'phpVersion' => PHP_VERSION,
    'studioName' => $config['studio_name'] ?? 'StoryPad Studio',
    'csrfToken' => storypad_csrf_token(),
    'initialScreen' => $initialScreen,
    'loggedIn' => (bool) ($session['logged_in'] ?? false),
    'theme' => $activeTheme,
    'personaKey' => $session['persona_key'] ?? '',
    'activeProjectId' => $session['active_project_id'] ?? '',
    'user' => $session['user'] ?? [],
    'adminLoggedIn' => $isAdminLoggedIn,
    'openImportOnLoad' => isset($_GET['import']) && $_GET['import'] === '1',
    'supabase' => [
        'url' => $config['supabase']['url'],
        'anonKey' => $config['supabase']['anon_key'],
        'projectId' => $config['supabase']['project_id'],
        'storageBucket' => $config['supabase']['storage_bucket'] ?? 'storypad-media',
    ],
    'endpoints' => [
        'session' => 'api/session.php',
        'supabase' => 'api/supabase.php',
        'scriptImport' => 'api/script-import.php',
        'media' => 'api/media.php',
    ],
];

$phpBootJson = json_encode($phpBoot, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
$pageTitle = 'StoryPad | Pencatatan Naskah & Jembatan Timeline NLE';

require __DIR__ . '/views/layout/head.php';
?>
<body data-active-screen="<?= e($initialScreen) ?>">
  <a href="#main-viewport" class="skip-link">Lewati ke konten utama</a>

  <div class="app-shell">
    <?php require __DIR__ . '/views/layout/navbar.php'; ?>

    <div class="workspace-shell">
      <div class="workspace-body">
        <main class="screen-viewport" id="main-viewport" tabindex="-1">
          <?php
          require __DIR__ . '/views/screens/login.php';
          require __DIR__ . '/views/screens/dashboard.php';
          require __DIR__ . '/views/screens/projects.php';
          require __DIR__ . '/views/screens/script-reader.php';
          require __DIR__ . '/views/screens/profile.php';
          ?>
        </main>

        <?php require __DIR__ . '/views/partials/inspector-panel.php'; ?>
      </div>
    </div>

    <?php require __DIR__ . '/views/partials/modals.php'; ?>
  </div>

  <script src="app.js"></script>
</body>
</html>
