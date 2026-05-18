import { describe, it, expect, vi } from 'vitest';
import { _, waitLocale, locale } from 'svelte-i18n';
import { get } from 'svelte/store';
import '../i18n';

async function loadI18nWithNavigatorLocale(navigatorLocale?: string) {
  vi.resetModules();

  if (navigatorLocale) {
    vi.doMock('svelte-i18n', async () => {
      const actual = await vi.importActual<typeof import('svelte-i18n')>('svelte-i18n');
      return {
        ...actual,
        getLocaleFromNavigator: () => navigatorLocale
      };
    });
  }

  await import('../i18n');

  if (navigatorLocale) {
    vi.doUnmock('svelte-i18n');
  }
}

/**
 * Tests for the internationalization (i18n) logic.
 * Verifies that 'en' and 'ru' locales are registered and return correct translations.
 */
describe('i18n logic', () => {
  /**
   * Test case for English locale.
   */
  it('should have correct translations for en', async () => {
    await loadI18nWithNavigatorLocale();
    locale.set('en');
    await waitLocale('en');
    const t = get(_);
    expect(t('welcome')).toBe('Welcome to w1p');
  });

  /**
   * Test case for Russian locale.
   */
  it('should have correct translations for ru', async () => {
    await loadI18nWithNavigatorLocale();
    locale.set('ru');
    await waitLocale('ru');
    const t = get(_);
    expect(t('welcome')).toBe('Добро пожаловать в w1p');
  });

  it('should normalize ru-RU navigator locale to ru', async () => {
    await loadI18nWithNavigatorLocale('ru-RU');
    await waitLocale();
    const t = get(_);
    expect(t('welcome')).toBe('Добро пожаловать в w1p');
  });
});
