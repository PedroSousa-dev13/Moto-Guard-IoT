import React from 'react';
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
      <div className="gauge-grid">
        <div className="gauge">
          <div className="gauge-icon"><MoveHorizontal size={16} /></div>
          <div className="value" style={{ color: rollColor(roll) }}>
            {roll.toFixed(1)}
          </div>
          <div className="unit">°</div>
          <div className="label">Roll</div>
        </div>
        <div className="gauge">
          <div className="gauge-icon"><MoveVertical size={16} /></div>
          <div className="value">{pitch.toFixed(1)}</div>
          <div className="unit">°</div>
          <div className="label">Pitch</div>
        </div>
        <div className="gauge">
          <div className="gauge-icon"><Compass size={16} /></div>
          <div className="value">{yaw.toFixed(1)}</div>
          <div className="unit">°</div>
          <div className="label">Yaw</div>
        </div>
        <div className="gauge">
          <div className="gauge-icon"><Activity size={16} /></div>
          <div className="value" style={{ color: gForceColor(gForce) }}>
            {gForce.toFixed(2)}
          </div>
          <div className="unit">G</div>
          <div className="label">G-Force</div>
        </div>
      </div>
    </Card>
  );
}
