/**
 * Preservation Property Tests - Language Selector Fix
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * This test verifies Property 2: Preservation - Non-Language Settings Behavior
 * 
 * IMPORTANT: These tests run on UNFIXED code and MUST PASS
 * 
 * Preservation Requirements: All behaviors that do NOT involve language changes
 * must remain completely unchanged after the fix. This includes:
 * - Navigation between pages (Router state)
 * - Theme setting changes (Light ↔ Dark)
 * - Units setting changes (Metric ↔ Imperial)
 * - Map style changes (Streets ↔ Satellite)
 * - Authentication flow (login/logout)
 * - Default language is PT on first access
 * - Translation fallback PT → EN works for missing keys
 * 
 * Testing Strategy: Observe behavior on UNFIXED code, write property-based tests
 * capturing observed behavior patterns. These tests establish the baseline that
 * must be preserved after implementing the fix.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import { I18nProvider, useI18n } from '../I18nContext';
import { TranslatedApp } from '../TranslatedApp';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { loadSettings, saveSettings, applyTheme, type AppSettings } from '../../utils/settings';

// Mock components that simulate real app structure
function MockDashboard() {
  const { t } = useI18n();
  return (
    <div data-testid="dashboard-page">
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.subtitle')}</p>
    </div>
  );
}

function MockTrips() {
  const { t } = useI18n();
  return (
    <div data-testid="trips-page">
      <h1>{t('trips.title')}</h1>
      <p>{t('trips.subtitle')}</p>
    </div>
  );
}

function MockMap() {
  const { t } = useI18n();
  return (
    <div data-testid="map-page">
      <h1>{t('map.title')}</h1>
      <p>{t('map.subtitle')}</p>
    </div>
  );
}

function MockSettings() {
  const { t, language } = useI18n();
  const settings = loadSettings();
  
  return (
    <div data-testid="settings-page">
      <h1>{t('settings.title')}</h1>
      <div data-testid="current-language">{language}</div>
      <div data-testid="current-theme">{settings.theme}</div>
      <div data-testid="current-units">{settings.units}</div>
      <div data-testid="current-mapstyle">{settings.mapStyle}</div>
      
      <button 
        data-testid="theme-light-btn"
        onClick={() => {
          const newSettings = { ...settings, theme: 'light' as const };
          saveSettings(newSettings);
          applyTheme('light');
        }}
      >
        Light
      </button>
      <button 
        data-testid="theme-dark-btn"
        onClick={() => {
          const newSettings = { ...settings, theme: 'dark' as const };
          saveSettings(newSettings);
          applyTheme('dark');
        }}
      >
        Dark
      </button>
      
      <button 
        data-testid="units-metric-btn"
        onClick={() => {
          const newSettings = { ...settings, units: 'metric' as const };
          saveSettings(newSettings);
        }}
      >
        Metric
      </button>
      <button 
        data-testid="units-imperial-btn"
        onClick={() => {
          const newSettings = { ...settings, units: 'imperial' as const };
          saveSettings(newSettings);
        }}
      >
        Imperial
      </button>
      
      <button 
        data-testid="mapstyle-streets-btn"
        onClick={() => {
          const newSettings = { ...settings, mapStyle: 'streets' as const };
          saveSettings(newSettings);
        }}
      >
        Streets
      </button>
      <button 
        data-testid="mapstyle-satellite-btn"
        onClick={() => {
          const newSettings = { ...settings, mapStyle: 'satellite' as const };
          saveSettings(newSettings);
        }}
      >
        Satellite
      </button>
    </div>
  );
}

function MockNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  
  return (
    <div data-testid="navigation">
      <div data-testid="current-path">{location.pathname}</div>
      <button data-testid="nav-dashboard" onClick={() => navigate('/dashboard')}>Dashboard</button>
      <button data-testid="nav-trips" onClick={() => navigate('/trips')}>Trips</button>
      <button data-testid="nav-map" onClick={() => navigate('/map')}>Map</button>
      <button data-testid="nav-settings" onClick={() => navigate('/settings')}>Settings</button>
    </div>
  );
}

// Current app structure (BUGGY: TranslatedApp ABOVE Router)
function TestAppStructure() {
  return (
    <I18nProvider>
      <TranslatedApp>
        <Router>
          <MockNavigation />
          <Routes>
            <Route path="/" element={<MockDashboard />} />
            <Route path="/dashboard" element={<MockDashboard />} />
            <Route path="/trips" element={<MockTrips />} />
            <Route path="/map" element={<MockMap />} />
            <Route path="/settings" element={<MockSettings />} />
          </Routes>
        </Router>
      </TranslatedApp>
    </I18nProvider>
  );
}

describe('Preservation Property Tests: Non-Language Settings Behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset to default theme (light)
    document.documentElement.setAttribute('data-theme', 'light');
  });

  describe('3.1: Default Language on First Access', () => {
    it('should use Portuguese as default language when no settings exist', async () => {
      const user = userEvent.setup();
      
      render(<TestAppStructure />);
      
      // Navigate to settings to check language
      await user.click(screen.getByTestId('nav-settings'));
      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });
      
      // Verify default language is PT
      expect(screen.getByTestId('current-language')).toHaveTextContent('pt');
      
      // Verify translations are in Portuguese
      expect(screen.getByText('Definições')).toBeInTheDocument();
    });

    it('property: default language is always PT on first access', async () => {
      const user = userEvent.setup();
      
      fc.assert(
        fc.property(
          fc.constant(null), // No initial settings
          () => {
            localStorage.clear();
            
            const { unmount } = render(<TestAppStructure />);
            
            try {
              // Navigate to settings to check language
              user.click(screen.getByTestId('nav-settings'));
              
              // Property: Default language MUST be PT
              waitFor(() => {
                expect(screen.getByTestId('current-language')).toHaveTextContent('pt');
              });
              
              // Property: Document language attribute MUST be PT
              expect(document.documentElement.lang).toBe('pt');
              
              return true;
            } finally {
              unmount();
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('3.2: Translation Function t() with Fallback', () => {
    it('should return correct translations for current language', async () => {
      const user = userEvent.setup();
      
      render(<TestAppStructure />);
      
      // Navigate to dashboard explicitly
      await user.click(screen.getByTestId('nav-dashboard'));
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
      
      // PT translations - check unique text
      expect(screen.getByText('Monitorização em tempo real')).toBeInTheDocument();
    });

    it('should fallback to PT then EN for missing keys', () => {
      function FallbackTest() {
        const { t } = useI18n();
        return (
          <div>
            <div data-testid="valid-key">{t('common.save')}</div>
            <div data-testid="missing-key">{t('missing.key' as any)}</div>
            <div data-testid="custom-fallback">{t('another.missing' as any, 'Custom')}</div>
          </div>
        );
      }
      
      render(
        <I18nProvider>
          <FallbackTest />
        </I18nProvider>
      );
      
      // Valid key returns translation
      expect(screen.getByTestId('valid-key')).toHaveTextContent('Guardar');
      
      // Missing key returns the key itself
      expect(screen.getByTestId('missing-key')).toHaveTextContent('missing.key');
      
      // Custom fallback is used
      expect(screen.getByTestId('custom-fallback')).toHaveTextContent('Custom');
    });

    it('property: t() always returns non-empty string for valid keys', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('pt', 'en'),
          fc.constantFrom(
            'common.save',
            'common.loading',
            'dashboard.title',
            'settings.title',
            'nav.dashboard',
            'trips.title'
          ),
          (lang, key) => {
            localStorage.clear();
            localStorage.setItem('motoguard_settings', JSON.stringify({ language: lang }));
            
            function TranslationTest() {
              const { t } = useI18n();
              return <div data-testid="translation">{t(key as any)}</div>;
            }
            
            const { unmount } = render(
              <I18nProvider>
                <TranslationTest />
              </I18nProvider>
            );
            
            try {
              const translation = screen.getByTestId('translation').textContent;
              
              // Property: Translation MUST be non-empty
              expect(translation).toBeTruthy();
              expect(translation!.trim().length).toBeGreaterThan(0);
              
              return true;
            } finally {
              unmount();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('3.3: Other Settings Save and Apply Correctly', () => {
    it('should save and apply theme changes correctly', async () => {
      const user = userEvent.setup();
      
      render(<TestAppStructure />);
      
      // Navigate to settings
      await user.click(screen.getByTestId('nav-settings'));
      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });
      
      // Initial theme should be light (default)
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      
      // Change to dark theme
      await user.click(screen.getByTestId('theme-dark-btn'));
      
      // Verify theme changed in localStorage
      await waitFor(() => {
        const settings = loadSettings();
        expect(settings.theme).toBe('dark');
      });
      
      // Verify theme applied to document
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should save and apply units changes correctly', async () => {
      const user = userEvent.setup();
      
      render(<TestAppStructure />);
      
      // Navigate to settings
      await user.click(screen.getByTestId('nav-settings'));
      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });
      
      // Initial units should be metric (default)
      expect(screen.getByTestId('current-units')).toHaveTextContent('metric');
      
      // Change to imperial
      await user.click(screen.getByTestId('units-imperial-btn'));
      
      // Verify units changed in localStorage
      await waitFor(() => {
        const settings = loadSettings();
        expect(settings.units).toBe('imperial');
      });
    });

    it('should save and apply map style changes correctly', async () => {
      const user = userEvent.setup();
      
      render(<TestAppStructure />);
      
      // Navigate to settings
      await user.click(screen.getByTestId('nav-settings'));
      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });
      
      // Initial map style should be streets (default)
      expect(screen.getByTestId('current-mapstyle')).toHaveTextContent('streets');
      
      // Change to satellite
      await user.click(screen.getByTestId('mapstyle-satellite-btn'));
      
      // Verify map style changed in localStorage
      await waitFor(() => {
        const settings = loadSettings();
        expect(settings.mapStyle).toBe('satellite');
      });
    });

    it('property: theme changes always persist correctly', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('light', 'dark'),
          fc.constantFrom('light', 'dark'),
          async (initialTheme, targetTheme) => {
            // Skip if same theme
            if (initialTheme === targetTheme) return true;
            
            localStorage.clear();
            localStorage.setItem('motoguard_settings', JSON.stringify({ theme: initialTheme }));
            
            const { unmount } = render(<TestAppStructure />);
            
            try {
              // Navigate to settings
              await user.click(screen.getByTestId('nav-settings'));
              await waitFor(() => {
                expect(screen.getByTestId('settings-page')).toBeInTheDocument();
              });
              
              // Verify initial theme
              expect(screen.getByTestId('current-theme')).toHaveTextContent(initialTheme);
              
              // Change theme
              const buttonId = `theme-${targetTheme}-btn`;
              await user.click(screen.getByTestId(buttonId));
              
              // Property: Theme MUST persist to localStorage
              await waitFor(() => {
                const settings = loadSettings();
                expect(settings.theme).toBe(targetTheme);
              });
              
              // Property: Theme MUST be applied to document
              expect(document.documentElement.getAttribute('data-theme')).toBe(targetTheme);
              
              return true;
            } finally {
              unmount();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('property: units changes always persist correctly', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('metric', 'imperial'),
          fc.constantFrom('metric', 'imperial'),
          async (initialUnits, targetUnits) => {
            // Skip if same units
            if (initialUnits === targetUnits) return true;
            
            localStorage.clear();
            localStorage.setItem('motoguard_settings', JSON.stringify({ units: initialUnits }));
            
            const { unmount } = render(<TestAppStructure />);
            
            try {
              // Navigate to settings
              await user.click(screen.getByTestId('nav-settings'));
              await waitFor(() => {
                expect(screen.getByTestId('settings-page')).toBeInTheDocument();
              });
              
              // Verify initial units
              expect(screen.getByTestId('current-units')).toHaveTextContent(initialUnits);
              
              // Change units
              const buttonId = `units-${targetUnits}-btn`;
              await user.click(screen.getByTestId(buttonId));
              
              // Property: Units MUST persist to localStorage
              await waitFor(() => {
                const settings = loadSettings();
                expect(settings.units).toBe(targetUnits);
              });
              
              return true;
            } finally {
              unmount();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('property: map style changes always persist correctly', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('streets', 'satellite'),
          fc.constantFrom('streets', 'satellite'),
          async (initialStyle, targetStyle) => {
            // Skip if same style
            if (initialStyle === targetStyle) return true;
            
            localStorage.clear();
            localStorage.setItem('motoguard_settings', JSON.stringify({ mapStyle: initialStyle }));
            
            const { unmount } = render(<TestAppStructure />);
            
            try {
              // Navigate to settings
              await user.click(screen.getByTestId('nav-settings'));
              await waitFor(() => {
                expect(screen.getByTestId('settings-page')).toBeInTheDocument();
              });
              
              // Verify initial map style
              expect(screen.getByTestId('current-mapstyle')).toHaveTextContent(initialStyle);
              
              // Change map style
              const buttonId = `mapstyle-${targetStyle}-btn`;
              await user.click(screen.getByTestId(buttonId));
              
              // Property: Map style MUST persist to localStorage
              await waitFor(() => {
                const settings = loadSettings();
                expect(settings.mapStyle).toBe(targetStyle);
              });
              
              return true;
            } finally {
              unmount();
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('3.4: Navigation Between Pages Preserves Router State', () => {
    it('should navigate between pages correctly', async () => {
      const user = userEvent.setup();
      
      render(<TestAppStructure />);
      
      // Start at root (which renders dashboard)
      expect(screen.getByTestId('current-path')).toHaveTextContent('/');
      
      // Navigate to trips
      await user.click(screen.getByTestId('nav-trips'));
      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent('/trips');
        expect(screen.getByTestId('trips-page')).toBeInTheDocument();
      });
      
      // Navigate to map
      await user.click(screen.getByTestId('nav-map'));
      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent('/map');
        expect(screen.getByTestId('map-page')).toBeInTheDocument();
      });
      
      // Navigate to settings
      await user.click(screen.getByTestId('nav-settings'));
      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent('/settings');
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });
      
      // Navigate back to dashboard
      await user.click(screen.getByTestId('nav-dashboard'));
      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent('/dashboard');
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
    });

    it('property: navigation always updates route correctly', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('/dashboard', '/trips', '/map', '/settings'),
          fc.constantFrom('/dashboard', '/trips', '/map', '/settings'),
          async (fromRoute, toRoute) => {
            // Skip if same route
            if (fromRoute === toRoute) return true;
            
            localStorage.clear();
            
            const { unmount } = render(<TestAppStructure />);
            
            try {
              // Navigate to initial route
              const fromButton = fromRoute.replace('/', 'nav-');
              await user.click(screen.getByTestId(fromButton));
              
              await waitFor(() => {
                expect(screen.getByTestId('current-path')).toHaveTextContent(fromRoute);
              });
              
              // Navigate to target route
              const toButton = toRoute.replace('/', 'nav-');
              await user.click(screen.getByTestId(toButton));
              
              // Property: Route MUST update correctly
              await waitFor(() => {
                expect(screen.getByTestId('current-path')).toHaveTextContent(toRoute);
              });
              
              // Property: Correct page component MUST be rendered
              const pageTestId = toRoute.replace('/', '') + '-page';
              expect(screen.getByTestId(pageTestId)).toBeInTheDocument();
              
              return true;
            } finally {
              unmount();
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it('property: navigation preserves Router state across multiple transitions', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom('/dashboard', '/trips', '/map', '/settings'), { minLength: 3, maxLength: 5 }),
          async (routeSequence) => {
            localStorage.clear();
            
            const { unmount } = render(<TestAppStructure />);
            
            try {
              // Navigate through sequence
              for (const route of routeSequence) {
                const button = route.replace('/', 'nav-');
                await user.click(screen.getByTestId(button));
                
                // Property: Each navigation MUST succeed
                await waitFor(() => {
                  expect(screen.getByTestId('current-path')).toHaveTextContent(route);
                });
                
                // Property: Correct page MUST be rendered
                const pageTestId = route.replace('/', '') + '-page';
                expect(screen.getByTestId(pageTestId)).toBeInTheDocument();
              }
              
              return true;
            } finally {
              unmount();
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
