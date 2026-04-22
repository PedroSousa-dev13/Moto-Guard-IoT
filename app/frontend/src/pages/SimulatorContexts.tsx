import { useEffect, useState } from 'react';
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";
import { motorcyclesAPI } from "../services/api";
import { CATEGORY_DEVICE_MAP } from "../utils/categoryDeviceMap";
import type { Motorcycle } from "../types";
import GaugeCard from "../components/GaugeCard";
import TempVoltCard from "../components/TempVoltCard";
import IMUCard from "../components/IMUCard";
import MapCard from "../components/MapCard";
import StatusCard from "../components/StatusCard";
import CommandPanel from "../components/CommandPanel";
import MotorcycleDigitalTwin from "../components/product/MotorcycleDigitalTwin";
import Toast from "../components/ui/Toast";
import { Activity, Wifi, Database, Clock, Settings2 } from 'lucide-react';

const ADMIN_EMAIL = 'admin@admin.com';

export default function SimulatorContexts() {
  const { user } = useAuth();
  const { telemetry, msgCount, logs, status, sendCommand, addLog, devices, activeDeviceId, setActiveDeviceId, tripEndedSignal, resetSimulationView } = useSocket();
  const lastUpdate = telemetry?.system?.timestamp
    ? new Date(telemetry.system.timestamp).toLocaleTimeString("pt-PT")
    : null;
  const [mapResetSignal, setMapResetSignal] = useState(0);
  const [mapRouteSignal, setMapRouteSignal] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [routeStart, setRouteStart] = useState<{ lat: number; lng: number } | null>(null);

  // Wrapper que deteta quando uma rota é enviada e incrementa o sinal
  function sendCommandAndSignal(cmd: any) {
    // Target current simulator, but pass new identity
    const enrichedCmd = { ...cmd, userId: user?.id, device_id: activeDeviceId };
    if (cmd.acao === "definir_modelo" && cmd.modelo) {
      // Procurar por nome exato primeiro, depois por categoria
      const bike = userMotos.find(m => m.name === cmd.modelo) || 
                   userMotos.find(m => m.category === cmd.modelo);
                   
      if (bike) {
        enrichedCmd.motorcycleName = bike.name;
        enrichedCmd.modelo = bike.category || "Naked";
        enrichedCmd.new_device_id = bike.deviceId;
      } else if (CATEGORY_DEVICE_MAP[cmd.modelo]) {
        // Fallback para quando o modelo é uma categoria (admin ou sem motas)
        enrichedCmd.new_device_id = CATEGORY_DEVICE_MAP[cmd.modelo];
        enrichedCmd.motorcycleName = cmd.modelo;
      }
    }

    sendCommand(enrichedCmd);
    if (cmd.acao === "definir_rota") {
      setMapRouteSignal((v) => v + 1);
    }
  }

  const isAdmin = user?.email === ADMIN_EMAIL;

  // User motos state (only for non-admin)
  const [userMotos, setUserMotos] = useState<Motorcycle[]>([]);
  const [motosLoading, setMotosLoading] = useState(false);
  const [motosError, setMotosError] = useState<string | null>(null);

  const running = status.ws && !!telemetry;

  // Derive allowedModels from user's motos (unique categories, preserving order).
  // undefined = admin free selector (all 8 models).
  // [] = still loading or no motos — CommandPanel will show empty/disabled state.
  const allowedModels: string[] | undefined = isAdmin
    ? undefined
    : motosLoading
      ? []
      : userMotos.map((m) => m.name).filter(Boolean) as string[];

  async function loadMotos() {
    setMotosLoading(true);
    setMotosError(null);
    try {
      const res = await motorcyclesAPI.getAll();
      setUserMotos(res.data);
    } catch {
      setMotosError("Não foi possível carregar as tuas motas.");
    } finally {
      setMotosLoading(false);
    }
  }

  useEffect(() => {
    document.title = "Simulador — MotoGuard";
    if (!isAdmin) {
      void loadMotos();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!tripEndedSignal) return;
    setToast((prev) =>
      prev?.message === "Simulação terminada"
        ? prev
        : { message: "Simulação terminada", type: "success" }
    );
    setMapResetSignal((v) => v + 1);
    resetSimulationView();
  }, [tripEndedSignal, resetSimulationView]);

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-text tracking-tight m-0 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <Activity size={24} />
            </span>
            Dashboard de Simulação
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Clock size={14} className="text-muted" />
            <span className="text-muted font-bold text-[0.65rem] uppercase tracking-widest leading-none">
              {lastUpdate ? `Último update às ${lastUpdate}` : "A aguardar sinal de telemetria..."}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {devices.length > 1 && (
            <div className="flex items-center bg-panel border border-border-glass-subtle rounded-xl px-3 py-2 gap-2 shadow-inner">
              <Settings2 size={16} className="text-accent/60" />
              <select
                className="bg-transparent border-none text-[0.7rem] font-black text-text uppercase tracking-widest focus:outline-none cursor-pointer"
                value={activeDeviceId ?? ""}
                onChange={(e) => setActiveDeviceId(e.target.value)}
              >
                {devices.map((d) => (
                  <option key={d} value={d} className="bg-surface">{d}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="flex items-center gap-2 bg-panel border border-border-glass-subtle p-1 rounded-xl shadow-inner">
            <span
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.6rem] font-black uppercase tracking-widest transition-all ${status.mqtt ? "bg-green/10 text-green border border-green/20" : "bg-red/10 text-red border border-red/20 opacity-50"}`}
              title={status.mqtt ? "Broker MQTT Online" : "Broker MQTT Offline"}
            >
              <Wifi size={12} /> MQTT
            </span>
            <span
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.6rem] font-black uppercase tracking-widest transition-all ${status.ws ? "bg-accent/10 text-accent border border-accent/20" : "bg-red/10 text-red border border-red/20 opacity-50"}`}
              title={status.ws ? "WebSocket Conectado" : "WebSocket Desconectado"}
            >
              <Activity size={12} /> WS
            </span>
            <span
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.6rem] font-black uppercase tracking-widest transition-all ${status.hasData ? "bg-blue/10 text-blue border border-blue/20" : "bg-yellow/10 text-yellow border border-yellow/20 opacity-50"}`}
              title={status.hasData ? "Stream de dados ativo" : "Sem fluxo de dados"}
            >
              <Database size={12} />
              {status.hasData ? `${msgCount}` : "WAIT"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* HERO ROW - DIGITAL TWIN & MAP */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-auto min-h-[500px]">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-surface/40 backdrop-blur-xl border border-border-glass shadow-2xl p-6 group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0" />
            <MotorcycleDigitalTwin data={telemetry} sendCommand={sendCommand} running={running} routeStart={routeStart} />
          </div>
          <div className="relative overflow-hidden rounded-[2.5rem] bg-surface/40 backdrop-blur-xl border border-border-glass shadow-2xl p-2 group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue/0 via-blue/40 to-blue/0" />
            <MapCard
              location={telemetry?.location ?? null}
              telemetry={telemetry?.telemetry ?? null}
              imu={telemetry?.imu ?? null}
              msgCount={msgCount}
              resetSignal={mapResetSignal}
              routeSignal={mapRouteSignal}
              sendCommand={sendCommand}
              onRouteStartChange={setRouteStart}
            />
          </div>
        </div>

        {/* TELEMETRY HUD GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <GaugeCard data={telemetry?.telemetry ?? null} />
          <TempVoltCard
            telemetry={telemetry?.telemetry ?? null}
            health={telemetry?.health ?? null}
          />
          <IMUCard data={telemetry?.imu ?? null} />
          <StatusCard
            system={telemetry?.system ?? null}
            safety={telemetry?.active_safety ?? null}
            health={telemetry?.health ?? null}
          />
        </div>

        {/* COMMAND CENTER */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-surface/60 backdrop-blur-xl border border-border-glass shadow-2xl group animate-fade-in [animation-delay:400ms]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 opacity-50" />
          <div className="p-1">
            <CommandPanel
              sendCommand={sendCommandAndSignal}
              addLog={addLog}
              logs={logs}
              running={running}
              allowedModels={allowedModels}
              onStop={() => {
                setToast({ message: "Simulação terminada", type: "success" });
                setMapResetSignal((v) => v + 1);
                resetSimulationView();
              }}
            />
          </div>
        </div>
      </div>

      {/* FOOTER STATS */}
      <div className="flex items-center justify-center gap-10 px-8 py-4 rounded-2xl bg-panel border border-border-glass-subtle shadow-inner shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[0.6rem] font-black text-muted uppercase tracking-widest opacity-40">Pacotes Recebidos</span>
          <span className="text-sm font-black text-text tracking-tight tabular-nums">{msgCount.toLocaleString()}</span>
        </div>
        <div className="w-px h-4 bg-border-glass-subtle" />
        <div className="flex items-center gap-2">
          <span className="text-[0.6rem] font-black text-muted uppercase tracking-widest opacity-40">Última Transmissão</span>
          <span className="text-sm font-black text-accent tracking-tight uppercase">{lastUpdate ?? "A AGUARDAR..."}</span>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
