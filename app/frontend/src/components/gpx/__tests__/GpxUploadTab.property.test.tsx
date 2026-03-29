import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import GpxUploadTab from "../GpxUploadTab";

// Feature: gpx-upload-ui, Property 8: UI Feedback Consistency
// **Validates: Requirements 1.4, 1.5, 4.4, 5.4, 5.5**

// Feature: gpx-upload-ui, Property 9: Error Handling Robustness
// **Validates: Requirements 2.3, 6.5**

const baseRoute = {
  waypoints: [
    { latitude: 41.1579, longitude: -8.6291 },
    { latitude: 41.1833, longitude: -8.698 },
  ],
  distanceKm: 5.2,
  totalTimeSec: 300,
  simulatorRoute: {
    start: { latitude: 41.1579, longitude: -8.6291 },
    end: { latitude: 41.1833, longitude: -8.698 },
    loop: false,
  },
};

describe("Property 9: Error Handling Robustness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows any non-empty error message without throwing", async () => {
    await fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 300 }).filter((s) => s.trim().length > 0),
        (msg) => {
          try {
            const { container } = render(
              <GpxUploadTab
                isActive
                gpxRoute={null}
                gpxUploading={false}
                gpxError={msg}
                gpxProcessing={false}
                gpxSending={false}
                gpxSent={false}
                onFileSelect={vi.fn()}
                onClearRoute={vi.fn()}
                onSendToSimulator={vi.fn()}
                onError={vi.fn()}
              />
            );
            const danger = container.querySelector(".alert-danger");
            expect(danger).toBeTruthy();
            expect((danger?.textContent ?? "").trim()).toBe(msg.trim());
          } finally {
            cleanup();
          }
        }
      ),
      { numRuns: 40 }
    );
  });

  it("when error is set, does not show parse-success banner", async () => {
    await fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 120 }).filter((s) => s.trim().length > 0),
        (err) => {
          try {
            render(
              <GpxUploadTab
                isActive
                gpxRoute={baseRoute}
                gpxUploading={false}
                gpxError={err}
                gpxProcessing={false}
                gpxSending={false}
                gpxSent={false}
                onFileSelect={vi.fn()}
                onClearRoute={vi.fn()}
                onSendToSimulator={vi.fn()}
                onError={vi.fn()}
              />
            );
            expect(screen.queryByText(/GPX processado com sucesso/i)).not.toBeInTheDocument();
          } finally {
            cleanup();
          }
        }
      ),
      { numRuns: 25 }
    );
  });
});

describe("Property 8: UI Feedback Consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const flagsArb = fc.record({
    uploading: fc.boolean(),
    processing: fc.boolean(),
    sending: fc.boolean(),
    sent: fc.boolean(),
    hasRoute: fc.boolean(),
  });

  it("shows loading copy whenever upload or processing is in progress", async () => {
    await fc.assert(
      fc.property(flagsArb, (f) => {
        if (!f.uploading && !f.processing) return true;

        try {
          render(
            <GpxUploadTab
              isActive
              gpxRoute={f.hasRoute ? baseRoute : null}
              gpxUploading={f.uploading}
              gpxError={null}
              gpxProcessing={f.processing}
              gpxSending={f.sending}
              gpxSent={f.sent}
              uploadProgress={f.uploading ? 50 : 0}
              onFileSelect={vi.fn()}
              onClearRoute={vi.fn()}
              onSendToSimulator={vi.fn()}
              onError={vi.fn()}
            />
          );
          expect(screen.getByText(/A carregar ficheiro/i)).toBeInTheDocument();
        } finally {
          cleanup();
        }
        return true;
      }),
      { numRuns: 40 }
    );
  });

  it("when route is ready and sent, shows sent affordance on the send control", async () => {
    await fc.assert(
      fc.property(fc.boolean(), (sending) => {
        try {
          render(
            <GpxUploadTab
              isActive
              gpxRoute={baseRoute}
              gpxUploading={false}
              gpxError={null}
              gpxProcessing={false}
              gpxSending={sending}
              gpxSent
              onFileSelect={vi.fn()}
              onClearRoute={vi.fn()}
              onSendToSimulator={vi.fn()}
              onError={vi.fn()}
            />
          );
          if (sending) {
            expect(
              screen.getByRole("button", { name: /A enviar/i })
            ).toBeInTheDocument();
          } else {
            expect(
              screen.getByRole("button", { name: /Rota enviada/i })
            ).toBeInTheDocument();
            expect(
              screen.getByText(/Rota enviada com sucesso! A redirecionar/i)
            ).toBeInTheDocument();
          }
        } finally {
          cleanup();
        }
        return true;
      }),
      { numRuns: 20 }
    );
  });

  it("when route is ready, not sent, and idle, shows primary send label", () => {
    render(
      <GpxUploadTab
        isActive
        gpxRoute={baseRoute}
        gpxUploading={false}
        gpxError={null}
        gpxProcessing={false}
        gpxSending={false}
        gpxSent={false}
        onFileSelect={vi.fn()}
        onClearRoute={vi.fn()}
        onSendToSimulator={vi.fn()}
        onError={vi.fn()}
      />
    );
    expect(screen.getByText(/Enviar para Simulador/i)).toBeInTheDocument();
    expect(screen.getByText(/GPX processado com sucesso/i)).toBeInTheDocument();
  });
});
