<?php

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if (!scanner_is_installed()) {
    scanner_json(['ok' => false, 'installed' => false, 'marks' => []], 503);
}

try {
    scanner_ensure_storage();
    $marks = array_values(array_filter(scanner_read_marks(), static fn(array $mark): bool => ($mark['status'] ?? 'active') === 'active'));
    scanner_json([
        'ok' => true,
        'installed' => true,
        'marks' => array_map('scanner_public_mark', $marks),
    ]);
} catch (Throwable $e) {
    scanner_json(['ok' => false, 'error' => 'Unable to load registered marks.'], 500);
}
