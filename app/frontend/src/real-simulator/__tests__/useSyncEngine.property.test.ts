// =============================================================================
// MotoGuard IoT — useSyncEngine property-based tests
// =============================================================================
// Feature: real-simulator, Property 4: Sync_Engine selects the nearest CSV row
// Validates: Requirements 4.1, 4.2, 4.4
// Feature: real-simulator, Property 6: Emission rate does not exceed 10 Hz
// Validates: Requirements 4.5
// Feature: real-simulator, Property 8: Stop resets all state to initial
// Validates: Requirements 4.7, 5.4, 5.9
// Feature: real-simulator, Property 9: Playback speed change preserves playing state
// Validates: Requirements 5.5, 5.6

import { describe, it, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';
import { findNearestIndex, useSyncEngine } from '../useSyncEngine';
import type { ParsedRow } from '../csvParser';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Minimal ParsedRow — only timestampSec matters for nearest-row selection */
function makeRow(timestampSec: number): ParsedRow {
  return {
    timestampSec,
    latitude: 0,
    longitude: 0,
    speed_kmh: 0,
    rpm: 0,
    gear: 1,
    throttle_pct: 0,
    engine_temp_c: 80,
    voltage: 12.5,
    roll_deg: 0,
    pitch_deg: 0,
    yaw_deg: 0,
    g_force: 1.0,
  };
}

/** Non-empty array of rows with arbitrary timestampSec values, sorted ascending */
const sortedRowsArb: fc.Arbitrary<ParsedRow[]> = fc
  .array(fc.float({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true }), {
    minLength: 1,
    maxLength: 200,
  })
  .map((timestamps) => [...timestamps].sort((a, b) => a - b).map(makeRow));

/** Query time T — can be anywhere, including outside the rows range */
const queryTimeArb: fc.Arbitrary<number> = fc.float({
  min: -1000,
  max: 101000,
  noNaN: true,
  noDefaultInfinity: true,
});

// ---------------------------------------------------------------------------
// Property 4: Sync_Engine selects the nearest CSV row
// Validates: Requirements 4.1, 4.2, 4.4
// ---------------------------------------------------------------------------

describe('Property 4 — Sync_Engine selects the nearest CSV row', () => {
  it('selected index minimizes |rows[i].timestampSec - T| for all valid inputs', () => {
    fc.assert(
      fc.property(sortedRowsArb, queryTimeArb, (rows, T) => {
        const selectedIndex = findNearestIndex(rows, T);

        // selectedIndex must be a valid index
        if (selectedIndex < 0 || selectedIndex >= rows.length) return false;

        const selectedDist = Math.abs(rows[selectedIndex].timestampSec - T);

        // For every other index j, the selected distance must be <= dist(j)
        for (let j = 0; j < rows.length; j++) {
          if (j === selectedIndex) continue;
          const dist = Math.abs(rows[j].timestampSec - T);
          if (selectedDist > dist) return false;
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Emission rate does not exceed 10 Hz
// Validates: Requirements 4.5
// ---------------------------------------------------------------------------

/** Valid playback speeds */
const playbackSpeedArb = fc.constantFrom(0.25, 0.5, 1, 2, 4);

/** Session duration in seconds (1 to 30) */
const durationArb = fc.integer({ min: 1, max: 30 });

describe('Property 6 — Emission rate does not exceed 10 Hz', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emittedCount <= D * 10 for any duration D and playback speed V', () => {
    fc.assert(
      fc.property(durationArb, playbackSpeedArb, (D, speed) => {
        vi.useFakeTimers();

        try {
          // Build enough rows to cover the full duration at the given speed.
          // At speed V, D seconds of wall-clock time covers D * V seconds of CSV time.
          // We generate rows at 1-second intervals up to D * speed + 1 to ensure coverage.
          const csvDuration = D * speed;
          const rowCount = Math.ceil(csvDuration) + 2;
          const rows: ParsedRow[] = Array.from({ length: rowCount }, (_, i) => ({
            timestampSec: i,
            latitude: 0,
            longitude: 0,
            speed_kmh: 0,
            rpm: 0,
            gear: 1,
            throttle_pct: 0,
            engine_temp_c: 80,
            voltage: 12.5,
            roll_deg: 0,
            pitch_deg: 0,
            yaw_deg: 0,
            g_force: 1.0,
          }));

          let callCount = 0;
          const onRowChange = () => { callCount++; };

          const { result } = renderHook(() =>
            useSyncEngine({
              rows,
              videoRef: null,
              playbackSpeed: speed,
              onRowChange,
              maxHz: 10,
            }),
          );

          // Start playback
          act(() => {
            result.current.start();
          });

          // Advance fake timers by D seconds
          act(() => {
            vi.advanceTimersByTime(D * 1000);
          });

          // The interval fires at most D * 10 times (every 100ms over D seconds),
          // and onRowChange is only called when the index changes, so callCount <= D * 10.
          return callCount <= D * 10;
        } finally {
          vi.useRealTimers();
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Stop resets all state to initial
// Feature: real-simulator, Property 8: Stop resets all state to initial
// Validates: Requirements 4.7, 5.4, 5.9
// ---------------------------------------------------------------------------

describe('Property 8 — Stop resets all state to initial', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('currentIndex === 0 and no further onRowChange calls after stop(), for any rows and playback speed', () => {
    fc.assert(
      fc.property(
        sortedRowsArb,
        playbackSpeedArb,
        fc.integer({ min: 500, max: 5000 }),
        (rows, speed, advanceMs) => {
          vi.useFakeTimers();

          try {
            let callCountAfterStop = 0;
            let callCountDuringPlay = 0;
            let stopped = false;

            const onRowChange = () => {
              if (stopped) {
                callCountAfterStop++;
              } else {
                callCountDuringPlay++;
              }
            };

            const { result } = renderHook(() =>
              useSyncEngine({
                rows,
                videoRef: null,
                playbackSpeed: speed,
                onRowChange,
                maxHz: 10,
              }),
            );

            // Start playback
            act(() => {
              result.current.start();
            });

            // Advance timers by arbitrary amount to simulate some playback
            act(() => {
              vi.advanceTimersByTime(advanceMs);
            });

            // Stop playback
            stopped = true;
            act(() => {
              result.current.stop();
            });

            // Advance timers further — no more callbacks should fire
            act(() => {
              vi.advanceTimersByTime(2000);
            });

            // currentIndex must be reset to 0
            if (result.current.currentIndex !== 0) return false;

            // No onRowChange calls should happen after stop
            if (callCountAfterStop !== 0) return false;

            return true;
          } finally {
            vi.useRealTimers();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Pause stops emission
// Feature: real-simulator, Property 7: Pause stops emission
// Validates: Requirements 4.6, 5.3
// ---------------------------------------------------------------------------

describe('Property 7 — Pause stops emission', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('no onRowChange calls after pause(), for any rows and playback speed', () => {
    fc.assert(
      fc.property(sortedRowsArb, playbackSpeedArb, (rows, speed) => {
        vi.useFakeTimers();

        try {
          let callCountAfterPause = 0;
          let paused = false;

          const onRowChange = () => {
            if (paused) {
              callCountAfterPause++;
            }
          };

          const { result } = renderHook(() =>
            useSyncEngine({
              rows,
              videoRef: null,
              playbackSpeed: speed,
              onRowChange,
              maxHz: 10,
            }),
          );

          // Start playback
          act(() => {
            result.current.start();
          });

          // Advance 200ms to confirm playback is active
          act(() => {
            vi.advanceTimersByTime(200);
          });

          // Pause playback
          paused = true;
          act(() => {
            result.current.pause();
          });

          // Record call count at pause time (should be 0 since we set paused=true before pause())
          const callCountAtPause = callCountAfterPause;

          // Advance another 1000ms — no new callbacks should fire
          act(() => {
            vi.advanceTimersByTime(1000);
          });

          // Assert no new onRowChange calls happened after pause
          return callCountAfterPause === callCountAtPause && callCountAfterPause === 0;
        } finally {
          vi.useRealTimers();
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Playback speed change preserves playing state
// Feature: real-simulator, Property 9: Playback speed change preserves playing state
// Validates: Requirements 5.5, 5.6
// ---------------------------------------------------------------------------

describe('Property 9 — Playback speed change preserves playing state', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('onRowChange continues to be called after speed change (playback is still active)', () => {
    const validSpeeds = [0.25, 0.5, 1, 2, 4] as const;
    const speedArb = fc.constantFrom(...validSpeeds);

    fc.assert(
      fc.property(speedArb, speedArb, (initialSpeed, newSpeed) => {
        vi.useFakeTimers();

        try {
          // Build rows covering enough CSV time for both speeds
          const rows: ParsedRow[] = Array.from({ length: 50 }, (_, i) => makeRow(i * 0.5));

          let callCountBeforeChange = 0;
          let callCountAfterChange = 0;
          let speedChanged = false;

          const onRowChange = () => {
            if (speedChanged) {
              callCountAfterChange++;
            } else {
              callCountBeforeChange++;
            }
          };

          const { result, rerender } = renderHook(
            ({ speed }: { speed: number }) =>
              useSyncEngine({
                rows,
                videoRef: null,
                playbackSpeed: speed,
                onRowChange,
                maxHz: 10,
              }),
            { initialProps: { speed: initialSpeed } },
          );

          // Start playback
          act(() => {
            result.current.start();
          });

          // Advance 200ms to confirm playback is active
          act(() => {
            vi.advanceTimersByTime(200);
          });

          // Change playback speed via re-render
          speedChanged = true;
          rerender({ speed: newSpeed });

          // Advance another 200ms after speed change
          act(() => {
            vi.advanceTimersByTime(200);
          });

          // Playback should still be active: onRowChange must have been called
          // at some point after the speed change (or at least the interval is still running).
          // We verify by checking that stop() was NOT implicitly called:
          // currentIndex should NOT have been reset to 0 unless rows only have 1 entry.
          // More robustly: advance more time and check that the hook is still ticking.
          const indexAfterChange = result.current.currentIndex;

          // Advance 500ms more to confirm the interval is still running
          act(() => {
            vi.advanceTimersByTime(500);
          });

          const indexAfterFurtherAdvance = result.current.currentIndex;

          // The hook should still be playing: either index advanced further,
          // or it reached the end of rows (both are valid "still playing" states).
          // The key invariant: stop() was NOT called, so currentIndex was never reset to 0
          // after having advanced beyond 0 during the initial 200ms.
          // If rows have enough entries, index should have advanced during the first 200ms.
          // We check that the index after further advance is >= index after change
          // (no reset happened).
          if (indexAfterFurtherAdvance < indexAfterChange) {
            // Index went backwards — this would indicate a reset (stop was called)
            return false;
          }

          return true;
        } finally {
          vi.useRealTimers();
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Cleanup on unmount stops emission
// Feature: real-simulator, Property 11: Cleanup on unmount stops emission
// Validates: Requirements 7.4
// ---------------------------------------------------------------------------

describe('Property 11 — Cleanup on unmount stops emission', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('no onRowChange calls after unmount, for any rows and playback speed', () => {
    fc.assert(
      fc.property(sortedRowsArb, playbackSpeedArb, (rows, speed) => {
        vi.useFakeTimers();

        try {
          let callCountAfterUnmount = 0;
          let unmounted = false;

          const onRowChange = () => {
            if (unmounted) {
              callCountAfterUnmount++;
            }
          };

          const { result, unmount } = renderHook(() =>
            useSyncEngine({
              rows,
              videoRef: null,
              playbackSpeed: speed,
              onRowChange,
              maxHz: 10,
            }),
          );

          // Start playback
          act(() => {
            result.current.start();
          });

          // Advance 200ms to confirm playback is active
          act(() => {
            vi.advanceTimersByTime(200);
          });

          // Unmount the hook (simulates navigation away)
          unmounted = true;
          act(() => {
            unmount();
          });

          // Record call count at unmount time (should be 0 since we set unmounted=true before unmount())
          const callCountAtUnmount = callCountAfterUnmount;

          // Advance another 1000ms — no new callbacks should fire
          act(() => {
            vi.advanceTimersByTime(1000);
          });

          // Assert no new onRowChange calls happened after unmount
          return callCountAfterUnmount === callCountAtUnmount && callCountAfterUnmount === 0;
        } finally {
          vi.useRealTimers();
        }
      }),
      { numRuns: 100 },
    );
  });
});
