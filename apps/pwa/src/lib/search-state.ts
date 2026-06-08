import type { DictionarySearchResult } from '@workspace/shared';

export const SEARCH_STATE_STORAGE_KEY = 'pwa-search-state';

export interface StoredSearchState {
  searchTerm: string;
  includeTranslations: boolean;
  translationLanguageCode: string;
  rawSearchResult: DictionarySearchResult;
  searchResult: DictionarySearchResult;
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * The last lookup is persisted as a complete view model so reloads,
 * service-worker refreshes, and installed PWA restarts can restore the same
 * dictionary context without re-querying the network.
 */
export function writeStoredSearchState(state: StoredSearchState): void {
  if (!canUseLocalStorage()) {
    return;
  }

  localStorage.setItem(SEARCH_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function clearStoredSearchState(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  localStorage.removeItem(SEARCH_STATE_STORAGE_KEY);
}

export function readStoredSearchState(): StoredSearchState | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const rawValue = localStorage.getItem(SEARCH_STATE_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const storedState = JSON.parse(rawValue) as Partial<StoredSearchState>;
    if (!storedState.searchTerm || !storedState.rawSearchResult || !storedState.searchResult) {
      return null;
    }

    return {
      searchTerm: storedState.searchTerm,
      includeTranslations: Boolean(storedState.includeTranslations),
      translationLanguageCode: storedState.translationLanguageCode || 'all',
      rawSearchResult: storedState.rawSearchResult,
      searchResult: storedState.searchResult
    };
  } catch (error) {
    console.warn('Failed to restore search state', error);
    return null;
  }
}
