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
      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: <Gauge size={16} />, val: speed, unit: "km/h", label: "Velocidade", color: speedColor(speed), title: "Velocidade atual em km/h." },
          { icon: <Zap size={16} />, val: rpm, unit: "RPM", label: "Rotações", color: "var(--text)", title: "Rotações por minuto do motor." },
          { icon: <Disc size={16} />, val: gear, unit: " ", label: "Mudança", color: "var(--text)", title: "Mudança de velocidade atual." },
          { icon: <ArrowUpCircle size={16} />, val: throttle, unit: "%", label: "Acelerador", color: "var(--text)", title: "Abertura do acelerador." },
        ].map((g, idx) => (
          <div key={idx} className="bg-panel border border-border-glass-subtle rounded-2xl p-4 flex flex-col items-center text-center transition-all hover:bg-panel-hover" title={g.title}>
            <div className="text-muted mb-2 opacity-50">{g.icon}</div>
            <div className="text-2xl font-black tracking-tighter tabular-nums" style={{ color: g.color }}>
              {g.val}
            </div>
            <div className="text-[0.6rem] font-bold text-muted uppercase tracking-widest opacity-60">{g.unit}</div>
            <div className="text-[0.55rem] font-black text-muted uppercase tracking-[0.2em] mt-2 opacity-40">{g.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
