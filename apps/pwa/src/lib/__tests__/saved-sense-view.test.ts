import { describe, expect, it } from 'vitest';
import type { Definition, DictionaryEntry, SavedSense } from '@workspace/shared';
import {
  buildCustomSavedSenseInput,
  buildSavedSenseInput,
  filterSavedSenses,
  getSelectedTranslationLanguage
} from '../saved-sense-view';

const entry: DictionaryEntry = {
  word: 'test',
  phonetic: '/test/',
  phonetics: [{ text: '/test/' }],
  meanings: []
};

const definition: Definition = {
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
};

describe('saved sense view helpers', () => {
  const savedSenses: SavedSense[] = [
    {
      id: 'newer',
      word: 'tree',
      partOfSpeech: 'noun',
      definition: 'A woody plant.',
      pronunciations: [],
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: [],
      savedAt: '2026-06-02T00:00:00.000Z'
    },
    {
      id: 'older',
      word: 'test',
      partOfSpeech: 'noun',
      definition: 'A procedure.',
      pronunciations: [],
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: [],
      translation: { languageCode: 'ru', languageName: 'Russian', words: ['тест'] },
      savedAt: '2026-06-01T00:00:00.000Z'
    }
  ];

  it('filters and sorts saved senses for the library panel', () => {
    expect(filterSavedSenses(savedSenses, 'тест', 'recent')).toEqual([savedSenses[1]]);
    expect(filterSavedSenses(savedSenses, '', 'oldest').map((sense) => sense.id)).toEqual([
      'older',
      'newer'
    ]);
    expect(filterSavedSenses(savedSenses, '', 'word').map((sense) => sense.word)).toEqual([
      'test',
      'tree'
    ]);
  });

  it('builds API-backed and custom saved-sense inputs from result cards', () => {
    expect(
      buildSavedSenseInput(entry, 'noun', definition, 'ru', 'https://source').translation
    ).toEqual({
      languageCode: 'ru',
      languageName: 'Russian',
      source: 'api',
      words: ['тест']
    });

    expect(
      buildCustomSavedSenseInput(entry, 'noun', definition, 'ru', ' проверка ', 'https://source')
        ?.translation
    ).toEqual({
      languageCode: 'ru',
      languageName: 'Russian',
      source: 'user',
      words: ['проверка']
    });
    expect(buildCustomSavedSenseInput(entry, 'noun', definition, 'all', 'ignored')).toBeNull();
  });

  it('falls back to the first translation language for unknown codes', () => {
    expect(getSelectedTranslationLanguage('missing')).toEqual({
      code: 'all',
      label: 'All languages'
    });
  });
});
