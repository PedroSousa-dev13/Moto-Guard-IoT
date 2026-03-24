import type {
  SystemData,
  ActiveSafety,
  HealthData,
} from "../types/telemetry";
import Card from "./ui/Card";
import { Shield, Bike, AlertTriangle } from 'lucide-react';

interface StatusCardProps {
  system: SystemData | null;
  safety: ActiveSafety | null;
  health: HealthData | null;
}

function SafetyBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`safety-item ${active ? "safety-active" : "safety-inactive"}`}>
      {label}
    </div>
  );
}

export default function StatusCard({ system, safety, health }: StatusCardProps) {
  const evento = system?.event_status ?? "NORMAL";

  return (
    <Card title="Estado & Segurança">
      <div className="status-section">
        <div className="section-label">
          <AlertTriangle size={14} />
          Evento Atual
        </div>
        <div className={`event-status event-${evento}`}>
          {evento.replace(/_/g, " ")}
        </div>
      </div>

      <div className="status-section">
        <div className="section-label">
          <Shield size={14} />
          Segurança Ativa
        </div>
        <div className="safety-grid">
          <SafetyBadge label="ABS" active={safety?.abs_active ?? false} />
          <SafetyBadge label="TC" active={safety?.tc_active ?? false} />
        </div>
      </div>

      <div className="status-section">
        <div className="section-label">
          <Bike size={14} />
          Informações do Veículo
        </div>
        <div className="info-list">
          <div className="info-row">
            <span className="key">Dispositivo</span>
            <span className="val">{system?.device_id ?? "—"}</span>
          </div>
          <div className="info-row">
            <span className="key">Modelo</span>
            <span className="val">{system?.moto_model ?? "—"}</span>
          </div>
          <div className="info-row">
            <span className="key">Pneu Frente</span>
            <span className="val">{(health?.tire_pressure_front_bar ?? 0).toFixed(1)} bar</span>
          </div>
          <div className="info-row">
            <span className="key">Pneu Trás</span>
            <span className="val">{(health?.tire_pressure_rear_bar ?? 0).toFixed(1)} bar</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
