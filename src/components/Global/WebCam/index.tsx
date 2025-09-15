// in /src/components/Global/WebCam/index.tsx

import { useEffect, useRef, useState } from "react";

const WebCam = () => {
  const camElement = useRef<HTMLVideoElement | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);

  const streamWebCam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 320 },
        },
        audio: false,
      });
      if (camElement.current) {
        camElement.current.srcObject = stream;
        await camElement.current.play();
      }
    } catch (err) {
      console.error("Could not access webcam:", err);
    }
  };

  const toggleCamera = () => {
    const el = camElement.current;
    const stream = el?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()?.[0];
    if (track) {
      const next = !track.enabled;
      track.enabled = next;
      setIsCameraOn(next);
    }
  };

  useEffect(() => {
    streamWebCam();
    return () => {
      const stream = camElement.current?.srcObject as MediaStream | undefined;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div
      onClick={toggleCamera}
      className="non-draggable cursor-pointer relative w-[220px] h-[220px] rounded-full overflow-hidden shadow-lg ring-1 ring-white/20"
    >
      <video
        ref={camElement}
        muted
        playsInline
        className="w-full h-full object-cover"
      />
      {!isCameraOn && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs">
          Camera off
        </div>
      )}
    </div>
  );
};

export default WebCam;
