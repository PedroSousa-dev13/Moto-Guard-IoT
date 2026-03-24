import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider, useI18n } from '../I18nContext';

// Test component
function TestComponent() {
  const { t, language, setLanguage } = useI18n();
  
  return (
    <div>
      <div data-testid="language">{language}</div>
      <div data-testid="translation">{t('common.save')}</div>
      <button onClick={() => setLanguage('en')}>Switch to EN</button>
      <button onClick={() => setLanguage('pt')}>Switch to PT</button>
    </div>
  );
}

describe('I18nContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should provide default language (pt)', () => {
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );
    
    expect(screen.getByTestId('language')).toHaveTextContent('pt');
    expect(screen.getByTestId('translation')).toHaveTextContent('Guardar');
  });

  it('should translate to English', async () => {
    const user = userEvent.setup();
    
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );
    
    await user.click(screen.getByText('Switch to EN'));
    
    await waitFor(() => {
      expect(screen.getByTestId('language')).toHaveTextContent('en');
      expect(screen.getByTestId('translation')).toHaveTextContent('Save');
    });
  });

  it('should switch between languages', async () => {
    const user = userEvent.setup();
    
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );
    
    // Start with PT
    expect(screen.getByTestId('translation')).toHaveTextContent('Guardar');
    
    // Switch to EN
    await user.click(screen.getByText('Switch to EN'));
    await waitFor(() => {
      expect(screen.getByTestId('translation')).toHaveTextContent('Save');
    });
    
    // Switch back to PT
    await user.click(screen.getByText('Switch to PT'));
    await waitFor(() => {
      expect(screen.getByTestId('translation')).toHaveTextContent('Guardar');
    });
  });

  it('should persist language to localStorage', async () => {
    const user = userEvent.setup();
    
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );
    
    await user.click(screen.getByText('Switch to EN'));
    
    await waitFor(() => {
      const settings = JSON.parse(localStorage.getItem('motoguard_settings') || '{}');
      expect(settings.language).toBe('en');
    });
  });

  it('should fallback to key when translation missing', () => {
    function FallbackTest() {
      const { t } = useI18n();
      return <div data-testid="fallback">{t('missing.key' as any)}</div>;
    }
    
    render(
      <I18nProvider>
        <FallbackTest />
      </I18nProvider>
    );
    
    expect(screen.getByTestId('fallback')).toHaveTextContent('missing.key');
  });

  it('should use custom fallback when provided', () => {
    function FallbackTest() {
      const { t } = useI18n();
      return <div data-testid="fallback">{t('missing.key' as any, 'Custom fallback')}</div>;
    }
    
    render(
      <I18nProvider>
        <FallbackTest />
      </I18nProvider>
    );
    
    expect(screen.getByTestId('fallback')).toHaveTextContent('Custom fallback');
  });

  it('should update document language attribute', async () => {
    const user = userEvent.setup();
    
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    );
    
    expect(document.documentElement.lang).toBe('pt');
    
    await user.click(screen.getByText('Switch to EN'));
    
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en');
    });
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = () => {};
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useI18n must be used within I18nProvider');
    
    console.error = originalError;
  });
});
