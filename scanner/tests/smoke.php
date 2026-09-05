<?php

declare(strict_types=1);

require __DIR__ . '/../api/bootstrap.php';

function expect(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$_SERVER['SCRIPT_NAME'] = '/scanner/api/register.php';

expect(scanner_slug(' Vacation Brain! ') === 'vacation-brain', 'slug normalization');
expect(scanner_clean_name("  Vacation   Brain  ") === 'Vacation Brain', 'name normalization');
expect(scanner_local_landing('', 'vacation-brain') === '/scanner/brand.php?slug=vacation-brain', 'default in-app landing path');
expect(scanner_local_landing('/index.html', 'vacation-brain') === '/index.html', 'explicit local landing path');

$rejectedExternal = false;
try {
    scanner_local_landing('https://example.com', 'vacation-brain');
} catch (InvalidArgumentException) {
    $rejectedExternal = true;
}
expect($rejectedExternal, 'external landing URL rejection');

$rejectedTraversal = false;
try {
    scanner_local_landing('../admin.php', 'vacation-brain');
} catch (InvalidArgumentException) {
    $rejectedTraversal = true;
}
expect($rejectedTraversal, 'parent traversal rejection');

echo "Scanner smoke tests passed.\n";
