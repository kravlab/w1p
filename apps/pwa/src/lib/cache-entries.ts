import { DICTIONARY_CACHE_NAME, type DictionarySearchResult } from '@workspace/shared';

export interface DictionaryCacheEntry {
  url: string;
  word: string;
  sourceUrl?: string;
}

/**
 * Cache entries are normalized once at the browser-storage boundary so the UI
 * can filter and render dictionary cache metadata without parsing request URLs.
 */
export async function listDictionaryCacheEntries(
  cacheStorage: CacheStorage | undefined = typeof caches === 'undefined' ? undefined : caches
): Promise<DictionaryCacheEntry[]> {
  if (!cacheStorage) {
    return [];
  }

  const cache = await cacheStorage.open(DICTIONARY_CACHE_NAME);
  const requests = await cache.keys();
  return Promise.all(
    requests.map(async (request) => {
      const response = await cache.match(request);
      const data = response ? ((await response.json()) as DictionarySearchResult) : undefined;
      const url = request.url;
      const pathname = new URL(url).pathname;
      const word = decodeURIComponent(pathname.split('/').pop() || '');

      return { url, word, sourceUrl: data?.sourceUrl };
    })
  );
}

export function filterDictionaryCacheEntries(
  entries: DictionaryCacheEntry[],
  searchTerm: string
): DictionaryCacheEntry[] {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  return entries.filter((entry) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      entry.word.toLowerCase().includes(normalizedSearch) ||
      entry.url.toLowerCase().includes(normalizedSearch) ||
      entry.sourceUrl?.toLowerCase().includes(normalizedSearch)
    );
  });
}

export async function deleteDictionaryCacheEntry(
  url: string,
  cacheStorage: CacheStorage | undefined = typeof caches === 'undefined' ? undefined : caches
): Promise<void> {
  if (!cacheStorage) {
    return;
  }

  const cache = await cacheStorage.open(DICTIONARY_CACHE_NAME);
  await cache.delete(url);
}
