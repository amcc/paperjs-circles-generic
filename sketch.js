// the variables
const MIN_RADIUS = 0.5;
let W = 0;
let H = 0;
let step = 1;
let cols = 0;
let rows = 0;
let divisions = 30;
let sizeMultiplier = 1;
let videoAspect = 4 / 3;
let videoLabel = "";
let sourceType = "camera";
let cameraStream = null;
let uploadObjectUrl = "";

// Low-res sampler canvas: one pixel per circle cell for fast brightness reads.
const sampleOff = Object.assign(document.createElement("canvas"), {
  width: 1,
  height: 1,
});
const sampleCtx = sampleOff.getContext("2d", { willReadFrequently: true });

// Preview canvas and elements
const previewCanvas = document.getElementById("debug-canvas");
const previewCtx = previewCanvas.getContext("2d");
const previewWrap = document.getElementById("debug-wrap");
const btnTogglePreview = document.getElementById("btn-debug");
const mainCanvas = document.getElementById("c");
const canvasWrap = document.getElementById("canvas-wrap");
const status = document.getElementById("status");
const divisionsInput = document.getElementById("divisions");
const divisionsValue = document.getElementById("divisions-value");
const sizeMultiplierInput = document.getElementById("size-multiplier");
const sizeMultiplierValue = document.getElementById("size-multiplier-value");
const vid = document.getElementById("vid");
const mediaUploadInput = document.getElementById("media-upload");
const btnSourceCamera = document.getElementById("btn-source-camera");
const videoControls = document.getElementById("video-controls");
const btnVideoPlayPause = document.getElementById("btn-video-playpause");
const btnVideoBack = document.getElementById("btn-video-back");
const btnVideoForward = document.getElementById("btn-video-forward");

const uploadVideo = Object.assign(document.createElement("video"), {
  autoplay: true,
  muted: true,
  loop: false,
  playsInline: true,
});
const uploadImage = new Image();

uploadVideo.addEventListener("play", () => setVideoPlayPauseLabel(true));
uploadVideo.addEventListener("pause", () => setVideoPlayPauseLabel(false));
uploadVideo.addEventListener("ended", () => setVideoPlayPauseLabel(false));

// Initialize Paper.js on the output canvas.
paper.setup(mainCanvas);

// Shared circle model/path storage.
const circles = [];

// Active media source used for pixel sampling.
const activeSource = {
  element: vid,
};

// Setup: bind controls, size scene, and request webcam.
syncControls();

divisionsInput.addEventListener("input", () => {
  divisions = Number(divisionsInput.value);
  syncControls();
  rebuildCircles();
});

sizeMultiplierInput.addEventListener("input", () => {
  sizeMultiplier = Number(sizeMultiplierInput.value);
  syncControls();
});

mediaUploadInput.addEventListener("change", handleMediaUpload);
btnSourceCamera.addEventListener("click", useCameraSource);
btnVideoPlayPause.addEventListener("click", toggleUploadVideoPlayback);
btnVideoBack.addEventListener("click", () => stepUploadVideo(-1));
btnVideoForward.addEventListener("click", () => stepUploadVideo(1));

resizeScene();
window.addEventListener("resize", resizeScene);

startCamera();

// Animate
let frameCount = 0;
let lastFpsUpdate = 0;
let lastFrameTime = performance.now();
let previewVisible = true;

setPreviewVisibility(previewVisible);

// Main frame loop: sample webcam pixels and map brightness to circle radii.
paper.view.onFrame = () => {
  if (!isActiveSourceReady()) return;

  sampleCtx.drawImage(activeSource.element, 0, 0, cols, rows);

  if (previewVisible) {
    previewCtx.drawImage(
      activeSource.element,
      0,
      0,
      previewCanvas.width,
      previewCanvas.height,
    );
  }

  const data = sampleCtx.getImageData(0, 0, cols, rows).data;
  frameCount += 1;

  updateFpsDisplay();

  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = (col + row * cols) * 4;
      const grey = (data[px] + data[px + 1] + data[px + 2]) / 3;
      const nextRadius = ((255 - grey) / 255) * ((step / 2) * sizeMultiplier);
      setCircleRadius(circles[i], nextRadius);
      i++;
    }
  }
};

// Build a circle model and backing Paper.js path.
function makeCircle(center, radius) {
  const path = new paper.Path.Circle(center, radius);
  path.fillColor = new paper.Color(0, 0, 1);

  return {
    center,
    radius,
    path,
  };
}

