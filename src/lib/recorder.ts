import React from "react";
import { hidePluginWindow } from "./utils";
import { v4 as uuid } from "uuid";
import io from "socket.io-client";

// Global variables
let videoTransferFileName: string | undefined;
let mediaRecorder: MediaRecorder | undefined;
let userId: string;
let micTrackRef: MediaStreamTrack | undefined;

// Socket connection
const socket = io(import.meta.env.VITE_SOCKET_URL as string);

// Start recording function
export const StartRecording = (onSources: {
  screen: string;
  audio: string;
  id: string;
}) => {
  if (!onSources || !onSources.id || !onSources.screen) {
    console.error("Invalid sources provided for recording.");
    return;
  }

  hidePluginWindow(true);

  // Generate unique filename for the recorded video
  videoTransferFileName = `${uuid()}-${onSources.id.slice(0, 8)}.webm`;

  // Start the MediaRecorder
  if (mediaRecorder && mediaRecorder.state !== "recording") {
    console.log("MediaRecorder starting with filename:", videoTransferFileName);
    try {
      mediaRecorder.start(1000); // Collect chunks every second
    } catch (err) {
      console.error("Failed to start MediaRecorder:", err);
    }
  } else {
    console.error("MediaRecorder is not initialized or already recording.");
  }
};

// Expose a mic toggle for UI
export const toggleMicrophone = (enabled: boolean) => {
  if (micTrackRef) micTrackRef.enabled = enabled;
};

// Stop recording function
export const onStopRecording = () => {
  hidePluginWindow(false);

  if (mediaRecorder) {
    mediaRecorder.stop();
  } else {
    console.error("MediaRecorder is not active.");
  }
};

// MediaRecorder stop event handler
const stopRecording = () => {
  hidePluginWindow(false);

  if (videoTransferFileName && userId) {
    socket.emit("process-video", {
      filename: videoTransferFileName,
      userId,
    });
  } else {
    console.error("Missing video filename or user ID.");
  }
};

// MediaRecorder data available event handler
let pendingSeq = 0;
let inflight = 0;
const MAX_INFLIGHT = 4; // simple window for backpressure
const queue: { seq: number; payload: ArrayBuffer }[] = [];

socket.on("ack", () => {
  inflight = Math.max(0, inflight - 1);
  flushQueue();
});

const flushQueue = () => {
  while (inflight < MAX_INFLIGHT && queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    inflight++;
    socket.emit("video-chunks", {
      filename: videoTransferFileName,
      chunks: item.payload,
      seq: item.seq,
    });
  }
};

export const onDataAvailable = async (e: BlobEvent) => {
  if (e.data.size > 0 && videoTransferFileName) {
    const ab = await e.data.arrayBuffer();
    const seq = pendingSeq++;
    queue.push({ seq, payload: ab });
    flushQueue();
  } else {
    console.error("No data available or filename is missing.");
  }
};

