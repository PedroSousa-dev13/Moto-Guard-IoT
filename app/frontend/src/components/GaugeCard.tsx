// =============================================================================
// GaugeCard — Velocidade, RPM, Mudança, Acelerador
// =============================================================================

import type { TelemetryData } from "../types/telemetry";

interface GaugeCardProps {
  data: TelemetryData | null;
}

function speedColor(speed: number): string {
  if (speed > 160) return "var(--red)";
  if (speed > 100) return "var(--yellow)";
  return "var(--green)";
}

export default function GaugeCard({ data }: GaugeCardProps) {
  const speed = Math.round(data?.speed_kmh ?? 0);
  const rpm = Math.round(data?.rpm ?? 0);
  const gear = (data?.gear ?? 0) === 0 ? "N" : data?.gear;
  const throttle = Math.round(data?.throttle_pct ?? 0);

  return (
    <div className="card">
      <h2>🏎️ Motor &amp; Velocidade</h2>
      <div className="gauge-grid">
        <div className="gauge">
          <div className="value" style={{ color: speedColor(speed) }}>
            {speed}
          </div>
          <div className="unit">km/h</div>
          <div className="label">Velocidade</div>
        </div>
        <div className="gauge">
          <div className="value">{rpm}</div>
          <div className="unit">RPM</div>
          <div className="label">Rotações</div>
        </div>
        <div className="gauge">
          <div className="value">{gear}</div>
          <div className="unit">&nbsp;</div>
          <div className="label">Mudança</div>
        </div>
        <div className="gauge">
          <div className="value">{throttle}</div>
          <div className="unit">%</div>
          <div className="label">Acelerador</div>
        </div>
      </div>
    </div>
  );
}
