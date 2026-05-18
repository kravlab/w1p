import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DictionaryLookupError, fetchDefinition, clearDictionaryCache } from '../dictionary';

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
        pronunciations: [{ text: '/test/' }],
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
  const mockData = [
    {
      word: mockWord,
      phonetic: '/test/',
      phonetics: [{ text: '/test/', audio: undefined }],
      meanings: [
        {
          partOfSpeech: 'noun',
          definitions: [
            {
              definition: 'A procedure intended to establish quality.',
              example: 'This is only a test.',
              synonyms: ['trial'],
              antonyms: [],
              translations: [
                {
                  languageCode: 'ru',
                  languageName: 'Russian',
                  word: 'тест'
                }
              ]
            }
          ],
          synonyms: ['exam'],
          antonyms: []
        }
      ]
    }
  ];
  const mockResult = {
    entries: mockData,
    sourceUrl: 'https://en.wiktionary.org/wiki/test',
    source: 'network'
  };

  /**
   * Setup global mocks before each test.
   */
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
  });

  /**
   * Test case for a successful word lookup (network hit).
   */
  it('should return data for a valid word and store it in cache', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockApiData)
    };
    (fetch as any).mockResolvedValue(mockResponse);

    const mockCache = await caches.open('any');
    (mockCache.match as any).mockResolvedValue(null);

    const result = await fetchDefinition(mockWord);

    expect(result).toEqual(mockResult);
    expect(fetch).toHaveBeenCalledWith(mockUrl);
    expect(mockCache.put).toHaveBeenCalledTimes(1);
    expect(mockCache.put).toHaveBeenCalledWith(mockUrl, expect.any(Response));
  });

  /**
   * Test case for a successful word lookup (cache hit).
   */
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

    expect(result).toEqual({
      ...mockResult,
      source: 'cache'
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(mockCache.match).toHaveBeenCalledWith(mockUrl);
  });

  /**
   * Test case for handling 404 Not Found error.
   */
  it('should throw "Word not found" for 404', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 404
    });

    const mockCache = await caches.open('any');
    (mockCache.match as any).mockResolvedValue(null);

    await expect(fetchDefinition('unknown')).rejects.toThrow('Word not found');
  });

  /**
   * Test case for handling generic network or server errors.
   */
  it('should throw generic error for other failure statuses', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 500
    });

    const mockCache = await caches.open('any');
    (mockCache.match as any).mockResolvedValue(null);

    await expect(fetchDefinition('error')).rejects.toMatchObject({
      message: 'The dictionary service is unavailable right now. Please try again.',
      code: 'server'
    });
  });

  it('should log and throw a network error when fetch rejects', async () => {
    const networkError = new TypeError('Failed to fetch');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    (fetch as any).mockRejectedValue(networkError);

    const mockCache = await caches.open('any');
    (mockCache.match as any).mockResolvedValue(null);

    let thrownError: unknown;

    try {
      await fetchDefinition('offline');
    } catch (error) {
      thrownError = error;
    }

    expect(consoleError).toHaveBeenCalledWith(
      'Dictionary lookup request failed',
      expect.objectContaining({
        word: 'offline',
        url: 'https://freedictionaryapi.com/api/v1/entries/en/offline',
        error: networkError
      })
    );
    expect(thrownError).toBeInstanceOf(DictionaryLookupError);
    expect(thrownError).toMatchObject({
      message: 'Unable to reach the dictionary service. Check your connection and try again.',
      code: 'network'
    });
  });

  /**
   * Test case for clearing the cache.
   */
  it('should delete the cache when clearDictionaryCache is called', async () => {
    await clearDictionaryCache();
    expect(caches.delete).toHaveBeenCalledWith('dictionary-api-cache');
  });

  it('should append the translations query when requested', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockApiData)
    };
    (fetch as any).mockResolvedValue(mockResponse);

    const mockCache = await caches.open('any');
    (mockCache.match as any).mockResolvedValue(null);

    await fetchDefinition(mockWord, {
      includeTranslations: true,
      translationLanguageCode: 'ru'
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://freedictionaryapi.com/api/v1/entries/en/test?translations=true'
    );
    expect(mockCache.put).toHaveBeenCalledWith(
      'https://freedictionaryapi.com/api/v1/entries/en/test?translations=true',
      expect.any(Response)
    );
  });
});
