interface PlaybackControlsProps {
  isPlaying: boolean;
  isPreloading?: boolean;
  playbackSpeed: number;
  disabled: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS = [1, 2, 5, 10] as const;

export function PlaybackControls({
  isPlaying,
  isPreloading = false,
  playbackSpeed,
  disabled,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
}: PlaybackControlsProps) {
  return (
    <div className="playback-controls" style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          className="btn btn-sm btn-primary"
          onClick={onPlay}
          disabled={disabled || isPlaying || isPreloading}
          aria-label="Play trip replay"
          title="Play"
        >
          {isPreloading ? '⏳ A preparar...' : '▶ Play'}
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={onPause}
          disabled={disabled || !isPlaying}
          aria-label="Pause trip replay"
          title="Pause"
        >
          ⏸ Pause
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={onStop}
          disabled={disabled || isPreloading}
          aria-label="Stop trip replay and reset to beginning"
          title="Stop"
        >
          ⏹ Stop
        </button>
      </div>
      
      <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <label htmlFor="playback-speed" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Speed:
        </label>
        <select
          id="playback-speed"
          value={playbackSpeed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          disabled={disabled || isPreloading}
          className="control control-sm"
          aria-label="Playback speed"
          style={{
            minWidth: 60,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {SPEED_OPTIONS.map((speed) => (
            <option key={speed} value={speed}>
              {speed}x
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
