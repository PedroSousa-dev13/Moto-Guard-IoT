import { Suspense, useState, useEffect } from 'react';
import type { TelemetryPayload, SimulatorCommand } from '../../types/telemetry';
import './MotorcycleDigitalTwin.css';
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

  // Derive values — use safe defaults when data is null
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

  return (
    <div className="digital-twin-container">
      {!data ? (
        /* ── Idle: tela escura com texto 3D a girar ── */
        <div className="twin-idle-screen">
          <div className="twin-idle-3d-text">
            {'SIMULADOR 3D'.split('').map((ch, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.06}s` }}>{ch === ' ' ? '\u00A0' : ch}</span>
            ))}
          </div>
        </div>
      ) : (
        /* ── Live: header + 3D + health + controlos ── */
        <>
          <div className="digital-twin-header">
            <h3 style={{ color: modelColor }}>{modelName || 'MotoGuard'}</h3>
            <div className="overall-health">
              <Shield size={18} />
              <span>ESTADO GLOBAL:</span>
              <strong className={engineTempStatus === 'critical' || oilPressureStatus === 'critical' ? 'text-danger' : 'text-success'}>
                {engineTempStatus === 'critical' || oilPressureStatus === 'critical' ? 'ALERTA' : 'SEGURO'}
              </strong>
            </div>
          </div>

          <div className="visual-center">
            <Suspense fallback={<div className="model-loader"><Loader2 className="animate-spin" /> Carregando 3D...</div>}>
              <Motorcycle3DView
                roll={imu?.roll_deg ?? 0}
                pitch={imu?.pitch_deg ?? 0}
                yaw={imu?.yaw_deg ?? 0}
                speed={telemetry?.speed_kmh ?? 0}
                rpm={telemetry?.rpm ?? 0}
                engineTempStatus={engineTempStatus}
                lat={location?.latitude}
                lng={location?.longitude}
                originLat={routeStart?.lat}
                originLng={routeStart?.lng}
                hasMapOrigin={!!(routeStart || (location?.latitude != null && location?.longitude != null))}
                modelColor={modelColor}
              />
            </Suspense>
            <div className="overlay-label engine-temp" style={{ top: '15%', left: '85%' }}>
              <span className="label">Temp:</span>
              <span className={`value ${engineTempStatus}`}>{telemetry!.engine_temp_c}°C</span>
            </div>
            <div className="overlay-label tire-front" style={{ top: '80%', left: '85%' }}>
              <span className="label">Pres F:</span>
              <span className={`value ${frontTireStatus}`}>{health!.tire_pressure_front_bar}b</span>
            </div>
            <div className="overlay-label tire-rear" style={{ top: '80%', left: '15%' }}>
              <span className="label">Pres T:</span>
              <span className={`value ${rearTireStatus}`}>{health!.tire_pressure_rear_bar}b</span>
            </div>
          </div>

          <div className="health-grid">
            <div className={`health-item ${oilPressureStatus}`}>
              <div className="icon-wrap"><AlertTriangle size={16} /></div>
              <div className="info">
                <span className="title">Pressão Óleo</span>
                <span className="val">{health?.oil_pressure_bar ?? '—'} {health ? 'bar' : ''}</span>
              </div>
            </div>
            <div className={`health-item ${batteryStatus}`}>
              <div className="icon-wrap"><CheckCircle2 size={16} /></div>
              <div className="info">
                <span className="title">Bateria</span>
                <span className="val">{telemetry?.voltage ?? '—'} {telemetry ? 'V' : ''}</span>
              </div>
            </div>
          </div>

          {sendCommand && (
            <div className="speed-controls">
              <span className="speed-label">Velocidade</span>
              {[1, 2, 5, 10].map((m) => (
                <button
                  key={m}
                  className={`btn-speed${!running ? ' disabled' : ''}`}
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
              <button
                className={`btn-speed btn-speed-danger${speedingActive ? ' active' : ''}${!running ? ' disabled' : ''}`}
                onClick={toggleSpeeding}
                disabled={!running}
                title={speedingActive ? 'Clica para desativar excesso de velocidade' : 'Clica para forçar excesso de velocidade'}
              >
                🚨 {speedingActive ? 'ON' : 'OFF'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
