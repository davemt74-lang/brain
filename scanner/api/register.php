<?php

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    scanner_json(['ok' => false, 'error' => 'POST required.'], 405);
}

scanner_require_admin_key();

try {
    scanner_ensure_storage();

    $name = scanner_clean_name((string)($_POST['name'] ?? ''));
    $slug = scanner_slug((string)($_POST['slug'] ?? $name));
    if ($name === '' || $slug === '') {
        throw new InvalidArgumentException('Brand name and slug are required.');
    }

    $landingPage = scanner_local_landing((string)($_POST['landing_page'] ?? ''), $slug);

    if (!isset($_FILES['mark']) || !is_array($_FILES['mark'])) {
        throw new InvalidArgumentException('Choose a mark image.');
    }

    $file = $_FILES['mark'];
    $error = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        throw new InvalidArgumentException('The mark image upload failed.');
    }

    $tmp = (string)($file['tmp_name'] ?? '');
    $size = (int)($file['size'] ?? 0);
    if ($size < 1 || $size > SCANNER_MAX_UPLOAD_BYTES || !is_uploaded_file($tmp)) {
        throw new InvalidArgumentException('Mark image must be a valid upload no larger than 8 MB.');
    }

    $imageInfo = @getimagesize($tmp);
    if ($imageInfo === false) {
        throw new InvalidArgumentException('Uploaded file is not a valid image.');
    }

    [$width, $height, $imageType] = $imageInfo;
    if ($width < 64 || $height < 64 || $width > 6000 || $height > 6000) {
        throw new InvalidArgumentException('Mark image dimensions must be between 64 and 6000 pixels.');
    }

    $extensions = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG => 'png',
        IMAGETYPE_WEBP => 'webp',
    ];
    if (!isset($extensions[$imageType])) {
        throw new InvalidArgumentException('Use a JPG, PNG, or WebP mark image.');
    }

    $id = bin2hex(random_bytes(8));
    $filename = $slug . '-' . $id . '.' . $extensions[$imageType];
    $destination = SCANNER_UPLOADS . '/' . $filename;
    if (!move_uploaded_file($tmp, $destination)) {
        throw new RuntimeException('Unable to store the mark image.');
    }
    @chmod($destination, 0644);

    $scriptBase = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/scanner/api/register.php')), '/');
    $imageUrl = ($scriptBase === '' ? '/scanner' : $scriptBase) . '/data/uploads/' . rawurlencode($filename);
    $now = gmdate(DATE_ATOM);

    $marks = scanner_read_marks();
    $existingIndex = null;
    foreach ($marks as $index => $mark) {
        if (($mark['slug'] ?? '') === $slug) {
            $existingIndex = $index;
            break;
        }
    }

    $record = [
        'id' => $existingIndex !== null ? (string)($marks[$existingIndex]['id'] ?? $id) : $id,
        'name' => $name,
        'slug' => $slug,
        'landing_page' => $landingPage,
        'image_url' => $imageUrl,
        'status' => 'active',
        'created_at' => $existingIndex !== null ? (string)($marks[$existingIndex]['created_at'] ?? $now) : $now,
        'updated_at' => $now,
    ];

    if ($existingIndex !== null) {
        $oldImage = basename((string)($marks[$existingIndex]['image_url'] ?? ''));
        $marks[$existingIndex] = $record;
        if ($oldImage !== '' && $oldImage !== $filename) {
            @unlink(SCANNER_UPLOADS . '/' . $oldImage);
        }
    } else {
        $marks[] = $record;
    }

    scanner_write_json_file(SCANNER_MARKS, $marks);
    scanner_json(['ok' => true, 'mark' => scanner_public_mark($record)], 201);
} catch (InvalidArgumentException $e) {
    scanner_json(['ok' => false, 'error' => $e->getMessage()], 422);
} catch (Throwable $e) {
    scanner_json(['ok' => false, 'error' => 'Unable to register the mark.'], 500);
}
