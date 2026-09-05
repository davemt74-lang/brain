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
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#081518">
  <title>Scan a Mark · Vacation Brain</title>
  <link rel="stylesheet" href="assets/app.css?v=20260904-2">
</head>
<body class="scanner-body">
  <main class="scanner-shell">
    <header class="scanner-header">
      <a class="scanner-back" href="../index.html" aria-label="Back to Vacation Brain">←</a>
      <div>
        <span class="scanner-kicker">Visual Mark Scanner</span>
        <strong>Point. Scan. Open.</strong>
      </div>
      <a class="scanner-register-link" href="register.php">Register</a>
    </header>

    <section class="camera-stage" data-camera-stage>
      <video playsinline muted autoplay data-video></video>
      <canvas data-capture-canvas hidden></canvas>
      <div class="camera-placeholder" data-placeholder>
        <span class="camera-glyph" aria-hidden="true">◎</span>
        <strong>Starting camera…</strong>
        <small>Allow camera access when your browser asks.</small>
      </div>

      <div class="scan-reticle" aria-hidden="true">
        <i></i><i></i><i></i><i></i>
        <span>Center the registered mark</span>
      </div>

      <div class="scan-result" hidden data-result>
        <img alt="Recognized brand mark" data-result-image>
        <div>
          <small>Mark recognized</small>
          <strong data-result-name></strong>
          <span data-result-confidence></span>
        </div>
      </div>
    </section>

    <section class="scanner-controls" aria-label="Scanner controls">
      <div class="engine-status"><span class="status-dot" data-engine-dot></span><span data-engine-status>Loading registered marks…</span></div>
      <div class="control-row">
        <label class="round-control" title="Use a photo">
          <input class="sr-only" type="file" accept="image/*" capture="environment" data-photo-input>
          <span aria-hidden="true">＋</span><small>Photo</small>
        </label>
        <button class="scan-button" type="button" data-scan><span></span><b>Scan</b></button>
        <button class="round-control" type="button" data-camera-toggle><span aria-hidden="true">◉</span><small>Camera</small></button>
      </div>
      <p class="scanner-message" role="status" aria-live="polite" data-message>Starting camera…</p>
    </section>
  </main>

  <script>
    window.Module = window.Module || {};
    window.Module.onRuntimeInitialized = function () {
      window.dispatchEvent(new Event('opencv-ready'));
    };
  </script>
  <script async src="https://docs.opencv.org/4.13.0/opencv.js"></script>
  <script src="assets/scanner.js?v=20260904-2" defer></script>
</body>
</html>