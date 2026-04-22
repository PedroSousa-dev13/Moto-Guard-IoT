import { Play, Pause, Square, Bike } from 'lucide-react';
import { formatTime } from './utils';
import type { Motorcycle } from '../types';

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
  motorcycles?: Motorcycle[];
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onDeviceIdChange: (id: string) => void;
  onSeek: (timeSec: number) => void;
  onMotorcycleChange?: (m: Motorcycle) => void;
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
  motorcycles = [],
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  onDeviceIdChange,
  onSeek,
  onMotorcycleChange,
}: PlaybackControlsProps) {
  const isPlaying = playbackState === 'playing';
  const progress = totalDurationSec > 0 ? currentTimeSec / totalDurationSec : 0;

  const handleMotorcycleChange = (id: string) => {
    const moto = motorcycles.find((m) => m.id === id);
    if (moto) {
      if (onMotorcycleChange) onMotorcycleChange(moto);
      if (moto.deviceId) onDeviceIdChange(moto.deviceId);
    }
  };

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

      {/* Motorcycle / Device ID */}
      <div className="playback-controls__device">
        <label htmlFor="device-select">
          <Bike size={12} style={{ marginRight: 4 }} />
          Mota da Garagem
        </label>
        {motorcycles.length > 0 ? (
          <select
            id="device-select"
            disabled={isPlaying || disabled}
            value={motorcycles.find(m => m.deviceId === deviceId)?.id || ""}
            onChange={(e) => handleMotorcycleChange(e.target.value)}
          >
            <option value="" disabled>— Selecionar Mota —</option>
            {motorcycles.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.deviceId})
              </option>
            ))}
          </select>
        ) : (
          <input
            id="device-id"
            type="text"
            value={deviceId}
            placeholder="REAL-SIM-001"
            disabled={isPlaying || disabled}
            onChange={(e) => onDeviceIdChange(e.target.value)}
          />
        )}
      </div>

      {/* Emitted counter */}
      <div className="playback-controls__counter">
        <span>Payloads emitidos:</span>
        <strong>{emittedCount}</strong>
      </div>
    </div>
  );
}
