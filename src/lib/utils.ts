/* eslint-disable @typescript-eslint/ban-ts-comment */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import axios from "axios";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
const httpsClient = axios.create({
  // In dev, use Vite proxy to avoid CORS; in prod, use configured host
  baseURL: import.meta.env.DEV ? "/api" : import.meta.env.VITE_HOST_URL,
  headers: {
    Authorization: `Bearer ${import.meta.env.VITE_DESKTOP_APP_API_KEY || ""}`,
    "Content-Type": "application/json",
  },
});
//@ts-ignore
export const onCloseApp = () => window.ipcRenderer.send("closeApp");
export const fetchUserProfile = async (clerkId: string) => {
  const response = await httpsClient.get(`/auth/${clerkId}`);
  return response.data;
};
export const getMediaSources = async () => {
  try {
    //@ts-ignore
    const displays = await window.ipcRenderer.invoke("getSources");
    console.log("Raw displays from Electron:", displays);
    type DisplayItem = {
      id: string;
      name?: string;
      type?: "screen" | "window";
    };
    const sanitizedDisplays: {
      id: string;
      name: string;
      type?: "screen" | "window";
    }[] = Array.isArray(displays)
      ? (displays as DisplayItem[])
          .filter((d) => d && typeof d.id === "string")
          .map((d) => ({ id: d.id, name: d.name || d.id, type: d.type }))
      : [];

    const enumerateDevices = await navigator.mediaDevices.enumerateDevices();
    const audioInput = enumerateDevices.filter(
      (device) => device.kind === "audioinput"
    );
    console.log("Audio devices:", audioInput);
    console.log("Final result:", {
      displays: sanitizedDisplays,
      audio: audioInput,
    });
    return { displays: sanitizedDisplays, audio: audioInput };
  } catch (error) {
    console.error("Error getting media sources:", error);
    return { displays: [], audio: [] };
  }
};

export const updateStudioSettings = async (
  id: string,
  screen: string,
  audio: string,
  preset: "HD" | "SD"
) => {
  const response = await httpsClient.post(
    `/studio/${id}`,
    {
      screen,
      audio,
      preset,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};
export const hidePluginWindow = (state: boolean) => {
  //@ts-ignore
  window.ipcRenderer.send("hide-plugin", { state });
};

export const videoRecordingTime = (ms: number) => {
  const second = Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, "0");
  const minute = Math.floor((ms / 1000 / 60) % 60)
    .toString()
    .padStart(2, "0");
  const hour = Math.floor((ms / 1000 / 60 / 60) % 60)
    .toString()
    .padStart(2, "0");
  return { length: `${hour}:${minute}:${second}`, minute };
};

export const resizeWindow = (shrink: boolean) => {
  //@ts-ignore
  window.ipcRenderer.send("resize-studio", { shrink });
};
