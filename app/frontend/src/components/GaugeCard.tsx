import React from 'react';
import type { TelemetryData } from "../types/telemetry";
import Card from "./ui/Card";
import { Gauge, Zap, Disc, ArrowUpCircle } from 'lucide-react';

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
    <Card title="Motor & Velocidade">
      <div className="gauge-grid">
        <div className="gauge" title="Velocidade atual em km/h. Amarelo acima de 100 km/h, vermelho acima de 160 km/h.">
          <div className="gauge-icon"><Gauge size={16} /></div>
          <div className="value" style={{ color: speedColor(speed) }}>
            {speed}
          </div>
          <div className="unit">km/h</div>
          <div className="label">Velocidade</div>
        </div>
        <div className="gauge" title="Rotações por minuto do motor. Valores altos indicam aceleração intensa ou mudança tardia.">
          <div className="gauge-icon"><Zap size={16} /></div>
          <div className="value">{rpm}</div>
          <div className="unit">RPM</div>
          <div className="label">Rotações</div>
        </div>
        <div className="gauge" title="Mudança de velocidade atual. N = ponto morto (mota parada). 1 a 6 são as mudanças normais.">
          <div className="gauge-icon"><Disc size={16} /></div>
          <div className="value">{gear}</div>
          <div className="unit">&nbsp;</div>
          <div className="label">Mudança</div>
        </div>
        <div className="gauge" title="Percentagem de abertura do acelerador (0% = fechado, 100% = fundo). Reflete a intenção de aceleração do piloto.">
          <div className="gauge-icon"><ArrowUpCircle size={16} /></div>
          <div className="value">{throttle}</div>
          <div className="unit">%</div>
          <div className="label">Acelerador</div>
        </div>
      </div>
    </Card>
  );
}
