import type { IMUData } from "../types/telemetry";
import Card from "./ui/Card";
import { Compass, MoveHorizontal, MoveVertical, Activity } from 'lucide-react';

interface IMUCardProps {
  data: IMUData | null;
  sources?: {
    roll?: boolean;
    pitch?: boolean;
    yaw?: boolean;
    gForce?: boolean;
  };
}

function rollColor(roll: number): string {
  const abs = Math.abs(roll);
  if (abs > 45) return "var(--red)";
  if (abs > 30) return "var(--yellow)";
  return "var(--text)";
}

function gForceColor(g: number): string {
  if (g > 2) return "var(--red)";
  if (g > 1.5) return "var(--yellow)";
  return "var(--text)";
}

export default function IMUCard({ data, sources }: IMUCardProps) {
  const roll = data?.roll_deg ?? 0;
  const pitch = data?.pitch_deg ?? 0;
  const yaw = data?.yaw_deg ?? 0;
  const gForce = data?.g_force ?? 0;

  return (
    <Card title="IMU — Inércia">
      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: <MoveHorizontal size={14} />, val: roll.toFixed(1), unit: "°", label: "Roll", color: rollColor(roll), isFile: sources?.roll ?? false },
          { icon: <MoveVertical size={14} />, val: pitch.toFixed(1), unit: "°", label: "Pitch", isFile: sources?.pitch ?? false },
          { icon: <Compass size={14} />, val: yaw.toFixed(1), unit: "°", label: "Yaw", isFile: sources?.yaw ?? false },
          { icon: <Activity size={14} />, val: gForce.toFixed(2), unit: "G", label: "G-Force", color: gForceColor(gForce), isFile: sources?.gForce ?? false },
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
