<?php

declare(strict_types=1);
require __DIR__ . '/api/bootstrap.php';

$installed = scanner_is_installed();
$error = '';
$success = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$installed) {
    $key = trim((string)($_POST['admin_key'] ?? ''));
    $confirm = trim((string)($_POST['admin_key_confirm'] ?? ''));

    if (strlen($key) < 10) {
        $error = 'Use an admin key with at least 10 characters.';
    } elseif (!hash_equals($key, $confirm)) {
        $error = 'The admin keys do not match.';
    } else {
        try {
            scanner_ensure_storage();
            $config = "<?php\n\ndeclare(strict_types=1);\n\nreturn " . var_export([
                'admin_password_hash' => password_hash($key, PASSWORD_DEFAULT),
                'installed_at' => gmdate(DATE_ATOM),
            ], true) . ";\n";

            if (file_put_contents(SCANNER_CONFIG, $config, LOCK_EX) === false) {
                throw new RuntimeException('Unable to write scanner/config.php. Check directory permissions.');
            }
            @chmod(SCANNER_CONFIG, 0640);
            $success = true;
            $installed = true;
        } catch (Throwable $e) {
            $error = $e->getMessage();
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f7f4ed">
  <title>Install Mark Scanner</title>
  <link rel="stylesheet" href="assets/app.css">
</head>
<body class="app-body">
  <main class="shell narrow-shell">
    <header class="app-header">
      <a class="wordmark" href="../index.html"><span>Vacation</span><strong>Brain</strong></a>
      <span class="header-label">Mark Scanner</span>
    </header>

    <section class="panel install-panel">
      <p class="eyebrow">One-time setup</p>
      <h1><?= $installed ? 'Scanner installed.' : 'Install the scanner.' ?></h1>
      <p class="lede">This creates the shared mark registry and protects mark registration with an admin key. Camera images stay in the browser during recognition.</p>

      <?php if ($error !== ''): ?>
        <div class="notice error" role="alert"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
      <?php endif; ?>

      <?php if ($success): ?>
        <div class="notice success" role="status">Installation completed successfully.</div>
      <?php endif; ?>

      <?php if (!$installed): ?>
        <form method="post" class="form-stack">
          <label>Admin key
            <input type="password" name="admin_key" minlength="10" autocomplete="new-password" required>
          </label>
          <label>Confirm admin key
            <input type="password" name="admin_key_confirm" minlength="10" autocomplete="new-password" required>
          </label>
          <button class="primary-button" type="submit">Install scanner</button>
        </form>
      <?php else: ?>
        <div class="action-grid">
          <a class="primary-button" href="register.php">Register a mark</a>
          <a class="secondary-button" href="index.php">Open scanner</a>
        </div>
        <p class="microcopy">Keep your admin key private. It is stored only as a password hash.</p>
      <?php endif; ?>
    </section>
  </main>
</body>
</html>
