// =============================================================================
// TempVoltCard — Temperatura, Voltagem, Pressão Óleo, Travões
// =============================================================================

import type { TelemetryData, HealthData } from "../types/telemetry";

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
}

function Bar({ name, value, pct, color }: BarProps) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const bg = color ?? barColor(clampedPct);

  return (
    <div className="bar-container">
      <div className="bar-label">
        <span className="name">{name}</span>
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
    <div className="card">
      <h2>🌡️ Temperatura &amp; Voltagem</h2>
      <Bar name="Temp. Motor" value={`${temp.toFixed(1)} °C`} pct={(temp / 130) * 100} />
      <Bar name="Voltagem" value={`${volt.toFixed(1)} V`} pct={(volt / 16) * 100} color={voltColor} />
      <Bar name="Pressão Óleo" value={`${oil.toFixed(1)} bar`} pct={(oil / 6) * 100} color={oil < 2 ? "var(--red)" : "var(--green)"} />
      <Bar name="Travão Frente" value={`${Math.round(brkF)} %`} pct={brkF} color="var(--accent)" />
      <Bar name="Travão Trás" value={`${Math.round(brkR)} %`} pct={brkR} color="var(--accent)" />
    </div>
  );
}
