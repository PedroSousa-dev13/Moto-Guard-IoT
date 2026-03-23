import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { DemoSocketEmitter } from "../demoSocketEmitter";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe("DemoSocketEmitter — unit tests", () => {
  it("start() emits 'connect' immediately", () => {
    const emitter = new DemoSocketEmitter();
    const connectSpy = vi.fn();
    emitter.on("connect", connectSpy);
    emitter.start();
    expect(connectSpy).toHaveBeenCalledTimes(1);
    emitter.stop();
  });

  it("start() emits 'status' with mqttConnected: true immediately", () => {
    const emitter = new DemoSocketEmitter();
    const statusSpy = vi.fn();
    emitter.on("status", statusSpy);
    emitter.start();
    expect(statusSpy).toHaveBeenCalledTimes(1);
    expect(statusSpy).toHaveBeenCalledWith(
      expect.objectContaining({ mqttConnected: true })
    );
    emitter.stop();
  });

  it("start() emits 'telemetry_update' after 1500ms", () => {
    const emitter = new DemoSocketEmitter();
    const telemetrySpy = vi.fn();
    emitter.on("telemetry_update", telemetrySpy);
    emitter.start();
    expect(telemetrySpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(telemetrySpy).toHaveBeenCalledTimes(1);
    emitter.stop();
  });

  it("start() emits 'trip_started' after 3000ms", () => {
    const emitter = new DemoSocketEmitter();
    const tripSpy = vi.fn();
    emitter.on("trip_started", tripSpy);
    emitter.start();
    expect(tripSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(tripSpy).toHaveBeenCalledTimes(1);
    emitter.stop();
  });

  it("stop() prevents further 'telemetry_update' emissions", () => {
    const emitter = new DemoSocketEmitter();
    const telemetrySpy = vi.fn();
    emitter.on("telemetry_update", telemetrySpy);
    emitter.start();
    vi.advanceTimersByTime(1500);
    expect(telemetrySpy).toHaveBeenCalledTimes(1);
    emitter.stop();
    vi.advanceTimersByTime(10000);
    // Still only 1 call — no more after stop
    expect(telemetrySpy).toHaveBeenCalledTimes(1);
  });

  it("stop() is idempotent — calling twice does not throw", () => {
    const emitter = new DemoSocketEmitter();
    emitter.start();
    expect(() => {
      emitter.stop();
      emitter.stop();
    }).not.toThrow();
  });

  it("start() is idempotent — calling twice does not create double intervals", () => {
    const emitter = new DemoSocketEmitter();
    const telemetrySpy = vi.fn();
    emitter.on("telemetry_update", telemetrySpy);
    emitter.start();
    emitter.start(); // second call should clear previous timers
    vi.advanceTimersByTime(1500);
    // Should only fire once, not twice
    expect(telemetrySpy).toHaveBeenCalledTimes(1);
    emitter.stop();
  });
});

// ---------------------------------------------------------------------------
// Property 7: DemoSocketEmitter emite telemetria com variação
// Feature: demo-mode, Property 7: DemoSocketEmitter emite telemetria com variação
// ---------------------------------------------------------------------------

describe("Property 7: DemoSocketEmitter emite telemetria com variação", () => {
  it("consecutive telemetry_update events have at least one differing numeric value", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 10 }), (n) => {
        const emitter = new DemoSocketEmitter();
        const events: any[] = [];
        emitter.on("telemetry_update", (data) => events.push(data));
        emitter.start();

        // Advance enough ticks to collect n events
        vi.advanceTimersByTime(1500 * n);
        emitter.stop();

        expect(events.length).toBeGreaterThanOrEqual(2);

        // Check that not all consecutive pairs are identical
        let foundVariation = false;
        for (let i = 1; i < events.length; i++) {
          const prev = events[i - 1];
          const curr = events[i];
          if (
            prev.telemetry.speed_kmh !== curr.telemetry.speed_kmh ||
            prev.telemetry.rpm !== curr.telemetry.rpm ||
            prev.imu.roll_deg !== curr.imu.roll_deg
          ) {
            foundVariation = true;
            break;
          }
        }
        expect(foundVariation).toBe(true);
      }),
      { numRuns: 20 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: DemoSocketEmitter para após desativação
// Feature: demo-mode, Property 8: DemoSocketEmitter para após desativação
// ---------------------------------------------------------------------------

describe("Property 8: DemoSocketEmitter para após desativação", () => {
  it("no telemetry_update events emitted after stop()", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (ticksBeforeStop) => {
        const emitter = new DemoSocketEmitter();
        const events: unknown[] = [];
        emitter.on("telemetry_update", (data) => events.push(data));
        emitter.start();

        // Collect some events
        vi.advanceTimersByTime(1500 * ticksBeforeStop);
        const countBeforeStop = events.length;

        emitter.stop();

        // Advance a lot more time — no new events should appear
        vi.advanceTimersByTime(30000);
        expect(events.length).toBe(countBeforeStop);
      }),
      { numRuns: 20 }
    );
  });
});
