import { useCallback, useRef } from 'react';

interface PlaybackSliderProps {
  value: number;
  max: number;
  currentTime: string;
  elapsedTime: string;
  totalDuration: string;
  disabled: boolean;
  onChange: (index: number) => void;
  disabledMessage?: string;
}

export function PlaybackSlider({
  value,
  max,
  currentTime,
  elapsedTime,
  totalDuration,
  disabled,
  onChange,
  disabledMessage = "Sem dados de viagem para reprodução"
}: PlaybackSliderProps) {
  const lastCallRef = useRef<number>(0);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const now = Date.now();
      if (now - lastCallRef.current >= 16) {
        lastCallRef.current = now;
        onChange(parseInt(e.target.value, 10));
      }
    },
    [onChange]
  );

  const progress = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="playback-slider-container" style={{ marginTop: 14 }}>
      {/* Header row: label + clock time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Reprodução
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {currentTime}
        </span>
      </div>

      {/* Progress bar track (custom, behind the native range) */}
      <div style={{ position: 'relative', marginBottom: 4 }}>
        {/* Background track */}
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          height: 4, transform: 'translateY(-50%)',
          background: 'rgba(255,255,255,0.08)', borderRadius: 2, pointerEvents: 'none',
        }} />
        {/* Filled portion */}
        <div style={{
          position: 'absolute', top: '50%', left: 0,
          width: `${progress}%`, height: 4, transform: 'translateY(-50%)',
          background: 'linear-gradient(90deg, #3b82f6, #eab308)',
          borderRadius: 2, pointerEvents: 'none', transition: 'width 0.1s linear',
        }} />
        <input
          id="playback-slider"
          type="range"
          min={0}
          max={max}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          aria-label="Slider de reprodução da viagem"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${elapsedTime} de ${totalDuration}`}
          style={{
            position: 'relative', width: '100%', height: 20,
            background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1, margin: 0,
            // hide default track, keep thumb
            WebkitAppearance: 'none', appearance: 'none',
          }}
        />
      </div>

      {/* Footer row: elapsed / total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
          {elapsedTime || '0:00'}
        </span>
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
          {totalDuration || '—'}
        </span>
      </div>

      {disabled && disabledMessage && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
          {disabledMessage}
        </div>
      )}
    </div>
  );
}
