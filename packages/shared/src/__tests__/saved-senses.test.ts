import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSavedSenseId,
  buildSavedSenseTranslation,
  clearSavedSenses,
  getSavedSenses,
  isSavedSense,
  saveSense
} from '../saved-senses';

describe('saved senses', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));
  });

  it('builds a stable id from the canonical sense identity', () => {
    expect(
      buildSavedSenseId({
        word: 'Test',
        languageCode: 'EN',
        partOfSpeech: 'Noun',
        definition: 'A procedure intended to establish quality.',
        translationLanguageCode: 'RU'
      })
    ).toBe(
      buildSavedSenseId({
        word: 'test',
        languageCode: 'en',
        partOfSpeech: 'noun',
        definition: 'A procedure intended to establish quality.',
        translationLanguageCode: 'ru'
      })
    );
  });

  it('stores normalized saved senses without duplicates', () => {
    const savedSense = saveSense({
      word: 'test',
      languageCode: 'en',
      languageName: 'English',
      partOfSpeech: 'noun',
      phonetic: '/test/',
      pronunciations: [{ text: '/test/', tags: [] }],
      definition: 'A procedure intended to establish quality.',
      tags: [],
      examples: ['This is only a test.', 'This is only a test.'],
      quotes: [],
      synonyms: ['trial'],
      antonyms: [],
      translation: {
        languageCode: 'ru',
        languageName: 'Russian',
        words: ['тест', 'тест']
      },
      sourceUrl: 'https://en.wiktionary.org/wiki/test'
    });

    saveSense({
      word: 'test',
      languageCode: 'en',
      languageName: 'English',
      partOfSpeech: 'noun',
      phonetic: '/test/',
      pronunciations: [{ text: '/test/', tags: [] }],
      definition: 'A procedure intended to establish quality.',
      tags: [],
      examples: ['This is only a test.'],
      quotes: [],
      synonyms: ['trial'],
      antonyms: [],
      translation: {
        languageCode: 'ru',
        languageName: 'Russian',
        words: ['тест']
      },
      sourceUrl: 'https://en.wiktionary.org/wiki/test'
    });

    expect(savedSense.translation?.words).toEqual(['тест', 'тест']);
    expect(savedSense.translation?.source).toBe('api');
    expect(savedSense.savedAt).toBe('2026-05-10T12:00:00.000Z');
    expect(getSavedSenses()).toHaveLength(1);
    expect(isSavedSense(savedSense.id)).toBe(true);
  });

  it('stores user-provided saved sense translations', () => {
    const savedSense = saveSense({
      word: 'test',
      languageCode: 'en',
      languageName: 'English',
      partOfSpeech: 'noun',
      phonetic: '/test/',
      pronunciations: [],
      definition: 'A procedure intended to establish quality.',
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: [],
      translation: {
        languageCode: 'ru',
        languageName: 'Russian',
        source: 'user',
        words: ['проверка']
      },
      sourceUrl: 'https://en.wiktionary.org/wiki/test'
    });

    expect(savedSense.translation).toEqual({
      languageCode: 'ru',
      languageName: 'Russian',
      source: 'user',
      words: ['проверка']
    });
  });

  it('returns undefined translation for all-languages mode', () => {
    expect(
      buildSavedSenseTranslation(
        [
          {
            languageCode: 'ru',
            languageName: 'Russian',
            word: 'тест'
          }
        ],
        'all'
      )
    ).toBeUndefined();
  });

  it('clears saved senses', () => {
    saveSense({
      word: 'test',
      languageCode: 'en',
      languageName: 'English',
      partOfSpeech: 'noun',
      phonetic: '/test/',
      pronunciations: [],
      definition: 'A procedure intended to establish quality.',
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: [],
      sourceUrl: 'https://en.wiktionary.org/wiki/test'
    });

    clearSavedSenses();
    expect(getSavedSenses()).toEqual([]);
  });
});
