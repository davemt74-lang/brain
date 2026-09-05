# Vacation Brain

Vacation Brain is a vintage coastal lifestyle and apparel brand site.

The storefront remains a lightweight, framework-free front end. The repository now also includes a small PHP-based registered-mark scanner under `/scanner/` so a physical brand mark can resolve to an in-app brand landing page.

## Current homepage

- Responsive desktop/mobile layout
- Sticky navigation with mobile drawer
- Vintage coastal hero and motel-inspired brand treatment
- Featured hat, tee, and hoodie collection cards
- Brand promise strip
- Story / lookbook section
- Newsletter interaction
- Lightweight add-to-cart feedback
- Reduced-motion support and accessible focus states

## Registered Mark Scanner

The v1 scanner provides the complete minimal flow:

1. One-time install and admin key
2. Register brand name + mark image + in-app landing path
3. Open a mobile camera scanner
4. Center the physical mark in the reticle
5. Match ORB features with geometric consistency in the browser
6. Redirect a confident match to the registered in-app landing page

Camera frames are processed locally in the browser and are not uploaded during recognition.

See [`scanner/README.md`](scanner/README.md) for deployment and testing details.

## Run the storefront locally

Open `index.html` directly or serve the repository with any static file server.

```bash
python -m http.server 8000
```

## Run the scanner locally

The scanner needs PHP:

```bash
php -S 127.0.0.1:8000
```

Then visit `http://127.0.0.1:8000/scanner/install.php`.

Production camera access requires HTTPS.

## Brand palette

- Midnight Navy: `#112B45`
- Deep Teal: `#0B6661`
- Sunset Rust: `#C74F30`
- Warm Cream: `#F5EFE5`

## Next storefront phases

1. Real product-detail pages and size / color variants
2. Cart drawer and checkout integration
3. Shop / collection archive
4. About and lookbook pages
5. CMS or commerce backend integration
6. SEO / social metadata and analytics hooks
