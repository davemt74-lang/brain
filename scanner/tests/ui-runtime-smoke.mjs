import fs from 'node:fs';

const page = fs.readFileSync(new URL('../index.php', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../assets/scanner.js', import.meta.url), 'utf8');

const expect = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
};

expect(page.includes('data-camera-toggle'), 'camera control exists');
expect(page.includes('data-photo-input'), 'photo control exists');
expect(page.includes('data-scan'), 'scan control exists');
expect(runtime.includes("cameraToggle.addEventListener('click'"), 'camera click handler is attached directly');
expect(runtime.includes("photoInput.addEventListener('change'"), 'photo handler is attached directly');
expect(runtime.includes("scanButton.addEventListener('click'"), 'scan handler is attached directly');
expect(runtime.includes('startCamera();'), 'camera startup is invoked directly by scanner runtime');
expect(!page.includes('camera-autostart.js'), 'legacy camera-autostart shim is removed');
console.log('Scanner UI runtime smoke tests passed.');
