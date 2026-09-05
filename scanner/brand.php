<?php

declare(strict_types=1);
require __DIR__ . '/api/bootstrap.php';

$slug = scanner_slug((string)($_GET['slug'] ?? ''));
$mark = $slug !== '' ? scanner_find_mark_by_slug($slug) : null;
if ($mark === null) {
    http_response_code(404);
}
$name = $mark !== null ? (string)$mark['name'] : 'Brand not found';
$image = $mark !== null ? (string)$mark['image_url'] : '';
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f7f4ed">
  <title><?= htmlspecialchars($name, ENT_QUOTES, 'UTF-8') ?> · Brand</title>
  <link rel="stylesheet" href="assets/app.css">
</head>
<body class="app-body">
  <main class="shell narrow-shell">
    <header class="app-header">
      <a class="wordmark" href="../index.html"><span>Vacation</span><strong>Brain</strong></a>
      <a class="text-link" href="index.php">Scan again</a>
    </header>

    <section class="panel brand-landing">
      <?php if ($mark !== null): ?>
        <p class="eyebrow">Registered brand</p>
        <img class="brand-mark-large" src="<?= htmlspecialchars($image, ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars($name, ENT_QUOTES, 'UTF-8') ?> mark">
        <h1><?= htmlspecialchars($name, ENT_QUOTES, 'UTF-8') ?></h1>
        <p class="lede">You arrived here by scanning this registered mark in the real world.</p>
        <div class="action-grid">
          <a class="primary-button" href="../index.html">Open Vacation Brain</a>
          <a class="secondary-button" href="index.php">Scan another mark</a>
        </div>
      <?php else: ?>
        <p class="eyebrow">404</p>
        <h1>Brand not found.</h1>
        <p class="lede">This registered brand is unavailable.</p>
        <a class="primary-button" href="index.php">Back to scanner</a>
      <?php endif; ?>
    </section>
  </main>
</body>
</html>
