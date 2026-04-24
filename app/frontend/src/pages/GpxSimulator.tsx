// =============================================================================
// MotoGuard IoT — GPX Simulator Page
// =============================================================================
// Parses GPX route files, enriches with motorcycle telemetry, and plays back
// the route with real-time telemetry display and socket emission.
// Mirrors the RealSimulator page but for GPX files instead of CSV+video.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { io, Socket } from "socket.io-client";
import type { ParsedRow, ParseResult } from "../real-simulator/csvParser";
import type { GpxStats } from "../gpx-simulator/gpxParser";
import GpxDropzone from "../gpx-simulator/GpxDropzone";
import RouteMap from "../real-simulator/RouteMap";
import { PlaybackControls } from "../real-simulator/PlaybackControls";
import { useSyncEngine } from "../real-simulator/useSyncEngine";
import { buildPayload, emitTelemetry } from "../real-simulator/telemetryEmitter";
import { useAuth } from "../hooks/useAuth";
import { motorcyclesAPI } from "../services/api";
import type { Motorcycle } from "../types";
import { Navigation, AlertTriangle, Mountain, Activity, MoveHorizontal, MoveVertical, Compass, Gauge, Zap, Disc, ArrowUpCircle, Thermometer, Droplets, CircleDot } from "lucide-react";
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
  const [totalDurationSec, setTotalDurationSec] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [selectedMotorcycle, setSelectedMotorcycle] = useState<Motorcycle | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const simulationStartTimeRef = useRef<Date>(new Date());

  // Dummy video ref (useSyncEngine requires it but we pass null)
  const videoRef = useRef<HTMLVideoElement>(null) as RefObject<HTMLVideoElement>;

  useEffect(() => {
    document.title = "Simulador GPX — MotoGuard";
  }, []);

  // Fetch motorcycles and Socket lifecycle
  useEffect(() => {
    motorcyclesAPI.getAll().then((res) => {
      setMotorcycles(res.data);
      if (res.data.length > 0) {
        setSelectedMotorcycle(res.data[0]);
        setSession(prev => ({ ...prev, deviceId: res.data[0].deviceId || "" }));
      }
    });

    const socket = io();
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // GPS track for map
  const gpsTrack = simSession.rows.map((r) => ({ lat: r.latitude, lng: r.longitude }));

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
          index
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
  }, []);

  // Sync engine (no video)
  const syncEngine = useSyncEngine({
    rows: simSession.rows,
    videoRef: null,
    playbackSpeed: simSession.playbackSpeed,
    onRowChange: handleRowChange,
    onEnd: () => {
      // Quando termina naturalmente, fazemos o mesmo que o Stop mas sem chamar syncEngine.stop()
      // (evitando recursão/circularidade)
      const socket = socketRef.current;
      if (socket?.connected && simSession.rows.length > 0) {
        const lastRow = simSession.rows[simSession.rows.length - 1];
        const payload = buildPayload(
          lastRow,
          simSession.deviceId,
          simulationStartTimeRef.current,
          "TRIP_ENDED",
          simSession.rows.length - 1
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
    syncEngine.stop();

    const socket = socketRef.current;
    if (socket?.connected && simSession.rows.length > 0) {
      const lastRow = simSession.rows[simSession.currentRowIndex] ?? simSession.rows[0];
      const payload = buildPayload(
        lastRow,
        simSession.deviceId,
        simulationStartTimeRef.current,
        "TRIP_ENDED",
        simSession.currentRowIndex
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
  }, [syncEngine, simSession.rows, simSession.currentRowIndex, simSession.deviceId]);

  const handlePlay = useCallback(() => {
    if (!socketRef.current?.connected) {
      setSocketError("Socket não conectado. Simulação sem emissão de telemetria.");
    } else {
      setSocketError(null);
      if (user?.id) {
        socketRef.current.emit("send_command", {
          acao: "definir_modelo",
          modelo: selectedMotorcycle?.name || "GPX Simulator",
          device_id: simSession.deviceId,
          userId: user.id
        });
      }
    }
    simulationStartTimeRef.current = new Date();
    syncEngine.start();
    setSession((prev) => ({ ...prev, playbackState: "playing" }));
  }, [syncEngine, user?.id, simSession.deviceId, selectedMotorcycle?.name]);

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
  const handleGpxParsed = useCallback((result: ParseResult, stats: GpxStats) => {
    setGpxStats(stats);
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
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      {/* CLEAN HEADER */}
      <div className="flex flex-col gap-1 border-b border-white/5 pb-4">
        <h1 className="text-2xl font-black text-white tracking-tight m-0 flex items-center gap-3">
          <Navigation size={20} className="text-accent" />
          Simulador de Rotas GPX
        </h1>
        <p className="text-[0.6rem] font-black text-muted uppercase tracking-[0.25em] opacity-40">Reprodução de telemetria enriquecida via GPS</p>
      </div>

      {/* TOP SOURCE BAR (Clean) */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        <div className="bg-panel/40 backdrop-blur-xl border border-border-glass-subtle rounded-2xl p-4 flex-1 flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent/60 group-hover:text-accent group-hover:bg-accent/10 transition-all">
              <Navigation size={18} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40">Fonte de Dados</span>
              <span className="text-xs font-bold text-white/80">{hasRows ? "Ficheiro GPX Carregado" : "Nenhum ficheiro selecionado"}</span>
            </div>
          </div>
          <GpxDropzone onParsed={handleGpxParsed} compact />
        </div>
        
        {gpxStats && (
          <div className="bg-panel/40 backdrop-blur-xl border border-border-glass-subtle rounded-2xl p-4 flex items-center gap-6 group hover:border-border-glass transition-all">
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40">Altitude</span>
              <span className="text-xs font-black text-blue/80 tabular-nums">{gpxStats.minElevation}m – {gpxStats.maxElevation}m</span>
            </div>
            <div className="w-px h-6 bg-white/5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40">Ganho Acumulado</span>
              <div className="flex items-center gap-2 text-xs font-black text-blue/80 tabular-nums">
                <span>↗ {gpxStats.elevationGain}m</span>
                <span className="opacity-20">|</span>
                <span>↘ {gpxStats.elevationLoss}m</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3-COLUMN PREMIUM DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_340px_1fr] gap-6 items-stretch min-h-[600px]">
        {/* COL 1: MOTOR & VELOCIDADE */}
        <div className="flex flex-col gap-6">
          <GaugeCard data={telemetryData} sources={gpxSources} />
          
          {/* Legend Card */}
          <div className="bg-panel/20 border border-border-glass-subtle rounded-2xl p-4 flex flex-col gap-3">
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
        </div>

        {/* COL 2: SAÚDE & INÉRCIA */}
        <div className="flex flex-col gap-6">
          <TempVoltCard telemetry={telemetryData} health={healthData} sources={gpxSources} />
          <IMUCard data={imuData} sources={gpxSources} />
        </div>

        {/* COL 3: MAPA */}
        <div className="flex flex-col gap-6">
          <div className="relative flex-1 bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl group min-h-[500px]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 opacity-50 z-10" />
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

          {socketError && (
            <div className="p-4 rounded-2xl bg-red/10 border border-red/20 text-red text-xs font-bold flex items-center gap-3 animate-shake">
              <AlertTriangle size={18} />
              <span>{socketError}</span>
            </div>
          )}
        </div>
      </div>

      {/* PLAYBACK CONTROLS */}
      <div className="sticky bottom-0 z-50">
        <PlaybackControls
          playbackState={simSession.playbackState}
          playbackSpeed={simSession.playbackSpeed}
          currentTimeSec={currentTimeSec}
          totalDurationSec={totalDurationSec}
          emittedCount={simSession.emittedCount}
          deviceId={simSession.deviceId}
          disabled={!hasRows}
          motorcycles={motorcycles}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          onSpeedChange={handleSpeedChange}
          onDeviceIdChange={(id) => setSession((prev) => ({ ...prev, deviceId: id }))}
          onMotorcycleChange={(m) => setSelectedMotorcycle(m)}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}
