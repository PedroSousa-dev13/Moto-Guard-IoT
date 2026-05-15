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
}

const AnimatedGauge: React.FC<AnimatedGaugeProps> = ({
  value,
  min = 0,
  max,
  label,
  unit,
  color,
  size = 130,
  strokeWidth = 10,
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

  return (
    <div className="flex flex-col items-center justify-center relative group" style={{ width: size, height: size }}>
      {/* Glow effect */}
      <div 
        className="absolute inset-4 rounded-full blur-[20px] transition-all duration-700 opacity-20 group-hover:opacity-40"
        style={{ backgroundColor: color }}
      />
      
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-[225deg] drop-shadow-2xl"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
        />
        
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{
            filter: `drop-shadow(0 0 5px ${color})`,
          }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center mt-1">
        <div className="flex items-baseline gap-0.5">
          <span className="text-3xl font-black text-text tracking-tighter tabular-nums leading-none">
            {Math.round(value)}
          </span>
        </div>
        <span className="text-[0.6rem] font-bold text-muted uppercase tracking-widest mt-1 opacity-60">
          {unit}
        </span>
      </div>
      
      {/* Bottom label */}
      <div className="absolute -bottom-1 text-[0.55rem] font-black text-muted uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100 group-hover:text-text transition-all">
        {label}
      </div>
    </div>
  );
};

export default AnimatedGauge;
