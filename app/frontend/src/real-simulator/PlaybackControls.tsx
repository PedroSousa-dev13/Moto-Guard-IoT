import { useState, useEffect } from 'react';
import { Play, Pause, Square, Bike } from 'lucide-react';
import { formatTime } from './utils';
import type { Motorcycle, MotorcycleProfile } from '../types';

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
  profiles?: MotorcycleProfile[];
  onProfileChange?: (p: MotorcycleProfile) => void;
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
  profiles = [],
  onProfileChange,
}: PlaybackControlsProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("motoguard_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleSidebarToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.collapsed === 'boolean') {
        setSidebarCollapsed(customEvent.detail.collapsed);
      }
    };
    window.addEventListener('motoguard_sidebar_toggle', handleSidebarToggle);
    return () => {
      window.removeEventListener('motoguard_sidebar_toggle', handleSidebarToggle);
    };
  }, []);

  const isPlaying = playbackState === 'playing';
  const progress = totalDurationSec > 0 ? currentTimeSec / totalDurationSec : 0;

  const handleMotorcycleChange = (id: string) => {
    const moto = motorcycles.find((m) => m.id === id);
    if (moto) {
      if (onMotorcycleChange) onMotorcycleChange(moto);
      if (moto.deviceId) onDeviceIdChange(moto.deviceId);
    }
  };
  
  const handleProfileChange = (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    if (profile && onProfileChange) {
      onProfileChange(profile);
    }
  };

  return (
    <div
      className={`fixed bottom-0 right-0 z-[100] px-4 md:px-8 pb-[5px] pointer-events-none flex flex-col items-center transition-all duration-300 ${
        sidebarCollapsed ? "left-0" : "left-0 md:left-72"
      }`}
    >
      <div className="w-full max-w-[1250px] border rounded-[2.5rem] player-bar-container backdrop-blur-2xl px-8 py-4 flex flex-col md:flex-row items-center gap-6 shadow-2xl animate-fade-in pointer-events-auto v2-debug-indicator">
      {/* Transport buttons */}
      <div className="flex items-center gap-3">
        {isPlaying ? (
          <button
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-panel border border-border-glass-subtle text-muted hover:text-text hover:bg-panel-hover transition-all shadow-inner active:scale-95"
            onClick={onPause}
            disabled={disabled}
            aria-label="Pause"
          >
            <Pause size={24} fill="currentColor" />
          </button>
        ) : (
          <button
            className="w-14 h-14 flex items-center justify-center rounded-2xl bg-accent text-white shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100"
            onClick={onPlay}
            disabled={disabled}
            aria-label="Play"
          >
            <Play size={28} fill="white" />
          </button>
        )}
        <button
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-panel border border-border-glass-subtle text-muted hover:text-red hover:bg-red/10 transition-all shadow-inner active:scale-95 disabled:opacity-30"
          onClick={onStop}
          disabled={disabled || playbackState === 'idle' || playbackState === 'stopped'}
          aria-label="Stop"
        >
          <Square size={20} fill="currentColor" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex-1 flex flex-col gap-2 w-full">
        <div className="relative group">
          <input
            type="range"
            min={0}
            max={totalDurationSec || 0}
            step={0.1}
            value={currentTimeSec}
            disabled={disabled}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            aria-label="Seek"
            className="w-full h-2 bg-panel rounded-lg appearance-none cursor-pointer accent-accent"
          />
        </div>
        <div className="flex justify-between items-center text-[0.65rem] font-black uppercase tracking-widest text-muted">
          <span>{formatTime(currentTimeSec)}</span>
          <span className="opacity-40">{formatTime(totalDurationSec)}</span>
        </div>
      </div>

      {/* Speed selector */}
      <div className="flex flex-col gap-2 min-w-[100px]">
        <label className="text-[0.6rem] font-black uppercase tracking-widest text-muted opacity-60">Velocidade</label>
        <div className="relative">
          <select
            className="w-full bg-panel border border-border-glass-subtle rounded-xl px-3 py-2 text-xs font-black text-text uppercase tracking-widest outline-none cursor-pointer hover:bg-panel-hover transition-colors appearance-none"
            value={playbackSpeed}
            disabled={disabled}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value) as PlaybackSpeed)}
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s} className="bg-surface">
                {s}×
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Motorcycle / Profile Selector */}
      <div className="flex flex-col gap-2 min-w-[200px]">
        <label className="text-[0.6rem] font-black uppercase tracking-widest text-muted opacity-60 flex items-center gap-1.5">
          <Bike size={14} /> {profiles.length > 0 ? "[V2] Perfil da Mota" : "Mota da Garagem"}
        </label>
        {profiles.length > 0 ? (
          <select
            className="w-full bg-panel border border-border-glass-subtle rounded-xl px-3 py-2 text-xs font-black text-text uppercase tracking-widest outline-none cursor-pointer hover:bg-panel-hover transition-colors appearance-none"
            disabled={isPlaying || disabled}
            value={profiles.find(p => p.name === deviceId)?.id || ""} // Note: using deviceId as a proxy or just need a way to track selected
            onChange={(e) => handleProfileChange(e.target.value)}
          >
            <option value="" disabled className="bg-surface">— Selecionar Perfil —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id} className="bg-surface">
                {p.name}
              </option>
            ))}
          </select>
        ) : motorcycles.length > 0 ? (
          <select
            className="w-full bg-panel border border-border-glass-subtle rounded-xl px-3 py-2 text-xs font-black text-text uppercase tracking-widest outline-none cursor-pointer hover:bg-panel-hover transition-colors appearance-none"
            disabled={isPlaying || disabled}
            value={motorcycles.find(m => m.deviceId === deviceId)?.id || ""}
            onChange={(e) => handleMotorcycleChange(e.target.value)}
          >
            <option value="" disabled className="bg-surface">— Selecionar Mota —</option>
            {motorcycles.map((m) => (
              <option key={m.id} value={m.id} className="bg-surface">
                {m.name} ({m.deviceId})
              </option>
            ))}
          </select>
        ) : (
          <input
            className="w-full bg-panel border border-border-glass-subtle rounded-xl px-3 py-2 text-xs font-black text-text outline-none focus:border-accent transition-colors placeholder:opacity-20"
            type="text"
            value={deviceId}
            placeholder="REAL-SIM-001"
            disabled={isPlaying || disabled}
            onChange={(e) => onDeviceIdChange(e.target.value)}
          />
        )}
      </div>

      {/* Emitted counter */}
      <div className="bg-panel border border-border-glass-subtle rounded-2xl px-5 py-3 flex flex-col gap-0.5 shadow-inner">
        <span className="text-[0.6rem] font-black text-muted uppercase tracking-widest opacity-40">Payloads</span>
        <strong className="text-sm font-black text-accent tabular-nums tracking-tighter">{emittedCount.toLocaleString()}</strong>
      </div>
    </div>
  </div>
  );
}
