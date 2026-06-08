// =============================================================================
// MotoGuard IoT — Real Simulator Page
// =============================================================================
// Orquestra CsvDropzone, RouteMap, VideoPlayer, PlaybackControls e useSyncEngine
// para reproduzir ficheiros CSV de telemetria sincronizados com vídeo .mp4.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { io, Socket } from "socket.io-client";
import type { ParsedRow, ParseResult } from "../real-simulator/csvParser";
import CsvDropzone from "../real-simulator/CsvDropzone";
import RouteMap from "../real-simulator/RouteMap";
import VideoPlayer from "../real-simulator/VideoPlayer";
import { PlaybackControls } from "../real-simulator/PlaybackControls";
import { useSyncEngine } from "../real-simulator/useSyncEngine";
import { buildPayload, emitTelemetry } from "../real-simulator/telemetryEmitter";
import { useAuth } from "../hooks/useAuth";
import { motorcyclesAPI } from "../services/api";
import type { Motorcycle, MotorcycleProfile } from "../types";
import { Activity, Gauge, Zap, AlertTriangle } from "lucide-react";
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
  videoFile: File | null;
  playbackState: PlaybackState;
  playbackSpeed: PlaybackSpeed;
  currentRowIndex: number;
  emittedCount: number;
}

const INITIAL_SESSION: SimulatorSession = {
  rows: [],
  deviceId: "",
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
  const [simSession, setSession] = useState<SimulatorSession>(INITIAL_SESSION);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [sourceFormat, setSourceFormat] = useState<ParseResult["format"] | null>(null);
  const [totalDurationSec, setTotalDurationSec] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [profiles, setProfiles] = useState<MotorcycleProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<MotorcycleProfile | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null) as RefObject<HTMLVideoElement>;
  const simulationStartTimeRef = useRef<Date>(new Date());

  useEffect(() => {
    document.title = "Simulador Real — MotoGuard";
  }, []);

  useEffect(() => {
    motorcyclesAPI.getProfiles().then((res) => {
      setProfiles(res.data);
      if (res.data.length > 0) {
        setSelectedProfile(res.data[0]);
      }
    });

    setSession(prev => ({ ...prev, deviceId: "MOTOGUARD-IRL-SIM" }));

    const socket = io();
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const gpsTrack = simSession.rows.map((r) => ({ lat: r.latitude, lng: r.longitude }));

  const currentPosition =
    simSession.rows.length > 0 && simSession.currentRowIndex < simSession.rows.length
      ? {
          lat: simSession.rows[simSession.currentRowIndex].latitude,
          lng: simSession.rows[simSession.currentRowIndex].longitude,
        }
      : null;

  const handleRowChange = useCallback(
    (row: ParsedRow, index: number) => {
      setSession((prev) => {
        if (!socketRef.current || !socketRef.current.connected) {
          return { ...prev, currentRowIndex: index };
        }

        const payload = buildPayload(
          row,
          prev.deviceId,
          simulationStartTimeRef.current,
          "TRIP_ACTIVE",
          selectedProfile?.name || "Real Simulator",
          index,
          "DEVICE_REAL"
        );
        emitTelemetry(socketRef.current, payload);

        return {
          ...prev,
          currentRowIndex: index,
          emittedCount: prev.emittedCount + 1,
        };
      });
      setCurrentTimeSec(row.timestampSec);
    },
    [selectedProfile]
  );

  const syncEngine = useSyncEngine({
    rows: simSession.rows,
    videoRef: simSession.videoFile ? videoRef : null,
    playbackSpeed: simSession.playbackSpeed,
    onRowChange: handleRowChange,
    onEnd: () => {
      console.debug("[RealSimulator] Playback finished.");
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      const socket = socketRef.current;
      if (socket?.connected && simSession.rows.length > 0) {
        const lastRow = simSession.rows[simSession.rows.length - 1];
        const payload = buildPayload(
          lastRow,
          simSession.deviceId,
          simulationStartTimeRef.current,
          "TRIP_ENDED",
          selectedProfile?.name || "Real Simulator",
          simSession.rows.length - 1,
          "DEVICE_REAL"
        );
        emitTelemetry(socket, payload);

        // Forçar fecho no backend
        socket.emit("send_command", { acao: "parar", device_id: simSession.deviceId, source: "DEVICE_REAL" });
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

  const { user } = useAuth();

  const handlePause = useCallback(() => {
    if (simSession.videoFile && videoRef.current) {
      videoRef.current.pause();
    }
    syncEngine.pause();
    setSession((prev) => ({ ...prev, playbackState: "paused" }));
  }, [simSession.videoFile, syncEngine]);

  const handleStop = useCallback(() => {
    console.debug("[RealSimulator] Stop clicked.");
    syncEngine.stop();
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    const socket = socketRef.current;
    if (socket && socket.connected && simSession.rows.length > 0) {
      const lastRow = simSession.rows[simSession.currentRowIndex] ?? simSession.rows[0];
      const payload = buildPayload(
        lastRow,
        simSession.deviceId,
        simulationStartTimeRef.current,
        "TRIP_ENDED",
        selectedProfile?.name || "Real Simulator",
        simSession.currentRowIndex,
        "DEVICE_REAL"
      );
      emitTelemetry(socket, payload);

      // Notificar backend para fechar a viagem imediatamente
      socket.emit("send_command", { acao: "parar", device_id: simSession.deviceId, source: "DEVICE_REAL" });
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
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      setSocketError("Socket não conectado. A simulação local vai iniciar sem emissão de telemetria.");
    } else {
      setSocketError(null);
      if (user?.id) {
        console.debug("[RealSimulator] Defining motorcycle model:", selectedProfile?.name || "Real Simulator");
        socket.emit("send_command", {
          acao: "definir_modelo",
          modelo: selectedProfile?.name || "Real Simulator",
          device_id: simSession.deviceId,
          userId: user.id,
          source: "DEVICE_REAL"
        });
      }
    }
    simulationStartTimeRef.current = new Date();
    if (simSession.videoFile && videoRef.current) {
      videoRef.current.playbackRate = simSession.playbackSpeed;
      videoRef.current.play().catch(() => {});
    }
    syncEngine.start();
    setSession((prev) => ({ ...prev, playbackState: "playing" }));
  }, [simSession.videoFile, simSession.playbackSpeed, syncEngine, user?.id, simSession.deviceId, selectedProfile?.name]);

  const handleSpeedChange = useCallback(
    (speed: PlaybackSpeed) => {
      if (simSession.videoFile && videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
      setSession((prev) => ({ ...prev, playbackSpeed: speed }));
    },
    [simSession.videoFile]
  );

  const handleSeek = useCallback(
    (timeSec: number) => {
      if (simSession.videoFile && videoRef.current) {
        videoRef.current.currentTime = timeSec;
      }
      syncEngine.seek(timeSec);
      setCurrentTimeSec(timeSec);
    },
    [simSession.videoFile, syncEngine]
  );

  const handleCsvParsed = useCallback((result: ParseResult) => {
    setSourceFormat(result.format);
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

  const handleVideoFileSelect = useCallback((file: File) => {
    setSession((prev) => ({ ...prev, videoFile: file }));
  }, []);

  // Cleanup: parar motor apenas no unmount real do componente
  // NÃO incluir syncEngine nas deps — muda a cada render e matava o loop!
  useEffect(() => {
    return () => {
      console.debug("[RealSimulator] Component unmounting — stopping engine");
      syncEngine.stop();
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasRows = simSession.rows.length > 0;
  const isDisabled = !hasRows;
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
    brake_front_pct: 0,
    brake_rear_pct: 0,
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
    oil_pressure_bar: 3.8,
    tire_pressure_front_bar: 2.3,
    tire_pressure_rear_bar: 2.5
  } : null;

  const isRiderData = sourceFormat === "riderdata";
  const telemetrySources = {
    speed: true,
    rpm: isRiderData,
    gear: isRiderData,
    throttle: isRiderData,
    engineTemp: isRiderData,
    voltage: isRiderData,
    oilPressure: false,
    brakeFront: false,
    brakeRear: false,
    roll: isRiderData,
    pitch: isRiderData,
    yaw: isRiderData,
    gForce: isRiderData
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-32">
      {/* CLEAN HEADER */}
      <div className="flex flex-col gap-1 border-b border-white/5 pb-4">
        <h1 className="text-2xl font-black text-white tracking-tight m-0 flex items-center gap-3">
          <Activity size={20} className="text-accent" />
          Simulador de Telemetria Real
        </h1>
        <p className="text-[0.6rem] font-black text-muted uppercase tracking-[0.25em] opacity-40">Análise de telemetria sincronizada com vídeo</p>
      </div>

      {/* TOP CONTROL GRID (Left: CsvDropzone + File Status, Center: Video Player, Right: Map) */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_1fr] xl:grid-cols-[300px_1.2fr_1fr] gap-6 items-stretch">
        {/* COL 1: CSV IMPORT & STATUS */}
        <div className="flex flex-col gap-4">
          <div className="flex-1 bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-4 flex flex-col justify-center min-h-[280px]">
            <CsvDropzone onParsed={handleCsvParsed} />
          </div>
          
          <div className="bg-panel/40 backdrop-blur-xl border border-border-glass-subtle rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
              <Activity size={18} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40">Ficheiro de Telemetria</span>
              <span className="text-xs font-bold text-white/80">{hasRows ? "Telemetria Ativa" : "Aguardando CSV..."}</span>
            </div>
          </div>
        </div>

        {/* COL 2: VIDEO PLAYER */}
        <div className="relative bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl group min-h-[380px] flex flex-col justify-center">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red/0 via-red/40 to-red/0 opacity-50 z-10" />
          <VideoPlayer
            videoFile={simSession.videoFile}
            videoRef={videoRef}
            onFileSelect={handleVideoFileSelect}
          />
        </div>

        {/* COL 3: MAP */}
        <div className="relative bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl group min-h-[380px]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 opacity-50 z-10" />
          <RouteMap
            gpsTrack={gpsTrack}
            currentPosition={simSession.playbackState === "playing" ? currentPosition : null}
          />
          {!hasRows && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 backdrop-blur-[2px] pointer-events-none z-10">
              <div className="text-5xl grayscale opacity-20">🗺️</div>
              <p className="text-[0.6rem] font-black text-white/40 uppercase tracking-widest">Carrega telemetria para ver o percurso</p>
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

      {/* HUD CARDS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
        {/* METADADOS DO PERCURSO */}
        <div className="bg-panel/40 backdrop-blur-xl border border-border-glass-subtle rounded-[2rem] p-6 flex flex-col justify-between relative overflow-hidden group min-h-[280px]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue/0 via-blue/40 to-blue/0 opacity-50" />
          <div className="flex flex-col gap-1 w-full">
            <span className="text-[0.65rem] font-black text-muted uppercase tracking-widest opacity-40">Metadados do Percurso</span>
            <div className="mt-6 flex flex-col gap-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-muted opacity-40 uppercase text-[0.5rem]">Origem</span>
                <span className="font-black text-white/80">{sourceFormat === "riderdata" ? "RiderData" : "CSV Genérico"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-muted opacity-40 uppercase text-[0.5rem]">Frequência</span>
                <span className="font-black text-white/80">10 Hz</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-muted opacity-40 uppercase text-[0.5rem]">Progresso</span>
                <span className="font-black text-white/80 tabular-nums">{(currentTimeSec / totalDurationSec * 100 || 0).toFixed(0)}%</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green" />
              <span className="text-[0.5rem] font-black text-muted uppercase">Original</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue" />
              <span className="text-[0.5rem] font-black text-muted uppercase">Simulado</span>
            </div>
          </div>
        </div>

        {/* SAÚDE & FLUIDOS */}
        <TempVoltCard telemetry={telemetryData} health={healthData} sources={telemetrySources} />

        {/* IMU - INÉRCIA */}
        <IMUCard data={imuData} sources={telemetrySources} />

        {/* MOTOR & VELOCIDADE */}
        <GaugeCard data={telemetryData} sources={telemetrySources} />
      </div>

      {/* PLAYBACK CONTROLS */}
      <PlaybackControls
        playbackState={simSession.playbackState}
        playbackSpeed={simSession.playbackSpeed}
        currentTimeSec={currentTimeSec}
        totalDurationSec={totalDurationSec}
        emittedCount={simSession.emittedCount}
        deviceId={simSession.deviceId}
        disabled={isDisabled}
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
