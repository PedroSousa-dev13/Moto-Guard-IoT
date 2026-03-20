import React, { Suspense, useState } from 'react';
import type { TelemetryPayload, SimulatorCommand } from '../../types/telemetry';
import './MotorcycleDigitalTwin.css';
import { Shield, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import Motorcycle3DView from './Motorcycle3DView';

interface DigitalTwinProps {
  data: TelemetryPayload | null;
  sendCommand?: (cmd: SimulatorCommand) => void;
  running?: boolean;
}

export default function MotorcycleDigitalTwin({ data, sendCommand, running }: DigitalTwinProps) {
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

  // Reset speeding state when simulation stops
  React.useEffect(() => {
    if (!running && speedingActive) {
      setSpeedingActive(false);
    }
  }, [running]);

  if (!data) return (
    <div className="digital-twin-empty">
      <Loader2 className="animate-spin" size={32} />
      <span>Aguardando dados da mota...</span>
    </div>
  );

  const { telemetry, health, active_safety, imu } = data;

  // Health calculation helpers
  const engineTempStatus = telemetry.engine_temp_c > 105 ? 'critical' : telemetry.engine_temp_c > 95 ? 'warning' : 'ok';
  const oilPressureStatus = health.oil_pressure_bar < 1.5 ? 'critical' : health.oil_pressure_bar < 2.5 ? 'warning' : 'ok';
  const frontTireStatus = health.tire_pressure_front_bar < 1.8 ? 'critical' : health.tire_pressure_front_bar < 2.2 ? 'warning' : 'ok';
  const rearTireStatus = health.tire_pressure_rear_bar < 1.9 ? 'critical' : health.tire_pressure_rear_bar < 2.4 ? 'warning' : 'ok';
  const batteryStatus = telemetry.voltage < 11.8 ? 'critical' : telemetry.voltage < 12.4 ? 'warning' : 'ok';

  return (
    <div className="digital-twin-container">
      <div className="digital-twin-header">
        <h3>{data.system.moto_model}</h3>
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
            roll={imu.roll_deg}
            pitch={imu.pitch_deg}
            yaw={imu.yaw_deg}
            speed={telemetry.speed_kmh}
            rpm={telemetry.rpm}
            engineTempStatus={engineTempStatus}
          />
        </Suspense>

        {/* Real-time Overlay Labels */}
        <div className="overlay-label engine-temp" style={{ top: '15%', left: '85%' }}>
          <span className="label">Temp:</span>
          <span className={`value ${engineTempStatus}`}>{telemetry.engine_temp_c}°C</span>
        </div>
        <div className="overlay-label tire-front" style={{ top: '80%', left: '85%' }}>
          <span className="label">Pres F:</span>
          <span className={`value ${frontTireStatus}`}>{health.tire_pressure_front_bar}b</span>
        </div>
        <div className="overlay-label tire-rear" style={{ top: '80%', left: '15%' }}>
          <span className="label">Pres T:</span>
          <span className={`value ${rearTireStatus}`}>{health.tire_pressure_rear_bar}b</span>
        </div>
        
      </div>

      <div className="health-grid">
        <div className={`health-item ${engineTempStatus}`}>
          <div className="icon-wrap"><AlertTriangle size={16} /></div>
          <div className="info">
            <span className="title">Pressão Óleo</span>
            <span className="val">{health.oil_pressure_bar} bar</span>
          </div>
        </div>
        <div className={`health-item ${batteryStatus}`}>
          <div className="icon-wrap"><CheckCircle2 size={16} /></div>
          <div className="info">
            <span className="title">Bateria</span>
            <span className="val">{telemetry.voltage} V</span>
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
    </div>
  );
}
