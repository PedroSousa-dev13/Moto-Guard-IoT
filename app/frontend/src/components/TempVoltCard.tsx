import { ReactNode } from 'react';
import type { TelemetryData, HealthData } from "../types/telemetry";
import Card from "./ui/Card";
import { Thermometer, Zap, Droplets, CircleDot } from 'lucide-react';

interface TempVoltCardProps {
  telemetry: TelemetryData | null;
  health: HealthData | null;
}

/** Cor dinâmica da barra baseada na percentagem */
function barColor(pct: number): string {
  if (pct > 85) return "var(--red)";
  if (pct > 65) return "var(--yellow)";
  return "var(--green)";
}

interface BarProps {
  name: string;
  value: string;
  pct: number;
  color?: string;
  icon?: ReactNode;
}

function Bar({ name, value, pct, color, icon }: BarProps) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const bg = color ?? barColor(clampedPct);

  return (
    <div className="bar-container">
      <div className="bar-label">
        <span className="name">
          {icon && <span className="bar-icon">{icon}</span>}
          {name}
        </span>
        <span className="val">{value}</span>
      </div>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{ width: `${clampedPct}%`, background: bg }}
        />
      </div>
    </div>
  );
}

export default function TempVoltCard({ telemetry, health }: TempVoltCardProps) {
  const temp = telemetry?.engine_temp_c ?? 0;
  const volt = telemetry?.voltage ?? 0;
  const oil = health?.oil_pressure_bar ?? 0;
  const brkF = telemetry?.brake_front_pct ?? 0;
  const brkR = telemetry?.brake_rear_pct ?? 0;

  const voltColor =
    volt < 11.5 ? "var(--red)" : volt < 12.5 ? "var(--yellow)" : "var(--green)";

  return (
    <Card title="Saúde & Fluidos">
      <div className="bar-list">
        <Bar 
          icon={<Thermometer size={14} />}
          name="Temp. Motor" 
          value={`${temp.toFixed(1)} °C`} 
          pct={(temp / 130) * 100} 
        />
        <Bar 
          icon={<Zap size={14} />}
          name="Voltagem" 
          value={`${volt.toFixed(1)} V`} 
          pct={(volt / 16) * 100} 
          color={voltColor} 
        />
        <Bar 
          icon={<Droplets size={14} />}
          name="Pressão Óleo" 
          value={`${oil.toFixed(1)} bar`} 
          pct={(oil / 6) * 100} 
          color={oil < 2 ? "var(--red)" : "var(--green)"} 
        />
        <Bar 
          icon={<CircleDot size={14} />}
          name="Travão Frente" 
          value={`${Math.round(brkF)} %`} 
          pct={brkF} 
          color="var(--accent)" 
        />
        <Bar 
          icon={<CircleDot size={14} />}
          name="Travão Trás" 
          value={`${Math.round(brkR)} %`} 
          pct={brkR} 
          color="var(--accent)" 
        />
      </div>
    </Card>
  );
}
