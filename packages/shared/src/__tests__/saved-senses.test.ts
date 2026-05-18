import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildSavedSenseId,
  buildSavedSenseTranslation,
  clearSavedSenses,
  getSavedSenses,
  isSavedSense,
  mapPhoneticsToSavedPronunciations,
  removeSavedSense,
  saveSense,
  SAVED_SENSES_STORAGE_KEY
} from '../saved-senses';

describe('saved senses', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
      pronunciations: [{ text: '/test/', tags: ['tag1', ''] }],
      definition: 'A procedure intended to establish quality.',
      tags: ['tag2', ' '],
      examples: ['This is only a test.', 'This is only a test.'],
      quotes: [
        { text: 'Some quote', reference: 'Ref' },
        { text: '  ', reference: 'None' }
      ],
      synonyms: ['trial'],
      antonyms: [],
      translation: {
        languageCode: 'RU ',
        languageName: 'Russian',
        words: ['тест', 'тест', ' ']
      },
      sourceUrl: 'https://en.wiktionary.org/wiki/test'
    });

    expect(savedSense.translation?.words).toEqual(['тест', 'тест']);
    expect(savedSense.translation?.languageCode).toBe('ru');
    expect(savedSense.tags).toEqual(['tag2']);

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

    expect(getSavedSenses()).toHaveLength(1);
  });

  it('removes a saved sense', () => {
    const sense = saveSense({
      word: 'test',
      partOfSpeech: 'noun',
      definition: 'def',
      pronunciations: [],
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: []
    });
    expect(getSavedSenses()).toHaveLength(1);
    removeSavedSense(sense.id);
    expect(getSavedSenses()).toHaveLength(0);
  });

  it('checks whether a sense identity is saved', () => {
    const sense = saveSense({
      word: 'test',
      partOfSpeech: 'noun',
      definition: 'def',
      pronunciations: [],
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: []
    });

    expect(isSavedSense(sense.id)).toBe(true);
    expect(isSavedSense('sense-missing')).toBe(false);
  });

  it('handles empty or missing translation', () => {
    const sense = saveSense({
      word: 'test',
      partOfSpeech: 'noun',
      definition: 'def',
      pronunciations: [],
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: [],
      translation: { words: [' ', ''] }
    });
    expect(sense.translation).toBeUndefined();
  });

  it('maps phonetics to saved pronunciations', () => {
    const phonetics = [{ text: '/abc/' }, { text: '/def/' }];
    const results = mapPhoneticsToSavedPronunciations(phonetics);
    expect(results).toEqual([
      { text: '/abc/', tags: [] },
      { text: '/def/', tags: [] }
    ]);
  });

  it('clears saved senses', () => {
    saveSense({
      word: 'test',
      partOfSpeech: 'noun',
      definition: 'def',
      pronunciations: [],
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: []
    });

    clearSavedSenses();
    expect(getSavedSenses()).toEqual([]);
  });

  it('handles localStorage errors and missing storage', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new Error('fail');
      }),
      setItem: vi.fn(),
      clear: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn()
    });
    expect(getSavedSenses()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', undefined);
    expect(getSavedSenses()).toEqual([]);
    clearSavedSenses();
  });

  it('handles invalid JSON in storage', () => {
    localStorage.setItem(SAVED_SENSES_STORAGE_KEY, 'invalid');
    expect(getSavedSenses()).toEqual([]);
  });

  it('ignores storage payloads that are not saved-sense arrays', () => {
    localStorage.setItem(SAVED_SENSES_STORAGE_KEY, JSON.stringify({ word: 'test' }));
    expect(getSavedSenses()).toEqual([]);
  });

  it('logs storage write failures without throwing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error('quota exceeded');
      }),
      clear: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn()
    });

    expect(() =>
      saveSense({
        word: 'test',
        partOfSpeech: 'noun',
        definition: 'def',
        pronunciations: [],
        tags: [],
        examples: [],
        quotes: [],
        synonyms: [],
        antonyms: []
      })
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith('Failed to persist saved senses', expect.any(Error));
  });

  it('builds translation only if language matches', () => {
    const trans = [
      { languageCode: 'en', languageName: 'English', word: 'hi' },
      { languageCode: 'ru', languageName: 'Russian', word: 'привет' }
    ];

    expect(buildSavedSenseTranslation(trans, 'ru')).toEqual({
      languageCode: 'ru',
      languageName: 'Russian',
      source: 'api',
      words: ['привет']
    });

    expect(buildSavedSenseTranslation(trans, 'all')).toBeUndefined();
    expect(buildSavedSenseTranslation(trans, 'fr')).toBeUndefined();
  });
});
