export function createPreviewController({
  previewWrap,
  previewCanvas,
  previewToggleButton,
  maxWidth = 320,
  maxHeight = 240,
}) {
  const previewCtx = previewCanvas.getContext("2d");
  let visible = true;

  function setVisible(nextVisible) {
    visible = nextVisible;
    previewWrap.classList.toggle("visible", visible);
    previewToggleButton.textContent = visible ? "hide source" : "show source";
  }

  function toggle() {
    setVisible(!visible);
  }

  function resizeByAspect(aspectRatio) {
    let width = maxWidth;
    let height = maxHeight;

    if (aspectRatio > maxWidth / maxHeight) {
      height = Math.round(width / aspectRatio);
    } else {
      width = Math.round(height * aspectRatio);
    }

    previewCanvas.width = width;
    previewCanvas.height = height;
  }

  function draw(sourceElement) {
    if (!visible) return;
    previewCtx.drawImage(
      sourceElement,
      0,
      0,
      previewCanvas.width,
      previewCanvas.height,
    );
  }

  function isVisible() {
    return visible;
  }

  return {
    setVisible,
    toggle,
    resizeByAspect,
    draw,
    isVisible,
  };
}
