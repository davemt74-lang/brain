(() => {
  'use strict';

  const toggle = document.querySelector('[data-camera-toggle]');
  const video = document.querySelector('[data-video]');
  const message = document.querySelector('[data-message]');

  const setMessage = (text) => {
    if (!message) return;
    message.textContent = text;
    message.dataset.kind = 'warn';
  };

  const hostname = window.location.hostname;
  const localHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  const start = () => {
    if (video?.srcObject) return;

    if (!window.isSecureContext && !localHost) {
      setMessage('Camera access requires HTTPS. Open this scanner on the secure https:// version of the site.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('This browser cannot open the camera here. Use Photo instead or open the scanner in Safari/Chrome over HTTPS.');
      return;
    }

    toggle?.click();
  };

  // scanner.js is loaded immediately before this file with defer, so its
  // camera click handler is already attached when this runs.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
