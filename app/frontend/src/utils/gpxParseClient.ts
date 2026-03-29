import { getStoredToken } from "../services/api";

/**
 * Client for POST /api/gpx/parse with optional upload progress (XHR).
 * Envia Bearer JWT como o axios (authMiddleware no backend).
 */

export interface GpxParseApiRoute {
  waypoints: Array<{ lat: number; lon: number; ele?: number; time?: string }>;
  distanceKm: number;
  totalTimeSec?: number;
  avgSpeedKmh?: number;
  maxSpeedKmh?: number;
  startedAt?: string;
  endedAt?: string;
  bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  simulatorRoute?: {
    start: { latitude: number; longitude: number };
    end: { latitude: number; longitude: number };
    loop: boolean;
  };
}

export type GpxParseApiBody =
  | { success: true; route: GpxParseApiRoute }
  | { success: false; error?: string; validationErrors?: string[] };

export interface PostGpxForParseResult {
  status: number;
  body: GpxParseApiBody;
}

export interface PostGpxForParseOptions {
  url?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** JWT; se omitido, usa o mesmo token que o cliente API (local/session storage). */
  token?: string | null;
  onUploadProgress?: (percent: number) => void;
  onUploadFinished?: () => void;
}

function parseResponseText(text: string): GpxParseApiBody {
  try {
    const raw = JSON.parse(text || "{}") as unknown;
    if (typeof raw !== "object" || raw === null) {
      return { success: false, error: "Invalid response from server." };
    }
    return raw as GpxParseApiBody;
  } catch {
    return { success: false, error: "Invalid response from server." };
  }
}

/**
 * Uploads a GPX file and returns HTTP status plus parsed JSON body.
 */
export function postGpxForParse(
  file: File,
  options: PostGpxForParseOptions = {}
): Promise<PostGpxForParseResult> {
  const {
    url = "/api/gpx/parse",
    signal,
    timeoutMs = 30000,
    onUploadProgress,
    onUploadFinished,
    token: tokenOption,
  } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;

    const authToken = tokenOption ?? getStoredToken();
    if (authToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
    }

    let uploadHadComputableProgress = false;

    const cleanupAbort = () => {
      if (!signal) return;
      signal.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      xhr.abort();
    };

    if (signal) {
      if (signal.aborted) {
        reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        return;
      }
      signal.addEventListener("abort", onAbort);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0 && onUploadProgress) {
        uploadHadComputableProgress = true;
        onUploadProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    };

    xhr.upload.addEventListener("loadend", () => {
      onUploadFinished?.();
      if (onUploadProgress && !uploadHadComputableProgress) {
        onUploadProgress(100);
      }
    });

    xhr.onload = () => {
      cleanupAbort();
      const body = parseResponseText(xhr.responseText);
      resolve({ status: xhr.status, body });
    };

    xhr.onerror = () => {
      cleanupAbort();
      resolve({
        status: 0,
        body: {
          success: false,
          error:
            "Não foi possível ligar ao servidor. Confirma que o backend está a correr (npm run dev na pasta app, porta 3000) e que abres o site pelo Vite (proxy /api).",
        },
      });
    };

    xhr.ontimeout = () => {
      cleanupAbort();
      resolve({
        status: 0,
        body: {
          success: false,
          error: "Upload timed out. Please check your connection and try again.",
        },
      });
    };

    xhr.onabort = () => {
      cleanupAbort();
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    };

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}
