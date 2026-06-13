// =============================================================================
// MotoGuard IoT — GPX Simulator Page
// =============================================================================
// Parses GPX route files, enriches with motorcycle telemetry, and plays back
// the route with real-time telemetry display and socket emission.
// Mirrors the RealSimulator page but for GPX files instead of CSV+video.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { io, Socket } from "socket.io-client";
import type { ParsedRow, ParseResult } from "../real-simulator/csvParser";
import { parseGPX } from "../gpx-simulator/gpxParser";
import type { GpxStats } from "../gpx-simulator/gpxParser";
import GpxDropzone from "../gpx-simulator/GpxDropzone";
import RouteMap from "../real-simulator/RouteMap";
import { PlaybackControls } from "../real-simulator/PlaybackControls";
import { useSyncEngine } from "../real-simulator/useSyncEngine";
import { buildPayload, emitTelemetry } from "../real-simulator/telemetryEmitter";
import { useAuth } from "../hooks/useAuth";
import { gpxAPI, motorcyclesAPI } from "../services/api";
import type { Motorcycle, MotorcycleProfile } from "../types";
import { Navigation, AlertTriangle, Mountain, Activity, MoveHorizontal, MoveVertical, Compass, Gauge, Zap, Disc, ArrowUpCircle, Thermometer, Droplets, CircleDot, Bike } from "lucide-react";
import GaugeCard from "../components/GaugeCard";
import TempVoltCard from "../components/TempVoltCard";
import IMUCard from "../components/IMUCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlaybackState = "idle" | "playing" | "paused" | "stopped";
type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4;

interface SimulatorSession {
  rows: ParsedRow[];
  deviceId: string;
  playbackState: PlaybackState;
  playbackSpeed: PlaybackSpeed;
  currentRowIndex: number;
  emittedCount: number;
}

const INITIAL_SESSION: SimulatorSession = {
  rows: [],
  deviceId: "",
  playbackState: "idle",
  playbackSpeed: 1,
  currentRowIndex: 0,
  emittedCount: 0,
};

// ---------------------------------------------------------------------------
// GpxSimulator
// ---------------------------------------------------------------------------

