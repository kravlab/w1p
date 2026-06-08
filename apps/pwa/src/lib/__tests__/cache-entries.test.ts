import { describe, expect, it } from 'vitest';
import {
  deleteDictionaryCacheEntry,
  filterDictionaryCacheEntries,
  listDictionaryCacheEntries
} from '../cache-entries';

describe('PWA cache entry view model', () => {
  const entries = [
    {
      url: 'https://w1p.example/dictionary/test',
      word: 'test',
      sourceUrl: 'https://en.wiktionary.org/wiki/test'
    },
    {
      url: 'https://w1p.example/dictionary/tree',
      word: 'tree'
    }
  ];

  it('filters cache entries by word, request URL, or source URL', () => {
    expect(filterDictionaryCacheEntries(entries, 'wiki')).toEqual([entries[0]]);
    expect(filterDictionaryCacheEntries(entries, 'TREE')).toEqual([entries[1]]);
    expect(filterDictionaryCacheEntries(entries, '')).toEqual(entries);
  });

  it('normalizes browser cache requests into cache entry view models', async () => {
    const request = new Request('https://w1p.example/dictionary/cache%20word');
    const cache = {
      keys: async () => [request],
      match: async () =>
        new Response(JSON.stringify({ entries: [], source: 'cache', sourceUrl: 'https://source' }))
    };
    const cacheStorage = {
      open: async () => cache
    } as unknown as CacheStorage;

    await expect(listDictionaryCacheEntries(undefined)).resolves.toEqual([]);
    await expect(listDictionaryCacheEntries(cacheStorage)).resolves.toEqual([
      {
        url: 'https://w1p.example/dictionary/cache%20word',
        word: 'cache word',
        sourceUrl: 'https://source'
      }
    ]);
  });

  it('deletes cache entries only when cache storage is available', async () => {
    let deletedUrl = '';
    const cache = {
      delete: async (url: string) => {
        deletedUrl = url;
        return true;
      }
    };
    const cacheStorage = {
      open: async () => cache
    } as unknown as CacheStorage;

    await expect(
      deleteDictionaryCacheEntry('https://w1p.example/dictionary/test', undefined)
    ).resolves.toBeUndefined();
    await deleteDictionaryCacheEntry('https://w1p.example/dictionary/test', cacheStorage);

    expect(deletedUrl).toBe('https://w1p.example/dictionary/test');
  });
});
