// =============================================================================
// MotoGuard IoT — Real Simulator Page
// =============================================================================
// Orquestra CsvDropzone, RouteMap, VideoPlayer, PlaybackControls e useSyncEngine
// para reproduzir ficheiros CSV de telemetria sincronizados com vídeo .mp4.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { io, Socket } from "socket.io-client";
import type { ParsedRow } from "../real-simulator/csvParser";
import type { ParseResult } from "../real-simulator/csvParser";
import CsvDropzone from "../real-simulator/CsvDropzone";
import RouteMap from "../real-simulator/RouteMap";
import VideoPlayer from "../real-simulator/VideoPlayer";
import { PlaybackControls } from "../real-simulator/PlaybackControls";
import { useSyncEngine } from "../real-simulator/useSyncEngine";
import { buildPayload, emitTelemetry } from "../real-simulator/telemetryEmitter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlaybackState = "idle" | "playing" | "paused" | "stopped";
type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4;

interface SimulatorSession {
  rows: ParsedRow[];
  deviceId: string;
  videoFile: File | null;
  playbackState: PlaybackState;
  playbackSpeed: PlaybackSpeed;
  currentRowIndex: number;
  emittedCount: number;
}

const INITIAL_SESSION: SimulatorSession = {
  rows: [],
  deviceId: "REAL-SIM-001",
  videoFile: null,
  playbackState: "idle",
  playbackSpeed: 1,
  currentRowIndex: 0,
  emittedCount: 0,
};

// ---------------------------------------------------------------------------
// RealSimulator
// ---------------------------------------------------------------------------

