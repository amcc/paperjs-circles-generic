// circles.js - Circle grid creation, sampling, and SVG export
export function createCircleRenderer({
  paper,
  mainCanvas,
  canvasWrap,
  statusEl,
  initialDivisions = 30,
  initialSizeMultiplier = 1,
  initialAspectRatio = 4 / 3,
  initialColor = { r: 0, g: 0, b: 255 },
  minRadius = 0.5,
}) {
  let W = 0;
  let H = 0;
  let step = 1;
  let cols = 0;
  let rows = 0;
  let divisions = initialDivisions;
  let sizeMultiplier = initialSizeMultiplier;
  let aspectRatio = initialAspectRatio;
  let sourceLabel = "";
  let backgroundRect = null;
  let circleColor = {
    r: Number(initialColor.r ?? 0),
    g: Number(initialColor.g ?? 0),
    b: Number(initialColor.b ?? 255),
  };

  const circles = [];
  const sampleOff = Object.assign(document.createElement("canvas"), {
    width: 1,
    height: 1,
  });
  const sampleCtx = sampleOff.getContext("2d", { willReadFrequently: true });

  function makeCircle(center, radius) {
    const path = new paper.Path.Circle(center, radius);
    path.fillColor = getPaperColor();

    return {
      center,
      radius,
      path,
    };
  }

  function setCircleRadius(circle, nextRadius) {
    const safeRadius = Math.max(minRadius, nextRadius);
    circle.path.scale(safeRadius / circle.radius, circle.center);
    circle.radius = safeRadius;
  }

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

  function syncBackground() {
    if (backgroundRect) {
      backgroundRect.remove();
    }

    backgroundRect = new paper.Path.Rectangle({
      from: [0, 0],
      to: [W, H],
      fillColor: new paper.Color(1, 1, 1),
    });
    backgroundRect.sendToBack();
  }

  function updateStatus() {
    const gridText = `${cols}x${rows} step:${step.toFixed(1)}`;
    statusEl.textContent = sourceLabel
      ? `${sourceLabel} | ${gridText}`
      : gridText;
  }

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

  function resizeScene() {
    const boundsWidth = canvasWrap.clientWidth;
    const boundsHeight = canvasWrap.clientHeight;

    let fitW = boundsWidth;
    let fitH = fitW / aspectRatio;

    if (fitH > boundsHeight) {
      fitH = boundsHeight;
      fitW = fitH * aspectRatio;
    }

    W = Math.max(1, Math.floor(fitW));
    H = Math.max(1, Math.floor(fitH));

    mainCanvas.width = W;
    mainCanvas.height = H;
    paper.view.viewSize = new paper.Size(W, H);
    mainCanvas.style.width = `${W}px`;
    mainCanvas.style.height = `${H}px`;

    syncBackground();
    rebuildCircles();
  }

  function renderFromSource(sourceElement) {
    if (!sourceElement || cols < 1 || rows < 1) return;

    sampleCtx.drawImage(sourceElement, 0, 0, cols, rows);
    const data = sampleCtx.getImageData(0, 0, cols, rows).data;

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
  }

  function setDivisions(value) {
    divisions = Math.max(1, Number(value) || 1);
    rebuildCircles();
  }

  function setSizeMultiplier(value) {
    sizeMultiplier = Math.max(0, Number(value) || 0);
  }

  function setAspect(nextAspectRatio) {
    if (!nextAspectRatio || nextAspectRatio <= 0) return;
    aspectRatio = nextAspectRatio;
    resizeScene();
  }

  function setSourceLabel(label) {
    sourceLabel = label || "";
    updateStatus();
  }

  function clampColorChannel(value) {
    return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
  }

  function getPaperColor() {
    return new paper.Color(
      circleColor.r / 255,
      circleColor.g / 255,
      circleColor.b / 255,
    );
  }

  function getColorHex() {
    const toHex = (value) => value.toString(16).padStart(2, "0");
    return `#${toHex(circleColor.r)}${toHex(circleColor.g)}${toHex(circleColor.b)}`;
  }

  function setCircleColor(nextColor) {
    circleColor = {
      r: clampColorChannel(nextColor.r),
      g: clampColorChannel(nextColor.g),
      b: clampColorChannel(nextColor.b),
    };

    const fill = getPaperColor();
    circles.forEach((circle) => {
      circle.path.fillColor = fill;
    });
  }

  function exportSvg(filename, rebuildPaths) {
    return exportSvgWithProgress({ filename, rebuildPaths });
  }

  async function exportSvgWithProgress({
    filename,
    rebuildPaths,
    onProgress = () => {},
  }) {
    const total = circles.length;
    if (total === 0) {
      onProgress({ completed: 0, total: 0, percent: 100 });
      return;
    }

    const chunks = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    ];
    const fill = getColorHex();

    const progressChunkSize = 250;

    for (let i = 0; i < total; i++) {
      const circle = circles[i];
      if (rebuildPaths) {
        rebuildCirclePath(circle);
      }

      chunks.push(
        `<circle cx="${circle.center.x}" cy="${circle.center.y}" r="${circle.radius}" fill="${fill}" />`,
      );

      if (i % progressChunkSize === 0 || i === total - 1) {
        const completed = i + 1;
        const percent = Math.round((completed / total) * 100);
        onProgress({ completed, total, percent });
        // Yield to the browser so overlay/progress can paint during long exports.
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }

    chunks.push("</svg>");
    const svg = chunks.join("");
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);

    const a = Object.assign(document.createElement("a"), {
      href,
      download: filename,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  return {
    resizeScene,
    renderFromSource,
    setDivisions,
    setSizeMultiplier,
    setCircleColor,
    setAspect,
    setSourceLabel,
    exportSvg,
    exportSvgWithProgress,
  };
}
