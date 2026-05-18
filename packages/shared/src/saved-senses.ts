import type { Phonetic, Translation } from './dictionary';

export const SAVED_SENSES_STORAGE_KEY = 'dictionary-saved-senses';

export interface SavedSenseTranslation {
  languageCode?: string;
  languageName?: string;
  source?: 'api' | 'user';
  words: string[];
}

export interface SavedSenseQuote {
  text: string;
  reference?: string;
}

export interface SavedSensePronunciation {
  type?: string;
  text?: string;
  tags: string[];
}

export interface SavedSense {
  id: string;
  word: string;
  languageCode?: string;
  languageName?: string;
  partOfSpeech: string;
  phonetic?: string;
  pronunciations: SavedSensePronunciation[];
  definition: string;
  tags: string[];
  examples: string[];
  quotes: SavedSenseQuote[];
  synonyms: string[];
  antonyms: string[];
  translation?: SavedSenseTranslation;
  sourceUrl?: string;
  savedAt: string;
}

export type SavedSenseInput = Omit<SavedSense, 'id' | 'savedAt'>;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function normalizeStringList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function normalizePronunciations(
  pronunciations: SavedSensePronunciation[]
): SavedSensePronunciation[] {
  return pronunciations.map((pronunciation) => ({
    type: pronunciation.type?.trim() || undefined,
    text: pronunciation.text?.trim() || undefined,
    tags: normalizeStringList(pronunciation.tags)
  }));
}

function normalizeQuotes(quotes: SavedSenseQuote[]): SavedSenseQuote[] {
  return quotes
    .map((quote) => ({
      text: quote.text.trim(),
      reference: quote.reference?.trim() || undefined
    }))
    .filter((quote) => quote.text);
}

function normalizeTranslation(
  translation?: SavedSenseTranslation
): SavedSenseTranslation | undefined {
  if (!translation) {
    return undefined;
  }

  const words = normalizeStringList(translation.words);
  if (!words.length) {
    return undefined;
  }

  return {
    languageCode: translation.languageCode?.trim().toLowerCase() || undefined,
    languageName: translation.languageName?.trim() || undefined,
    source: translation.source || 'api',
    words
  };
}

/**
 * Saved-sense IDs only include the fields that distinguish one meaning from
 * another in the product UX: word, entry language, part of speech, definition,
 * and whether the sense was saved for a specific translation language.
 */
export function buildSavedSenseId(input: {
  word: string;
  languageCode?: string;
  partOfSpeech: string;
  definition: string;
  translationLanguageCode?: string;
}): string {
  const payload = JSON.stringify({
    word: input.word.trim().toLowerCase(),
    languageCode: input.languageCode?.trim().toLowerCase() || '',
    partOfSpeech: input.partOfSpeech.trim().toLowerCase(),
    definition: input.definition.trim(),
    translationLanguageCode: input.translationLanguageCode?.trim().toLowerCase() || ''
  });

  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `sense-${(hash >>> 0).toString(16)}`;
}

/**
 * A saved sense stores normalized domain data, not the raw upstream payload,
 * so future UI changes can reuse the saved library without reparsing API
 * responses or depending on cache availability.
 */
export function normalizeSavedSense(input: SavedSenseInput): SavedSense {
  const translation = normalizeTranslation(input.translation);

  return {
    ...input,
    id: buildSavedSenseId({
      word: input.word,
      languageCode: input.languageCode,
      partOfSpeech: input.partOfSpeech,
      definition: input.definition,
      translationLanguageCode: translation?.languageCode
    }),
    word: input.word.trim(),
    languageCode: input.languageCode?.trim().toLowerCase() || undefined,
    languageName: input.languageName?.trim() || undefined,
    partOfSpeech: input.partOfSpeech.trim(),
    phonetic: input.phonetic?.trim() || undefined,
    pronunciations: normalizePronunciations(input.pronunciations),
    definition: input.definition.trim(),
    tags: normalizeStringList(input.tags),
    examples: normalizeStringList(input.examples),
    quotes: normalizeQuotes(input.quotes),
    synonyms: normalizeStringList(input.synonyms),
    antonyms: normalizeStringList(input.antonyms),
    translation,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    savedAt: new Date().toISOString()
  };
}

function readStoredSavedSenses(): SavedSense[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const rawValue = localStorage.getItem(SAVED_SENSES_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to read saved senses', error);
    return [];
  }
}

function writeStoredSavedSenses(entries: SavedSense[]): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    localStorage.setItem(SAVED_SENSES_STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('Failed to persist saved senses', error);
  }
}

export function getSavedSenses(): SavedSense[] {
  return readStoredSavedSenses();
}

export function isSavedSense(id: string): boolean {
  return readStoredSavedSenses().some((entry) => entry.id === id);
}

export function saveSense(input: SavedSenseInput): SavedSense {
  const nextEntry = normalizeSavedSense(input);
  const previousEntries = readStoredSavedSenses();

  if (previousEntries.some((entry) => entry.id === nextEntry.id)) {
    return previousEntries.find((entry) => entry.id === nextEntry.id) ?? nextEntry;
  }

  writeStoredSavedSenses([nextEntry, ...previousEntries]);
  return nextEntry;
}

export function removeSavedSense(id: string): void {
  writeStoredSavedSenses(readStoredSavedSenses().filter((entry) => entry.id !== id));
}

export function clearSavedSenses(): void {
  if (!canUseStorage()) {
    return;
  }

  localStorage.removeItem(SAVED_SENSES_STORAGE_KEY);
}

export function buildSavedSenseTranslation(
  translations: Translation[],
  translationLanguageCode: string
): SavedSenseTranslation | undefined {
  if (translationLanguageCode === 'all') {
    return undefined;
  }

  const matchingTranslations = translations.filter(
    (translation) => translation.languageCode === translationLanguageCode
  );
  if (!matchingTranslations.length) {
    return undefined;
  }

  return {
    languageCode: matchingTranslations[0].languageCode,
    languageName: matchingTranslations[0].languageName,
    source: 'api',
    words: matchingTranslations.map((translation) => translation.word)
  };
}

export function mapPhoneticsToSavedPronunciations(
  phonetics: Phonetic[]
): SavedSensePronunciation[] {
  return phonetics.map((phonetic) => ({
    text: phonetic.text,
    tags: []
  }));
}
