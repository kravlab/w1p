/**
 * Client and normalized types for https://freedictionaryapi.com/.
 * The UI consumes a stable `DictionaryEntry[]` shape even though the upstream
 * API returns a different nested schema.
 */

export interface Definition {
  definition: string;
  example?: string;
  synonyms: string[];
  antonyms: string[];
  translations: Translation[];
}

export interface Translation {
  languageCode: string;
  languageName: string;
  word: string;
}

export interface TranslationLanguageOption {
  code: string;
  label: string;
}

export interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
  synonyms: string[];
  antonyms: string[];
}

export interface Phonetic {
  text?: string;
  audio?: string;
  sourceUrl?: string;
}

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: Phonetic[];
  meanings: Meaning[];
}

export interface DictionarySearchResult {
  entries: DictionaryEntry[];
  sourceUrl?: string;
  source: 'cache' | 'network';
}

export class DictionaryLookupError extends Error {
  constructor(
    message: string,
    public readonly code: 'not_found' | 'network' | 'server',
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DictionaryLookupError';
  }
}

interface FreeDictionaryApiLanguage {
  code: string;
  name: string;
}

interface FreeDictionaryApiPronunciation {
  type?: string;
  text?: string;
  audio?: string;
  tags?: string[];
}

interface FreeDictionaryApiSense {
  definition: string;
  tags?: string[];
  examples?: string[];
  synonyms?: string[];
  antonyms?: string[];
  translations?: Array<{
    language: FreeDictionaryApiLanguage;
    word: string;
  }>;
  subsenses?: FreeDictionaryApiSense[];
}

interface FreeDictionaryApiEntry {
  language: FreeDictionaryApiLanguage;
  partOfSpeech: string;
  pronunciations?: FreeDictionaryApiPronunciation[];
  senses?: FreeDictionaryApiSense[];
  synonyms?: string[];
  antonyms?: string[];
}

interface FreeDictionaryApiResponse {
  word: string;
  entries: FreeDictionaryApiEntry[];
  source?: {
    url?: string;
  };
}

