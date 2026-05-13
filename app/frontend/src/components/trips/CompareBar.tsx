export interface CompareBarProps {
  selectedCount: number;
  onClear: () => void;
}

export function CompareBar({ selectedCount, onClear }: CompareBarProps) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-surface/80 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-6 animate-fade-in">
      <div className="flex items-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center font-black text-xs transition-all ${i < selectedCount ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'border-white/10 text-muted opacity-30'}`}>
            {i < selectedCount ? String.fromCharCode(65 + i) : (i + 1)}
          </div>
        ))}
      </div>
      <div className="flex flex-col">
        <span className="text-[0.6rem] font-black uppercase tracking-widest text-text">
          {selectedCount} / 4 selecionadas
        </span>
        <span className="text-[0.55rem] font-bold text-muted uppercase tracking-widest opacity-60">
          {selectedCount < 2 ? "Seleciona pelo menos 2 viagens" : "A comparação é exibida abaixo"}
        </span>
      </div>
      <button type="button" className="btn btn-ghost btn-sm text-muted hover:text-red" onClick={onClear}>
        Limpar
      </button>
    </div>
  );
}

export default CompareBar;
