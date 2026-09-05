<?php

declare(strict_types=1);
require __DIR__ . '/api/bootstrap.php';
if (!scanner_is_installed()) {
    header('Location: install.php', true, 302);
    exit;
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f7f4ed">
  <title>Register Mark · Vacation Brain</title>
  <link rel="stylesheet" href="assets/app.css">
</head>
<body class="app-body">
  <main class="shell">
    <header class="app-header">
      <a class="wordmark" href="../index.html"><span>Vacation</span><strong>Brain</strong></a>
      <nav class="app-nav" aria-label="Scanner navigation">
        <a href="index.php">Scanner</a>
        <a aria-current="page" href="register.php">Register</a>
      </nav>
    </header>

    <section class="split-layout">
      <div class="panel form-panel">
        <p class="eyebrow">Brand registry</p>
        <h1>Register a mark.</h1>
        <p class="lede">Upload the cleanest version of the mark you want the camera to recognize. Reusing a slug updates that mark.</p>

        <form class="form-stack" data-register-form enctype="multipart/form-data">
          <label>Brand name
            <input type="text" name="name" maxlength="100" placeholder="Vacation Brain" required data-name>
          </label>
          <label>Slug
            <input type="text" name="slug" maxlength="100" placeholder="vacation-brain" required data-slug>
          </label>
          <label>In-app landing page <span class="label-note">optional</span>
            <input type="text" name="landing_page" maxlength="500" placeholder="Leave blank for generated brand page">
          </label>
          <label>Admin key
            <input type="password" name="admin_key" autocomplete="current-password" required>
          </label>
          <label class="upload-zone" data-upload-zone>
            <input class="sr-only" type="file" name="mark" accept="image/png,image/jpeg,image/webp" required data-mark-file>
            <span class="upload-title">Choose mark image</span>
            <span class="upload-help">PNG, JPG or WebP · 8 MB max</span>
            <img alt="Selected mark preview" hidden data-preview>
          </label>
          <button class="primary-button" type="submit" data-submit>Register mark</button>
          <p class="form-status" role="status" aria-live="polite" data-status></p>
        </form>
      </div>

      <aside class="panel registry-panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Active registry</p><h2>Registered marks</h2></div>
          <span class="count-pill" data-mark-count>0</span>
        </div>
        <div class="mark-list" data-mark-list><p class="empty-state">Loading registry…</p></div>
      </aside>
    </section>
  </main>
  <script src="assets/register.js" defer></script>
</body>
</html>
