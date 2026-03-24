import { ReactNode } from 'react';
import { useI18n } from './I18nContext';

/**
 * Wrapper component that forces re-render of all children when language changes
 * Use this to wrap the entire app or specific sections that need to update
 */
export function TranslatedApp({ children }: { children: ReactNode }) {
  const { _renderKey } = useI18n();
  
  // Key prop forces React to unmount and remount all children when language changes
  return <div key={`i18n-${_renderKey}`}>{children}</div>;
}
