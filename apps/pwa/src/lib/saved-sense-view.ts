import {
  buildSavedSenseId,
  buildSavedSenseTranslation,
  DICTIONARY_TRANSLATION_LANGUAGES,
  mapPhoneticsToSavedPronunciations,
  type Definition,
  type DictionaryEntry,
  type SavedSense,
  type SavedSenseInput
} from '@workspace/shared';

export type SavedSenseSortOrder = 'recent' | 'oldest' | 'word';

export function filterSavedSenses(
  savedSenses: SavedSense[],
  searchTerm: string,
  sortOrder: SavedSenseSortOrder
): SavedSense[] {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredSenses = savedSenses.filter((savedSense) => {
    if (!normalizedSearch) {
      return true;
    }

    const translationWords = savedSense.translation?.words.join(' ').toLowerCase() ?? '';

    return (
      savedSense.word.toLowerCase().includes(normalizedSearch) ||
      savedSense.definition.toLowerCase().includes(normalizedSearch) ||
      savedSense.partOfSpeech.toLowerCase().includes(normalizedSearch) ||
      translationWords.includes(normalizedSearch)
    );
  });

  if (sortOrder === 'recent') {
    return [...filteredSenses].sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  }

  if (sortOrder === 'oldest') {
    return [...filteredSenses].sort((left, right) => left.savedAt.localeCompare(right.savedAt));
  }

  return [...filteredSenses].sort((left, right) => left.word.localeCompare(right.word));
}

export function getSavedSenseId(
  entry: DictionaryEntry,
  partOfSpeech: string,
  definition: Definition,
  translationLanguageCode: string
): string {
  const savedTranslationLanguageCode = buildSavedSenseTranslation(
    definition.translations,
    translationLanguageCode
  )?.languageCode;

  return buildSavedSenseId({
    word: entry.word,
    languageCode: 'en',
    partOfSpeech,
    definition: definition.definition,
    translationLanguageCode: savedTranslationLanguageCode
  });
}

export function getCustomSavedSenseId(
  entry: DictionaryEntry,
  partOfSpeech: string,
  definition: Definition,
  translationLanguageCode: string
): string {
  return buildSavedSenseId({
    word: entry.word,
    languageCode: 'en',
    partOfSpeech,
    definition: definition.definition,
    translationLanguageCode
  });
}

export function getSelectedTranslationLanguage(translationLanguageCode: string): {
  code: string;
  label: string;
} {
  return (
    DICTIONARY_TRANSLATION_LANGUAGES.find(
      (language) => language.code === translationLanguageCode
    ) ?? DICTIONARY_TRANSLATION_LANGUAGES[0]
  );
}

export function canSaveCustomTranslation(translationLanguageCode: string): boolean {
  return translationLanguageCode !== 'all';
}

export function getSavedCustomTranslation(
  savedSenses: SavedSense[],
  entry: DictionaryEntry,
  partOfSpeech: string,
  definition: Definition,
  translationLanguageCode: string
): SavedSense['translation'] | undefined {
  const savedSenseId = getCustomSavedSenseId(
    entry,
    partOfSpeech,
    definition,
    translationLanguageCode
  );

  return savedSenses.find(
    (savedSense) => savedSense.id === savedSenseId && savedSense.translation?.source === 'user'
  )?.translation;
}

export function isDefinitionSaved(
  savedSenseIds: string[],
  entry: DictionaryEntry,
  partOfSpeech: string,
  definition: Definition,
  translationLanguageCode: string
): boolean {
  return savedSenseIds.includes(
    getSavedSenseId(entry, partOfSpeech, definition, translationLanguageCode)
  );
}

/**
 * Saved result cards are converted to the saved-sense domain shape before
 * storage so App.svelte does not duplicate dictionary-to-library adapters.
 */
export function buildSavedSenseInput(
  entry: DictionaryEntry,
  partOfSpeech: string,
  definition: Definition,
  translationLanguageCode: string,
  sourceUrl?: string
): SavedSenseInput {
  return {
    word: entry.word,
    languageCode: 'en',
    languageName: 'English',
    partOfSpeech,
    phonetic: entry.phonetic,
    pronunciations: mapPhoneticsToSavedPronunciations(entry.phonetics),
    definition: definition.definition,
    tags: [],
    examples: definition.example ? [definition.example] : [],
    quotes: [],
    synonyms: definition.synonyms,
    antonyms: definition.antonyms,
    translation: buildSavedSenseTranslation(definition.translations, translationLanguageCode),
    sourceUrl
  };
}

/**
 * User translations intentionally keep the selected language code; they replace
 * wording for that language without pretending to come from the dictionary API.
 */
export function buildCustomSavedSenseInput(
  entry: DictionaryEntry,
  partOfSpeech: string,
  definition: Definition,
  translationLanguageCode: string,
  customTranslation: string,
  sourceUrl?: string
): SavedSenseInput | null {
  const normalizedTranslation = customTranslation.trim();
  if (!normalizedTranslation || !canSaveCustomTranslation(translationLanguageCode)) {
    return null;
  }

  const selectedTranslationLanguage = getSelectedTranslationLanguage(translationLanguageCode);

  return {
    word: entry.word,
    languageCode: 'en',
    languageName: 'English',
    partOfSpeech,
    phonetic: entry.phonetic,
    pronunciations: mapPhoneticsToSavedPronunciations(entry.phonetics),
    definition: definition.definition,
    tags: [],
    examples: definition.example ? [definition.example] : [],
    quotes: [],
    synonyms: definition.synonyms,
    antonyms: definition.antonyms,
    translation: {
      languageCode: selectedTranslationLanguage.code,
      languageName: selectedTranslationLanguage.label,
      source: 'user',
      words: [normalizedTranslation]
    },
    sourceUrl
  };
}
