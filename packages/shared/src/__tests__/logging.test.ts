import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import {
  appendDictionaryLog,
  clearDictionaryLogs,
  filterDictionaryLogs,
  getDictionaryLogs,
  groupDictionaryLogsByDate,
  isStorageLogType,
  LOG_STORAGE_KEY,
  sectionDictionaryLogs,
  type DictionaryLogEntry
} from '../logging';
import { DictionaryLookupError } from '../dictionary';

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
    expect(isStorageLogType('storage_denied')).toBe(true);
    expect(isStorageLogType('storage_unsupported')).toBe(true);
    expect(isStorageLogType('success')).toBe(false);
    expect(isStorageLogType('network')).toBe(false);
  });

  it('filters logs by type and search term', () => {
    expect(filterDictionaryLogs(entries, { type: 'not_found' })).toEqual([entries[2]]);
    expect(filterDictionaryLogs(entries, { searchTerm: 'persist' })).toEqual([entries[1]]);
    expect(filterDictionaryLogs(entries, { searchTerm: '  TEST  ' })).toEqual([entries[0]]);
    expect(filterDictionaryLogs(entries, { type: 'all', searchTerm: '' })).toEqual(entries);
  });

  it('filters logs by source', () => {
    expect(filterDictionaryLogs(entries, { source: 'network' })).toEqual([entries[0], entries[2]]);
    expect(filterDictionaryLogs(entries, { source: 'unknown' })).toEqual([entries[1]]);
    expect(filterDictionaryLogs(entries, { source: 'all' })).toEqual(entries);
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

    expect(sectionDictionaryLogs([entries[0]])).toEqual([
      {
        id: 'dictionary',
        entries: [entries[0]]
      }
    ]);

    expect(sectionDictionaryLogs([entries[1]])).toEqual([
      {
        id: 'storage',
        entries: [entries[1]]
      }
    ]);

    expect(sectionDictionaryLogs([])).toEqual([]);
  });

  it('groups entries by locale date label while preserving order', () => {
    const groups = groupDictionaryLogsByDate([entries[0], entries[1], entries[2]]);

    expect(groups).toHaveLength(2);
    expect(groups[0].entries).toEqual([entries[0], entries[1]]);
    expect(groups[1].entries).toEqual([entries[2]]);
  });
});

describe('logging storage and side effects', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appends and retrieves logs', () => {
    appendDictionaryLog({
      word: 'hello',
      type: 'success',
      message: 'Found hello',
      source: 'cache'
    });

    const logs = getDictionaryLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].word).toBe('hello');
  });

  it('handles multiple appends and limits log size', () => {
    for (let i = 0; i < 210; i++) {
      appendDictionaryLog({
        word: `word-${i}`,
        type: 'success',
        message: `message-${i}`
      });
    }

    const logs = getDictionaryLogs();
    expect(logs).toHaveLength(200);
    expect(logs[0].word).toBe('word-209'); // Newest first
  });

  it('clears logs', () => {
    appendDictionaryLog({ word: 'test', type: 'success', message: 'test' });
    clearDictionaryLogs();
    expect(getDictionaryLogs()).toHaveLength(0);
  });

  it('serializes different error types', () => {
    const lookupError = new DictionaryLookupError('Not found', 'network', 404);
    appendDictionaryLog({
      word: 'err',
      type: 'network',
      message: 'fail',
      rawError: lookupError,
      url: 'https://api.com'
    });

    const stdError = new Error('std fail');
    appendDictionaryLog({
      word: 'std',
      type: 'runtime_error',
      message: 'std message',
      rawError: stdError
    });

    appendDictionaryLog({
      word: 'str',
      type: 'unknown',
      message: 'str message',
      rawError: 'simple string error'
    });

    appendDictionaryLog({
      word: 'obj',
      type: 'unknown',
      message: 'obj message',
      rawError: { code: 123 }
    });

    appendDictionaryLog({
      word: 'none',
      type: 'success',
      message: 'ok'
    });

    const logs = getDictionaryLogs();
    expect(logs[4].rawError).toMatchObject({
      name: 'DictionaryLookupError',
      message: 'Not found'
    });
    expect(logs[3].rawError).toMatchObject({
      message: 'std fail'
    });
    expect(logs[2].rawError).toMatchObject({
      message: 'simple string error'
    });
    expect(logs[1].rawError).toMatchObject({
      message: '{"code":123}'
    });
    expect(logs[0].rawError).toBeUndefined();
  });

  it('handles localStorage errors gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new Error('storage fail');
      }),
      setItem: vi.fn(),
      clear: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn()
    });

    expect(getDictionaryLogs()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error('storage write fail');
      }),
      clear: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn()
    });
    appendDictionaryLog({ word: 'test', type: 'success', message: 'test' });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('handles missing storage correctly', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(getDictionaryLogs()).toEqual([]);
    appendDictionaryLog({ word: 'test', type: 'success', message: 'test' });
    clearDictionaryLogs();
  });

  it('handles invalid JSON in storage', () => {
    localStorage.setItem(LOG_STORAGE_KEY, 'invalid-json');
    expect(getDictionaryLogs()).toEqual([]);
  });

  it('handles non-array JSON in storage', () => {
    localStorage.setItem(LOG_STORAGE_KEY, '{"not": "an array"}');
    expect(getDictionaryLogs()).toEqual([]);
  });
});