// Select sources for screen and audio recording
export const selectSources = async (
  onSources: {
    screen: string;
    audio: string;
    id: string;
    preset: "HD" | "SD";
  },
  videoElement: React.RefObject<HTMLVideoElement>
) => {
  if (!onSources || !onSources.screen || !onSources.audio || !onSources.id) {
    console.error("Invalid sources provided.");
    return;
  }

  // Validate and, if necessary, replace the screen source with an available one
  // This avoids Windows Graphics Capture errors like: "Source is not capturable"
  // which happen if a previously saved window/source no longer exists or is protected/minimized
  let resolvedScreenSourceId = onSources.screen;
  try {
    // window.ipcRenderer is injected by Electron preload
    // Using any for window to avoid unused ts-expect-error; cast the result only
    type IpcApi = {
      invoke: (
        channel: string,
        ...args: unknown[]
      ) => Promise<{ id: string; name?: string }[]>;
    };
    const ipc = (window as unknown as { ipcRenderer: IpcApi }).ipcRenderer;
    const availableSources = await ipc.invoke("getSources");
    const matchingSource = Array.isArray(availableSources)
      ? availableSources.find((s) => s?.id === onSources.screen)
      : undefined;

    if (!matchingSource) {
      // Prefer a display/screen source; fall back to the first available source
      const fallbackScreen = Array.isArray(availableSources)
        ? availableSources.find(
            (s) => typeof s?.id === "string" && s.id.startsWith("screen:")
          )
        : undefined;
      const firstAvailable = Array.isArray(availableSources)
        ? availableSources[0]
        : undefined;

      if (fallbackScreen?.id) {
        resolvedScreenSourceId = fallbackScreen.id;
        console.warn(
          "Original screen source not found. Falling back to:",
          fallbackScreen?.name || fallbackScreen?.id
        );
      } else if (firstAvailable?.id) {
        resolvedScreenSourceId = firstAvailable.id;
        console.warn(
          "No screen source found. Using first available source:",
          firstAvailable?.name || firstAvailable?.id
        );
      } else {
        throw new Error("No capturable sources are currently available.");
      }
    }
  } catch (validationError: unknown) {
    console.error("Failed to validate screen source:", validationError);
  }

  const constraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: resolvedScreenSourceId,
        minWidth: onSources.preset === "HD" ? 1920 : 1280,
        maxWidth: onSources.preset === "HD" ? 1920 : 1280,
        minHeight: onSources.preset === "HD" ? 1080 : 720,
        maxHeight: onSources.preset === "HD" ? 1080 : 720,
        frameRate: 30,
      },
    },
  } as unknown as MediaStreamConstraints;

  userId = onSources.id;

  try {
    // Create screen video stream
    let stream: MediaStream | undefined;
    try {
      const cs: MediaStreamConstraints = constraints as MediaStreamConstraints;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mandatory = (
        cs as unknown as {
          video: { mandatory: { chromeMediaSourceId: string } };
        }
      ).video.mandatory;
      console.log(
        "Attempting getUserMedia with source:",
        mandatory.chromeMediaSourceId
      );
      stream = await navigator.mediaDevices.getUserMedia(cs);
    } catch (err: unknown) {
      const message = String((err as Error)?.message || err);
      console.error("Initial getUserMedia failed:", message);
      // Retry by re-enumerating sources and picking the first available screen
      if (
        message.includes("not capturable") ||
        message.includes("NotReadableError") ||
        message.includes("could not start video source")
      ) {
        try {
          type IpcApi = {
            invoke: (
              channel: string,
              ...args: unknown[]
            ) => Promise<{ id: string; name?: string }[]>;
          };
          const ipc = (window as unknown as { ipcRenderer: IpcApi })
            .ipcRenderer;
          const freshSources = await ipc.invoke("getSources");
          const fallback = Array.isArray(freshSources)
            ? freshSources.find(
                (s) => typeof s?.id === "string" && s.id.startsWith("screen:")
              ) || freshSources[0]
            : undefined;
          if (fallback?.id) {
            console.warn(
              "Retrying with fallback source:",
              fallback?.name || fallback.id
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (
              constraints as unknown as {
                video: { mandatory: { chromeMediaSourceId: string } };
              }
            ).video.mandatory.chromeMediaSourceId = fallback.id;
            stream = await navigator.mediaDevices.getUserMedia(
              constraints as MediaStreamConstraints
            );
          } else {
            throw err;
          }
        } catch (retryErr: unknown) {
          console.error("Retry getUserMedia failed:", retryErr);
          throw retryErr;
        }
      } else {
        throw err;
      }
    }

    // Create audio stream with fallback
    let audioStream: MediaStream | undefined;
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: onSources.audio
          ? { deviceId: { exact: onSources.audio } }
          : true,
      });
    } catch (audioErr) {
      console.warn(
        "Audio device exact match failed, trying default mic:",
        audioErr
      );
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
      } catch (fallbackErr) {
        console.warn(
          "Default mic failed, proceeding without audio:",
          fallbackErr
        );
      }
    }

    // Assign the screen video stream to the video element
    if (videoElement && videoElement.current) {
      videoElement.current.srcObject = stream;
      videoElement.current.muted = true;
      await videoElement.current.play();
    }

    // Combine video and audio tracks into a single MediaStream
    const combineStream = new MediaStream([
      ...stream.getTracks(),
      ...(audioStream ? audioStream.getTracks() : []),
    ]);

    micTrackRef = audioStream?.getAudioTracks()?.[0];

    // Initialize the MediaRecorder
    mediaRecorder = new MediaRecorder(combineStream, {
      mimeType: "video/webm; codecs=vp9",
    });

    mediaRecorder.ondataavailable = onDataAvailable;
    mediaRecorder.onstop = stopRecording;
    mediaRecorder.onerror = (e) => {
      console.error("MediaRecorder error:", e);
    };
    mediaRecorder.onstart = () => {
      console.log("MediaRecorder started.");
    };
  } catch (error: unknown) {
    console.error("Error selecting sources:", error);
    const msg = (error as Error)?.message;
    if (msg) console.error(msg);
  }
};

export const isRecorderReady = () => {
  return Boolean(mediaRecorder && mediaRecorder.state !== "recording");
};