export default function RealSimulator() {
  const [session, setSession] = useState<SimulatorSession>(INITIAL_SESSION);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [totalDurationSec, setTotalDurationSec] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);

  // Socket for emitting telemetry
  const socketRef = useRef<Socket | null>(null);

  // Video element ref (passed to VideoPlayer and useSyncEngine)
  // Cast needed: React 19 useRef returns RefObject<T | null>, but components expect RefObject<T>
  const videoRef = useRef<HTMLVideoElement>(null) as RefObject<HTMLVideoElement>;

  // simulationStartTime is set when Play is first clicked
  const simulationStartTimeRef = useRef<Date>(new Date());

  // Set document title on mount
  useEffect(() => {
    document.title = "Simulador Real — MotoGuard";
  }, []);

  // Create socket on mount, clean up on unmount
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // GPS track derived from rows
  // ---------------------------------------------------------------------------

  const gpsTrack = session.rows.map((r) => ({ lat: r.latitude, lng: r.longitude }));

  const currentPosition =
    session.rows.length > 0 && session.currentRowIndex < session.rows.length
      ? {
          lat: session.rows[session.currentRowIndex].latitude,
          lng: session.rows[session.currentRowIndex].longitude,
        }
      : null;

  // ---------------------------------------------------------------------------
  // onRowChange: called by useSyncEngine on each row advance
  // ---------------------------------------------------------------------------

  const handleRowChange = useCallback(
    (row: ParsedRow, index: number) => {
      setSession((prev) => {
        if (!socketRef.current) return { ...prev, currentRowIndex: index };

        const payload = buildPayload(
          row,
          prev.deviceId,
          simulationStartTimeRef.current,
          "TRIP_ACTIVE",
          index
        );
        emitTelemetry(socketRef.current, payload);

        return {
          ...prev,
          currentRowIndex: index,
          emittedCount: prev.emittedCount + 1,
        };
      });

      // Update current time display
      setCurrentTimeSec(row.timestampSec);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // useSyncEngine
  // ---------------------------------------------------------------------------

  const syncEngine = useSyncEngine({
    rows: session.rows,
    videoRef: session.videoFile ? videoRef : null,
    playbackSpeed: session.playbackSpeed,
    onRowChange: handleRowChange,
  });

  // ---------------------------------------------------------------------------
  // Playback handlers
  // ---------------------------------------------------------------------------

  const handlePlay = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      setSocketError(
        "Socket não conectado. Aguarda a ligação ao servidor antes de iniciar a simulação."
      );
      return;
    }

    setSocketError(null);
    simulationStartTimeRef.current = new Date();

    // Start video if available
    if (session.videoFile && videoRef.current) {
      videoRef.current.playbackRate = session.playbackSpeed;
      videoRef.current.play().catch(() => {});
    }

    syncEngine.start();
    setSession((prev) => ({ ...prev, playbackState: "playing" }));
  }, [session.videoFile, session.playbackSpeed, syncEngine]);

  const handlePause = useCallback(() => {
    if (session.videoFile && videoRef.current) {
      videoRef.current.pause();
    }
    syncEngine.pause();
    setSession((prev) => ({ ...prev, playbackState: "paused" }));
  }, [session.videoFile, syncEngine]);

  const handleStop = useCallback(() => {
    // Stop sync engine
    syncEngine.stop();

    // Stop and reset video
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }

    // Emit TRIP_ENDED payload
    const socket = socketRef.current;
    if (socket && socket.connected && session.rows.length > 0) {
      const lastRow = session.rows[session.currentRowIndex] ?? session.rows[0];
      const payload = buildPayload(
        lastRow,
        session.deviceId,
        simulationStartTimeRef.current,
        "TRIP_ENDED",
        session.currentRowIndex
      );
      emitTelemetry(socket, payload);
    }

    setCurrentTimeSec(0);
    setSession((prev) => ({
      ...prev,
      playbackState: "stopped",
      currentRowIndex: 0,
      emittedCount: 0,
    }));
  }, [syncEngine, session.rows, session.currentRowIndex, session.deviceId]);

  const handleSpeedChange = useCallback(
    (speed: PlaybackSpeed) => {
      if (session.videoFile && videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
      setSession((prev) => ({ ...prev, playbackSpeed: speed }));
    },
    [session.videoFile]
  );

  const handleSeek = useCallback(
    (timeSec: number) => {
      if (session.videoFile && videoRef.current) {
        videoRef.current.currentTime = timeSec;
      }
      syncEngine.seek(timeSec);
      setCurrentTimeSec(timeSec);
    },
    [session.videoFile, syncEngine]
  );

  // ---------------------------------------------------------------------------
  // CSV parsed
  // ---------------------------------------------------------------------------

  const handleCsvParsed = useCallback((result: ParseResult) => {
    setTotalDurationSec(result.durationSec);
    setCurrentTimeSec(0);
    setSession((prev) => ({
      ...prev,
      rows: result.rows,
      playbackState: "idle",
      currentRowIndex: 0,
      emittedCount: 0,
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Video file selected
  // ---------------------------------------------------------------------------

  const handleVideoFileSelect = useCallback((file: File) => {
    setSession((prev) => ({ ...prev, videoFile: file }));
  }, []);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount: stop playback
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      syncEngine.stop();
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const hasRows = session.rows.length > 0;
  const isDisabled = !hasRows;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "20px 24px",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Page title */}
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#f9fafb" }}>
          Simulador Real
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ca3af" }}>
          Reproduz ficheiros CSV de telemetria sincronizados com vídeo .mp4
        </p>
      </div>

      {/* CSV import */}
      <CsvDropzone onParsed={handleCsvParsed} />

      {/* Socket error */}
      {socketError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 6,
            color: "#fca5a5",
            fontSize: 13,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {socketError}
        </div>
      )}

      {/* Split layout: RouteMap (left ≥50%) + VideoPlayer (right) */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flex: 1,
          minHeight: 320,
        }}
      >
        {/* RouteMap — left, ≥50% */}
        <div style={{ flex: "0 0 55%", minWidth: 0 }}>
          <RouteMap
            gpsTrack={gpsTrack}
            currentPosition={session.playbackState === "playing" ? currentPosition : null}
          />
        </div>

        {/* VideoPlayer — right */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <VideoPlayer
            videoFile={session.videoFile}
            videoRef={videoRef}
            onFileSelect={handleVideoFileSelect}
          />
        </div>
      </div>

      {/* Playback controls */}
      <PlaybackControls
        playbackState={session.playbackState}
        playbackSpeed={session.playbackSpeed}
        currentTimeSec={currentTimeSec}
        totalDurationSec={totalDurationSec}
        emittedCount={session.emittedCount}
        deviceId={session.deviceId}
        disabled={isDisabled}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onSpeedChange={handleSpeedChange}
        onDeviceIdChange={(id) => setSession((prev) => ({ ...prev, deviceId: id }))}
        onSeek={handleSeek}
      />
    </div>
  );
}
