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

  // Internal mutable state
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  
  const currentTimeSecRef = useRef(0);
  const currentIndexRef = useRef(0);
  const loopRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef(0);

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
  // Clear interval helper
  // -------------------------------------------------------------------------

  const clearTick = useCallback(() => {
    if (loopRef.current !== null) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
  }, []);

  // Efeito que controla o ciclo de vida do loop (Substituído rAF por setInterval para estabilidade absoluta)
  useEffect(() => {
    let intervalId: any;
    if (isPlaying) {
      console.log("[SyncEngine] Starting autonomous 10Hz interval loop");
      intervalId = setInterval(() => {
        try {
          const currentRows = rowsRef.current;
          if (currentRows.length === 0) return;

          const vRef = videoRefRef.current;
          if (vRef && vRef.current && !vRef.current.paused) {
            currentTimeSecRef.current = vRef.current.currentTime;
          } else {
            const dt = (intervalMs / 1000) * playbackSpeedRef.current;
            currentTimeSecRef.current = (currentTimeSecRef.current || 0) + dt;
          }

          if (isNaN(currentTimeSecRef.current)) currentTimeSecRef.current = 0;

          const newIndex = findNearestIndex(currentRows, currentTimeSecRef.current);

          if (newIndex !== currentIndexRef.current) {
            currentIndexRef.current = newIndex;
            onRowChangeRef.current(currentRows[newIndex], newIndex);
          }

          const lastRow = currentRows[currentRows.length - 1];
          if (lastRow && currentTimeSecRef.current >= lastRow.timestampSec) {
            console.log("[SyncEngine] Reached end of data.");
            setIsPlaying(false);
            isPlayingRef.current = false;
            if (onEndRef.current) onEndRef.current();
          }
        } catch (err) {
          console.error("[SyncEngine] Loop Error:", err);
          setIsPlaying(false);
          isPlayingRef.current = false;
        }
      }, intervalMs);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log(`[SyncEngine] Interval stopped (isPlaying was: ${isPlaying})`);
      }
    };
  }, [isPlaying, intervalMs]);

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------

  const start = useCallback(() => {
    console.log("[SyncEngine] Requesting start. isPlaying:", isPlayingRef.current);
    if (isPlayingRef.current) return;
    
    const currentRows = rowsRef.current;
    if (currentRows.length === 0) {
      console.warn("[SyncEngine] Cannot start: no rows loaded.");
      return;
    }

    // Se estivermos no fim (ou muito perto), recomeçar do início
    const lastRow = currentRows[currentRows.length - 1];
    if (lastRow && currentTimeSecRef.current >= lastRow.timestampSec - 0.01) {
      console.log("[SyncEngine] Restarting from beginning (was at end).");
      currentTimeSecRef.current = 0;
      currentIndexRef.current = 0;
    }

    setIsPlaying(true);
    isPlayingRef.current = true;
    lastTickTimeRef.current = performance.now();
    console.log("[SyncEngine] Engine started at", currentTimeSecRef.current);
    
    // Emitir o estado atual imediatamente
    const initialIndex = findNearestIndex(currentRows, currentTimeSecRef.current);
    currentIndexRef.current = initialIndex;
    onRowChangeRef.current(currentRows[initialIndex], initialIndex);

    clearTick();
  }, [clearTick]);

  const pause = useCallback(() => {
    console.log("[SyncEngine] Pause called");
    setIsPlaying(false);
    isPlayingRef.current = false;
    clearTick();
  }, [clearTick]);

  const stop = useCallback(() => {
    console.log("[SyncEngine] Stop called");
    setIsPlaying(false);
    isPlayingRef.current = false;
    clearTick();
    currentTimeSecRef.current = 0;
    currentIndexRef.current = 0;
  }, [clearTick]);

  const seek = useCallback((timeSec: number) => {
    currentTimeSecRef.current = timeSec;
    const currentRows = rowsRef.current;
    if (currentRows.length === 0) return;
    const newIndex = findNearestIndex(currentRows, timeSec);
    if (newIndex !== currentIndexRef.current) {
      currentIndexRef.current = newIndex;
      onRowChangeRef.current(currentRows[newIndex], newIndex);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      console.log("[SyncEngine] UNMOUNTING - Stopping loop.");
      isPlayingRef.current = false;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, []);

  return {
    start,
    pause,
    stop,
    seek,
    currentIndex: currentIndexRef.current,
    isPlaying,
  };
}
