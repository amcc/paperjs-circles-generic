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
            cameraVideoEl.videoWidth / cameraVideoEl.videoHeight,
          );
        };

        cameraVideoEl.onloadedmetadata = () => {
          cameraVideoEl.play().catch(() => {});
          notifySourceChange("camera", cameraVideoEl, "camera", 4 / 3);
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
      width / height,
    );
  }

  function handleMediaUpload(event) {
    const [file] = event.target.files || [];
    if (!file) return;

    cleanupUploadMedia();
    uploadObjectUrl = URL.createObjectURL(file);
    setCameraActive(false);

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

  function isActiveSourceReady() {
    if (sourceType === "image") {
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
