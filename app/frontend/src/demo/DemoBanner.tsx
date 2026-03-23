import React from 'react';
import { useDemoContext } from './DemoContext';

export default function DemoBanner() {
  const { isDemoMode, exitDemoMode } = useDemoContext();

  if (!isDemoMode) return null;

  return (
    <div
      style={{
        background: '#f59e0b',
        color: '#1c1917',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '0.5rem 1rem',
        fontWeight: 600,
        fontSize: '0.9rem',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
      }}
    >
      <span>Modo Demo — dados simulados</span>
      <button
        onClick={exitDemoMode}
        style={{
          background: '#1c1917',
          color: '#f59e0b',
          border: 'none',
          borderRadius: '4px',
          padding: '0.25rem 0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        Sair do Modo Demo
      </button>
    </div>
  );
}
