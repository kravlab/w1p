import type {
  DictionaryLookupError,
  SearchHistoryEntry,
  SearchHistoryFailureReason
} from '@workspace/shared';

export function getVisibleSearchHistory(
  searchHistory: SearchHistoryEntry[],
  searchTerm: string,
  limit = 8
): SearchHistoryEntry[] {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchingEntries = normalizedSearch
    ? searchHistory.filter((entry) => entry.normalizedQuery.includes(normalizedSearch))
    : searchHistory;

  return matchingEntries.slice(0, limit);
}

export function getSearchHistoryStatusIcon(entry: SearchHistoryEntry): string {
  if (entry.status === 'failed') {
    return '!';
  }

  if (entry.status === 'not_found') {
    return '?';
  }

  return '';
}

export function getSearchHistoryStatusClass(entry: SearchHistoryEntry): string {
  if (entry.status === 'failed') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  if (entry.status === 'not_found') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-slate-200 bg-white text-slate-400';
}

export function getSearchHistoryFailureReason(
  type: DictionaryLookupError['code']
): SearchHistoryFailureReason | undefined {
  if (type === 'network' || type === 'server') {
    return type;
  }

  return undefined;
}
