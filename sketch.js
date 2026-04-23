import { createCircleRenderer } from "./circles.js";
import { createMediaSourceController } from "./media-source.js";
import { getDomElements } from "./dom-elements.js";
import { createPreviewController } from "./preview-controller.js";
import { createVideoControlsController } from "./video-controls-controller.js";
import { createFpsController } from "./fps-controller.js";
import { createExportController } from "./export-controller.js";

const dom = getDomElements();

paper.setup(dom.mainCanvas);

const circleRenderer = createCircleRenderer({
  paper,
  mainCanvas: dom.mainCanvas,
  canvasWrap: dom.canvasWrap,
  statusEl: dom.statusEl,
  initialDivisions: Number(dom.divisionsInput.value),
  initialSizeMultiplier: Number(dom.sizeMultiplierInput.value),
  initialAspectRatio: 4 / 3,
  initialColor: {
    r: Number(dom.circleColorRInput.value),
    g: Number(dom.circleColorGInput.value),
    b: Number(dom.circleColorBInput.value),
  },
});

let sourceType = "camera";
let exportInProgress = false;

const preview = createPreviewController({
  previewWrap: dom.previewWrap,
  previewCanvas: dom.previewCanvas,
  previewToggleButton: dom.btnTogglePreview,
});

const fps = createFpsController({ fpsEl: dom.fpsEl });

function syncControls() {
  dom.divisionsValue.textContent = String(dom.divisionsInput.value);
  dom.sizeMultiplierValue.textContent = Number(
    dom.sizeMultiplierInput.value,
  ).toFixed(2);

  dom.circleColorRNumberInput.value = dom.circleColorRInput.value;
  dom.circleColorGNumberInput.value = dom.circleColorGInput.value;
  dom.circleColorBNumberInput.value = dom.circleColorBInput.value;

  const r = Number(dom.circleColorRInput.value);
  const g = Number(dom.circleColorGInput.value);
  const b = Number(dom.circleColorBInput.value);
  dom.circleColorValue.textContent = `rgb(${r}, ${g}, ${b})`;
  dom.circleColorSwatch.style.background = `rgb(${r}, ${g}, ${b})`;
}

function syncCircleColor() {
  circleRenderer.setCircleColor({
    r: Number(dom.circleColorRInput.value),
    g: Number(dom.circleColorGInput.value),
    b: Number(dom.circleColorBInput.value),
  });
  syncControls();
}

function clampRgbValue(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function syncColorFromNumberInputs() {
  dom.circleColorRInput.value = String(
    clampRgbValue(dom.circleColorRNumberInput.value),
  );
  dom.circleColorGInput.value = String(
    clampRgbValue(dom.circleColorGNumberInput.value),
  );
  dom.circleColorBInput.value = String(
    clampRgbValue(dom.circleColorBNumberInput.value),
  );
  syncCircleColor();
}

const mediaController = createMediaSourceController({
  cameraVideoEl: dom.cameraVideoEl,
  uploadInputEl: dom.uploadInputEl,
  cameraButtonEl: dom.cameraButtonEl,
  onSourceChanged: ({ type, element, label, aspectRatio }) => {
    sourceType = type;
    circleRenderer.setSourceLabel(label);
    circleRenderer.setAspect(aspectRatio);
    preview.resizeByAspect(aspectRatio);
    videoControls.setVisible(type === "video");

    if (type !== "video") {
      videoControls.setPlayPauseLabel(false);
    }

    if (preview.isVisible()) {
      preview.draw(element);
    }
  },
});

const videoControls = createVideoControlsController({
  controlsWrap: dom.videoControlsEl,
  playPauseButton: dom.btnVideoPlayPause,
  backButton: dom.btnVideoBack,
  forwardButton: dom.btnVideoForward,
  uploadVideo: mediaController.getUploadVideoElement(),
  getSourceType: () => sourceType,
});

const exportController = createExportController({
  statusEl: dom.statusEl,
  overlay: dom.exportOverlay,
  overlayTitle: dom.exportOverlayTitle,
  overlaySubtitle: dom.exportOverlaySubtitle,
  progressBar: dom.exportProgress,
  progressFill: dom.exportProgressFill,
  progressText: dom.exportProgressText,
  controls: [
    dom.divisionsInput,
    dom.sizeMultiplierInput,
    dom.circleColorRInput,
    dom.circleColorGInput,
    dom.circleColorBInput,
    dom.circleColorRNumberInput,
    dom.circleColorGNumberInput,
    dom.circleColorBNumberInput,
    dom.uploadInputEl,
    dom.cameraButtonEl,
    dom.btnVideoPlayPause,
    dom.btnVideoBack,
    dom.btnVideoForward,
    dom.btnExportFast,
    dom.btnExportRebuilt,
    dom.btnTogglePreview,
  ],
  onExport: ({ filename, rebuildPaths, onProgress }) =>
    circleRenderer.exportSvgWithProgress({
      filename,
      rebuildPaths,
      onProgress,
    }),
  onExportStateChange: (isExporting) => {
    exportInProgress = isExporting;
    if (isExporting) {
      fps.setExporting();
    }
  },
});

dom.divisionsInput.addEventListener("input", () => {
  circleRenderer.setDivisions(Number(dom.divisionsInput.value));
  syncControls();
});

dom.sizeMultiplierInput.addEventListener("input", () => {
  circleRenderer.setSizeMultiplier(Number(dom.sizeMultiplierInput.value));
  syncControls();
});

dom.circleColorRInput.addEventListener("input", syncCircleColor);
dom.circleColorGInput.addEventListener("input", syncCircleColor);
dom.circleColorBInput.addEventListener("input", syncCircleColor);
dom.circleColorRNumberInput.addEventListener(
  "input",
  syncColorFromNumberInputs,
);
dom.circleColorGNumberInput.addEventListener(
  "input",
  syncColorFromNumberInputs,
);
dom.circleColorBNumberInput.addEventListener(
  "input",
  syncColorFromNumberInputs,
);

dom.btnTogglePreview.addEventListener("click", () => preview.toggle());
dom.btnExportFast.addEventListener("click", () => {
  exportController.run({
    filename: "frame.svg",
    rebuildPaths: false,
    label: "exporting svg",
  });
});

dom.btnExportRebuilt.addEventListener("click", () => {
  exportController.run({
    filename: "frame-rebuilt.svg",
    rebuildPaths: true,
    label: "exporting rebuilt svg",
  });
});

window.addEventListener("resize", () => circleRenderer.resizeScene());

videoControls.bind();
preview.setVisible(true);
preview.resizeByAspect(4 / 3);
syncControls();
syncCircleColor();
circleRenderer.resizeScene();
mediaController.init();

paper.view.onFrame = () => {
  if (exportInProgress) return;
  if (!mediaController.isActiveSourceReady()) return;

  const source = mediaController.getActiveSourceElement();
  circleRenderer.renderFromSource(source);
  preview.draw(source);
  fps.tick();
};
