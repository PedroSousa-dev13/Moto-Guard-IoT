// =============================================================================
// MotoGuard — CompareBar
// =============================================================================
// Barra flutuante que aparece quando há ≥1 viagem selecionada para comparação.
// =============================================================================

import React from "react";

export interface CompareBarProps {
  /** Número de viagens atualmente selecionadas (0, 1 ou 2) */
  selectedCount: number;
  /** Callback para limpar todas as seleções */
  onClear: () => void;
  /** Callback para iniciar a comparação — só ativo quando selectedCount === 2 */
  onCompare: () => void;
}

export function CompareBar({ selectedCount, onClear, onCompare }: CompareBarProps) {
  if (selectedCount < 1) return null;

  const canCompare = selectedCount === 2;

  return (
    <div
      className="compare-bar"
      role="region"
      aria-label="Barra de comparação de viagens"
      aria-live="polite"
    >
      <div className="compare-bar-inner">
        {/* Contador e mensagem */}
        <div className="compare-bar-info">
          <span className="compare-bar-count">
            <span className="compare-bar-count-num">{selectedCount}</span>
            {" de 2 selecionadas"}
          </span>
          {canCompare && (
            <span className="compare-bar-hint">
              Pronto para comparar
            </span>
          )}
          {!canCompare && (
            <span className="compare-bar-hint">
              Seleciona mais 1 viagem para comparar
            </span>
          )}
        </div>

        {/* Ações */}
        <div className="compare-bar-actions">
          <button
            type="button"
            className="btn btn-ghost compare-bar-clear"
            onClick={onClear}
          >
            Limpar
          </button>

          <button
            type="button"
            className="btn btn-primary compare-bar-compare"
            onClick={onCompare}
            disabled={!canCompare}
            aria-disabled={!canCompare}
            tabIndex={0}
          >
            Comparar Viagens
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompareBar;
