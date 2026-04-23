export function createFpsController({ fpsEl }) {
  let frameCount = 0;
  let lastFpsUpdate = performance.now();
  let lastFrameCount = 0;

  function setExporting() {
    fpsEl.textContent = "exporting...";
  }

  function tick() {
    frameCount += 1;
    const now = performance.now();
    const deltaMs = now - lastFpsUpdate;

    if (deltaMs < 500) return;

    const framesSinceUpdate = frameCount - lastFrameCount;
    const fps = Math.round((framesSinceUpdate * 1000) / deltaMs);

    fpsEl.textContent = `${fps} FPS`;
    lastFpsUpdate = now;
    lastFrameCount = frameCount;
  }

  return {
    tick,
    setExporting,
  };
}
