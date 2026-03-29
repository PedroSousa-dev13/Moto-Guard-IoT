import { describe, it, expect, vi, afterEach } from "vitest";
import { postGpxForParse } from "../gpxParseClient";

/**
 * Minimal XMLHttpRequest mock: runs upload progress + loadend, then load, in microtasks.
 */
function installMockXHR(
  handlers: {
    status: number;
    responseText: string;
    progress?: { loaded: number; total: number; lengthComputable: boolean };
  }
) {
  const OriginalXHR = globalThis.XMLHttpRequest;

  class MockUpload {
    listeners: Record<string, EventListenerOrEventListenerObject[]> = {};
    onprogress: ((e: ProgressEvent) => void) | null = null;

    addEventListener(type: string, fn: EventListenerOrEventListenerObject) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(fn);
    }

    dispatch(type: string) {
      for (const fn of this.listeners[type] ?? []) {
        if (typeof fn === "function") (fn as EventListener).call(this, {} as Event);
      }
    }
  }

  class MockXHR {
    upload = new MockUpload();
    status = 0;
    responseText = "";
    timeout = 0;
    withCredentials = false;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;

    open = vi.fn();
    send = vi.fn(() => {
      queueMicrotask(() => {
        const p = handlers.progress;
        if (p && this.upload.onprogress) {
          this.upload.onprogress({
            lengthComputable: p.lengthComputable,
            loaded: p.loaded,
            total: p.total,
          } as ProgressEvent);
        }
        this.upload.dispatch("loadend");
        this.status = handlers.status;
        this.responseText = handlers.responseText;
        this.onload?.();
      });
    });

    abort = vi.fn(() => {
      this.onabort?.();
    });
  }

  vi.stubGlobal("XMLHttpRequest", MockXHR as unknown as typeof XMLHttpRequest);
  return () => {
    vi.stubGlobal("XMLHttpRequest", OriginalXHR);
  };
}

describe("postGpxForParse (XHR client)", () => {
  let restoreXHR: () => void;

  afterEach(() => {
    restoreXHR?.();
  });

  it("parses successful JSON response", async () => {
    const body = {
      success: true as const,
      route: {
        waypoints: [
          { lat: 1, lon: 2 },
          { lat: 3, lon: 4 },
        ],
        distanceKm: 1.5,
        simulatorRoute: {
          start: { latitude: 1, longitude: 2 },
          end: { latitude: 3, longitude: 4 },
          loop: false,
        },
      },
    };
    restoreXHR = installMockXHR({
      status: 200,
      responseText: JSON.stringify(body),
      progress: { lengthComputable: true, loaded: 100, total: 100 },
    });

    const progressSpy = vi.fn();
    const uploadDoneSpy = vi.fn();
    const file = new File(["<gpx/>"], "t.gpx", { type: "application/gpx+xml" });

    const result = await postGpxForParse(file, {
      onUploadProgress: progressSpy,
      onUploadFinished: uploadDoneSpy,
    });

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    if (result.body.success) {
      expect(result.body.route.distanceKm).toBe(1.5);
      expect(result.body.route.waypoints).toHaveLength(2);
    }
    expect(progressSpy).toHaveBeenCalled();
    expect(uploadDoneSpy).toHaveBeenCalled();
  });

  it("surfaces API error body on HTTP 400", async () => {
    restoreXHR = installMockXHR({
      status: 400,
      responseText: JSON.stringify({
        success: false,
        error: "Invalid GPX",
        validationErrors: ["no track"],
      }),
    });

    const result = await postGpxForParse(new File(["x"], "t.gpx"));
    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
    if (!result.body.success) {
      expect(result.body.error).toBe("Invalid GPX");
      expect(result.body.validationErrors).toContain("no track");
    }
  });

  it("calls onUploadProgress(100) when length is not computable", async () => {
    restoreXHR = installMockXHR({
      status: 200,
      responseText: JSON.stringify({
        success: true,
        route: { waypoints: [{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }], distanceKm: 1 },
      }),
    });

    const progressSpy = vi.fn();
    await postGpxForParse(new File(["x"], "t.gpx"), {
      onUploadProgress: progressSpy,
    });

    expect(progressSpy).toHaveBeenCalledWith(100);
  });

  it("rejects with AbortError when aborted before send completes", async () => {
    const OriginalXHR = globalThis.XMLHttpRequest;

    class HangingXHR {
      upload = {
        addEventListener: vi.fn(),
        onprogress: null as ((e: ProgressEvent) => void) | null,
      };
      status = 0;
      responseText = "";
      timeout = 0;
      withCredentials = false;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open = vi.fn();
      send = vi.fn();
      abort = vi.fn(() => {
        this.onabort?.();
      });
    }

    vi.stubGlobal("XMLHttpRequest", HangingXHR as unknown as typeof XMLHttpRequest);

    const ac = new AbortController();
    const file = new File(["x"], "t.gpx");
    const p = postGpxForParse(file, { signal: ac.signal });

    queueMicrotask(() => {
      ac.abort();
    });

    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    vi.stubGlobal("XMLHttpRequest", OriginalXHR);
  });

  it("sends Authorization Bearer when token option is set", async () => {
    const headerSpy = vi.fn();
    const OriginalXHR = globalThis.XMLHttpRequest;

    class TokenXHR {
      upload = {
        listeners: {} as Record<string, EventListenerOrEventListenerObject[]>,
        addEventListener(type: string, fn: EventListenerOrEventListenerObject) {
          if (!this.listeners[type]) this.listeners[type] = [];
          this.listeners[type].push(fn);
        },
        onprogress: null as ((e: ProgressEvent) => void) | null,
        dispatch(type: string) {
          for (const fn of this.listeners[type] ?? []) {
            if (typeof fn === "function") (fn as EventListener).call(this, {} as Event);
          }
        },
      };
      status = 0;
      responseText = "";
      timeout = 0;
      withCredentials = false;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open = vi.fn();
      setRequestHeader = headerSpy;
      send = vi.fn(() => {
        queueMicrotask(() => {
          this.upload.dispatch("loadend");
          this.status = 200;
          this.responseText = JSON.stringify({
            success: true,
            route: {
              waypoints: [
                { lat: 0, lon: 0 },
                { lat: 1, lon: 1 },
              ],
              distanceKm: 1,
            },
          });
          this.onload?.();
        });
      });
      abort = vi.fn();
    }

    vi.stubGlobal("XMLHttpRequest", TokenXHR as unknown as typeof XMLHttpRequest);

    await postGpxForParse(new File(["x"], "t.gpx"), { token: "test-jwt" });

    expect(headerSpy).toHaveBeenCalledWith("Authorization", "Bearer test-jwt");
    vi.stubGlobal("XMLHttpRequest", OriginalXHR);
  });
});