// Scale a circle path to the next radius, clamped to a safe minimum.
function setCircleRadius(circle, nextRadius) {
  const safeRadius = Math.max(MIN_RADIUS, nextRadius);
  circle.path.scale(safeRadius / circle.radius, circle.center);
  circle.radius = safeRadius;
}

// Rebuild a circle path from stored center/radius for clean export geometry.
function rebuildCirclePath(circle) {
  const nextPath = new paper.Path.Circle(circle.center, circle.radius);
  nextPath.fillColor = circle.path.fillColor;
  circle.path.replaceWith(nextPath);
  circle.path = nextPath;
}

function resetSamplerCanvas() {
  sampleOff.width = Math.max(1, cols);
  sampleOff.height = Math.max(1, rows);
}

// Regenerate the circle grid from current dimensions and division settings.
function rebuildCircles() {
  circles.forEach((circle) => circle.path.remove());
  circles.length = 0;

  cols = Math.max(1, divisions);
  step = W / cols;
  rows = Math.max(1, Math.floor(H / step));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const center = new paper.Point(
        col * step + step / 2,
        row * step + step / 2,
      );
      circles.push(makeCircle(center, Math.max(1, step * 0.1)));
    }
  }

  resetSamplerCanvas();
  updateStatus();
}

// Fit the scene to the available area while preserving webcam aspect ratio.
function resizeScene() {
  const boundsWidth = canvasWrap.clientWidth;
  const boundsHeight = canvasWrap.clientHeight;

  let fitW = boundsWidth;
  let fitH = fitW / videoAspect;

  if (fitH > boundsHeight) {
    fitH = boundsHeight;
    fitW = fitH * videoAspect;
  }

  W = Math.max(1, Math.floor(fitW));
  H = Math.max(1, Math.floor(fitH));

  mainCanvas.width = W;
  mainCanvas.height = H;
  paper.view.viewSize = new paper.Size(W, H);
  mainCanvas.style.width = `${W}px`;
  mainCanvas.style.height = `${H}px`;

  rebuildCircles();
}

// Render status text for video + grid state.
function updateStatus(videoText = "") {
  const gridText = `${cols}x${rows} step:${step.toFixed(1)}`;
  status.textContent = videoText ? `${videoText} | ${gridText}` : gridText;
}

// Update status using the currently known video label.
function refreshStatus() {
  updateStatus(videoLabel);
}

function startCamera() {
  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "user" }, audio: false })
    .then((stream) => {
      cameraStream = stream;
      vid.srcObject = stream;
      setCameraActive(sourceType === "camera");

      const syncVideoAspect = () => {
        if (!vid.videoWidth || !vid.videoHeight) return;

        if (sourceType !== "camera") return;
        setActiveSource(
          "camera",
          vid,
          `camera ${vid.videoWidth}x${vid.videoHeight}`,
          vid.videoWidth / vid.videoHeight,
        );
      };

      vid.onloadedmetadata = () => {
        vid.play().catch(() => {});
        setActiveSource("camera", vid, "camera", videoAspect);
        requestAnimationFrame(syncVideoAspect);
        requestAnimationFrame(syncVideoAspect);
      };

      vid.oncanplay = () => {
        syncVideoAspect();
      };
    })
    .catch((err) => {
      if (sourceType === "camera") {
        videoLabel = "camera unavailable";
        refreshStatus();
      }
      console.error(err);
    });
}

function setActiveSource(nextType, element, label, aspectRatio) {
  sourceType = nextType;
  activeSource.element = element;
  videoLabel = label;

  setCameraActive(nextType === "camera");

  if (nextType !== "video") {
    uploadVideo.pause();
  }

  if (aspectRatio > 0) {
    videoAspect = aspectRatio;
  }

  setVideoControlsVisibility(nextType === "video");
  resizeScene();
  refreshStatus();
}

function isActiveSourceReady() {
  if (sourceType === "image") {
    return uploadImage.complete && uploadImage.naturalWidth > 0;
  }

  const source = activeSource.element;
  return (
    source.readyState >= 2 && source.videoWidth > 0 && source.videoHeight > 0
  );
}

function cleanupUploadMedia() {
  if (uploadObjectUrl) {
    URL.revokeObjectURL(uploadObjectUrl);
    uploadObjectUrl = "";
  }

  uploadVideo.pause();
  setVideoPlayPauseLabel(false);
  uploadVideo.removeAttribute("src");
  uploadVideo.load();
  uploadImage.src = "";
}

