(() => {
  'use strict';

  const video = document.querySelector('[data-video]');
  const captureCanvas = document.querySelector('[data-capture-canvas]');
  const stage = document.querySelector('[data-camera-stage]');
  const placeholder = document.querySelector('[data-placeholder]');
  const scanButton = document.querySelector('[data-scan]');
  const cameraToggle = document.querySelector('[data-camera-toggle]');
  const photoInput = document.querySelector('[data-photo-input]');
  const message = document.querySelector('[data-message]');
  const engineStatus = document.querySelector('[data-engine-status]');
  const engineDot = document.querySelector('[data-engine-dot]');
  const result = document.querySelector('[data-result]');
  const resultName = document.querySelector('[data-result-name]');
  const resultConfidence = document.querySelector('[data-result-confidence]');
  const resultImage = document.querySelector('[data-result-image]');

  const state = {
    marks: [],
    references: [],
    stream: null,
    sourceCanvas: null,
    photoUrl: null,
    engineReady: false,
    engineLoading: true,
    engineError: '',
    busy: false,
    cameraStarting: false,
  };

  function setMessage(text, kind) {
    if (!message) return;
    message.textContent = text;
    message.dataset.kind = kind || '';
  }

  function setEngine(text, ready) {
    if (engineStatus) engineStatus.textContent = text;
    if (engineDot) engineDot.classList.toggle('ready', Boolean(ready));
  }

  function setBusy(busy) {
    state.busy = busy;
    if (scanButton) scanButton.disabled = Boolean(busy);
  }

  function safeDelete() {
    for (let i = 0; i < arguments.length; i += 1) {
      const item = arguments[i];
      try {
        if (item && typeof item.delete === 'function') item.delete();
      } catch (_) {
        // OpenCV cleanup is best effort.
      }
    }
  }

  function clearPhotoPreview() {
    if (state.photoUrl) {
      URL.revokeObjectURL(state.photoUrl);
      state.photoUrl = null;
    }
    state.sourceCanvas = null;
    if (!placeholder) return;
    placeholder.classList.remove('has-photo');
    placeholder.style.backgroundImage = '';
  }

  function showCameraPlaceholder(title, detail) {
    if (!placeholder) return;
    placeholder.hidden = false;
    placeholder.innerHTML = '';

    const glyph = document.createElement('span');
    glyph.className = 'camera-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = '◎';

    const strong = document.createElement('strong');
    strong.textContent = title;

    const small = document.createElement('small');
    small.textContent = detail;

    placeholder.append(glyph, strong, small);
  }

  function stopCamera(showPlaceholder) {
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
    }
    state.stream = null;
    state.cameraStarting = false;

    if (video) {
      video.pause();
      video.srcObject = null;
      video.hidden = true;
    }

    if (showPlaceholder !== false && !state.sourceCanvas) {
      showCameraPlaceholder('Camera stopped.', 'Tap Camera to start it again.');
    }
  }

  function cameraSupportError() {
    const hostname = window.location.hostname;
    const localhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

    if (!window.isSecureContext && !localhost) {
      return 'Camera access requires HTTPS. Open the secure https:// version of this scanner.';
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return 'This browser cannot access the camera here. Use Photo or open the scanner in current Safari/Chrome over HTTPS.';
    }
    return '';
  }

  async function requestCameraStream() {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    } catch (error) {
      if (error && (error.name === 'OverconstrainedError' || error.name === 'NotFoundError')) {
        return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      throw error;
    }
  }

  async function startCamera() {
    if (state.cameraStarting || state.stream) return;

    const supportError = cameraSupportError();
    if (supportError) {
      showCameraPlaceholder('Camera unavailable.', supportError);
      setMessage(supportError, 'warn');
      return;
    }

    state.cameraStarting = true;
    clearPhotoPreview();
    showCameraPlaceholder('Starting camera…', 'Allow camera access when your browser asks.');
    setMessage('Requesting camera access…');

    try {
      const stream = await requestCameraStream();
      state.stream = stream;

      if (!video) throw new Error('Camera video element is missing.');
      video.srcObject = stream;
      video.hidden = false;
      video.muted = true;
      video.setAttribute('playsinline', '');
      await video.play();

      if (placeholder) placeholder.hidden = true;
      setMessage('Camera ready. Center the registered mark and tap Scan.', 'success');
    } catch (error) {
      console.error('Camera start failed', error);
      state.stream = null;
      const name = error && error.name ? error.name : '';
      let detail = 'Camera could not start. Tap Camera to retry or use Photo.';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        detail = 'Camera permission is blocked. Allow camera access for this site, then tap Camera again.';
      } else if (name === 'NotReadableError') {
        detail = 'The camera is already in use by another app or browser tab.';
      }
      showCameraPlaceholder('Camera unavailable.', detail);
      setMessage(detail, 'warn');
    } finally {
      state.cameraStarting = false;
    }
  }

  async function loadMarks() {
    const response = await fetch('api/marks.php', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Unable to load registered marks.');
    }
    state.marks = Array.isArray(payload.marks) ? payload.marks : [];
    if (!state.marks.length) {
      throw new Error('No marks are registered yet. Register one before scanning.');
    }
  }

  async function waitForOpenCv(timeoutMs) {
    const timeout = timeoutMs || 20000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        let candidate = window.cv;
        if (candidate && typeof candidate.then === 'function') candidate = await candidate;
        const required = ['Mat', 'ORB', 'KeyPointVector', 'BFMatcher', 'DMatchVectorVector'];
        if (candidate && required.every((name) => typeof candidate[name] === 'function')) {
          window.cv = candidate;
          return candidate;
        }
      } catch (error) {
        console.warn('OpenCV initialization retry', error);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('Recognition engine did not load. Check that docs.opencv.org is reachable, then reload.');
  }

  function normalizeMat(src, maxSide) {
    const cv = window.cv;
    const rgba = new cv.Mat();
    const gray = new cv.Mat();
    const resized = new cv.Mat();
    const limit = maxSide || 720;

    try {
      if (src.channels() === 4) src.copyTo(rgba);
      else cv.cvtColor(src, rgba, cv.COLOR_RGB2RGBA);
      cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
      cv.equalizeHist(gray, gray);

      const scale = Math.min(1, limit / Math.max(gray.cols, gray.rows));
      if (scale < 1) {
        cv.resize(
          gray,
          resized,
          new cv.Size(Math.max(1, Math.round(gray.cols * scale)), Math.max(1, Math.round(gray.rows * scale))),
          0,
          0,
          cv.INTER_AREA,
        );
        return resized.clone();
      }
      return gray.clone();
    } finally {
      safeDelete(rgba, gray, resized);
    }
  }

  function computeFeatures(gray) {
    const cv = window.cv;
    const orb = new cv.ORB();
    const keypoints = new cv.KeyPointVector();
    const descriptors = new cv.Mat();
    const mask = new cv.Mat();

    try {
      if (typeof orb.setMaxFeatures === 'function') orb.setMaxFeatures(1600);
      orb.detectAndCompute(gray, mask, keypoints, descriptors);
      return { keypoints, descriptors };
    } finally {
      safeDelete(orb, mask);
    }
  }

  function imageToCanvas(image) {
    const canvas = document.createElement('canvas');
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const scale = Math.min(1, 900 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Unable to load registered mark: ${url}`));
      image.src = url;
    });
  }

  async function buildReferences() {
    const cv = window.cv;
    const refs = [];

    for (const mark of state.marks) {
      try {
        const image = await loadImage(mark.image_url);
        const canvas = imageToCanvas(image);
        const src = cv.imread(canvas);
        const gray = normalizeMat(src);
        const features = computeFeatures(gray);
        safeDelete(src, gray);

        if (features.keypoints.size() >= 4 && !features.descriptors.empty()) {
          refs.push({
            mark,
            keypoints: features.keypoints,
            descriptors: features.descriptors,
          });
        } else {
          safeDelete(features.keypoints, features.descriptors);
        }
      } catch (error) {
        console.warn(error);
      }
    }

    state.references = refs;
    if (!refs.length) {
      throw new Error('The registered mark does not contain enough visual detail. Register a clearer mark image.');
    }
  }

  function solve3x3(matrix, vector) {
    const a = matrix.map((row, index) => [row[0], row[1], row[2], vector[index]]);

    for (let col = 0; col < 3; col += 1) {
      let pivot = col;
      for (let row = col + 1; row < 3; row += 1) {
        if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
      }
      if (Math.abs(a[pivot][col]) < 1e-7) return null;

      const temp = a[col];
      a[col] = a[pivot];
      a[pivot] = temp;

      const divisor = a[col][col];
      for (let k = col; k < 4; k += 1) a[col][k] /= divisor;

      for (let row = 0; row < 3; row += 1) {
        if (row === col) continue;
        const factor = a[row][col];
        for (let k = col; k < 4; k += 1) a[row][k] -= factor * a[col][k];
      }
    }

    return [a[0][3], a[1][3], a[2][3]];
  }

  function affineFromMatches(sample, refKeypoints, scanKeypoints) {
    const rows = [];
    const xs = [];
    const ys = [];

    for (const match of sample) {
      const source = refKeypoints.get(match.queryIdx).pt;
      const target = scanKeypoints.get(match.trainIdx).pt;
      rows.push([source.x, source.y, 1]);
      xs.push(target.x);
      ys.push(target.y);
    }

    const xParams = solve3x3(rows, xs);
    const yParams = solve3x3(rows, ys);
    if (!xParams || !yParams) return null;

    return {
      a: xParams[0], b: xParams[1], tx: xParams[2],
      c: yParams[0], d: yParams[1], ty: yParams[2],
    };
  }

  function affineInliers(good, refKeypoints, scanKeypoints, scanWidth, scanHeight) {
    if (good.length < 4) return { inliers: 0, ratio: 0, error: Infinity };

    const threshold = Math.max(8, Math.min(22, Math.max(scanWidth, scanHeight) * 0.025));
    const iterations = Math.min(180, Math.max(36, good.length * 4));
    let best = { inliers: 0, ratio: 0, error: Infinity };

    for (let i = 0; i < iterations; i += 1) {
      const i1 = i % good.length;
      const i2 = (i * 7 + 3) % good.length;
      const i3 = (i * 13 + 5) % good.length;
      if (i1 === i2 || i1 === i3 || i2 === i3) continue;

      const transform = affineFromMatches([good[i1], good[i2], good[i3]], refKeypoints, scanKeypoints);
      if (!transform) continue;

      let inliers = 0;
      let totalError = 0;

      for (const match of good) {
        const source = refKeypoints.get(match.queryIdx).pt;
        const target = scanKeypoints.get(match.trainIdx).pt;
        const px = transform.a * source.x + transform.b * source.y + transform.tx;
        const py = transform.c * source.x + transform.d * source.y + transform.ty;
        const error = Math.hypot(px - target.x, py - target.y);
        if (error <= threshold) {
          inliers += 1;
          totalError += error;
        }
      }

      if (inliers > best.inliers || (inliers === best.inliers && totalError < best.error)) {
        best = {
          inliers,
          ratio: inliers / good.length,
          error: inliers ? totalError / inliers : Infinity,
        };
      }
    }

    return best;
  }

  function matchReference(scanFeatures, ref, scanWidth, scanHeight) {
    const cv = window.cv;
    const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
    const pairs = new cv.DMatchVectorVector();

    try {
      matcher.knnMatch(ref.descriptors, scanFeatures.descriptors, pairs, 2);
      const good = [];
      let distanceTotal = 0;

      for (let i = 0; i < pairs.size(); i += 1) {
        const pair = pairs.get(i);
        if (pair.size() >= 2) {
          const first = pair.get(0);
          const second = pair.get(1);
          if (first.distance < 0.74 * second.distance && first.distance < 88) {
            good.push({
              queryIdx: first.queryIdx,
              trainIdx: first.trainIdx,
              distance: first.distance,
            });
            distanceTotal += first.distance;
          }
        }
        safeDelete(pair);
      }

      if (good.length < 4) {
        return { score: 0, good: good.length, inliers: 0, ratio: 0, averageDistance: 256 };
      }

      const geometry = affineInliers(good, ref.keypoints, scanFeatures.keypoints, scanWidth, scanHeight);
      const averageDistance = distanceTotal / good.length;
      const countScore = Math.min(1, geometry.inliers / 18);
      const ratioScore = Math.min(1, geometry.ratio / 0.82);
      const distanceScore = Math.max(0, Math.min(1, (82 - averageDistance) / 58));
      const errorScore = Number.isFinite(geometry.error)
        ? Math.max(0, Math.min(1, 1 - geometry.error / 20))
        : 0;
      const score = (0.40 * ratioScore) + (0.34 * countScore) + (0.14 * distanceScore) + (0.12 * errorScore);

      return {
        score,
        good: good.length,
        inliers: geometry.inliers,
        ratio: geometry.ratio,
        averageDistance,
        geometricError: geometry.error,
      };
    } catch (error) {
      console.warn('Feature match failed', error);
      return { score: 0, good: 0, inliers: 0, ratio: 0, averageDistance: 256, geometricError: Infinity };
    } finally {
      safeDelete(matcher, pairs);
    }
  }

  function recognize(canvas) {
    const cv = window.cv;
    const src = cv.imread(canvas);
    const gray = normalizeMat(src);
    const scanFeatures = computeFeatures(gray);
    safeDelete(src, gray);

    try {
      if (scanFeatures.keypoints.size() < 8 || scanFeatures.descriptors.empty()) {
        return {
          accepted: false,
          reason: 'Not enough visual detail. Move closer and fill the scan frame with the mark.',
        };
      }

      const ranked = state.references
        .map((ref) => ({ ref, metrics: matchReference(scanFeatures, ref, canvas.width, canvas.height) }))
        .sort((a, b) => b.metrics.score - a.metrics.score);

      const best = ranked[0];
      if (!best) return { accepted: false, reason: 'No registered marks are available.' };

      const secondScore = ranked[1] ? ranked[1].metrics.score : 0;
      const margin = best.metrics.score - secondScore;
      const strongGeometry = best.metrics.inliers >= 7 && best.metrics.ratio >= 0.42;
      const confidentScore = best.metrics.score >= 0.50;
      const separated = ranked.length === 1 || margin >= 0.07 || best.metrics.score >= 0.72;
      const accepted = strongGeometry && confidentScore && separated;

      return {
        accepted,
        mark: best.ref.mark,
        confidence: Math.round(Math.min(0.99, Math.max(0, best.metrics.score)) * 100),
        metrics: best.metrics,
        reason: accepted ? '' : 'No confident match. Center the mark, move closer, and try again.',
      };
    } finally {
      safeDelete(scanFeatures.keypoints, scanFeatures.descriptors);
    }
  }

  function cropVideoToCanvas() {
    if (!video || !stage || !captureCanvas || !video.videoWidth || !video.videoHeight) return null;

    const reticle = stage.querySelector('.scan-reticle');
    if (!reticle) return null;

    const stageRect = stage.getBoundingClientRect();
    const reticleRect = reticle.getBoundingClientRect();
    const videoAspect = video.videoWidth / video.videoHeight;
    const stageAspect = stageRect.width / stageRect.height;

    let displayedWidth;
    let displayedHeight;
    let offsetX;
    let offsetY;

    if (videoAspect > stageAspect) {
      displayedHeight = stageRect.height;
      displayedWidth = displayedHeight * videoAspect;
      offsetX = (stageRect.width - displayedWidth) / 2;
      offsetY = 0;
    } else {
      displayedWidth = stageRect.width;
      displayedHeight = displayedWidth / videoAspect;
      offsetX = 0;
      offsetY = (stageRect.height - displayedHeight) / 2;
    }

    const relX = reticleRect.left - stageRect.left - offsetX;
    const relY = reticleRect.top - stageRect.top - offsetY;
    const scaleX = video.videoWidth / displayedWidth;
    const scaleY = video.videoHeight / displayedHeight;
    const sx = Math.max(0, Math.round(relX * scaleX));
    const sy = Math.max(0, Math.round(relY * scaleY));
    const sw = Math.min(video.videoWidth - sx, Math.round(reticleRect.width * scaleX));
    const sh = Math.min(video.videoHeight - sy, Math.round(reticleRect.height * scaleY));

    captureCanvas.width = Math.max(1, sw);
    captureCanvas.height = Math.max(1, sh);
    const ctx = captureCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, captureCanvas.width, captureCanvas.height);
    return captureCanvas;
  }

  async function decodePhoto(file) {
    if ('createImageBitmap' in window) {
      const bitmap = await createImageBitmap(file);
      return {
        image: bitmap,
        cleanup: () => {
          if (typeof bitmap.close === 'function') bitmap.close();
        },
      };
    }

    const url = URL.createObjectURL(file);
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Unable to decode photo.'));
      element.src = url;
    });

    return {
      image,
      cleanup: () => URL.revokeObjectURL(url),
    };
  }

  async function loadPhoto(file) {
    if (!file) return;

    const decoded = await decodePhoto(file);
    const image = decoded.image;

    try {
      const sourceWidth = image.width || image.naturalWidth;
      const sourceHeight = image.height || image.naturalHeight;
      const targetAspect = 1.45;
      let cropWidth = sourceWidth * 0.78;
      let cropHeight = cropWidth / targetAspect;

      if (cropHeight > sourceHeight * 0.78) {
        cropHeight = sourceHeight * 0.78;
        cropWidth = cropHeight * targetAspect;
      }

      const sx = Math.max(0, (sourceWidth - cropWidth) / 2);
      const sy = Math.max(0, (sourceHeight - cropHeight) / 2);
      const scale = Math.min(1, 1600 / Math.max(cropWidth, cropHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(cropWidth * scale));
      canvas.height = Math.max(1, Math.round(cropHeight * scale));
      canvas.getContext('2d', { willReadFrequently: true }).drawImage(
        image,
        sx,
        sy,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      stopCamera(false);
      clearPhotoPreview();
      state.sourceCanvas = canvas;
      state.photoUrl = URL.createObjectURL(file);

      if (placeholder) {
        placeholder.hidden = false;
        placeholder.classList.add('has-photo');
        placeholder.style.backgroundImage = `url(${state.photoUrl})`;
        placeholder.innerHTML = '';

        const glyph = document.createElement('span');
        glyph.className = 'camera-glyph';
        glyph.setAttribute('aria-hidden', 'true');
        glyph.textContent = '✓';
        const strong = document.createElement('strong');
        strong.textContent = 'Photo loaded.';
        const small = document.createElement('small');
        small.textContent = 'Tap Scan to recognize the centered mark.';
        placeholder.append(glyph, strong, small);
      }

      setMessage('Photo ready. Tap Scan.', 'success');
    } finally {
      decoded.cleanup();
    }
  }

  async function scan() {
    if (state.busy) return;

    if (state.engineLoading) {
      setMessage('Recognition is still loading. Camera and Photo are ready; try Scan again in a moment.', 'warn');
      return;
    }
    if (!state.engineReady) {
      setMessage(state.engineError || 'Recognition is unavailable. Reload the page and try again.', 'warn');
      return;
    }

    const canvas = state.sourceCanvas || cropVideoToCanvas();
    if (!canvas) {
      setMessage('No image is ready. Start Camera or choose Photo first.', 'warn');
      return;
    }

    setBusy(true);
    if (result) result.hidden = true;
    setMessage('Matching against registered marks…');

    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const match = recognize(canvas);

      if (!match.accepted) {
        setMessage(match.reason, 'warn');
        return;
      }

      if (resultName) resultName.textContent = match.mark.name;
      if (resultConfidence) resultConfidence.textContent = `${match.confidence}% confidence`;
      if (resultImage) {
        resultImage.src = match.mark.image_url;
        resultImage.alt = `${match.mark.name} mark`;
      }
      if (result) result.hidden = false;

      setMessage(`Opening ${match.mark.name}…`, 'success');
      window.setTimeout(() => window.location.assign(match.mark.landing_page), 700);
    } catch (error) {
      console.error('Recognition failed', error);
      setMessage('Recognition failed. Try the scan again.', 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function initRecognition() {
    state.engineLoading = true;
    state.engineReady = false;
    state.engineError = '';
    setEngine('Loading registered marks…', false);

    try {
      await loadMarks();
      setEngine(`${state.marks.length} registered mark${state.marks.length === 1 ? '' : 's'} · loading recognition…`, false);
      await waitForOpenCv(20000);
      await buildReferences();
      state.engineReady = true;
      setEngine(`${state.references.length} registered mark${state.references.length === 1 ? '' : 's'} · recognition ready`, true);
    } catch (error) {
      console.error('Recognition initialization failed', error);
      state.engineError = error instanceof Error ? error.message : 'Recognition initialization failed.';
      setEngine('Recognition unavailable', false);
    } finally {
      state.engineLoading = false;
    }
  }

  function wireControls() {
    if (scanButton) {
      scanButton.disabled = false;
      scanButton.addEventListener('click', scan);
    }

    if (cameraToggle) {
      cameraToggle.addEventListener('click', () => {
        if (state.stream) {
          stopCamera(true);
          setMessage('Camera stopped. Tap Camera to start it again.');
        } else {
          startCamera();
        }
      });
    }

    if (photoInput) {
      photoInput.addEventListener('change', async () => {
        try {
          const file = photoInput.files && photoInput.files[0];
          await loadPhoto(file);
        } catch (error) {
          console.error('Photo load failed', error);
          setMessage('Unable to load that photo. Choose another image and try again.', 'warn');
        } finally {
          photoInput.value = '';
        }
      });
    }
  }

  window.addEventListener('pagehide', () => {
    stopCamera(false);
    clearPhotoPreview();
  });

  wireControls();
  startCamera();
  initRecognition();
})();
