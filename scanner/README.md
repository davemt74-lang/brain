# Registered Mark Scanner v1

A deliberately small end-to-end scanner for the Vacation Brain app:

1. Install once and choose an admin key.
2. Register a brand name, local landing path, and reference mark image.
3. Open the camera scanner on a phone.
4. Center the physical mark in the reticle and scan.
5. The browser matches ORB visual features + affine geometric consistency against registered marks.
6. A confident match redirects to the brand's in-app landing page.

## Requirements

- PHP 8.1+
- Writable `scanner/` directory during first install so `config.php` can be created.
- Writable `scanner/data/` and `scanner/data/uploads/` directories.
- HTTPS (or localhost) for browser camera access.
- Internet access to load the official OpenCV.js runtime from `https://docs.opencv.org/4.13.0/opencv.js`.

No database, vector service, AI API key, or build step is required.

## Install

1. Deploy the repository.
2. Visit `/scanner/install.php`.
3. Create an admin key (10+ characters).
4. Visit `/scanner/register.php` and register the first mark.
5. Visit `/scanner/index.php` from a phone and scan it.

`scanner/config.php`, `scanner/data/marks.json`, and uploaded mark files are runtime data and should not be committed.

## Registration guidance

Use a clean, high-resolution reference image with enough visual detail. PNG, JPG, and WebP are supported. For v1, users should center the mark tightly inside the scan reticle.

Leaving the landing-page field blank creates a simple generated brand page at `scanner/brand.php?slug=...`. You can instead enter an in-app path such as `/index.html`.

## Recognition acceptance

A match is accepted only when:

- there are at least 7 geometrically consistent feature inliers,
- the inlier ratio is at least 42%,
- the combined confidence score is at least 50%, and
- the result is sufficiently separated from the second-best registered mark.

These conservative defaults are intentional for the first real-world test. Thresholds should be tuned from actual successful and rejected scans before scaling the registry.

## Privacy

Camera frames and selected photos are not uploaded to the server. The browser performs recognition locally and only downloads the registered reference marks.
