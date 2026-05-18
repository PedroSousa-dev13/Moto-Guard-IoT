import { useState } from 'react';
import { Navigation, Search, Crosshair, MapPin, X, Loader2, RotateCcw, Play } from 'lucide-react';
import { Button } from '../ui';

interface CustomPoint {
  lat: number;
  lng: number;
  label: string;
}

interface CustomRoutePanelProps {
  onSearchAddress: (query: string, target: 'start' | 'end') => Promise<void>;
  onUseMyLocation: (target: 'start' | 'end') => void;
  onSendRoute: () => void;
  onClearRoute: () => void;
  geoLoading: 'start' | 'end' | null;
  geoError: string | null;
  customSent: boolean;
  customLoadingPreview: boolean;
  clickMode: 'start' | 'end' | null;
  onClickModeChange: (mode: 'start' | 'end' | null) => void;
}

export default function CustomRoutePanel({
  onSearchAddress,
  onUseMyLocation,
  onSendRoute,
  onClearRoute,
  geoLoading,
  geoError,
  customSent,
  customLoadingPreview,
  clickMode,
  onClickModeChange,
}: CustomRoutePanelProps) {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [customStart, setCustomStart] = useState<CustomPoint | null>(null);
  const [customEnd, setCustomEnd] = useState<CustomPoint | null>(null);

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
      <div>
        <div className="flex items-center gap-2 text-text font-black tracking-tight mb-2">
          <Navigation size={18} className="text-accent" />
          <span>Definir Percurso</span>
        </div>
        <p className="text-[0.75rem] font-medium text-muted leading-relaxed">
          Pesquisa um endereço, usa a tua localização atual ou clica no mapa para definir os pontos.
        </p>
      </div>

      {/* Origin */}
      <div className="flex flex-col gap-4 p-5 rounded-3xl bg-surface border border-border-glass-subtle">
        <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-green">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
          Origem
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-surface border border-border-glass-subtle rounded-xl py-2.5 px-4 text-xs font-bold text-text outline-none focus:border-accent placeholder:text-muted/40 transition-all"
              placeholder="Pesquisar endereço..."
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchAddress(startInput, 'start')}
            />
            <button
              className="w-10 h-10 rounded-xl bg-panel border border-border-glass-subtle flex items-center justify-center text-muted hover:text-text hover:bg-panel-hover transition-all disabled:opacity-30"
              onClick={() => onSearchAddress(startInput, 'start')}
              disabled={geoLoading === 'start'}
            >
              {geoLoading === 'start' ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
            <button
              className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent hover:bg-accent/20 transition-all disabled:opacity-30"
              onClick={() => onUseMyLocation('start')}
              disabled={geoLoading === 'start'}
            >
              <Crosshair size={16} />
            </button>
          </div>
          <button
            className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-[0.65rem] font-black uppercase tracking-widest transition-all ${
              clickMode === 'start'
                ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20'
                : 'bg-panel border-border-glass-subtle text-muted hover:text-text hover:bg-panel-hover'
            }`}
            onClick={() => onClickModeChange(clickMode === 'start' ? null : 'start')}
          >
            <MapPin size={14} />
            {clickMode === 'start' ? 'A aguardar clique...' : 'Clicar no mapa'}
          </button>
        </div>
      </div>

      {/* Destination */}
      <div className="flex flex-col gap-4 p-5 rounded-3xl bg-surface border border-border-glass-subtle">
        <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-widest text-red">
          <span className="w-2 h-2 rounded-full bg-red animate-pulse" />
          Destino
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-surface border border-border-glass-subtle rounded-xl py-2.5 px-4 text-xs font-bold text-text outline-none focus:border-accent placeholder:text-muted/40 transition-all"
              placeholder="Pesquisar endereço..."
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchAddress(endInput, 'end')}
            />
            <button
              className="w-10 h-10 rounded-xl bg-panel border border-border-glass-subtle flex items-center justify-center text-muted hover:text-text hover:bg-panel-hover transition-all disabled:opacity-30"
              onClick={() => onSearchAddress(endInput, 'end')}
              disabled={geoLoading === 'end'}
            >
              {geoLoading === 'end' ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
            <button
              className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent hover:bg-accent/20 transition-all disabled:opacity-30"
              onClick={() => onUseMyLocation('end')}
              disabled={geoLoading === 'end'}
            >
              <Crosshair size={16} />
            </button>
          </div>
          <button
            className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-[0.65rem] font-black uppercase tracking-widest transition-all ${
              clickMode === 'end'
                ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20'
                : 'bg-panel border-border-glass-subtle text-muted hover:text-text hover:bg-panel-hover'
            }`}
            onClick={() => onClickModeChange(clickMode === 'end' ? null : 'end')}
          >
            <MapPin size={14} />
            {clickMode === 'end' ? 'A aguardar clique...' : 'Clicar no mapa'}
          </button>
        </div>
      </div>

      {geoError && (
        <div className="p-3 rounded-xl bg-red/10 border border-red/20 text-red text-[0.7rem] font-bold">{geoError}</div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" size="md" icon={<RotateCcw size={14} />} onClick={onClearRoute}>
          Limpar
        </Button>
        <Button
          variant="primary"
          size="md"
          icon={customLoadingPreview ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          onClick={onSendRoute}
          disabled={customLoadingPreview}
          className="flex-1"
        >
          {customLoadingPreview ? 'Calculando...' : customSent ? 'Enviada ✓' : 'Usar Rota'}
        </Button>
      </div>
    </div>
  );
}
