// media-source.js - Camera and uploaded media source management
export function createMediaSourceController({
  cameraVideoEl,
  uploadInputEl,
  cameraButtonEl,
  onSourceChanged,
}) {
  let sourceType = "camera";
  let cameraStream = null;
  let uploadObjectUrl = "";
  let activeSourceElement = cameraVideoEl;

  const uploadVideo = Object.assign(document.createElement("video"), {
    autoplay: true,
    muted: true,
    loop: false,
    playsInline: true,
  });
  const uploadImage = new Image();
  const svgBitmapCanvas = document.createElement("canvas");
  const svgBitmapCtx = svgBitmapCanvas.getContext("2d");

  function notifySourceChange(type, element, label, aspectRatio) {
    sourceType = type;
    activeSourceElement = element;

    if (typeof onSourceChanged === "function") {
      onSourceChanged({ type, element, label, aspectRatio });
    }
  }

  function setCameraActive(active) {
    if (!cameraStream) return;

    cameraStream.getVideoTracks().forEach((track) => {
      track.enabled = active;
    });

    if (active) {
      cameraVideoEl.play().catch(() => {});
      return;
    }

    cameraVideoEl.pause();
  }

  function getCameraAspectRatio() {
    const track = cameraStream?.getVideoTracks?.()[0];
    const settings = track?.getSettings?.();

    if (
      settings &&
      Number.isFinite(settings.aspectRatio) &&
      settings.aspectRatio > 0
    ) {
      return settings.aspectRatio;
    }

    if (
      settings &&
      Number.isFinite(settings.width) &&
      Number.isFinite(settings.height) &&
      settings.width > 0 &&
      settings.height > 0
    ) {
      return settings.width / settings.height;
    }

    if (cameraVideoEl.videoWidth > 0 && cameraVideoEl.videoHeight > 0) {
      return cameraVideoEl.videoWidth / cameraVideoEl.videoHeight;
    }

    return 4 / 3;
  }

  function startCamera() {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        cameraStream = stream;
        cameraVideoEl.srcObject = stream;
        setCameraActive(sourceType === "camera");

        const syncCameraSource = () => {
          if (!cameraVideoEl.videoWidth || !cameraVideoEl.videoHeight) return;
          if (sourceType !== "camera") return;

          notifySourceChange(
            "camera",
            cameraVideoEl,
            `camera ${cameraVideoEl.videoWidth}x${cameraVideoEl.videoHeight}`,
            getCameraAspectRatio(),
          );
        };

        cameraVideoEl.onloadedmetadata = () => {
          cameraVideoEl.play().catch(() => {});
          notifySourceChange(
            "camera",
            cameraVideoEl,
            "camera",
            getCameraAspectRatio(),
          );
          requestAnimationFrame(syncCameraSource);
          requestAnimationFrame(syncCameraSource);
        };

        cameraVideoEl.oncanplay = () => {
          syncCameraSource();
        };
      })
      .catch(() => {
        if (sourceType === "camera") {
          notifySourceChange(
            "camera",
            cameraVideoEl,
            "camera unavailable",
            4 / 3,
          );
        }
      });
  }

  function cleanupUploadMedia() {
    if (uploadObjectUrl) {
      URL.revokeObjectURL(uploadObjectUrl);
      uploadObjectUrl = "";
    }

    uploadVideo.pause();
    uploadVideo.removeAttribute("src");
    uploadVideo.load();
    uploadImage.src = "";
  }

  function useCameraSource() {
    if (!cameraStream) {
      notifySourceChange("camera", cameraVideoEl, "camera unavailable", 4 / 3);
      return;
    }

    cleanupUploadMedia();
    uploadInputEl.value = "";
    setCameraActive(true);

    const width = cameraVideoEl.videoWidth || 4;
    const height = cameraVideoEl.videoHeight || 3;

    notifySourceChange(
      "camera",
      cameraVideoEl,
      `camera ${width}x${height}`,
      getCameraAspectRatio(),
    );
  }

  function handleMediaUpload(event) {
    const [file] = event.target.files || [];
    if (!file) return;

    cleanupUploadMedia();
    uploadObjectUrl = URL.createObjectURL(file);
    setCameraActive(false);

    if (isSvgFile(file)) {
      loadSvgAsBitmap();
      return;
    }

    if (file.type.startsWith("image/")) {
      uploadImage.onload = () => {
        notifySourceChange(
          "image",
          uploadImage,
          `image ${uploadImage.naturalWidth}x${uploadImage.naturalHeight}`,
          uploadImage.naturalWidth / uploadImage.naturalHeight,
        );
      };

      uploadImage.onerror = () => {
        notifySourceChange("image", uploadImage, "failed to load image", 4 / 3);
      };

      uploadImage.src = uploadObjectUrl;
      return;
    }

    if (file.type.startsWith("video/")) {
      uploadVideo.onloadedmetadata = () => {
        uploadVideo.play().catch(() => {});
        notifySourceChange(
          "video",
          uploadVideo,
          `video ${uploadVideo.videoWidth}x${uploadVideo.videoHeight}`,
          uploadVideo.videoWidth / uploadVideo.videoHeight,
        );
      };

      uploadVideo.onerror = () => {
        notifySourceChange("video", uploadVideo, "failed to load video", 4 / 3);
      };

      uploadVideo.src = uploadObjectUrl;
      uploadVideo.load();
      return;
    }

    notifySourceChange(
      sourceType,
      activeSourceElement,
      "unsupported file type",
      4 / 3,
    );
  }

  function isSvgFile(file) {
    return (
      file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")
    );
  }

  function loadSvgAsBitmap() {
    const svgImage = new Image();

    svgImage.onload = () => {
      const width = Math.max(1, Math.round(svgImage.naturalWidth || 1024));
      const height = Math.max(1, Math.round(svgImage.naturalHeight || 1024));

      svgBitmapCanvas.width = width;
      svgBitmapCanvas.height = height;
      svgBitmapCtx.clearRect(0, 0, width, height);
      svgBitmapCtx.drawImage(svgImage, 0, 0, width, height);

      URL.revokeObjectURL(uploadObjectUrl);
      uploadObjectUrl = "";

      notifySourceChange(
        "image",
        svgBitmapCanvas,
        `svg ${width}x${height} (bitmap)`,
        width / height,
      );
    };

    svgImage.onerror = () => {
      notifySourceChange("image", uploadImage, "failed to load svg", 4 / 3);
    };

    svgImage.src = uploadObjectUrl;
  }

  function isActiveSourceReady() {
    if (sourceType === "image") {
      if (activeSourceElement instanceof HTMLCanvasElement) {
        return activeSourceElement.width > 0 && activeSourceElement.height > 0;
      }

      return uploadImage.complete && uploadImage.naturalWidth > 0;
    }

    return (
      activeSourceElement.readyState >= 2 &&
      activeSourceElement.videoWidth > 0 &&
      activeSourceElement.videoHeight > 0
    );
  }

  function init() {
    uploadInputEl.addEventListener("change", handleMediaUpload);
    cameraButtonEl.addEventListener("click", useCameraSource);
    startCamera();
  }

  return {
    init,
    isActiveSourceReady,
    getActiveSourceElement: () => activeSourceElement,
    getSourceType: () => sourceType,
    getUploadVideoElement: () => uploadVideo,
  };
}
