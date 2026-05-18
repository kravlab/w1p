import { describe, expect, it } from 'vitest';
import {
  filterDictionaryLogs,
  groupDictionaryLogsByDate,
  isStorageLogType,
  sectionDictionaryLogs,
  type DictionaryLogEntry
} from '../logging';

const entries: DictionaryLogEntry[] = [
  {
    id: '1',
    timestamp: '2026-05-09T10:00:00.000Z',
    word: 'test',
    type: 'success',
    source: 'network',
    message: 'Lookup succeeded for "test".'
  },
  {
    id: '2',
    timestamp: '2026-05-09T11:00:00.000Z',
    word: 'persistent-storage',
    type: 'storage_unsupported',
    source: 'unknown',
    message: 'Persistent storage is not supported in this browser.'
  },
  {
    id: '3',
    timestamp: '2026-05-10T09:00:00.000Z',
    word: 'missing',
    type: 'not_found',
    source: 'network',
    message: 'Word not found'
  }
];

describe('logging helpers', () => {
  it('classifies storage log types', () => {
    expect(isStorageLogType('storage_granted')).toBe(true);
    expect(isStorageLogType('success')).toBe(false);
  });

  it('filters logs by type and search term', () => {
    expect(filterDictionaryLogs(entries, { type: 'not_found' })).toEqual([entries[2]]);
    expect(filterDictionaryLogs(entries, { searchTerm: 'persist' })).toEqual([entries[1]]);
  });

  it('splits dictionary and storage sections', () => {
    expect(sectionDictionaryLogs(entries)).toEqual([
      {
        id: 'dictionary',
        entries: [entries[0], entries[2]]
      },
      {
        id: 'storage',
        entries: [entries[1]]
      }
    ]);
  });

  it('groups entries by locale date label while preserving order', () => {
    const groups = groupDictionaryLogsByDate([entries[0], entries[1], entries[2]]);

    expect(groups).toHaveLength(2);
    expect(groups[0].entries).toEqual([entries[0], entries[1]]);
    expect(groups[1].entries).toEqual([entries[2]]);
  });
});
