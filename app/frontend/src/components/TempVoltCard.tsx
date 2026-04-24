import { ReactNode } from 'react';
import type { TelemetryData, HealthData } from "../types/telemetry";
import Card from "./ui/Card";
import { Thermometer, Zap, Droplets, CircleDot } from 'lucide-react';

interface TempVoltCardProps {
  telemetry: TelemetryData | null;
  health: HealthData | null;
  sources?: {
    engineTemp?: boolean;
    voltage?: boolean;
    oilPressure?: boolean;
    brakeFront?: boolean;
    brakeRear?: boolean;
  };
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
  isFile?: boolean;
}

function Bar({ name, value, pct, color, icon, isFile }: BarProps) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const bg = color ?? barColor(clampedPct);

  return (
    <div className="flex flex-col gap-2 relative group/bar">
      <div className="flex justify-between items-center text-[0.6rem] font-black uppercase tracking-widest">
        <span className="flex items-center gap-2 text-muted opacity-40 group-hover:opacity-60 transition-opacity">
          <div className={`w-1 h-1 rounded-full ${isFile ? 'bg-green' : 'bg-blue'}`} />
          {icon && <span>{icon}</span>}
          {name}
        </span>
        <span className="text-text tabular-nums font-black">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-panel/30 rounded-full overflow-hidden border border-border-glass-subtle group-hover:border-border-glass transition-colors">
        <div
          className="h-full transition-all duration-1000 ease-out rounded-full shadow-[0_0_8px_rgba(0,0,0,0.05)]"
          style={{ width: `${clampedPct}%`, background: bg }}
        />
      </div>
    </div>
  );
}

export default function TempVoltCard({ telemetry, health, sources }: TempVoltCardProps) {
  const temp = telemetry?.engine_temp_c ?? 0;
  const volt = telemetry?.voltage ?? 0;
  const oil = health?.oil_pressure_bar ?? 0;
  const brkF = telemetry?.brake_front_pct ?? 0;
  const brkR = telemetry?.brake_rear_pct ?? 0;

  const voltColor =
    volt < 11.5 ? "var(--red)" : volt < 12.5 ? "var(--yellow)" : "var(--green)";

  return (
    <Card title="Saúde & Fluidos">
      <div className="flex flex-col gap-6">
        <Bar 
          icon={<Thermometer size={12} />}
          name="Temp. Motor" 
          value={`${temp.toFixed(1)} °C`} 
          pct={(temp / 130) * 100} 
          isFile={sources?.engineTemp ?? false}
        />
        <Bar 
          icon={<Zap size={12} />}
          name="Voltagem" 
          value={`${volt.toFixed(1)} V`} 
          pct={(volt / 16) * 100} 
          color={voltColor} 
          isFile={sources?.voltage ?? false}
        />
        <Bar 
          icon={<Droplets size={12} />}
          name="Pressão Óleo" 
          value={`${oil.toFixed(1)} bar`} 
          pct={(oil / 6) * 100} 
          color={oil < 2 ? "var(--red)" : "var(--green)"} 
          isFile={sources?.oilPressure ?? false}
        />
        <Bar 
          icon={<CircleDot size={12} />}
          name="Travão Frente" 
          value={`${Math.round(brkF)} %`} 
          pct={brkF} 
          color="var(--accent)" 
          isFile={sources?.brakeFront ?? false}
        />
        <Bar 
          icon={<CircleDot size={12} />}
          name="Travão Trás" 
          value={`${Math.round(brkR)} %`} 
          pct={brkR} 
          color="var(--accent)" 
          isFile={sources?.brakeRear ?? false}
        />
      </div>
    </Card>
  );
}
