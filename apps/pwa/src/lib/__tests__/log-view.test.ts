import { describe, expect, it } from 'vitest';
import type { DictionaryLogEntry } from '@workspace/shared';
import {
  getFilteredLogEntries,
  getLogSections,
  getLogTypeBadgeClass,
  logSourceOptions,
  logTypeOptions
} from '../log-view';

const entries: DictionaryLogEntry[] = [
  {
    id: '1',
    word: 'test',
    type: 'success',
    source: 'network',
    message: 'ok',
    timestamp: '2026-06-03T10:00:00.000Z'
  },
  {
    id: '2',
    word: 'persistent-storage',
    type: 'storage_denied',
    source: 'unknown',
    message: 'denied',
    timestamp: '2026-06-03T10:01:00.000Z'
  }
];

describe('log view helpers', () => {
  it('exports stable filter option lists for the log panel', () => {
    expect(logTypeOptions).toContain('runtime_error');
    expect(logSourceOptions).toEqual(['all', 'network', 'cache', 'unknown']);
  });

  it('filters and sections log entries for rendering', () => {
    expect(
      getFilteredLogEntries(entries, {
        type: 'success',
        source: 'all',
        searchTerm: ''
      })
    ).toEqual([entries[0]]);

    const sections = getLogSections(entries, {
      type: 'all',
      source: 'all',
      searchTerm: '',
      dictionaryTitle: 'Dictionary',
      storageTitle: 'Storage'
    });

    expect(sections.map((section) => section.title)).toEqual(['Dictionary', 'Storage']);
  });

  it('maps log types to semantic badge classes', () => {
    expect(getLogTypeBadgeClass('success')).toContain('emerald');
    expect(getLogTypeBadgeClass('not_found')).toContain('amber');
    expect(getLogTypeBadgeClass('network')).toContain('orange');
    expect(getLogTypeBadgeClass('server')).toContain('rose');
    expect(getLogTypeBadgeClass('unknown')).toContain('slate');
    expect(getLogTypeBadgeClass('runtime_error')).toContain('rose');
    expect(getLogTypeBadgeClass('unhandled_rejection')).toContain('fuchsia');
    expect(getLogTypeBadgeClass('storage_granted')).toContain('emerald');
    expect(getLogTypeBadgeClass('storage_denied')).toContain('amber');
    expect(getLogTypeBadgeClass('storage_unsupported')).toContain('slate');
  });
});
