export const SEARCH_HISTORY_STORAGE_KEY = 'dictionary-search-history';
const MAX_SEARCH_HISTORY_ENTRIES = 20;

export type SearchHistoryStatus = 'success' | 'failed' | 'not_found';
export type SearchHistoryFailureReason = 'network' | 'server' | 'unknown';

export interface SearchHistoryEntry {
  id: string;
  query: string;
  normalizedQuery: string;
  status: SearchHistoryStatus;
  failureReason?: SearchHistoryFailureReason;
  message?: string;
  includeTranslations: boolean;
  translationLanguageCode: string;
  attempts: number;
  lastTriedAt: string;
}

export interface SearchHistoryInput {
  query: string;
  status: SearchHistoryStatus;
  failureReason?: SearchHistoryFailureReason;
  message?: string;
  includeTranslations?: boolean;
  translationLanguageCode?: string;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function readStoredSearchHistory(): SearchHistoryEntry[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const rawValue = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to read dictionary search history', error);
    return [];
  }
}

function writeStoredSearchHistory(entries: SearchHistoryEntry[]): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('Failed to persist dictionary search history', error);
  }
}

/**
 * Records the latest observable result for a query. Entries are unique per
 * normalized query so a successful retry replaces the previous failed state.
 */
export function recordSearchHistory(input: SearchHistoryInput): void {
  const query = input.query.trim();
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return;
  }

  const previousEntries = readStoredSearchHistory();
  const previousEntry = previousEntries.find((entry) => entry.normalizedQuery === normalizedQuery);
  const nextEntry: SearchHistoryEntry = {
    id: previousEntry?.id ?? crypto.randomUUID(),
    query,
    normalizedQuery,
    status: input.status,
    failureReason: input.status === 'failed' ? input.failureReason : undefined,
    message: input.message,
    includeTranslations: input.includeTranslations ?? previousEntry?.includeTranslations ?? false,
    translationLanguageCode:
      input.translationLanguageCode ?? previousEntry?.translationLanguageCode ?? 'all',
    attempts: (previousEntry?.attempts ?? 0) + 1,
    lastTriedAt: new Date().toISOString()
  };

  const nextEntries = [
    nextEntry,
    ...previousEntries.filter((entry) => entry.normalizedQuery !== normalizedQuery)
  ].slice(0, MAX_SEARCH_HISTORY_ENTRIES);

  writeStoredSearchHistory(nextEntries);
}

export function getSearchHistory(): SearchHistoryEntry[] {
  return readStoredSearchHistory();
}

export function clearSearchHistory(): void {
  if (!canUseStorage()) {
    return;
  }

  localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
}
