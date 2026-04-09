import React from 'react';

export interface TelemetryData {
  rpm: number;
  gear: number;
  throttle_pct: number;
  engine_temp_c: number;
  voltage: number;
  roll_deg: number;
  pitch_deg: number;
  yaw_deg: number;
  g_force: number;
  speed_kmh: number;
}

export interface TelemetryOverlayProps {
  data: TelemetryData;
  visible: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity?: number;
  displayedFields?: (keyof TelemetryData)[];
}

const DEFAULT_DISPLAYED_FIELDS: (keyof TelemetryData)[] = [
  'speed_kmh', 'rpm', 'gear', 'throttle_pct', 'engine_temp_c', 'voltage', 'g_force'
];

export default function TelemetryOverlay({
  data,
  visible,
  position = 'top-right',
  opacity = 0.8,
  displayedFields = DEFAULT_DISPLAYED_FIELDS
}: TelemetryOverlayProps) {
  if (!visible) return null;

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  const formatValue = (key: keyof TelemetryData, value: number): string => {
    switch (key) {
      case 'speed_kmh':
        return `${value.toFixed(0)} km/h`;
      case 'rpm':
        return `${value.toLocaleString()} RPM`;
      case 'gear':
        return `Gear ${value}`;
      case 'throttle_pct':
        return `${value}%`;
      case 'engine_temp_c':
        return `${value}°C`;
      case 'voltage':
        return `${value.toFixed(1)}V`;
      case 'roll_deg':
      case 'pitch_deg':
      case 'yaw_deg':
        return `${value.toFixed(1)}°`;
      case 'g_force':
        return `${value.toFixed(2)}G`;
      default:
        return value.toString();
    }
  };

  const getFieldLabel = (key: keyof TelemetryData): string => {
    const labels: Record<keyof TelemetryData, string> = {
      speed_kmh: 'Speed',
      rpm: 'RPM',
      gear: 'Gear',
      throttle_pct: 'Throttle',
      engine_temp_c: 'Engine Temp',
      voltage: 'Voltage',
      roll_deg: 'Roll',
      pitch_deg: 'Pitch',
      yaw_deg: 'Yaw',
      g_force: 'G-Force'
    };
    return labels[key] || key;
  };

  return (
    <div
      className={`absolute ${positionClasses[position]} bg-black text-white p-3 rounded-lg font-mono text-sm pointer-events-none z-10`}
      style={{ opacity }}
    >
      <div className="grid grid-cols-2 gap-2 min-w-[200px]">
        {displayedFields.map((field) => (
          <div key={field} className="flex justify-between">
            <span className="text-gray-300">{getFieldLabel(field)}:</span>
            <span className="text-white font-bold ml-2">
              {formatValue(field, data[field])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}