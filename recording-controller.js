function pickSupportedMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function getExtensionFromMimeType(mimeType) {
  if (mimeType.includes("mp4")) return "mp4";
  return "webm";
}

function buildRecordingFilename(extension) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  return `paperjs-circles-${timestamp}.${extension}`;
}

function downloadRecordingBlob(blob, extension) {
  const href = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href,
    download: buildRecordingFilename(extension),
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function createRecordingController({
  canvas,
  toggleButton,
  onStatus,
  onRecordingStateChange,
}) {
  let mediaRecorder = null;
  let mediaStream = null;
  let recordedChunks = [];
  let activeMimeType = "";
  let recording = false;

  function setButtonState() {
    toggleButton.textContent = recording ? "stop recording" : "start recording";
    toggleButton.setAttribute(
      "aria-label",
      recording ? "stop recording" : "start recording",
    );
  }

  function emitStatus(message) {
    if (typeof onStatus === "function") {
      onStatus(message);
    }
  }

  function emitRecordingState() {
    if (typeof onRecordingStateChange === "function") {
      onRecordingStateChange(recording);
    }
  }

  function cleanupStream() {
    if (!mediaStream) return;

    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  function stopRecordingInternal() {
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;
    mediaRecorder.stop();
  }

  function startRecording() {
    if (recording) return;

    if (!window.MediaRecorder) {
      emitStatus("recording unsupported in this browser");
      return;
    }

    const mimeType = pickSupportedMimeType();
    if (!mimeType) {
      emitStatus("no supported recording mime type");
      return;
    }

    activeMimeType = mimeType;
    recordedChunks = [];

    mediaStream = canvas.captureStream(30);

    mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: activeMimeType,
      videoBitsPerSecond: 12_000_000,
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onerror = () => {
      recording = false;
      setButtonState();
      emitRecordingState();
      emitStatus("recording failed");
      cleanupStream();
    };

    mediaRecorder.onstop = () => {
      recording = false;
      setButtonState();
      emitRecordingState();

      const extension = getExtensionFromMimeType(activeMimeType);
      const blob = new Blob(recordedChunks, { type: activeMimeType });
      downloadRecordingBlob(blob, extension);
      emitStatus(`recording saved (${extension})`);

      cleanupStream();
    };

    mediaRecorder.start(250);
    recording = true;
    setButtonState();
    emitRecordingState();
    emitStatus("recording...");
  }

  function bind() {
    toggleButton.addEventListener("click", () => {
      if (recording) {
        stopRecordingInternal();
        return;
      }

      startRecording();
    });
    setButtonState();
  }

  return {
    bind,
    stopRecording: stopRecordingInternal,
    isRecording: () => recording,
  };
}
