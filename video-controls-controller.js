export function createVideoControlsController({
  controlsWrap,
  playPauseButton,
  backButton,
  forwardButton,
  uploadVideo,
  getSourceType,
}) {
  function setVisible(visible) {
    controlsWrap.classList.toggle("visible", visible);
    controlsWrap.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function setPlayPauseLabel(isPlaying) {
    playPauseButton.textContent = isPlaying ? "pause" : "play";
    playPauseButton.setAttribute(
      "aria-label",
      isPlaying ? "pause video" : "play video",
    );
  }

  function togglePlayback() {
    if (getSourceType() !== "video") return;

    if (uploadVideo.paused) {
      uploadVideo.play().catch(() => {});
      return;
    }

    uploadVideo.pause();
  }

  function step(direction) {
    if (getSourceType() !== "video") return;

    uploadVideo.pause();
    const frameDuration = 1 / 30;
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

  function bind() {
    playPauseButton.addEventListener("click", togglePlayback);
    backButton.addEventListener("click", () => step(-1));
    forwardButton.addEventListener("click", () => step(1));

    uploadVideo.addEventListener("play", () => setPlayPauseLabel(true));
    uploadVideo.addEventListener("pause", () => setPlayPauseLabel(false));
    uploadVideo.addEventListener("ended", () => setPlayPauseLabel(false));
  }

  return {
    bind,
    setVisible,
    setPlayPauseLabel,
  };
}
