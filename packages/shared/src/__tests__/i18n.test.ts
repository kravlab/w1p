import { describe, it, expect, vi, beforeEach } from 'vitest';
import { _, waitLocale, locale, getLocaleFromNavigator } from 'svelte-i18n';
import { get } from 'svelte/store';
import { setupI18n } from '../i18n';

vi.mock('svelte-i18n', async () => {
  const actual = await vi.importActual<typeof import('svelte-i18n')>('svelte-i18n');
  return {
    ...actual,
    getLocaleFromNavigator: vi.fn(),
    init: vi.fn(actual.init)
  };
});

describe('i18n logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct translations for en', async () => {
    locale.set('en');
    await waitLocale('en');
    const t = get(_);
    expect(t('welcome')).toBe('Welcome to w1p');
  });

  it('should have correct translations for ru', async () => {
    locale.set('ru');
    await waitLocale('ru');
    const t = get(_);
    expect(t('welcome')).toBe('Добро пожаловать в w1p');
  });

  it('should handle locale initialization logic', async () => {
    const { init } = await import('svelte-i18n');

    // Test RU
    vi.mocked(getLocaleFromNavigator).mockReturnValue('ru-RU');
    setupI18n();
    expect(init).toHaveBeenLastCalledWith(expect.objectContaining({ initialLocale: 'ru' }));

    // Test EN
    vi.mocked(getLocaleFromNavigator).mockReturnValue('en-US');
    setupI18n();
    expect(init).toHaveBeenLastCalledWith(expect.objectContaining({ initialLocale: 'en' }));

    // Test default when null
    vi.mocked(getLocaleFromNavigator).mockReturnValue(null);
    setupI18n();
    expect(init).toHaveBeenLastCalledWith(expect.objectContaining({ initialLocale: 'en' }));
  });
});