export default function GpxSimulator() {
  const [simSession, setSession] = useState<SimulatorSession>(INITIAL_SESSION);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [gpxStats, setGpxStats] = useState<GpxStats | null>(null);
  const [gpxFileName, setGpxFileName] = useState<string | null>(null);
  const [gpxFileSize, setGpxFileSize] = useState<number | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [totalDurationSec, setTotalDurationSec] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [profiles, setProfiles] = useState<MotorcycleProfile[]>([
    { id: "debug-id", name: "TESTE-PERFIL", maxSpeedKmh: 100, typicalMaxRollDeg: 30, crashRollThreshold: 60, crashGForce: 2.0, criticalTemp: 100, criticalVoltage: 11.5, criticalRpm: 8000, createdAt: new Date().toISOString() }
  ]);
  const [selectedProfile, setSelectedProfile] = useState<MotorcycleProfile | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const simulationStartTimeRef = useRef<Date>(new Date());
  const gpxPersistedRef = useRef(false);
  const gpxRawTextRef = useRef<string | null>(null);

  // Dummy video ref (useSyncEngine requires it but we pass null)
  const videoRef = useRef<HTMLVideoElement>(null) as RefObject<HTMLVideoElement>;

  useEffect(() => {
    document.title = "Simulador GPX — MotoGuard";
  }, []);

  // Fetch profiles and Socket lifecycle
  useEffect(() => {
    motorcyclesAPI.getProfiles().then((res) => {
      setProfiles(res.data);
      if (res.data.length > 0) {
        setSelectedProfile(res.data[0]);
      }
    });

    setSession(prev => ({ ...prev, deviceId: "MOTOGUARD-GPX-SIM" }));

    const socket = io();
    socketRef.current = socket;

    const handleTripStarted = (data: { deviceId?: string; tripId?: string }) => {
      if (data?.deviceId === simSession.deviceId && data.tripId) {
        setTripId(data.tripId);
      }
    };

    const handleTripEnded = (data: { deviceId?: string }) => {
      if (data?.deviceId === simSession.deviceId) {
        setTripId(null);
      }
    };

    socket.on("trip_started", handleTripStarted);
    socket.on("trip_ended", handleTripEnded);

    return () => {
      socket.off("trip_started", handleTripStarted);
      socket.off("trip_ended", handleTripEnded);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [simSession.deviceId]);

  const persistGpxData = useCallback(async () => {
    if (gpxPersistedRef.current) return;
    if (!tripId || simSession.rows.length === 0 || !gpxStats) return;

    const baseTime = simulationStartTimeRef.current.getTime();
    const waypoints = simSession.rows.map((row) => ({
      lat: row.latitude,
      lon: row.longitude,
      time: new Date(baseTime + row.timestampSec * 1000).toISOString(),
    }));

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;

    for (const pt of waypoints) {
      minLat = Math.min(minLat, pt.lat);
      maxLat = Math.max(maxLat, pt.lat);
      minLon = Math.min(minLon, pt.lon);
      maxLon = Math.max(maxLon, pt.lon);
    }

    try {
      await gpxAPI.saveSimulatorTrip({
        tripId,
        filename: gpxFileName ?? "gpx-simulator.gpx",
        fileSize: gpxFileSize ?? 0,
        waypoints,
        bounds: { minLat, maxLat, minLon, maxLon },
        totalTime: Math.round(gpxStats.durationSec),
      });
      gpxPersistedRef.current = true;
    } catch (error) {
      console.error("[GpxSimulator] Falha ao guardar gpxData:", error);
    }
  }, [gpxFileName, gpxFileSize, gpxStats, simSession.rows, tripId]);

  // GPS track for map (stabilized with useMemo)
  const gpsTrack = useMemo(
    () => simSession.rows.map((r) => ({ lat: r.latitude, lng: r.longitude })),
    [simSession.rows]
  );

  const currentPosition =
    simSession.rows.length > 0 && simSession.currentRowIndex < simSession.rows.length
      ? {
          lat: simSession.rows[simSession.currentRowIndex].latitude,
          lng: simSession.rows[simSession.currentRowIndex].longitude,
        }
      : null;

  // Row change handler (emit telemetry)
  const handleRowChange = useCallback((row: ParsedRow, index: number) => {
    setSession((prev) => {
      if (socketRef.current?.connected) {
        const payload = buildPayload(
          row,
          prev.deviceId,
          simulationStartTimeRef.current,
          "TRIP_ACTIVE",
          selectedProfile?.name || "GPX Simulator",
          index,
          "GPX_IMPORTED"
        );
        emitTelemetry(socketRef.current, payload);
      }
      return {
        ...prev,
        currentRowIndex: index,
        emittedCount: prev.emittedCount + 1,
      };
    });
    setCurrentTimeSec(row.timestampSec);
  }, [selectedProfile]);

  // Sync engine (no video)
  const syncEngine = useSyncEngine({
    rows: simSession.rows,
    videoRef: null,
    playbackSpeed: simSession.playbackSpeed,
    onRowChange: handleRowChange,
    onEnd: () => {
      console.log("[GpxSimulator] Route finished. Stopping.");
      const socket = socketRef.current;
      if (socket?.connected) {
        // Enviar payload final
        const lastRow = simSession.rows[simSession.rows.length - 1];
        const payload = buildPayload(
          lastRow,
          simSession.deviceId,
          simulationStartTimeRef.current,
          "TRIP_ENDED",
          selectedProfile?.name || "GPX Simulator",
          simSession.rows.length - 1,
          "GPX_IMPORTED"
        );
        emitTelemetry(socket, payload);

        void persistGpxData();
      }
      
      setCurrentTimeSec(0);
      setSession((prev) => ({
        ...prev,
        playbackState: "stopped",
        currentRowIndex: 0,
        emittedCount: 0,
      }));
    }
  });

  // ---------------------------------------------------------------------------
  // Playback handlers
  // ---------------------------------------------------------------------------
  const { user } = useAuth();

  const handlePause = useCallback(() => {
    syncEngine.pause();
    setSession((prev) => ({ ...prev, playbackState: "paused" }));
  }, [syncEngine]);

  const handleStop = useCallback(() => {
    console.log("[GpxSimulator] Stop clicked.");
    syncEngine.stop();

    const socket = socketRef.current;
    if (socket?.connected && simSession.rows.length > 0) {
      const lastRow = simSession.rows[simSession.currentRowIndex] ?? simSession.rows[0];
      const payload = buildPayload(
        lastRow,
        simSession.deviceId,
        simulationStartTimeRef.current,
        "TRIP_ENDED",
        selectedProfile?.name || "GPX Simulator",
        simSession.currentRowIndex,
        "GPX_IMPORTED"
      );
      emitTelemetry(socket, payload);

      void persistGpxData();
    }

    setCurrentTimeSec(0);
    setSession((prev) => ({
      ...prev,
      playbackState: "stopped",
      currentRowIndex: 0,
      emittedCount: 0,
    }));
  }, [syncEngine, simSession.rows, simSession.currentRowIndex, simSession.deviceId, selectedProfile?.name]);

  const handlePlay = useCallback(() => {
    if (!socketRef.current?.connected) {
      setSocketError("Socket não conectado. Simulação sem emissão de telemetria.");
    } else {
      setSocketError(null);
      if (user?.id) {
        socketRef.current.emit("send_command", {
          acao: "definir_modelo",
          modelo: selectedProfile?.name || "GPX Simulator",
          device_id: simSession.deviceId,
          userId: user.id,
          source: "GPX_IMPORTED"
        });
      }
    }
    simulationStartTimeRef.current = new Date();
    syncEngine.start();
    setSession((prev) => ({ ...prev, playbackState: "playing" }));
  }, [syncEngine, user?.id, simSession.deviceId, selectedProfile?.name]);

  const handleSpeedChange = useCallback((speed: PlaybackSpeed) => {
    setSession((prev) => ({ ...prev, playbackSpeed: speed }));
  }, []);

  const handleSeek = useCallback(
    (timeSec: number) => {
      syncEngine.seek(timeSec);
      setCurrentTimeSec(timeSec);
    },
    [syncEngine]
  );

  // GPX parsed
  const handleGpxParsed = useCallback((result: ParseResult, stats: GpxStats, meta: { fileName: string; fileSize: number; rawText: string }) => {
    gpxRawTextRef.current = meta.rawText;
    setGpxStats(stats);
    setGpxFileName(meta.fileName);
    setGpxFileSize(meta.fileSize);
    setTripId(null);
    gpxPersistedRef.current = false;
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

  // Cleanup
  useEffect(() => {
    return () => {
      syncEngine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-parse GPX when profile changes (only when idle)
  useEffect(() => {
    if (!selectedProfile || !gpxRawTextRef.current) return;
    if (simSession.playbackState !== "idle") return;
    const result = parseGPX(gpxRawTextRef.current, { motorcycleProfile: selectedProfile.name });
    if ("type" in result) return;
    const { gpxStats: newStats, ...parseResult } = result;
    setGpxStats(newStats);
    setTotalDurationSec(parseResult.durationSec);
    setCurrentTimeSec(0);
    setSession((prev) => ({
      ...prev,
      rows: parseResult.rows,
      currentRowIndex: 0,
      emittedCount: 0,
    }));
  }, [selectedProfile?.name, simSession.playbackState]);

  // Derived state
  const hasRows = simSession.rows.length > 0;
  const currentRow = hasRows
    ? simSession.rows[Math.min(simSession.currentRowIndex, simSession.rows.length - 1)]
    : null;

  const telemetryData = currentRow ? {
    speed_kmh: currentRow.speed_kmh,
    rpm: currentRow.rpm,
    gear: currentRow.gear,
    throttle_pct: currentRow.throttle_pct,
    engine_temp_c: currentRow.engine_temp_c,
    voltage: currentRow.voltage,
    brake_front_pct: currentRow.brake_front_pct,
    brake_rear_pct: currentRow.brake_rear_pct,
    odometer_km: 0,
    clutch_engaged: false
  } : null;

  const imuData = currentRow ? {
    roll_deg: currentRow.roll_deg,
    pitch_deg: currentRow.pitch_deg,
    yaw_deg: currentRow.yaw_deg,
    g_force: currentRow.g_force
  } : null;

  const healthData = currentRow ? {
    oil_pressure_bar: 3.5, // Default for simulation
    tire_pressure_front_bar: 2.3,
    tire_pressure_rear_bar: 2.5
  } : null;

  const gpxSources = {
    speed: true,
    rpm: false,
    gear: false,
    throttle: false,
    engineTemp: false,
    voltage: false,
    oilPressure: false,
    brakeFront: false,
    brakeRear: false,
    roll: false,
    pitch: false,
    yaw: false,
    gForce: false
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-32">
      {/* CLEAN HEADER */}
      <div className="flex flex-col gap-1 border-b border-white/5 pb-4">
        <h1 className="text-2xl font-black text-white tracking-tight m-0 flex items-center gap-3">
          <Navigation size={20} className="text-accent" />
          Simulador de Rotas GPX
        </h1>
        <p className="text-[0.6rem] font-black text-muted uppercase tracking-[0.25em] opacity-40">Reprodução de telemetria enriquecida via GPS</p>
      </div>

      {/* 3-COLUMN PREMIUM DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_340px_1fr] gap-6 items-stretch min-h-[600px]">
        {/* COL 1: CONTROLS, LEGEND, IMPORT & TELEMETRY */}
        <div className="flex flex-col gap-6">
          {/* Perfil de Moto Selector Card */}
          <div className="bg-panel/40 backdrop-blur-xl border border-border-glass-subtle rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Bike size={14} className="text-accent" />
              <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-60">Perfil de Moto</span>
            </div>
            <div className="relative">
              <select
                value={selectedProfile?.name || "Naked"}
                onChange={(e) => {
                  const prof = profiles.find(p => p.name === e.target.value);
                  if (prof) setSelectedProfile(prof);
                }}
                className="w-full bg-panel border border-border-glass-subtle rounded-xl px-3 py-2 text-xs font-black text-text uppercase tracking-widest outline-none cursor-pointer hover:bg-panel-hover transition-colors appearance-none"
              >
                {profiles.map((p) => (
                  <option key={p.name} value={p.name} className="bg-surface">
                    {p.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Legenda de Origem Card */}
          <div className="bg-panel/40 border border-border-glass-subtle rounded-2xl p-4 flex flex-col gap-3">
             <span className="text-[0.5rem] font-black text-muted uppercase tracking-widest opacity-40">Legenda de Origem</span>
             <div className="flex items-center gap-4">
               <div className="flex items-center gap-1.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-green" />
                 <span className="text-[0.55rem] font-bold text-muted uppercase tracking-widest">Ficheiro</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-blue" />
                 <span className="text-[0.55rem] font-bold text-muted uppercase tracking-widest">Simulado</span>
               </div>
             </div>
          </div>

          {/* Importar Rota GPX Dropzone */}
          <GpxDropzone
            onParsed={handleGpxParsed}
            selectedProfile={selectedProfile?.name || "Naked"}
          />
        </div>

        {/* COL 2: SAÚDE, INÉRCIA & MOTOR */}
        <div className="flex flex-col gap-6">
          <TempVoltCard telemetry={telemetryData} health={healthData} sources={gpxSources} />
          <IMUCard data={imuData} sources={gpxSources} />
          {/* Motor & Velocidade Card */}
          <GaugeCard data={telemetryData} sources={gpxSources} />
        </div>

        {/* COL 3: MAPA */}
        <div className="flex flex-col gap-6 h-full min-h-[500px]">
          <div className="relative flex-grow bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl group flex flex-col h-full">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 opacity-50 z-10" />
            <div className="w-full flex-grow relative h-full">
              <RouteMap
                gpsTrack={gpsTrack}
                currentPosition={simSession.playbackState === "playing" ? currentPosition : null}
              />
              {!hasRows && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 backdrop-blur-[2px] pointer-events-none z-10">
                  <div className="text-5xl grayscale opacity-20">🗺️</div>
                  <p className="text-[0.6rem] font-black text-white/40 uppercase tracking-widest">Carrega um percurso para ativar o mapa</p>
                </div>
              )}
            </div>
          </div>

          {socketError && (
            <div className="p-4 rounded-2xl bg-red/10 border border-red/20 text-red text-xs font-bold flex items-center gap-3 animate-shake">
              <AlertTriangle size={18} />
              <span>{socketError}</span>
            </div>
          )}
        </div>
      </div>

      {/* PLAYBACK CONTROLS */}
      <PlaybackControls
        playbackState={simSession.playbackState}
        playbackSpeed={simSession.playbackSpeed}
        currentTimeSec={currentTimeSec}
        totalDurationSec={totalDurationSec}
        emittedCount={simSession.emittedCount}
        deviceId={simSession.deviceId}
        disabled={!hasRows}
        profiles={profiles}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onSpeedChange={handleSpeedChange}
        onDeviceIdChange={(id) => setSession((prev) => ({ ...prev, deviceId: id }))}
        onProfileChange={(p) => setSelectedProfile(p)}
        onSeek={handleSeek}
      />
    </div>
  );
}
