<?php

declare(strict_types=1);

const SCANNER_ROOT = __DIR__ . '/..';
const SCANNER_CONFIG = SCANNER_ROOT . '/config.php';
const SCANNER_DATA = SCANNER_ROOT . '/data';
const SCANNER_UPLOADS = SCANNER_DATA . '/uploads';
const SCANNER_MARKS = SCANNER_DATA . '/marks.json';
const SCANNER_MAX_UPLOAD_BYTES = 8_388_608; // 8 MB

function scanner_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function scanner_is_installed(): bool
{
    return is_file(SCANNER_CONFIG);
}

function scanner_config(): array
{
    if (!scanner_is_installed()) {
        return [];
    }

    $config = require SCANNER_CONFIG;
    return is_array($config) ? $config : [];
}

function scanner_ensure_storage(): void
{
    foreach ([SCANNER_DATA, SCANNER_UPLOADS] as $dir) {
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new RuntimeException('Unable to create scanner storage directory.');
        }
    }

    if (!is_file(SCANNER_MARKS)) {
        scanner_write_json_file(SCANNER_MARKS, []);
    }
}

function scanner_read_marks(): array
{
    if (!is_file(SCANNER_MARKS)) {
        return [];
    }

    $raw = file_get_contents(SCANNER_MARKS);
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? array_values($decoded) : [];
}

function scanner_write_json_file(string $path, array $value): void
{
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new RuntimeException('Unable to create data directory.');
    }

    $tmp = $path . '.tmp.' . bin2hex(random_bytes(4));
    $json = json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false || file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
        @unlink($tmp);
        throw new RuntimeException('Unable to write scanner data.');
    }

    if (!rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException('Unable to finalize scanner data.');
    }
}

function scanner_slug(string $value): string
{
    $value = strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    return trim($value, '-');
}

function scanner_clean_name(string $value): string
{
    $value = preg_replace('/\s+/', ' ', trim($value)) ?? '';
    return substr($value, 0, 100);
}

function scanner_local_landing(string $value, string $slug): string
{
    $value = trim($value);
    if ($value === '') {
        $base = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/scanner/api/register.php')), '/');
        return ($base === '' ? '/scanner' : $base) . '/brand.php?slug=' . rawurlencode($slug);
    }

    if (str_contains($value, "\0") || preg_match('/^[a-z][a-z0-9+.-]*:/i', $value) || str_starts_with($value, '//')) {
        throw new InvalidArgumentException('Landing page must be an in-app path, not an external URL.');
    }

    if (!str_starts_with($value, '/') && !preg_match('/^[A-Za-z0-9._~\/?#=&%+-]+$/', $value)) {
        throw new InvalidArgumentException('Landing page contains unsupported characters.');
    }

    if (str_contains($value, '..')) {
        throw new InvalidArgumentException('Landing page cannot traverse parent directories.');
    }

    return substr($value, 0, 500);
}

function scanner_require_admin_key(): void
{
    if (!scanner_is_installed()) {
        scanner_json(['ok' => false, 'error' => 'Scanner is not installed.'], 503);
    }

    $config = scanner_config();
    $hash = (string)($config['admin_password_hash'] ?? '');
    $provided = trim((string)($_POST['admin_key'] ?? ($_SERVER['HTTP_X_SCANNER_ADMIN_KEY'] ?? '')));

    if ($hash === '' || $provided === '' || !password_verify($provided, $hash)) {
        scanner_json(['ok' => false, 'error' => 'Invalid admin key.'], 401);
    }
}

function scanner_public_mark(array $mark): array
{
    return [
        'id' => (string)($mark['id'] ?? ''),
        'name' => (string)($mark['name'] ?? ''),
        'slug' => (string)($mark['slug'] ?? ''),
        'landing_page' => (string)($mark['landing_page'] ?? ''),
        'image_url' => (string)($mark['image_url'] ?? ''),
        'status' => (string)($mark['status'] ?? 'active'),
        'created_at' => (string)($mark['created_at'] ?? ''),
        'updated_at' => (string)($mark['updated_at'] ?? ''),
    ];
}

function scanner_find_mark_by_slug(string $slug): ?array
{
    foreach (scanner_read_marks() as $mark) {
        if (($mark['slug'] ?? '') === $slug && ($mark['status'] ?? 'active') === 'active') {
            return $mark;
        }
    }
    return null;
}
