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
    engineReady: false,
    busy: false,
    sourceCanvas: null,
    photoUrl: null,
  };

  const setMessage = (text, kind = '') => {
    if (!message) return;
    message.textContent = text;
    message.dataset.kind = kind;
  };

  const setEngine = (text, ready = false) => {
    if (engineStatus) engineStatus.textContent = text;
    if (engineDot) engineDot.classList.toggle('ready', ready);
  };

  const updateScanEnabled = () => {
    if (!scanButton) return;
    const hasSource = Boolean(state.stream || state.sourceCanvas);
    scanButton.disabled = state.busy || !state.engineReady || !state.references.length || !hasSource;
  };

  async function waitForOpenCv(timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        let candidate = window.cv;
        if (candidate instanceof Promise) candidate = await candidate;
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
    throw new Error('Recognition engine could not load. Check the internet connection and reload.');
  }

  async function loadMarks() {
    const response = await fetch('api/marks.php', { cache: 'no-store', headers: { Accept: 'application/json' } });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Unable to load registered marks.');
    state.marks = Array.isArray(payload.marks) ? payload.marks : [];
    if (!state.marks.length) throw new Error('No marks are registered yet. Register one before scanning.');
  }

  function safeDelete(...items) {
    for (const item of items) {
      try { item?.delete?.(); } catch { /* OpenCV cleanup best effort */ }
    }
  }

  function normalizeMat(src, maxSide = 720) {
    const cv = window.cv;
    const rgba = new cv.Mat();
    const gray = new cv.Mat();
    const resized = new cv.Mat();
    try {
      if (src.channels() === 4) src.copyTo(rgba);
      else cv.cvtColor(src, rgba, cv.COLOR_RGB2RGBA);
      cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
      cv.equalizeHist(gray, gray);

      const scale = Math.min(1, maxSide / Math.max(gray.cols, gray.rows));
      if (scale < 1) {
        cv.resize(gray, resized, new cv.Size(Math.max(1, Math.round(gray.cols * scale)), Math.max(1, Math.round(gray.rows * scale))), 0, 0, cv.INTER_AREA);
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
    if (typeof orb.setMaxFeatures === 'function') orb.setMaxFeatures(1600);
    const keypoints = new cv.KeyPointVector();
    const descriptors = new cv.Mat();
    const mask = new cv.Mat();
    try {
      orb.detectAndCompute(gray, mask, keypoints, descriptors);
      return { keypoints, descriptors };
    } finally {
      safeDelete(orb, mask);
    }
  }

  function imageToCanvas(image) {
    const canvas = document.createElement('canvas');
    const maxSide = 900;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function loadImage(url) {
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
          refs.push({ mark, keypoints: features.keypoints, descriptors: features.descriptors });
        } else {
          safeDelete(features.keypoints, features.descriptors);
        }
      } catch (error) {
        console.warn(error);
      }
    }
    state.references = refs;
    if (!refs.length) throw new Error('Registered marks do not contain enough visual detail to recognize. Try a clearer mark image.');
  }

  function solve3x3(matrix, vector) {
    const a = matrix.map((row, index) => [...row, vector[index]]);
    for (let col = 0; col < 3; col += 1) {
      let pivot = col;
      for (let row = col + 1; row < 3; row += 1) {
        if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
      }
      if (Math.abs(a[pivot][col]) < 1e-7) return null;
      [a[col], a[pivot]] = [a[pivot], a[col]];
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
    let best = { inliers: 0, ratio: 0, error: Infinity };
    const iterations = Math.min(180, Math.max(36, good.length * 4));

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
            good.push({ queryIdx: first.queryIdx, trainIdx: first.trainIdx, distance: first.distance });
            distanceTotal += first.distance;
          }
        }
        safeDelete(pair);
      }

      if (good.length < 4) {
        return { score: 0, good: good.length, inliers: 0, ratio: 0, averageDistance: 256 };
      }

      const geometry = affineInliers(good, ref.keypoints, scanFeatures.keypoints, scanWidth, scanHeight);
      const averageDistance = good.length ? distanceTotal / good.length : 256;
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
        return { accepted: false, reason: 'Not enough visual detail. Move closer and fill the scan frame with the mark.' };
      }

      const ranked = state.references
        .map((ref) => ({ ref, metrics: matchReference(scanFeatures, ref, canvas.width, canvas.height) }))
        .sort((a, b) => b.metrics.score - a.metrics.score);

      const best = ranked[0];
      if (!best) return { accepted: false, reason: 'No registered marks are available.' };

      const secondScore = ranked[1]?.metrics.score ?? 0;
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
    const stageRect = stage.getBoundingClientRect();
    const reticle = stage.querySelector('.scan-reticle');
    if (!reticle) return null;
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

  function resetPlaceholder() {
    if (!placeholder) return;
    if (state.photoUrl) {
      URL.revokeObjectURL(state.photoUrl);
      state.photoUrl = null;
    }
    placeholder.classList.remove('has-photo');
    placeholder.style.backgroundImage = '';
    placeholder.innerHTML = '<span class="camera-glyph" aria-hidden="true">◎</span><strong>Camera ready when you are.</strong><small>Camera access requires HTTPS or localhost.</small>';
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Camera access is unavailable here. Use Photo instead.', 'warn');
      return;
    }
    stopCamera(false);
    resetPlaceholder();
    try {
      state.sourceCanvas = null;
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      video.srcObject = state.stream;
      await video.play();
      video.hidden = false;
      if (placeholder) placeholder.hidden = true;
      setMessage('Center the mark inside the frame, then tap Scan.');
    } catch (error) {
      console.warn(error);
      setMessage('Camera permission was not available. You can still choose Photo.', 'warn');
      if (placeholder) placeholder.hidden = false;
    } finally {
      updateScanEnabled();
    }
  }

  function stopCamera(showPlaceholder = true) {
    state.stream?.getTracks().forEach((track) => track.stop());
    state.stream = null;
    if (video) {
      video.srcObject = null;
      video.hidden = true;
    }
    if (showPlaceholder && placeholder && !state.sourceCanvas) placeholder.hidden = false;
    updateScanEnabled();
  }

  async function scan() {
    if (state.busy) return;
    const canvas = state.sourceCanvas || cropVideoToCanvas();
    if (!canvas) {
      setMessage('Start the camera or choose a photo first.', 'warn');
      return;
    }

    state.busy = true;
    updateScanEnabled();
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
      setTimeout(() => window.location.assign(match.mark.landing_page), 850);
    } catch (error) {
      console.error(error);
      setMessage('Recognition failed. Try the scan again.', 'warn');
    } finally {
      state.busy = false;
      updateScanEnabled();
    }
  }

  async function decodePhoto(file) {
    if ('createImageBitmap' in window) {
      return { image: await createImageBitmap(file), cleanup: (image) => image.close?.() };
    }

    const url = URL.createObjectURL(file);
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Unable to decode photo.'));
      element.src = url;
    });
    return { image, cleanup: () => URL.revokeObjectURL(url) };
  }

  async function loadPhoto(file) {
    if (!file) return;
    const decoded = await decodePhoto(file);
    const image = decoded.image;
    try {
      const maxSide = 1600;
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
      const scale = Math.min(1, maxSide / Math.max(cropWidth, cropHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(cropWidth * scale));
      canvas.height = Math.max(1, Math.round(cropHeight * scale));
      canvas.getContext('2d', { willReadFrequently: true }).drawImage(
        image,
        sx, sy, cropWidth, cropHeight,
        0, 0, canvas.width, canvas.height,
      );

      state.sourceCanvas = canvas;
      stopCamera(false);
      resetPlaceholder();
      state.photoUrl = URL.createObjectURL(file);
      if (placeholder) {
        placeholder.hidden = false;
        placeholder.innerHTML = '<span class="camera-glyph" aria-hidden="true">✓</span><strong>Photo loaded.</strong><small>Tap Scan to recognize the centered mark.</small>';
        placeholder.style.backgroundImage = `url(${state.photoUrl})`;
        placeholder.classList.add('has-photo');
      }
      setMessage('Photo ready. Tap Scan.');
      updateScanEnabled();
    } finally {
      decoded.cleanup(image);
    }
  }

  async function init() {
    try {
      await loadMarks();
      setMessage(`${state.marks.length} registered mark${state.marks.length === 1 ? '' : 's'} loaded.`);
      const cv = await waitForOpenCv();
      if (!cv) throw new Error('Recognition engine unavailable.');
      await buildReferences();
      state.engineReady = true;
      setEngine('Recognition ready', true);
      setMessage('Start the camera or choose a photo.');
      updateScanEnabled();
    } catch (error) {
      console.error(error);
      const text = error instanceof Error ? error.message : 'Scanner initialization failed.';
      setEngine('Recognition unavailable', false);
      setMessage(text, 'warn');
    }
  }

  scanButton?.addEventListener('click', scan);
  cameraToggle?.addEventListener('click', () => state.stream ? stopCamera() : startCamera());
  photoInput?.addEventListener('change', async () => {
    try {
      await loadPhoto(photoInput.files?.[0]);
    } catch (error) {
      console.error(error);
      setMessage('Unable to load that photo.', 'warn');
    }
  });
  window.addEventListener('pagehide', () => { stopCamera(false); resetPlaceholder(); });
  window.addEventListener('opencv-ready', updateScanEnabled);

  init();
})();
