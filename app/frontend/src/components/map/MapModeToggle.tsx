type MapMode = 'preset' | 'custom' | 'gpx';

interface MapModeToggleProps {
  mode: MapMode;
  onChange: (mode: MapMode) => void;
}

const modes: { id: MapMode; label: string }[] = [
  { id: 'preset', label: 'Rotas Oficiais' },
  { id: 'custom', label: 'Personalizada' },
  { id: 'gpx', label: 'GPX Upload' },
];

export default function MapModeToggle({ mode, onChange }: MapModeToggleProps) {
  return (
    <div className="flex bg-panel border border-border-glass-subtle p-1 rounded-2xl shadow-inner shrink-0">
      {modes.map((m) => (
        <button
          key={m.id}
          className={`px-5 py-2.5 rounded-xl text-[0.65rem] font-black uppercase tracking-widest transition-all ${
            mode === m.id
              ? 'bg-accent text-white shadow-lg shadow-accent/20'
              : 'text-muted hover:text-text'
          }`}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
