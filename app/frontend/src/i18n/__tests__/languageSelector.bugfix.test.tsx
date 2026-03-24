/**
 * Bug Condition Exploration Test - Language Selector Fix
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * This test verifies Property 1: Bug Condition - Language Change Updates Interface
 * 
 * CRITICAL: This test MUST FAIL on unfixed code (failure confirms the bug exists)
 * 
 * Bug Condition: When user selects a different language in Settings (selectLanguage with 
 * newLanguage != currentLanguage), the interface should immediately update all visible 
 * translations, causing all components using the t() function to re-render with the new 
 * translations.
 * 
 * Root Cause: TranslatedApp wrapper is positioned ABOVE Router in App.tsx, which causes
 * the entire Router to unmount/remount when _renderKey changes, preventing proper 
 * re-rendering of internal components.
 * 
 * Expected Behavior: All components using t() (Sidebar, Navbar, Settings labels) should
 * display translations in the new language immediately after language selection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import { I18nProvider, useI18n } from '../I18nContext';
import { TranslatedApp } from '../TranslatedApp';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Simplified test component that mimics the structure of real components like Sidebar
function MockSidebarComponent() {
  const { t } = useI18n();
  
  return (
    <div data-testid="mock-sidebar">
      <div data-testid="monitoring-label">{t('sidebar.monitoring')}</div>
      <div data-testid="dashboard-label">{t('nav.dashboard')}</div>
      <div data-testid="data-label">{t('sidebar.data')}</div>
      <div data-testid="system-label">{t('sidebar.system')}</div>
    </div>
  );
}

// Language selector component that mimics Settings page behavior
function MockLanguageSelector() {
  const { language, setLanguage } = useI18n();
  
  return (
    <div data-testid="language-selector">
      <div data-testid="current-language">{language}</div>
      <button onClick={() => setLanguage('en')} data-testid="select-en">
        English
      </button>
      <button onClick={() => setLanguage('es')} data-testid="select-es">
        Español
      </button>
      <button onClick={() => setLanguage('pt')} data-testid="select-pt">
        Português
      </button>
    </div>
  );
}

// BUGGY structure: TranslatedApp ABOVE Router (current implementation)
function BuggyAppStructure() {
  return (
    <I18nProvider>
      <TranslatedApp>
        <Router>
          <Routes>
            <Route path="/" element={
              <div>
                <MockSidebarComponent />
                <MockLanguageSelector />
              </div>
            } />
            <Route path="/settings" element={
              <div>
                <MockSidebarComponent />
                <MockLanguageSelector />
              </div>
            } />
          </Routes>
        </Router>
      </TranslatedApp>
    </I18nProvider>
  );
}

describe('Bug Condition Exploration: Language Selector Not Updating Interface', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should update all visible translations when language changes from PT to EN', async () => {
    const user = userEvent.setup();
    
    render(<BuggyAppStructure />);
    
    // Verify initial state (PT - default language)
    expect(screen.getByTestId('current-language')).toHaveTextContent('pt');
    expect(screen.getByTestId('monitoring-label')).toHaveTextContent('Monitorização');
    expect(screen.getByTestId('dashboard-label')).toHaveTextContent('Dashboard');
    expect(screen.getByTestId('data-label')).toHaveTextContent('Dados');
    expect(screen.getByTestId('system-label')).toHaveTextContent('Sistema');
    
    // User action: Select English
    await user.click(screen.getByTestId('select-en'));
    
    // Expected behavior: All translations should update to English
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toHaveTextContent('en');
    }, { timeout: 2000 });
    
    // CRITICAL ASSERTIONS: These will FAIL on unfixed code
    // The bug prevents these components from re-rendering with new translations
    expect(screen.getByTestId('monitoring-label')).toHaveTextContent('Monitoring');
    expect(screen.getByTestId('dashboard-label')).toHaveTextContent('Dashboard');
    expect(screen.getByTestId('data-label')).toHaveTextContent('Data');
    expect(screen.getByTestId('system-label')).toHaveTextContent('System');
  });

  it('should update all visible translations when language changes from EN to PT', async () => {
    const user = userEvent.setup();
    
    // Start with English
    localStorage.setItem('motoguard_settings', JSON.stringify({ language: 'en' }));
    
    render(<BuggyAppStructure />);
    
    // Verify initial state (EN)
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toHaveTextContent('en');
    });
    expect(screen.getByTestId('monitoring-label')).toHaveTextContent('Monitoring');
    expect(screen.getByTestId('data-label')).toHaveTextContent('Data');
    expect(screen.getByTestId('system-label')).toHaveTextContent('System');
    
    // User action: Select Portuguese
    await user.click(screen.getByTestId('select-pt'));
    
    // Expected behavior: All translations should update to Portuguese
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toHaveTextContent('pt');
    }, { timeout: 2000 });
    
    // CRITICAL ASSERTIONS: These will FAIL on unfixed code
    expect(screen.getByTestId('monitoring-label')).toHaveTextContent('Monitorização');
    expect(screen.getByTestId('dashboard-label')).toHaveTextContent('Dashboard');
    expect(screen.getByTestId('data-label')).toHaveTextContent('Dados');
    expect(screen.getByTestId('system-label')).toHaveTextContent('Sistema');
  });

  it('should update translations when switching between PT and EN multiple times', async () => {
    const user = userEvent.setup();
    
    render(<BuggyAppStructure />);
    
    // Start with PT
    expect(screen.getByTestId('monitoring-label')).toHaveTextContent('Monitorização');
    expect(screen.getByTestId('data-label')).toHaveTextContent('Dados');
    
    // Switch to EN
    await user.click(screen.getByTestId('select-en'));
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toHaveTextContent('en');
    });
    expect(screen.getByTestId('monitoring-label')).toHaveTextContent('Monitoring');
    expect(screen.getByTestId('data-label')).toHaveTextContent('Data');
    
    // Switch back to PT
    await user.click(screen.getByTestId('select-pt'));
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toHaveTextContent('pt');
    });
    expect(screen.getByTestId('monitoring-label')).toHaveTextContent('Monitorização');
    expect(screen.getByTestId('data-label')).toHaveTextContent('Dados');
    
    // Switch to EN again
    await user.click(screen.getByTestId('select-en'));
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toHaveTextContent('en');
    });
    expect(screen.getByTestId('monitoring-label')).toHaveTextContent('Monitoring');
    expect(screen.getByTestId('data-label')).toHaveTextContent('Data');
  });

  it('property: language change always updates interface for PT ↔ EN', async () => {
    const user = userEvent.setup();
    
    // Property-based test: For ANY language change between PT and EN,
    // the interface MUST update to show translations in the new language
    // Note: Spanish (ES) translations don't exist in the codebase, so we test PT ↔ EN only
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('pt', 'en'),
        fc.constantFrom('pt', 'en'),
        async (fromLang, toLang) => {
          // Skip if languages are the same (not a bug condition)
          if (fromLang === toLang) return true;
          
          // Clear and set initial language
          localStorage.clear();
          localStorage.setItem('motoguard_settings', JSON.stringify({ language: fromLang }));
          
          const { unmount } = render(<BuggyAppStructure />);
          
          try {
            // Verify initial language
            await waitFor(() => {
              expect(screen.getByTestId('current-language')).toHaveTextContent(fromLang);
            });
            
            // Get initial translation
            const initialTranslation = screen.getByTestId('monitoring-label').textContent;
            
            // Change language
            const buttonTestId = `select-${toLang}`;
            await user.click(screen.getByTestId(buttonTestId));
            
            // Wait for language state to update
            await waitFor(() => {
              expect(screen.getByTestId('current-language')).toHaveTextContent(toLang);
            }, { timeout: 2000 });
            
            // Get new translation
            const newTranslation = screen.getByTestId('monitoring-label').textContent;
            
            // CRITICAL PROPERTY: Translation MUST change when language changes
            // This will FAIL on unfixed code because components don't re-render
            expect(newTranslation).not.toBe(initialTranslation);
            
            // Verify the translation matches the expected language
            const expectedTranslations: Record<string, string> = {
              pt: 'Monitorização',
              en: 'Monitoring',
            };
            expect(newTranslation).toBe(expectedTranslations[toLang]);
            
            return true;
          } finally {
            unmount();
          }
        }
      ),
      { 
        numRuns: 10,
        verbose: true,
      }
    );
  });
});
