function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: ${id}`);
  }
  return element;
}

export function getDomElements() {
  return {
    mainCanvas: requireElement("c"),
    canvasWrap: requireElement("canvas-wrap"),
    statusEl: requireElement("status"),
    fpsEl: requireElement("fps"),

    previewWrap: requireElement("debug-wrap"),
    previewCanvas: requireElement("debug-canvas"),
    btnTogglePreview: requireElement("btn-debug"),

    divisionsInput: requireElement("divisions"),
    divisionsValue: requireElement("divisions-value"),
    sizeMultiplierInput: requireElement("size-multiplier"),
    sizeMultiplierValue: requireElement("size-multiplier-value"),
    circleColorRInput: requireElement("circle-color-r"),
    circleColorGInput: requireElement("circle-color-g"),
    circleColorBInput: requireElement("circle-color-b"),
    circleColorRNumberInput: requireElement("circle-color-r-number"),
    circleColorGNumberInput: requireElement("circle-color-g-number"),
    circleColorBNumberInput: requireElement("circle-color-b-number"),

    cameraVideoEl: requireElement("vid"),
    uploadInputEl: requireElement("media-upload"),
    cameraButtonEl: requireElement("btn-source-camera"),

    videoControlsEl: requireElement("video-controls"),
    btnVideoPlayPause: requireElement("btn-video-playpause"),
    btnVideoBack: requireElement("btn-video-back"),
    btnVideoForward: requireElement("btn-video-forward"),

    btnExportFast: requireElement("btn-export"),
    btnExportRebuilt: requireElement("btn-export-raw"),
    btnRecordToggle: requireElement("btn-record-toggle"),

    exportOverlay: requireElement("export-overlay"),
    exportOverlayTitle: requireElement("export-overlay-title"),
    exportOverlaySubtitle: requireElement("export-overlay-subtitle"),
    exportProgress: requireElement("export-progress"),
    exportProgressFill: requireElement("export-progress-fill"),
    exportProgressText: requireElement("export-progress-text"),
  };
}