export const DICTIONARY_CACHE_NAME = 'dictionary-api-cache';
export const DICTIONARY_TRANSLATION_LANGUAGES: TranslationLanguageOption[] = [
  { code: 'all', label: 'All languages' },
  { code: 'ru', label: 'Russian' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' }
];

/**
 * Translation payloads are optional because they increase response size, but
 * cache entries should only split by whether translations were requested at all.
 */
function buildDictionaryUrl(word: string, includeTranslations: boolean): string {
  const baseUrl = `https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(word)}`;
  if (!includeTranslations) {
    return baseUrl;
  }

  return `${baseUrl}?translations=true`;
}

/**
 * The upstream API nests child senses recursively, while the current UI expects
 * a flat list of definitions under each part of speech.
 */
function flattenSenses(
  senses: FreeDictionaryApiSense[] = [],
  translationLanguageCode: string
): Definition[] {
  return senses.flatMap((sense) => {
    const current: Definition = {
      definition: sense.definition,
      example: sense.examples?.[0],
      synonyms: sense.synonyms ?? [],
      antonyms: sense.antonyms ?? [],
      translations: (sense.translations ?? [])
        .filter(
          (translation) =>
            translationLanguageCode === 'all' ||
            translation.language.code === translationLanguageCode
        )
        .map((translation) => ({
          languageCode: translation.language.code,
          languageName: translation.language.name,
          word: translation.word
        }))
    };

    return [current, ...flattenSenses(sense.subsenses, translationLanguageCode)];
  });
}

/**
 * Maps the upstream response into the app's internal search-result contract.
 * Source URLs belong to the whole lookup result, not to each individual entry.
 */
function normalizeDictionaryResponse(
  data: FreeDictionaryApiResponse,
  translationLanguageCode: string
): DictionarySearchResult {
  return {
    entries: data.entries.map((entry) => {
      const phonetics = (entry.pronunciations ?? []).map((pronunciation) => ({
        text: pronunciation.text,
        audio: pronunciation.audio
      }));

      return {
        word: data.word,
        phonetic: phonetics.find((phonetic) => phonetic.text)?.text,
        phonetics,
        meanings: [
          {
            partOfSpeech: entry.partOfSpeech,
            definitions: flattenSenses(entry.senses, translationLanguageCode),
            synonyms: entry.synonyms ?? [],
            antonyms: entry.antonyms ?? []
          }
        ]
      };
    }),
    sourceUrl: data.source?.url,
    source: 'network'
  };
}

/**
 * Applies a client-side translation-language filter to an already normalized
 * search result. This lets the UI switch languages without refetching or
 * duplicating cached translated payloads per language.
 */
export function filterDictionarySearchResult(
  result: DictionarySearchResult,
  translationLanguageCode: string
): DictionarySearchResult {
  if (translationLanguageCode === 'all') {
    return result;
  }

  return {
    ...result,
    entries: result.entries.map((entry) => ({
      ...entry,
      meanings: entry.meanings.map((meaning) => ({
        ...meaning,
        definitions: meaning.definitions.map((definition) => ({
          ...definition,
          translations: definition.translations.filter(
            (translation) => translation.languageCode === translationLanguageCode
          )
        }))
      }))
    }))
  };
}

/**
 * Fetches a word definition and returns the normalized UI shape.
 * Successful responses are cached by request URL, including the normalized body.
 */
export async function fetchDefinition(
  word: string,
  options: { includeTranslations?: boolean; translationLanguageCode?: string } = {}
): Promise<DictionarySearchResult> {
  const normalizedWord = word.trim().toLowerCase();
  const includeTranslations = options.includeTranslations ?? false;
  const translationLanguageCode = options.translationLanguageCode ?? 'all';
  const url = buildDictionaryUrl(normalizedWord, includeTranslations);

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(DICTIONARY_CACHE_NAME);
      const cachedResponse = await cache.match(url);

      if (cachedResponse) {
        const cachedData = (await cachedResponse.json()) as DictionarySearchResult;
        const result: DictionarySearchResult = {
          ...cachedData,
          source: 'cache'
        };
        return includeTranslations
          ? filterDictionarySearchResult(result, translationLanguageCode)
          : result;
      }
    } catch (e) {
      console.warn('Cache API failed to read, falling back to network', e);
    }
  }

  let response: Response;

  try {
    response = await fetch(url);
  } catch (error) {
    console.error('Dictionary lookup request failed', {
      word: normalizedWord,
      url,
      error
    });
    throw new DictionaryLookupError(
      'Unable to reach the dictionary service. Check your connection and try again.',
      'network',
      error
    );
  }

  if (!response.ok) {
    if (response.status === 404) {
      console.warn('Dictionary lookup returned no results', {
        word: normalizedWord,
        url,
        status: response.status
      });
      throw new DictionaryLookupError('Word not found', 'not_found');
    }
    console.error('Dictionary lookup returned an unexpected response', {
      word: normalizedWord,
      url,
      status: response.status
    });
    throw new DictionaryLookupError(
      'The dictionary service is unavailable right now. Please try again.',
      'server'
    );
  }

  const data = normalizeDictionaryResponse(
    (await response.json()) as FreeDictionaryApiResponse,
    includeTranslations ? 'all' : translationLanguageCode
  );

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(DICTIONARY_CACHE_NAME);
      await cache.put(url, new Response(JSON.stringify(data)));
    } catch (e) {
      console.warn('Cache API failed to write', e);
    }
  }

  return includeTranslations ? filterDictionarySearchResult(data, translationLanguageCode) : data;
}

/**
 * Clears normalized dictionary responses cached by `fetchDefinition`.
 */
export async function clearDictionaryCache(): Promise<void> {
  if (typeof caches !== 'undefined') {
    await caches.delete(DICTIONARY_CACHE_NAME);
  }
}
