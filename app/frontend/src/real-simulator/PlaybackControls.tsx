import { Play, Pause, Square } from 'lucide-react';
import { formatTime } from './utils';

type PlaybackState = 'idle' | 'playing' | 'paused' | 'stopped';
type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4;

interface PlaybackControlsProps {
  playbackState: PlaybackState;
  playbackSpeed: PlaybackSpeed;
  currentTimeSec: number;
  totalDurationSec: number;
  emittedCount: number;
  deviceId: string;
  disabled: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onDeviceIdChange: (id: string) => void;
  onSeek: (timeSec: number) => void;
}

const SPEED_OPTIONS: PlaybackSpeed[] = [0.25, 0.5, 1, 2, 4];

export function PlaybackControls({
  playbackState,
  playbackSpeed,
  currentTimeSec,
  totalDurationSec,
  emittedCount,
  deviceId,
  disabled,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  onDeviceIdChange,
  onSeek,
}: PlaybackControlsProps) {
  const isPlaying = playbackState === 'playing';
  const progress = totalDurationSec > 0 ? currentTimeSec / totalDurationSec : 0;

  return (
    <div className="playback-controls">
      {/* Transport buttons */}
      <div className="playback-controls__transport">
        {isPlaying ? (
          <button
            className="playback-controls__btn"
            onClick={onPause}
            disabled={disabled}
            aria-label="Pause"
          >
            <Pause size={20} />
          </button>
        ) : (
          <button
            className="playback-controls__btn playback-controls__btn--play"
            onClick={onPlay}
            disabled={disabled}
            aria-label="Play"
          >
            <Play size={20} />
          </button>
        )}
        <button
          className="playback-controls__btn"
          onClick={onStop}
          disabled={disabled || playbackState === 'idle'}
          aria-label="Stop"
        >
          <Square size={20} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="playback-controls__progress">
        <input
          type="range"
          min={0}
          max={totalDurationSec || 0}
          step={0.1}
          value={currentTimeSec}
          disabled={disabled}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          aria-label="Seek"
          style={{ width: '100%' }}
        />
        <div className="playback-controls__time">
          <span>{formatTime(currentTimeSec)}</span>
          <span>/</span>
          <span>{formatTime(totalDurationSec)}</span>
        </div>
      </div>

      {/* Speed selector */}
      <div className="playback-controls__speed">
        <label htmlFor="playback-speed">Velocidade</label>
        <select
          id="playback-speed"
          value={playbackSpeed}
          disabled={disabled}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value) as PlaybackSpeed)}
        >
          {SPEED_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </div>

      {/* Device ID */}
      <div className="playback-controls__device">
        <label htmlFor="device-id">Device ID</label>
        <input
          id="device-id"
          type="text"
          value={deviceId}
          placeholder="REAL-SIM-001"
          disabled={isPlaying}
          onChange={(e) => onDeviceIdChange(e.target.value)}
        />
      </div>

      {/* Emitted counter */}
      <div className="playback-controls__counter">
        <span>Payloads emitidos:</span>
        <strong>{emittedCount}</strong>
      </div>
    </div>
  );
}