function handleMediaUpload(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  cleanupUploadMedia();
  uploadObjectUrl = URL.createObjectURL(file);

  if (file.type.startsWith("image/")) {
    uploadImage.onload = () => {
      setActiveSource(
        "image",
        uploadImage,
        `image ${uploadImage.naturalWidth}x${uploadImage.naturalHeight}`,
        uploadImage.naturalWidth / uploadImage.naturalHeight,
      );
    };

    uploadImage.onerror = () => {
      videoLabel = "failed to load image";
      refreshStatus();
    };

    uploadImage.src = uploadObjectUrl;
    return;
  }

  if (file.type.startsWith("video/")) {
    uploadVideo.onloadedmetadata = () => {
      uploadVideo.play().catch(() => {});
      setActiveSource(
        "video",
        uploadVideo,
        `video ${uploadVideo.videoWidth}x${uploadVideo.videoHeight}`,
        uploadVideo.videoWidth / uploadVideo.videoHeight,
      );
    };

    uploadVideo.onerror = () => {
      videoLabel = "failed to load video";
      refreshStatus();
    };

    uploadVideo.src = uploadObjectUrl;
    uploadVideo.load();
    return;
  }

  videoLabel = "unsupported file type";
  refreshStatus();
}

function useCameraSource() {
  if (!cameraStream) {
    videoLabel = "camera unavailable";
    refreshStatus();
    return;
  }

  cleanupUploadMedia();
  mediaUploadInput.value = "";
  setActiveSource(
    "camera",
    vid,
    `camera ${vid.videoWidth}x${vid.videoHeight}`,
    vid.videoWidth / vid.videoHeight,
  );
}

function setCameraActive(active) {
  if (!cameraStream) return;

  cameraStream.getVideoTracks().forEach((track) => {
    track.enabled = active;
  });

  if (active) {
    vid.play().catch(() => {});
    return;
  }

  vid.pause();
}

function setVideoControlsVisibility(visible) {
  videoControls.classList.toggle("visible", visible);
  videoControls.setAttribute("aria-hidden", visible ? "false" : "true");

  if (!visible) {
    setVideoPlayPauseLabel(false);
  }
}

function setVideoPlayPauseLabel(isPlaying) {
  btnVideoPlayPause.textContent = isPlaying ? "pause" : "play";
}

function toggleUploadVideoPlayback() {
  if (sourceType !== "video") return;

  if (uploadVideo.paused) {
    uploadVideo
      .play()
      .then(() => setVideoPlayPauseLabel(true))
      .catch(() => {});
    return;
  }

  uploadVideo.pause();
  setVideoPlayPauseLabel(false);
}

function stepUploadVideo(direction) {
  if (sourceType !== "video") return;

  uploadVideo.pause();
  setVideoPlayPauseLabel(false);

  const frameDuration = getUploadVideoFrameDuration();
  const duration = Number.isFinite(uploadVideo.duration)
    ? uploadVideo.duration
    : 0;
  const maxTime = Math.max(0, duration - frameDuration);
  const targetTime = Math.min(
    maxTime,
    Math.max(0, uploadVideo.currentTime + direction * frameDuration),
  );

  uploadVideo.currentTime = targetTime;
}

function getUploadVideoFrameDuration() {
  return 1 / 30;
}

function updateFpsDisplay() {
  const now = performance.now();
  const deltaMs = now - lastFpsUpdate;

  if (deltaMs < 500) return;

  const framesSinceUpdate = frameCount - lastFrameTime;
  const fps = Math.round((framesSinceUpdate * 1000) / deltaMs);

  document.getElementById("fps").textContent = `${fps} FPS`;

  lastFpsUpdate = now;
  lastFrameTime = frameCount;
}

// Reflect slider state values in the sidebar labels.
function syncControls() {
  divisionsValue.textContent = String(divisions);
  sizeMultiplierValue.textContent = sizeMultiplier.toFixed(2);
}

// Toggle visibility of the source preview panel.
function togglePreview() {
  previewVisible = !previewVisible;
  setPreviewVisibility(previewVisible);
}

function setPreviewVisibility(visible) {
  previewWrap.classList.toggle("visible", visible);
  btnTogglePreview.textContent = visible ? "hide source" : "show source";
}

// Export normalized SVG (paths rebuilt from stored geometry).
function exportSVG() {
  downloadSVG("frame.svg", true);
}

// Export current SVG scene as-is without path rebuild.
function exportSVGRaw() {
  downloadSVG("frame-raw.svg", false);
}

// Shared SVG download helper.
function downloadSVG(filename, rebuildPaths) {
  if (rebuildPaths) {
    circles.forEach(rebuildCirclePath);
  }

  const svg = paper.project.exportSVG({ asString: true });
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
}
