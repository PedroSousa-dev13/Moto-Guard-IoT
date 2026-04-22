import type { IMUData } from "../types/telemetry";
import Card from "./ui/Card";
import { Compass, MoveHorizontal, MoveVertical, Activity } from 'lucide-react';

interface IMUCardProps {
  data: IMUData | null;
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

export default function IMUCard({ data }: IMUCardProps) {
  const roll = data?.roll_deg ?? 0;
  const pitch = data?.pitch_deg ?? 0;
  const yaw = data?.yaw_deg ?? 0;
  const gForce = data?.g_force ?? 0;

  return (
    <Card title="IMU — Inércia">
      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: <MoveHorizontal size={16} />, val: roll.toFixed(1), unit: "°", label: "Roll", color: rollColor(roll), title: "Inclinação lateral da mota." },
          { icon: <MoveVertical size={16} />, val: pitch.toFixed(1), unit: "°", label: "Pitch", color: "var(--text)", title: "Inclinação frontal/traseira." },
          { icon: <Compass size={16} />, val: yaw.toFixed(1), unit: "°", label: "Yaw", color: "var(--text)", title: "Orientação da mota." },
          { icon: <Activity size={16} />, val: gForce.toFixed(2), unit: "G", label: "G-Force", color: gForceColor(gForce), title: "Força gravitacional total." },
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
