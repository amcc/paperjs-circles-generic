export function createExportController({
  statusEl,
  overlay,
  overlayTitle,
  overlaySubtitle,
  progressBar,
  progressFill,
  progressText,
  controls,
  onExport,
  onExportStateChange,
  onExportDone,
}) {
  let exporting = false;

  function isExporting() {
    return exporting;
  }

  function setControlsDisabled(disabled) {
    controls.forEach((control) => {
      control.disabled = disabled;
    });
  }

  function waitForNextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function setOverlay({ visible, title = "", subtitle = "" }) {
    overlay.classList.toggle("visible", visible);
    overlay.setAttribute("aria-hidden", visible ? "false" : "true");

    if (title) {
      overlayTitle.textContent = title;
    }

    if (subtitle) {
      overlaySubtitle.textContent = subtitle;
    }
  }

  function setProgress(percent) {
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
    progressFill.style.width = `${safePercent}%`;
    progressText.textContent = `${safePercent}%`;
    progressBar.setAttribute("aria-valuenow", String(safePercent));
  }

  async function run({ filename, rebuildPaths, label }) {
    if (exporting) return;

    exporting = true;
    onExportStateChange(true);
    setControlsDisabled(true);
    statusEl.textContent = `${label}...`;
    setOverlay({
      visible: true,
      title: `${label}...`,
      subtitle: "rendering paused while svg is generated",
    });
    setProgress(0);

    await waitForNextPaint();
    await waitForNextPaint();

    const startedAt = performance.now();

    try {
      await onExport({
        filename,
        rebuildPaths,
        onProgress: ({ percent, completed, total }) => {
          setProgress(percent);
          overlaySubtitle.textContent = `${completed} / ${total} circles`;
        },
      });

      setProgress(100);
      const elapsedMs = Math.round(performance.now() - startedAt);
      statusEl.textContent = `${label} done (${elapsedMs} ms)`;
      setOverlay({
        visible: true,
        title: `${label} done`,
        subtitle: `${elapsedMs} ms`,
      });
      if (typeof onExportDone === "function") {
        onExportDone(elapsedMs);
      }
    } catch (error) {
      statusEl.textContent = `${label} failed`;
      setOverlay({
        visible: true,
        title: `${label} failed`,
        subtitle: "check console for details",
      });
      console.error(error);
    } finally {
      await waitForNextPaint();
      exporting = false;
      onExportStateChange(false);
      setControlsDisabled(false);
      setOverlay({ visible: false });
    }
  }

  return {
    isExporting,
    run,
  };
}
