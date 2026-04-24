import type { TelemetryData } from "../types/telemetry";
import Card from "./ui/Card";
import { Gauge, Zap, Disc, ArrowUpCircle } from 'lucide-react';

interface GaugeCardProps {
  data: TelemetryData | null;
  sources?: {
    speed?: boolean;
    rpm?: boolean;
    gear?: boolean;
    throttle?: boolean;
  };
}

function speedColor(speed: number): string {
  if (speed > 160) return "var(--red)";
  if (speed > 100) return "var(--yellow)";
  return "var(--green)";
}

export default function GaugeCard({ data, sources }: GaugeCardProps) {
  const speed = Math.round(data?.speed_kmh ?? 0);
  const rpm = Math.round(data?.rpm ?? 0);
  const gear = (data?.gear ?? 0) === 0 ? "N" : data?.gear;
  const throttle = Math.round(data?.throttle_pct ?? 0);

  return (
    <Card title="Motor & Velocidade">
      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: <Gauge size={14} />, val: speed, unit: "km/h", label: "Velocidade", color: speedColor(speed), isFile: sources?.speed ?? true },
          { icon: <Zap size={14} />, val: rpm, unit: "RPM", label: "Rotações", isFile: sources?.rpm ?? false },
          { icon: <Disc size={14} />, val: gear, unit: " ", label: "Mudança", isFile: sources?.gear ?? false },
          { icon: <ArrowUpCircle size={14} />, val: throttle, unit: "%", label: "Acelerador", isFile: sources?.throttle ?? false },
        ].map((g, idx) => (
          <div key={idx} className="bg-panel/40 border border-border-glass-subtle rounded-2xl p-4 flex flex-col items-center text-center transition-all hover:bg-panel hover:border-border-glass group/item relative overflow-hidden">
            {/* Background Glow */}
            <div className={`absolute -bottom-4 -right-4 w-12 h-12 blur-2xl opacity-10 rounded-full transition-opacity group-hover:opacity-20 ${g.isFile ? 'bg-green' : 'bg-blue'}`} />
            
            <div className="flex items-center gap-1.5 mb-2 opacity-40 group-hover:opacity-60 transition-opacity">
              <div className={`w-1 h-1 rounded-full ${g.isFile ? 'bg-green' : 'bg-blue'}`} />
              <span className="text-[0.5rem] font-black uppercase tracking-widest text-muted">{g.label}</span>
            </div>

            <div className="text-2xl font-black tracking-tighter tabular-nums mb-0.5" style={{ color: g.color || 'var(--text)' }}>
              {g.val}
            </div>
            <div className="text-[0.6rem] font-bold text-muted uppercase tracking-widest opacity-40">{g.unit}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
