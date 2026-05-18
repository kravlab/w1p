import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import {
  clearSearchHistory,
  getSearchHistory,
  recordSearchHistory,
  SEARCH_HISTORY_STORAGE_KEY
} from '../search-history';

describe('search history helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores unique queries with the latest status first', () => {
    recordSearchHistory({
      query: 'Tree',
      status: 'failed',
      failureReason: 'network',
      message: 'Offline',
      includeTranslations: true,
      translationLanguageCode: 'ru'
    });
    recordSearchHistory({
      query: 'tree',
      status: 'success',
      includeTranslations: false,
      translationLanguageCode: 'all'
    });

    const history = getSearchHistory();
    expect(history).toMatchObject([
      {
        query: 'tree',
        normalizedQuery: 'tree',
        status: 'success',
        attempts: 2
      }
    ]);
  });

  it('preserves existing settings if not provided in update', () => {
    recordSearchHistory({
      query: 'persist',
      status: 'success',
      includeTranslations: true,
      translationLanguageCode: 'fr'
    });
    recordSearchHistory({
      query: 'persist',
      status: 'success'
    });

    expect(getSearchHistory()[0]).toMatchObject({
      includeTranslations: true,
      translationLanguageCode: 'fr',
      attempts: 2
    });
  });

  it('ignores empty queries', () => {
    recordSearchHistory({ query: ' ', status: 'success' });
    expect(getSearchHistory()).toHaveLength(0);
  });

  it('limits history size', () => {
    for (let i = 0; i < 30; i++) {
      recordSearchHistory({ query: `q${i}`, status: 'success' });
    }
    expect(getSearchHistory()).toHaveLength(20);
    expect(getSearchHistory()[0].query).toBe('q29');
  });

  it('clears history', () => {
    recordSearchHistory({ query: 'test', status: 'success' });
    clearSearchHistory();
    expect(getSearchHistory()).toHaveLength(0);
  });

  it('handles storage errors gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new Error('read fail');
      }),
      setItem: vi.fn(),
      clear: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn()
    });
    expect(getSearchHistory()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error('write fail');
      }),
      clear: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn()
    });
    recordSearchHistory({ query: 'test', status: 'success' });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('handles missing storage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getSearchHistory()).toEqual([]);
    recordSearchHistory({ query: 'test', status: 'success' });
    clearSearchHistory();
  });

  it('ignores malformed stored history', () => {
    localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, '{broken');
    expect(getSearchHistory()).toEqual([]);

    localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, '{"not": "an array"}');
    expect(getSearchHistory()).toEqual([]);
  });
});
