import { describe, expect, it } from 'vitest';
import type { SearchHistoryEntry } from '@workspace/shared';
import {
  getSearchHistoryFailureReason,
  getSearchHistoryStatusClass,
  getSearchHistoryStatusIcon,
  getVisibleSearchHistory
} from '../search-history-view';

const history: SearchHistoryEntry[] = [
  {
    id: '1',
    query: 'test',
    normalizedQuery: 'test',
    status: 'success',
    includeTranslations: false,
    translationLanguageCode: 'all',
    attempts: 1,
    lastTriedAt: '2026-06-03T10:00:00.000Z'
  },
  {
    id: '2',
    query: 'tree',
    normalizedQuery: 'tree',
    status: 'not_found',
    includeTranslations: true,
    translationLanguageCode: 'ru',
    attempts: 1,
    lastTriedAt: '2026-06-03T10:01:00.000Z'
  },
  {
    id: '3',
    query: 'broken',
    normalizedQuery: 'broken',
    status: 'failed',
    includeTranslations: false,
    translationLanguageCode: 'all',
    attempts: 1,
    lastTriedAt: '2026-06-03T10:02:00.000Z'
  }
];

describe('search history view helpers', () => {
  it('filters visible entries by normalized query and limit', () => {
    expect(getVisibleSearchHistory(history, 'tr')).toEqual([history[1]]);
    expect(getVisibleSearchHistory(history, '', 2)).toEqual(history.slice(0, 2));
  });

  it('maps status to compact icons and classes', () => {
    expect(getSearchHistoryStatusIcon(history[0])).toBe('');
    expect(getSearchHistoryStatusIcon(history[1])).toBe('?');
    expect(getSearchHistoryStatusIcon(history[2])).toBe('!');
    expect(getSearchHistoryStatusClass(history[0])).toContain('text-slate-400');
    expect(getSearchHistoryStatusClass(history[1])).toContain('text-amber-700');
    expect(getSearchHistoryStatusClass(history[2])).toContain('text-rose-700');
  });

  it('maps dictionary lookup errors to search-history failure reasons', () => {
    expect(getSearchHistoryFailureReason('network')).toBe('network');
    expect(getSearchHistoryFailureReason('server')).toBe('server');
    expect(getSearchHistoryFailureReason('not_found')).toBeUndefined();
  });
});
