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
    <div className={`px-3 py-2 rounded-xl text-[0.65rem] font-black uppercase tracking-widest text-center border transition-all ${
      active 
        ? "bg-green/10 text-green border-green/20" 
        : "bg-panel text-muted border-border-glass-subtle opacity-40"
    }`}>
      {label}
    </div>
  );
}

export default function StatusCard({ system, safety, health }: StatusCardProps) {
  const evento = system?.event_status ?? "NORMAL";
  
  const eventStyles = {
    NORMAL: "bg-green/10 text-green border-green/20",
    WARNING: "bg-yellow/10 text-yellow border-yellow/20",
    CRITICAL: "bg-red/10 text-red border-red/20"
  }[evento as "NORMAL" | "WARNING" | "CRITICAL"] || "bg-panel text-muted border-border-glass-subtle";

  return (
    <Card title="Estado & Segurança">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-muted opacity-60">
            <AlertTriangle size={14} />
            Evento Atual
          </div>
          <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-center border ${eventStyles}`}>
            {evento.replace(/_/g, " ")}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-muted opacity-60">
            <Shield size={14} />
            Segurança Ativa
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SafetyBadge label="ABS" active={safety?.abs_active ?? false} />
            <SafetyBadge label="TC" active={safety?.tc_active ?? false} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-muted opacity-60">
            <Bike size={14} />
            Informações do Veículo
          </div>
          <div className="flex flex-col gap-2">
            {[
              { key: "Dispositivo", val: system?.device_id ?? "—" },
              { key: "Modelo", val: system?.moto_model ?? "—" },
              { key: "Pneu Frente", val: `${(health?.tire_pressure_front_bar ?? 0).toFixed(1)} bar` },
              { key: "Pneu Trás", val: `${(health?.tire_pressure_rear_bar ?? 0).toFixed(1)} bar` },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between p-3 rounded-xl bg-panel border border-border-glass-subtle">
                <span className="text-[0.65rem] font-bold text-muted uppercase tracking-widest">{row.key}</span>
                <span className="text-sm font-black text-text">{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
