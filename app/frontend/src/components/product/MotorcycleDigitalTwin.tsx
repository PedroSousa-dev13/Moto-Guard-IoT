import { Suspense, useState, useEffect, useRef } from 'react';
import type { TelemetryPayload, SimulatorCommand } from '../../types/telemetry';
import { Shield, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import Motorcycle3DView from './Motorcycle3DView';

interface DigitalTwinProps {
  data: TelemetryPayload | null;
  sendCommand?: (cmd: SimulatorCommand) => void;
  running?: boolean;
  routeStart?: { lat: number; lng: number } | null;
}

// Map moto model/category to a signature color
const MODEL_COLORS: Record<string, string> = {
  sport:       '#ff2244',
  naked:       '#ff6600',
  trail:       '#22cc66',
  enduro:      '#44dd88',
  tour:        '#3399ff',
  cruise:      '#cc44ff',
  scooter:     '#ffcc00',
  supermotard: '#ff4400',
};

function getModelColor(model: string): string {
  const key = model.toLowerCase();
  for (const [k, v] of Object.entries(MODEL_COLORS)) {
    if (key.includes(k)) return v;
  }
  return '#33b5e5'; // default blue
}

export default function MotorcycleDigitalTwin({ data, sendCommand, running, routeStart }: DigitalTwinProps) {
  const [speedingActive, setSpeedingActive] = useState(false);
  const firstLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (data?.location?.latitude != null && data?.location?.longitude != null && !firstLocationRef.current) {
      firstLocationRef.current = { lat: data.location.latitude, lng: data.location.longitude };
    }
  }, [data?.location?.latitude, data?.location?.longitude]);

  function handleSpeedPress(multiplier: number) {
    if (!running || !sendCommand) return;
    sendCommand({ acao: 'set_speed', multiplier });
  }

  function handleSpeedRelease() {
    if (!running || !sendCommand) return;
    sendCommand({ acao: 'set_speed', multiplier: 1 });
  }

  function toggleSpeeding() {
    if (!running || !sendCommand) return;
    const next = !speedingActive;
    setSpeedingActive(next);
    sendCommand({ acao: 'set_speeding', active: next });
  }

  useEffect(() => {
    if (!running && speedingActive) setSpeedingActive(false);
  }, [running, speedingActive]);

  const telemetry = data?.telemetry;
  const health    = data?.health;
  const imu       = data?.imu;
  const location  = data?.location;
  const modelName = data?.system?.moto_model ?? '';
  const modelColor = getModelColor(modelName);

  const engineTempStatus = !telemetry ? 'ok'
    : telemetry.engine_temp_c > 105 ? 'critical'
    : telemetry.engine_temp_c > 95  ? 'warning' : 'ok';

  const oilPressureStatus = !health ? 'ok'
    : health.oil_pressure_bar < 1.5 ? 'critical'
    : health.oil_pressure_bar < 2.5 ? 'warning' : 'ok';

  const frontTireStatus = !health ? 'ok'
    : health.tire_pressure_front_bar < 1.8 ? 'critical'
    : health.tire_pressure_front_bar < 2.2 ? 'warning' : 'ok';

  const rearTireStatus = !health ? 'ok'
    : health.tire_pressure_rear_bar < 1.9 ? 'critical'
    : health.tire_pressure_rear_bar < 2.4 ? 'warning' : 'ok';

  const batteryStatus = !telemetry ? 'ok'
    : telemetry.voltage < 11.8 ? 'critical'
    : telemetry.voltage < 12.4 ? 'warning' : 'ok';

  const statusColor = (status: string) => {
    if (status === 'critical') return 'text-red';
    if (status === 'warning') return 'text-yellow';
    return 'text-green';
  };

  const statusBg = (status: string) => {
    if (status === 'critical') return 'bg-red/10 border-red/20';
    if (status === 'warning') return 'bg-yellow/10 border-yellow/20';
    return 'bg-green/10 border-green/20';
  };

  return (
    <div className="flex flex-col gap-6 h-full min-h-[500px]">
      {!data ? (
        <div className="flex-1 flex items-center justify-center bg-panel rounded-[2.5rem] border border-border-glass-subtle overflow-hidden group">
          <div className="flex gap-4 animate-pulse">
            {'SIMULADOR 3D'.split('').map((ch, i) => (
              <span key={i} className="text-4xl md:text-6xl font-black text-muted opacity-10 group-hover:text-accent/20 transition-colors" style={{ animationDelay: `${i * 0.1}s` }}>
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-6 py-4 bg-panel border border-border-glass-subtle rounded-2xl">
            <h3 className="text-xl font-black tracking-tighter m-0" style={{ color: modelColor }}>{modelName || 'MotoGuard'}</h3>
            <div className="flex items-center gap-3">
              <Shield size={18} className={engineTempStatus === 'critical' || oilPressureStatus === 'critical' ? 'text-red' : 'text-green'} />
              <span className="text-[0.65rem] font-black uppercase tracking-widest text-muted">Estado Global:</span>
              <strong className={`text-[0.65rem] font-black uppercase tracking-widest ${engineTempStatus === 'critical' || oilPressureStatus === 'critical' ? 'text-red' : 'text-green'}`}>
                {engineTempStatus === 'critical' || oilPressureStatus === 'critical' ? 'Alerta' : 'Seguro'}
              </strong>
            </div>
          </div>

          <div className="flex-1 relative bg-black/40 rounded-[2.5rem] border border-border-glass-subtle overflow-hidden min-h-[350px]">
            <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-muted font-bold gap-3"><Loader2 className="animate-spin" /> Carregando 3D...</div>}>
              <Motorcycle3DView
                roll={imu?.roll_deg ?? 0}
                pitch={imu?.pitch_deg ?? 0}
                yaw={imu?.yaw_deg ?? 0}
                speed={telemetry?.speed_kmh ?? 0}
                rpm={telemetry?.rpm ?? 0}
                engineTempStatus={engineTempStatus}
                lat={location?.latitude}
                lng={location?.longitude}
                originLat={routeStart?.lat ?? firstLocationRef.current?.lat}
                originLng={routeStart?.lng ?? firstLocationRef.current?.lng}
                hasMapOrigin={!!(routeStart || firstLocationRef.current || (location?.latitude != null && location?.longitude != null))}
                modelColor={modelColor}
              />
            </Suspense>
            
            {/* Overlay telemetry */}
            <div className="absolute top-8 right-8 flex flex-col gap-3">
              <div className={`flex flex-col items-end px-4 py-2 rounded-xl backdrop-blur-md border ${statusBg(engineTempStatus)}`}>
                <span className="text-[0.55rem] font-black uppercase tracking-widest opacity-60">Temp Motor</span>
                <span className={`text-lg font-black ${statusColor(engineTempStatus)}`}>{telemetry!.engine_temp_c}°C</span>
              </div>
              <div className={`flex flex-col items-end px-4 py-2 rounded-xl backdrop-blur-md border ${statusBg(frontTireStatus)}`}>
                <span className="text-[0.55rem] font-black uppercase tracking-widest opacity-60">Pres. Dianteira</span>
                <span className={`text-lg font-black ${statusColor(frontTireStatus)}`}>{health!.tire_pressure_front_bar} bar</span>
              </div>
            </div>

            <div className="absolute bottom-8 left-8">
              <div className={`flex flex-col px-4 py-2 rounded-xl backdrop-blur-md border ${statusBg(rearTireStatus)}`}>
                <span className="text-[0.55rem] font-black uppercase tracking-widest opacity-60">Pres. Traseira</span>
                <span className={`text-lg font-black ${statusColor(rearTireStatus)}`}>{health!.tire_pressure_rear_bar} bar</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`flex items-center gap-4 p-4 rounded-2xl bg-panel border border-border-glass-subtle group hover:border-accent/20 transition-all ${statusColor(oilPressureStatus)}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${statusBg(oilPressureStatus)}`}>
                <AlertTriangle size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[0.65rem] font-black uppercase tracking-widest text-muted opacity-60">Pressão Óleo</span>
                <span className="text-lg font-black tracking-tight text-text">{health?.oil_pressure_bar ?? '—'} bar</span>
              </div>
            </div>
            <div className={`flex items-center gap-4 p-4 rounded-2xl bg-panel border border-border-glass-subtle group hover:border-accent/20 transition-all ${statusColor(batteryStatus)}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${statusBg(batteryStatus)}`}>
                <CheckCircle2 size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[0.65rem] font-black uppercase tracking-widest text-muted opacity-60">Bateria</span>
                <span className="text-lg font-black tracking-tight text-text">{telemetry?.voltage ?? '—'} V</span>
              </div>
            </div>
          </div>

          {sendCommand && (
            <div className="flex flex-wrap items-center gap-3 p-6 bg-panel border border-border-glass-subtle rounded-2xl">
              <span className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-muted mr-3">Simulação</span>
              <div className="flex items-center gap-2">
                {[1, 2, 5, 10].map((m) => (
                  <button
                    key={m}
                    className={`px-4 py-2 rounded-xl font-black text-[0.7rem] uppercase tracking-widest transition-all ${
                      !running 
                        ? 'opacity-30 cursor-not-allowed bg-surface' 
                        : 'bg-surface border border-border-glass-subtle text-muted hover:text-accent hover:border-accent/40 hover:scale-105 active:scale-95'
                    }`}
                    onMouseDown={() => handleSpeedPress(m)}
                    onMouseUp={m === 1 ? undefined : handleSpeedRelease}
                    onMouseLeave={m === 1 ? undefined : handleSpeedRelease}
                    onTouchStart={() => handleSpeedPress(m)}
                    onTouchEnd={m === 1 ? undefined : handleSpeedRelease}
                    disabled={!running}
                    title={m === 1 ? 'Velocidade normal' : `Segurar para ${m}x`}
                  >
                    {m}x
                  </button>
                ))}
              </div>
              <button
                className={`ml-auto flex items-center gap-2 px-6 py-2 rounded-xl font-black text-[0.7rem] uppercase tracking-widest transition-all ${
                  !running 
                    ? 'opacity-30 cursor-not-allowed bg-red/10 border border-red/20 text-red/40' 
                    : speedingActive
                      ? 'bg-red text-white shadow-lg shadow-red/20 animate-pulse'
                      : 'bg-red/10 border border-red/20 text-red hover:bg-red hover:text-white hover:shadow-lg hover:shadow-red/20 hover:scale-105 active:scale-95'
                }`}
                onClick={toggleSpeeding}
                disabled={!running}
                title={speedingActive ? 'Desativar excesso' : 'Ativar excesso'}
              >
                🚨 {speedingActive ? 'Emergência ON' : 'Forçar Emergência'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
