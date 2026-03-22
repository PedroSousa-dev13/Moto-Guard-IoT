// =============================================================================
// MotoGuard — CompareBar
// =============================================================================

import React from "react";

export interface CompareBarProps {
  selectedCount: number;
  onClear: () => void;
  onCompare: () => void;
}

export function CompareBar({ selectedCount, onClear, onCompare }: CompareBarProps) {
  if (selectedCount < 1) return null;

  const canCompare = selectedCount === 2;

  return (
    <div className="compare-bar" role="region" aria-label="Barra de comparação de viagens" aria-live="polite">
      <div className="compare-bar-inner">
        {/* Slots visuais */}
        <div className="compare-bar-slots">
          <div className={`compare-bar-slot ${selectedCount >= 1 ? "compare-bar-slot--filled compare-bar-slot--a" : ""}`}>
            {selectedCount >= 1 ? "A" : "—"}
          </div>
          <div className="compare-bar-slot-sep">vs</div>
          <div className={`compare-bar-slot ${selectedCount >= 2 ? "compare-bar-slot--filled compare-bar-slot--b" : ""}`}>
            {selectedCount >= 2 ? "B" : "—"}
          </div>
        </div>

        {/* Info */}
        <div className="compare-bar-info">
          <span className="compare-bar-count">
            <span className="compare-bar-count-num">{selectedCount}</span>
            <span className="compare-bar-count-of"> / 2</span>
          </span>
          <span className="compare-bar-hint">
            {canCompare ? "Pronto para comparar" : "Seleciona mais 1 viagem"}
          </span>
        </div>

        {/* Actions */}
        <div className="compare-bar-actions">
          <button type="button" className="btn btn-ghost compare-bar-clear btn-sm" onClick={onClear}>
            Limpar
          </button>
          <button
            type="button"
            className="btn btn-primary compare-bar-compare"
            onClick={onCompare}
            disabled={!canCompare}
            aria-disabled={!canCompare}
          >
            ⚡ Comparar
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompareBar;
