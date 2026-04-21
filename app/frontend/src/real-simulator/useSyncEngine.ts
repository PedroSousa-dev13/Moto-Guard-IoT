// =============================================================================
// MotoGuard IoT — Sync_Engine
// =============================================================================
// Hook React que mantém o alinhamento entre o tempo de reprodução e o índice
// CSV a emitir. Suporta dois modos:
//   - Modo vídeo: lê videoRef.current.currentTime a cada 100ms
//   - Modo timer: avança currentTimeSec com setInterval ajustado por playbackSpeed
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ParsedRow } from './csvParser';

export interface SyncEngineOptions {
  rows: ParsedRow[];
  videoRef: RefObject<HTMLVideoElement> | null; // null = modo timer
  playbackSpeed: number;
  onRowChange: (row: ParsedRow, index: number) => void;
  onEnd?: () => void;
  maxHz?: number; // default 10
}

export interface SyncEngineControls {
  start: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeSec: number) => void;
  currentIndex: number;
}

// ---------------------------------------------------------------------------
// Binary search: encontra o índice cujo timestampSec é mais próximo de target
// ---------------------------------------------------------------------------

export function findNearestIndex(rows: ParsedRow[], target: number): number {
  if (rows.length === 0) return 0;
  if (rows.length === 1) return 0;

  let lo = 0;
  let hi = rows.length - 1;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].timestampSec < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  // lo is the first index with timestampSec >= target
  // Compare with lo-1 to find the nearest
  if (lo > 0) {
    const diffLo = Math.abs(rows[lo].timestampSec - target);
    const diffPrev = Math.abs(rows[lo - 1].timestampSec - target);
    if (diffPrev <= diffLo) {
      return lo - 1;
    }
  }

  return lo;
}

// ---------------------------------------------------------------------------
// useSyncEngine hook
// ---------------------------------------------------------------------------

export function useSyncEngine(options: SyncEngineOptions): SyncEngineControls {
  const { rows, videoRef, playbackSpeed, onRowChange, onEnd, maxHz = 10 } = options;

  const intervalMs = Math.round(1000 / maxHz); // 100ms at 10 Hz

  const [currentIndex, setCurrentIndex] = useState(0);

  // Internal mutable state (not triggering re-renders)
  const currentTimeSecRef = useRef(0);
  const currentIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep latest callbacks/options in refs to avoid stale closures
  const rowsRef = useRef(rows);
  const videoRefRef = useRef(videoRef);
  const playbackSpeedRef = useRef(playbackSpeed);
  const onRowChangeRef = useRef(onRowChange);
  const onEndRef = useRef(onEnd);

  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { videoRefRef.current = videoRef; }, [videoRef]);
  useEffect(() => { playbackSpeedRef.current = playbackSpeed; }, [playbackSpeed]);
  useEffect(() => { onRowChangeRef.current = onRowChange; }, [onRowChange]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  // -------------------------------------------------------------------------
  // Core tick: called every intervalMs while playing
  // -------------------------------------------------------------------------

  const tick = useCallback(() => {
    if (!isPlayingRef.current) return;

    const currentRows = rowsRef.current;
    if (currentRows.length === 0) return;

    // Update currentTimeSec
    const vRef = videoRefRef.current;
    if (vRef && vRef.current) {
      // Video mode: read currentTime from video element
      currentTimeSecRef.current = vRef.current.currentTime;
    } else {
      // Timer mode: advance by (intervalMs / 1000) * playbackSpeed
      currentTimeSecRef.current += (intervalMs / 1000) * playbackSpeedRef.current;

      // Auto-stop at end
      const lastRow = currentRows[currentRows.length - 1];
      if (lastRow && currentTimeSecRef.current >= lastRow.timestampSec) {
        currentTimeSecRef.current = lastRow.timestampSec;
        isPlayingRef.current = false;
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (onEndRef.current) onEndRef.current();
      }
    }

    // Find nearest row
    const newIndex = findNearestIndex(currentRows, currentTimeSecRef.current);

    if (newIndex !== currentIndexRef.current) {
      currentIndexRef.current = newIndex;
      setCurrentIndex(newIndex);
      onRowChangeRef.current(currentRows[newIndex], newIndex);
    }
  }, [intervalMs]);

  // -------------------------------------------------------------------------
  // Clear interval helper
  // -------------------------------------------------------------------------

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------

  const start = useCallback(() => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    clearTick();
    intervalRef.current = setInterval(tick, intervalMs);
  }, [tick, clearTick, intervalMs]);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    clearTick();
  }, [clearTick]);

  const stop = useCallback(() => {
    isPlayingRef.current = false;
    clearTick();
    currentTimeSecRef.current = 0;
    currentIndexRef.current = 0;
    setCurrentIndex(0);
  }, [clearTick]);

  const seek = useCallback((timeSec: number) => {
    currentTimeSecRef.current = timeSec;
    const currentRows = rowsRef.current;
    if (currentRows.length === 0) return;
    const newIndex = findNearestIndex(currentRows, timeSec);
    if (newIndex !== currentIndexRef.current) {
      currentIndexRef.current = newIndex;
      setCurrentIndex(newIndex);
      onRowChangeRef.current(currentRows[newIndex], newIndex);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      clearTick();
    };
  }, [clearTick]);

  return { start, pause, stop, seek, currentIndex };
}
