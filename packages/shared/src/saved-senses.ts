import type { Phonetic, Translation } from './dictionary';

export const SAVED_SENSES_STORAGE_KEY = 'dictionary-saved-senses';
export const SAVED_SENSES_YJS_STORAGE_KEY = 'dictionary-saved-senses-yjs-v1';

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

interface YjsDocLike {
  getMap: (name: string) => YjsMapLike<SavedSense>;
}

interface YjsMapLike<T> {
  clear: () => void;
  delete: (key: string) => void;
  entries: () => IterableIterator<[string, T]>;
  set: (key: string, value: T) => void;
}

interface YjsModuleLike {
  Doc: new () => YjsDocLike;
  applyUpdate: (doc: YjsDocLike, update: Uint8Array) => void;
  encodeStateAsUpdate: (doc: YjsDocLike) => Uint8Array;
}

interface SavedSensesYjsRuntime {
  doc: YjsDocLike;
  map: YjsMapLike<SavedSense>;
  yjs: YjsModuleLike;
}

let savedSensesYjsRuntime: SavedSensesYjsRuntime | null = null;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function encodeBytes(value: Uint8Array): string {
  const binary = Array.from(value, (byte) => String.fromCharCode(byte)).join('');

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  /* v8 ignore next 5 -- Node-only fallback for runtimes without btoa. */
  return (
    globalThis as typeof globalThis & {
      Buffer: {
        from: (value: string, encoding: string) => { toString: (encoding: string) => string };
      };
    }
  ).Buffer.from(binary, 'binary').toString('base64');
}

function decodeBytes(value: string): Uint8Array {
  /* v8 ignore next 10 -- Node-only fallback for runtimes without atob. */
  const binary =
    typeof atob === 'function'
      ? atob(value)
      : (
          globalThis as typeof globalThis & {
            Buffer: {
              from: (value: string, encoding: string) => { toString: (encoding: string) => string };
            };
          }
        ).Buffer.from(value, 'base64').toString('binary');

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function loadYjs(): Promise<YjsModuleLike | null> {
  try {
    return (await import('yjs')) as unknown as YjsModuleLike;
  } catch (error) {
    console.warn('Failed to load Yjs saved-senses runtime', error);
    return null;
  }
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
 * responses or depending on cache availability. Re-saving the same identity
 * replaces the stored entry so edits can update an existing sense in place.
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

function getRuntimeSavedSenses(): SavedSense[] {
  if (!savedSensesYjsRuntime) {
    return readStoredSavedSenses();
  }

  return Array.from(savedSensesYjsRuntime.map.entries())
    .map(([, value]) => value)
    .sort((first, second) => second.savedAt.localeCompare(first.savedAt));
}

function projectRuntimeSavedSenses(): void {
  writeStoredSavedSenses(getRuntimeSavedSenses());
}

function persistRuntimeState(): void {
  if (!canUseStorage() || !savedSensesYjsRuntime) {
    return;
  }

  try {
    localStorage.setItem(
      SAVED_SENSES_YJS_STORAGE_KEY,
      encodeBytes(savedSensesYjsRuntime.yjs.encodeStateAsUpdate(savedSensesYjsRuntime.doc))
    );
    projectRuntimeSavedSenses();
  } catch (error) {
    console.warn('Failed to persist saved-senses Yjs state', error);
  }
}

/**
 * Initializes the CRDT document that backs saved senses during sync-enabled app
 * sessions. Existing localStorage data is imported only when no persisted Yjs
 * state exists, preserving Yjs delete markers after future reloads.
 */
export async function initializeSavedSensesSync(): Promise<boolean> {
  if (savedSensesYjsRuntime) {
    return true;
  }

  const yjs = await loadYjs();
  if (!yjs) {
    return false;
  }

  const doc = new yjs.Doc();
  const map = doc.getMap('savedSenses');
  savedSensesYjsRuntime = { doc, map, yjs };

  const storedState = canUseStorage() ? localStorage.getItem(SAVED_SENSES_YJS_STORAGE_KEY) : null;
  if (storedState) {
    try {
      yjs.applyUpdate(doc, decodeBytes(storedState));
      projectRuntimeSavedSenses();
      return true;
    } catch (error) {
      console.warn('Failed to restore saved-senses Yjs state', error);
    }
  }

  for (const entry of readStoredSavedSenses()) {
    map.set(entry.id, entry);
  }
  persistRuntimeState();
  return true;
}

export function isSavedSensesSyncInitialized(): boolean {
  return Boolean(savedSensesYjsRuntime);
}

/**
 * Test-only hook for resetting the in-memory CRDT document between isolated
 * storage scenarios. Production code should use clearSavedSenses() so Yjs
 * deletion operations remain part of the persisted CRDT history.
 */
export function resetSavedSensesSyncForTests(): void {
  savedSensesYjsRuntime = null;
}

export function getSavedSensesYjsUpdate(): Uint8Array | null {
  if (!savedSensesYjsRuntime) {
    return null;
  }

  return savedSensesYjsRuntime.yjs.encodeStateAsUpdate(savedSensesYjsRuntime.doc);
}

export async function applySavedSensesYjsUpdate(update: Uint8Array): Promise<boolean> {
  /* v8 ignore next 3 -- initialize returns false only when the yjs package is absent. */
  if (!savedSensesYjsRuntime && !(await initializeSavedSensesSync())) {
    return false;
  }

  /* v8 ignore next 3 -- kept as a guard against unexpected runtime mutation. */
  if (!savedSensesYjsRuntime) {
    return false;
  }

  savedSensesYjsRuntime.yjs.applyUpdate(savedSensesYjsRuntime.doc, update);
  persistRuntimeState();
  return true;
}

export function getSavedSenses(): SavedSense[] {
  return getRuntimeSavedSenses();
}

export function isSavedSense(id: string): boolean {
  return getRuntimeSavedSenses().some((entry) => entry.id === id);
}

export function saveSense(input: SavedSenseInput): SavedSense {
  const nextEntry = normalizeSavedSense(input);
  if (savedSensesYjsRuntime) {
    savedSensesYjsRuntime.map.set(nextEntry.id, nextEntry);
    persistRuntimeState();
    return nextEntry;
  }

  const previousEntries = readStoredSavedSenses();
  writeStoredSavedSenses([
    nextEntry,
    ...previousEntries.filter((entry) => entry.id !== nextEntry.id)
  ]);
  return nextEntry;
}

export function removeSavedSense(id: string): void {
  if (savedSensesYjsRuntime) {
    savedSensesYjsRuntime.map.delete(id);
    persistRuntimeState();
    return;
  }

  writeStoredSavedSenses(readStoredSavedSenses().filter((entry) => entry.id !== id));
}

export function clearSavedSenses(): void {
  if (savedSensesYjsRuntime) {
    savedSensesYjsRuntime.map.clear();
    persistRuntimeState();
    return;
  }

  if (!canUseStorage()) {
    return;
  }

  localStorage.removeItem(SAVED_SENSES_STORAGE_KEY);
  localStorage.removeItem(SAVED_SENSES_YJS_STORAGE_KEY);
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
