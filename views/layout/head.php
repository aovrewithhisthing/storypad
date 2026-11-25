<?php
declare(strict_types=1);

/**
 * Shared <head> layout untuk StoryPad Crew Workspace (PHP Native).
 * Membutuhkan variabel: $pageTitle, $activeTheme, $phpBootJson
 */
$pageTitle = $pageTitle ?? 'StoryPad | Pencatatan Naskah & Jembatan Timeline NLE';
$activeTheme = ($activeTheme ?? 'daylight') === 'slate' ? 'slate' : 'daylight';
?>
<!DOCTYPE html>
<html lang="id" data-theme="<?= e($activeTheme) ?>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title><?= e($pageTitle) ?></title>

  <!-- Google Fonts: Inter & JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;600;700&amp;display=swap" rel="stylesheet">

  <!-- Material Symbols Outlined -->
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet">

  <!-- Tailwind CSS CDN & Supabase JS -->
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/dist/umd/supabase.min.js" defer></script>
  <script id="tailwind-config">
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            "primary": "#2563EB",
            "secondary": "#047857",
            "tertiary": "#D97706",
            "error": "#DC2626"
          },
          fontFamily: {
            sans: ["Inter", "sans-serif"],
            mono: ["JetBrains Mono", "monospace"]
          }
        }
      }
    };
  </script>

  <link rel="stylesheet" href="app.css">
  <?php if (!empty($phpBootJson)): ?>
  <script>
    window.STORYPAD_PHP_BOOT = <?= $phpBootJson ?>;
  </script>
  <?php endif; ?>
</head>

