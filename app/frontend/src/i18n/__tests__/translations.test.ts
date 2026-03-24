import { describe, it, expect } from 'vitest';
import { translations } from '../translations';

describe('translations', () => {
  it('should have pt, en translations', () => {
    expect(translations).toHaveProperty('pt');
    expect(translations).toHaveProperty('en');
  });

  it('should have matching keys between pt and en', () => {
    const ptKeys = Object.keys(translations.pt).sort();
    const enKeys = Object.keys(translations.en).sort();
    
    expect(ptKeys).toEqual(enKeys);
  });

  it('should have no empty translations in pt', () => {
    Object.entries(translations.pt).forEach(([key, value]) => {
      expect(value as string, `PT translation for "${key}" should not be empty`).toBeTruthy();
      expect((value as string).trim(), `PT translation for "${key}" should not be whitespace`).toBeTruthy();
    });
  });

  it('should have no empty translations in en', () => {
    Object.entries(translations.en).forEach(([key, value]) => {
      expect(value as string, `EN translation for "${key}" should not be empty`).toBeTruthy();
      expect((value as string).trim(), `EN translation for "${key}" should not be whitespace`).toBeTruthy();
    });
  });

  it('should have common translations', () => {
    const commonKeys = [
      'common.loading',
      'common.error',
      'common.success',
      'common.save',
      'common.cancel',
    ];
    
    commonKeys.forEach(key => {
      expect(translations.pt).toHaveProperty(key);
      expect(translations.en).toHaveProperty(key);
    });
  });

  it('should have navigation translations', () => {
    const navKeys = [
      'nav.dashboard',
      'nav.trips',
      'nav.map',
      'nav.garage',
      'nav.settings',
    ];
    
    navKeys.forEach(key => {
      expect(translations.pt).toHaveProperty(key);
      expect(translations.en).toHaveProperty(key);
    });
  });

  it('should have settings translations', () => {
    const settingsKeys = [
      'settings.title',
      'settings.subtitle',
      'settings.theme',
      'settings.language',
      'settings.saveSuccess',
    ];
    
    settingsKeys.forEach(key => {
      expect(translations.pt).toHaveProperty(key);
      expect(translations.en).toHaveProperty(key);
    });
  });

  it('should have different translations for pt and en', () => {
    // Sample keys that should be different
    const sampleKeys = [
      'common.save',
      'common.loading',
      'dashboard.title',
      'settings.title',
    ];
    
    sampleKeys.forEach(key => {
      const ptValue = translations.pt[key as keyof typeof translations.pt];
      const enValue = translations.en[key as keyof typeof translations.en];
      
      expect(ptValue, `"${key}" should have different PT and EN translations`).not.toBe(enValue);
    });
  });

  it('should have at least 100 translation keys', () => {
    const ptKeyCount = Object.keys(translations.pt).length;
    expect(ptKeyCount).toBeGreaterThanOrEqual(100);
  });

  it('should use consistent naming convention (dot notation)', () => {
    Object.keys(translations.pt).forEach(key => {
      expect(key, `Key "${key}" should use dot notation`).toMatch(/^[a-z]+\.[a-zA-Z.]+$/);
    });
  });

  it('should have demo mode translations', () => {
    expect(translations.pt).toHaveProperty('demo.banner');
    expect(translations.pt).toHaveProperty('demo.exit');
    expect(translations.en).toHaveProperty('demo.banner');
    expect(translations.en).toHaveProperty('demo.exit');
  });

  it('should have alert severity translations', () => {
    expect(translations.pt).toHaveProperty('alerts.severity.INFO');
    expect(translations.pt).toHaveProperty('alerts.severity.WARNING');
    expect(translations.pt).toHaveProperty('alerts.severity.CRITICAL');
  });

  it('should have unit translations', () => {
    const unitKeys = [
      'units.kmh',
      'units.mph',
      'units.celsius',
      'units.fahrenheit',
    ];
    
    unitKeys.forEach(key => {
      expect(translations.pt).toHaveProperty(key);
      expect(translations.en).toHaveProperty(key);
    });
  });
});
