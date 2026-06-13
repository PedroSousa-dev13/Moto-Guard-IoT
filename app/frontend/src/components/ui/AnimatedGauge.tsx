import { useMemo } from 'react';

interface AnimatedGaugeProps {
  value: number;
  min?: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  size?: number;
  strokeWidth?: number;
  decimals?: number;
}

const AnimatedGauge: React.FC<AnimatedGaugeProps> = ({
  value,
  min = 0,
  max,
  label,
  unit,
  color,
  size = 130,
  strokeWidth = 8,
  decimals = 0,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Normalized percentage (0 to 1)
  const percentage = useMemo(() => {
    const p = (value - min) / (max - min);
    return Math.min(Math.max(p, 0), 1);
  }, [value, min, max]);

  // Dash offset: full circumference * (1 - percentage)
  // We only use 75% of the circle for the gauge (from -225deg to 45deg)
  const arcLength = 0.75;
  const strokeDasharray = `${circumference * arcLength} ${circumference}`;
  const offset = circumference * arcLength * (1 - percentage);

  // Calculate coordinates of the glowing dot at the end of progress arc
  const localAngle = percentage * 270; // 270 degrees total arc
  const localRad = (localAngle * Math.PI) / 180;
  const dotX = size / 2 + radius * Math.cos(localRad);
  const dotY = size / 2 + radius * Math.sin(localRad);

  const gradId = `gauge-grad-${color.replace(/[()#,\s]+/g, '-')}`;

  return (
    <div className="flex flex-col items-center justify-center relative group" style={{ width: size, height: size }}>
      {/* Background radial glow */}
      <div 
        className="absolute inset-4 rounded-full blur-[24px] transition-all duration-700 opacity-10 group-hover:opacity-25"
        style={{ backgroundColor: color }}
      />
      
      {/* Inner glass panel */}
      <div className="absolute rounded-full border border-white/[0.03] bg-white/[0.01] backdrop-blur-[1px]" style={{ width: size - 20, height: size - 20 }} />

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-[225deg] drop-shadow-2xl overflow-visible"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity={0.6} />
            <stop offset="100%" stopColor={color} stopOpacity={1} />
          </linearGradient>
        </defs>

        {/* Outer subtle boundary line */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius + 4}
          fill="none"
          stroke="rgba(255, 255, 255, 0.02)"
          strokeWidth={1}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
        />

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.04)"
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
        />
        
        {/* Scale Ticks (Cockpit feel) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius - 6}
          fill="none"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth={2}
          strokeDasharray="1 5"
          strokeDashoffset={2}
          className="transition-opacity opacity-40 group-hover:opacity-70"
        />

        {/* Dynamic Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-out"
          style={{
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />

        {/* Glow bead pointer at the end of progress */}
        {percentage > 0.01 && (
          <circle
            cx={dotX}
            cy={dotY}
            r={strokeWidth / 2 + 1}
            fill="#ffffff"
            style={{
              filter: `drop-shadow(0 0 4px ${color})`,
            }}
            className="transition-all duration-300 ease-out"
          />
        )}
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center mt-1">
        <div className="flex items-baseline gap-0.5">
          <span className="text-3xl font-black text-text tracking-tighter tabular-nums leading-none">
            {value.toFixed(decimals)}
          </span>
        </div>
        <span className="text-[0.65rem] font-black text-muted uppercase tracking-widest mt-1.5 group-hover:opacity-80 transition-opacity">
          {unit}
        </span>
      </div>
      
      {/* Bottom label */}
      <div className="absolute -bottom-1 text-[0.55rem] font-black text-muted uppercase tracking-[0.2em] group-hover:opacity-100 group-hover:text-text transition-all">
        {label}
      </div>
    </div>
  );
};

export default AnimatedGauge;
