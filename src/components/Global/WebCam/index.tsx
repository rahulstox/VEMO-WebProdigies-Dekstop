// in /src/components/Global/WebCam/index.tsx

import { useEffect, useRef } from "react";

const WebCam = () => {
  const camElement = useRef<HTMLVideoElement | null>(null);

  const streamWebCam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true, // We only need video for the floating webcam
      });
      if (camElement.current) {
        camElement.current.srcObject = stream;
        await camElement.current.play();
      }
    } catch (err) {
      console.error("Could not access webcam:", err);
      // Yahan hum "camera off" icon dikhane ka logic daal sakte hain
    }
  };

  useEffect(() => {
    streamWebCam();
  }, []);

  return (
    <video
      ref={camElement}
      className="draggable webcam-circle" // Changed this className
    ></video>
  );
};

export default WebCam;
