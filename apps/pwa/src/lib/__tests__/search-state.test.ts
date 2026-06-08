import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearStoredSearchState,
  readStoredSearchState,
  SEARCH_STATE_STORAGE_KEY,
  writeStoredSearchState
} from '../search-state';

const emptyResult = { entries: [], source: 'network' as const };

describe('PWA search state storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips the last dictionary view model', () => {
    writeStoredSearchState({
      searchTerm: 'test',
      includeTranslations: true,
      translationLanguageCode: 'ru',
      rawSearchResult: emptyResult,
      searchResult: emptyResult
    });

    expect(readStoredSearchState()).toEqual({
      searchTerm: 'test',
      includeTranslations: true,
      translationLanguageCode: 'ru',
      rawSearchResult: emptyResult,
      searchResult: emptyResult
    });
  });

  it('ignores malformed or incomplete stored state', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    localStorage.setItem(
      SEARCH_STATE_STORAGE_KEY,
      JSON.stringify({ searchTerm: 'missing-results' })
    );
    expect(readStoredSearchState()).toBeNull();

    localStorage.setItem(SEARCH_STATE_STORAGE_KEY, '{');
    expect(readStoredSearchState()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('clears the stored lookup state', () => {
    localStorage.setItem(SEARCH_STATE_STORAGE_KEY, '{}');

    clearStoredSearchState();

    expect(localStorage.getItem(SEARCH_STATE_STORAGE_KEY)).toBeNull();
  });

  it('no-ops when browser storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(readStoredSearchState()).toBeNull();
    expect(() =>
      writeStoredSearchState({
        searchTerm: 'test',
        includeTranslations: false,
        translationLanguageCode: 'all',
        rawSearchResult: emptyResult,
        searchResult: emptyResult
      })
    ).not.toThrow();
    expect(() => clearStoredSearchState()).not.toThrow();
  });
});
