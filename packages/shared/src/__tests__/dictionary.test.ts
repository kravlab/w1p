import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DictionaryLookupError,
  fetchDefinition,
  clearDictionaryCache,
  filterDictionarySearchResult
} from '../dictionary';

/**
 * Unit tests for the Dictionary API Client with Caching.
 * Uses global fetch and caches mocking to simulate API responses and cache behavior.
 */
describe('Dictionary API Client', () => {
  const mockWord = 'test';
  const mockUrl = `https://freedictionaryapi.com/api/v1/entries/en/${mockWord}`;
  const mockApiData = {
    word: mockWord,
    entries: [
      {
        language: { code: 'en', name: 'English' },
        partOfSpeech: 'noun',
        pronunciations: [{ text: '/test/', audio: 'test.mp3' }],
        senses: [
          {
            definition: 'A procedure intended to establish quality.',
            examples: ['This is only a test.'],
            synonyms: ['trial'],
            antonyms: [],
            translations: [
              {
                language: { code: 'ru', name: 'Russian' },
                word: 'тест'
              }
            ],
            subsenses: [
              {
                definition: 'Subsense def',
                translations: []
              }
            ]
          }
        ],
        synonyms: ['exam'],
        antonyms: []
      }
    ],
    source: {
      url: 'https://en.wiktionary.org/wiki/test'
    }
  };
  const mockResult = {
    entries: [
      {
        word: mockWord,
        phonetic: '/test/',
        phonetics: [{ text: '/test/', audio: 'test.mp3' }],
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [
              {
                definition: 'A procedure intended to establish quality.',
                example: 'This is only a test.',
                synonyms: ['trial'],
                antonyms: [],
                translations: [{ languageCode: 'ru', languageName: 'Russian', word: 'тест' }]
              },
              {
                definition: 'Subsense def',
                example: undefined,
                synonyms: [],
                antonyms: [],
                translations: []
              }
            ],
            synonyms: ['exam'],
            antonyms: []
          }
        ]
      }
    ],
    sourceUrl: 'https://en.wiktionary.org/wiki/test',
    source: 'network'
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());

    // Mock Cache API
    const mockCache = {
      match: vi.fn(),
      put: vi.fn()
    };

    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue(mockCache),
      delete: vi.fn().mockResolvedValue(true)
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function withExpectedConsoleError(run: () => Promise<void>): Promise<void> {
    // Failure-path assertions intentionally trigger dictionary diagnostics; suppress only that noise.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await run();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  }

  async function withExpectedConsoleWarn(run: () => Promise<void>): Promise<void> {
    // Missing-word assertions intentionally trigger dictionary diagnostics; suppress only that noise.
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await run();
    } finally {
      consoleWarnSpy.mockRestore();
    }
  }

  it('should return data for a valid word and store it in cache', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockApiData)
    };
    (fetch as any).mockResolvedValue(mockResponse);

    const mockCache = await caches.open('any');
    (mockCache.match as any).mockResolvedValue(null);

    const result = await fetchDefinition(mockWord);

    expect(result.entries[0].word).toBe(mockWord);
    expect(fetch).toHaveBeenCalledWith(mockUrl);
    expect(mockCache.put).toHaveBeenCalledTimes(1);
  });

  it('should return data from cache if available', async () => {
    const mockCachedResponse = {
      json: vi.fn().mockResolvedValue({
        ...mockResult,
        source: 'network'
      })
    };

    const mockCache = await caches.open('any');
    (mockCache.match as any).mockResolvedValue(mockCachedResponse);

    const result = await fetchDefinition(mockWord);

    expect(result.source).toBe('cache');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should handle cache hit with translations', async () => {
    const mockCachedResponse = {
      json: vi.fn().mockResolvedValue({
        ...mockResult,
        source: 'network'
      })
    };

    const mockCache = await caches.open('any');
    (mockCache.match as any).mockResolvedValue(mockCachedResponse);

    const result = await fetchDefinition(mockWord, {
      includeTranslations: true,
      translationLanguageCode: 'ru'
    });
    expect(result.source).toBe('cache');
  });

  it('should handle cache read error and fallback to network', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('caches', {
      open: vi.fn().mockRejectedValue(new Error('cache fail'))
    });

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockApiData)
    };
    (fetch as any).mockResolvedValue(mockResponse);

    const result = await fetchDefinition(mockWord);
    expect(result.source).toBe('network');
    expect(fetch).toHaveBeenCalled();
  });

  it('should throw "Word not found" for 404', async () => {
    await withExpectedConsoleWarn(async () => {
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 404
      });

      const mockCache = await caches.open('any');
      (mockCache.match as any).mockResolvedValue(null);

      await expect(fetchDefinition('unknown')).rejects.toThrow('Word not found');
    });
  });

  it('should throw generic error for other failure statuses', async () => {
    await withExpectedConsoleError(async () => {
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 500
      });

      const mockCache = await caches.open('any');
      (mockCache.match as any).mockResolvedValue(null);

      await expect(fetchDefinition('error')).rejects.toMatchObject({
        code: 'server'
      });
    });
  });

  it('should log and throw a network error when fetch rejects', async () => {
    await withExpectedConsoleError(async () => {
      (fetch as any).mockRejectedValue(new TypeError('Failed to fetch'));

      const mockCache = await caches.open('any');
      (mockCache.match as any).mockResolvedValue(null);

      await expect(fetchDefinition('offline')).rejects.toThrow(DictionaryLookupError);
    });
  });

  it('should handle cache write error gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockCache = {
      match: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockRejectedValue(new Error('write fail'))
    };
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue(mockCache)
    });

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockApiData)
    };
    (fetch as any).mockResolvedValue(mockResponse);

    await fetchDefinition(mockWord);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cache API failed to write'),
      expect.any(Error)
    );
  });

  it('should delete the cache when clearDictionaryCache is called', async () => {
    await clearDictionaryCache();
    expect(caches.delete).toHaveBeenCalledWith('dictionary-api-cache');
  });

  it('should skip cache and storage operations if they are missing', async () => {
    const originalCaches = global.caches;
    // @ts-expect-error - testing missing caches
    delete (global as any).caches;

    (fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockApiData)
    });

    await fetchDefinition(mockWord);
    await clearDictionaryCache(); // Should not throw

    global.caches = originalCaches;
  });

  it('filters results by language', () => {
    const filtered = filterDictionarySearchResult(mockResult as any, 'fr');
    expect(filtered.entries[0].meanings[0].definitions[0].translations).toHaveLength(0);

    const all = filterDictionarySearchResult(mockResult as any, 'all');
    expect(all).toBe(mockResult);
  });
});
