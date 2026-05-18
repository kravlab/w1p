import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DictionaryLookupError,
  buildSavedSenseId,
  clearSavedSenses,
  getSavedSenses
} from '@workspace/shared';
import App from '../App.svelte';

const createObjectURL = vi.fn(() => 'blob:saved-senses');
const revokeObjectURL = vi.fn();

const {
  fetchDefinition,
  getDictionaryLogs,
  clearDictionaryLogs,
  clearDictionaryCache,
  appendDictionaryLog,
  cacheDelete,
  saveSense,
  getSavedSensesMock,
  clearSavedSensesMock,
  removeSavedSenseMock,
  needRefreshStore,
  updateServiceWorker,
  savedSensesStore
} = vi.hoisted(() => ({
  fetchDefinition: vi.fn(),
  getDictionaryLogs: vi.fn(),
  clearDictionaryLogs: vi.fn(),
  clearDictionaryCache: vi.fn(),
  appendDictionaryLog: vi.fn(),
  cacheDelete: vi.fn().mockResolvedValue(true),
  savedSensesStore: new Array<Record<string, unknown>>(),
  needRefreshStore: (() => {
    let value = false;
    const subscribers = new Set<(nextValue: boolean) => void>();

    return {
      subscribe(run: (nextValue: boolean) => void) {
        subscribers.add(run);
        run(value);

        return () => subscribers.delete(run);
      },
      set(nextValue: boolean) {
        value = nextValue;
        subscribers.forEach((run) => run(value));
      }
    };
  })(),
  updateServiceWorker: vi.fn(),
  getSavedSensesMock: vi.fn((): Array<Record<string, unknown>> => []),
  clearSavedSensesMock: vi.fn(),
  removeSavedSenseMock: vi.fn(),
  saveSense: vi.fn()
}));

vi.mock('@workspace/shared', async () => {
  const actual = await vi.importActual<typeof import('@workspace/shared')>('@workspace/shared');
  return {
    ...actual,
    fetchDefinition,
    getDictionaryLogs,
    clearDictionaryLogs,
    clearDictionaryCache,
    appendDictionaryLog,
    saveSense,
    getSavedSenses: getSavedSensesMock,
    clearSavedSenses: clearSavedSensesMock,
    removeSavedSense: removeSavedSenseMock,
    DICTIONARY_CACHE_NAME: 'dictionary-api-cache'
  };
});

vi.mock('virtual:pwa-register/svelte', () => ({
  useRegisterSW: vi.fn(() => ({
    needRefresh: needRefreshStore,
    updateServiceWorker
  }))
}));

describe('PWA App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    needRefreshStore.set(false);
    updateServiceWorker.mockResolvedValue(undefined);
    savedSensesStore.length = 0;
    clearSavedSensesMock.mockImplementation(() => {
      savedSensesStore.length = 0;
    });
    getSavedSensesMock.mockImplementation(() => [...savedSensesStore]);
    removeSavedSenseMock.mockImplementation((id: string) => {
      const index = savedSensesStore.findIndex((entry) => entry.id === id);
      if (index >= 0) {
        savedSensesStore.splice(index, 1);
      }
    });
    saveSense.mockImplementation((input) => {
      const entry = {
        id: buildSavedSenseId({
          word: input.word,
          languageCode: input.languageCode,
          partOfSpeech: input.partOfSpeech,
          definition: input.definition,
          translationLanguageCode: input.translation?.languageCode
        }),
        savedAt: '2026-05-10T12:00:00.000Z',
        ...input
      };
      savedSensesStore.unshift(entry);
      return entry;
    });
    clearSavedSenses();
    fetchDefinition.mockResolvedValue({
      entries: [
        {
          word: 'test',
          phonetic: '/test/',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'noun',
              definitions: [
                {
                  definition: 'A test definition',
                  synonyms: [],
                  antonyms: [],
                  translations: []
                }
              ],
              synonyms: [],
              antonyms: []
            }
          ]
        }
      ],
      sourceUrl: 'https://en.wiktionary.org/wiki/test',
      source: 'network'
    });
    getDictionaryLogs.mockReturnValue([
      {
        id: '1',
        timestamp: '2026-05-09T10:00:00.000Z',
        word: 'test',
        type: 'success',
        source: 'network',
        message: 'Lookup succeeded for "test".'
      }
    ]);

    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('navigator', {
      storage: {
        persisted: vi.fn().mockResolvedValue(false),
        persist: vi.fn().mockResolvedValue(true)
      }
    });
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue({
        keys: vi
          .fn()
          .mockResolvedValue([new Request('https://freedictionaryapi.com/api/v1/entries/en/test')]),
        match: vi.fn().mockImplementation(
          async () =>
            new Response(
              JSON.stringify({
                entries: [],
                sourceUrl: 'https://en.wiktionary.org/wiki/test',
                source: 'cache'
              })
            )
        ),
        delete: cacheDelete
      })
    });
  });

  it('searches and renders dictionary results with one attribution block', async () => {
    render(App);

    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(fetchDefinition).toHaveBeenCalledWith('test', {
      includeTranslations: false,
      translationLanguageCode: 'all'
    });
    expect(await screen.findByText('A test definition')).toBeInTheDocument();
    expect(screen.getAllByText('Original Wiktionary page')).toHaveLength(1);
  });

  it('restores the last search after a page reload', async () => {
    localStorage.setItem(
      'pwa-search-state',
      JSON.stringify({
        searchTerm: 'persisted',
        includeTranslations: true,
        translationLanguageCode: 'ru',
        rawSearchResult: {
          entries: [
            {
              word: 'persisted',
              phonetic: '/persisted/',
              phonetics: [],
              meanings: [
                {
                  partOfSpeech: 'noun',
                  definitions: [
                    {
                      definition: 'A restored definition',
                      synonyms: [],
                      antonyms: [],
                      translations: [
                        {
                          languageCode: 'ru',
                          languageName: 'Russian',
                          word: 'восстановлено'
                        }
                      ]
                    }
                  ],
                  synonyms: [],
                  antonyms: []
                }
              ]
            }
          ],
          sourceUrl: 'https://en.wiktionary.org/wiki/persisted',
          source: 'cache'
        },
        searchResult: {
          entries: [
            {
              word: 'persisted',
              phonetic: '/persisted/',
              phonetics: [],
              meanings: [
                {
                  partOfSpeech: 'noun',
                  definitions: [
                    {
                      definition: 'A restored definition',
                      synonyms: [],
                      antonyms: [],
                      translations: [
                        {
                          languageCode: 'ru',
                          languageName: 'Russian',
                          word: 'восстановлено'
                        }
                      ]
                    }
                  ],
                  synonyms: [],
                  antonyms: []
                }
              ]
            }
          ],
          sourceUrl: 'https://en.wiktionary.org/wiki/persisted',
          source: 'cache'
        }
      })
    );

    render(App);

    expect(await screen.findByDisplayValue('persisted')).toBeInTheDocument();
    expect(await screen.findByText('A restored definition')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('ru');
    expect(fetchDefinition).not.toHaveBeenCalled();
  });

  it('passes includeTranslations when the checkbox is enabled', async () => {
    fetchDefinition.mockResolvedValueOnce({
      entries: [
        {
          word: 'test',
          phonetic: '/test/',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'noun',
              definitions: [
                {
                  definition: 'A test definition',
                  synonyms: [],
                  antonyms: [],
                  translations: [
                    {
                      languageCode: 'ru',
                      languageName: 'Russian',
                      word: 'тест'
                    },
                    {
                      languageCode: 'de',
                      languageName: 'German',
                      word: 'Test'
                    }
                  ]
                }
              ],
              synonyms: [],
              antonyms: []
            }
          ]
        }
      ],
      sourceUrl: 'https://en.wiktionary.org/wiki/test',
      source: 'network'
    });

    render(App);

    await fireEvent.click(await screen.findByLabelText('Include translations'));
    const languageSelect = screen.getByRole('combobox') as HTMLSelectElement;
    languageSelect.value = 'ru';
    await fireEvent.change(languageSelect);
    expect(languageSelect.value).toBe('ru');
    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(fetchDefinition).toHaveBeenCalledWith('test', {
      includeTranslations: true,
      translationLanguageCode: 'all'
    });
    expect(await screen.findByText('тест')).toBeInTheDocument();
  });

  it('updates rendered translations when the language selection changes', async () => {
    fetchDefinition.mockResolvedValueOnce({
      entries: [
        {
          word: 'test',
          phonetic: '/test/',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'noun',
              definitions: [
                {
                  definition: 'A test definition',
                  synonyms: [],
                  antonyms: [],
                  translations: [
                    {
                      languageCode: 'ru',
                      languageName: 'Russian',
                      word: 'тест'
                    },
                    {
                      languageCode: 'de',
                      languageName: 'German',
                      word: 'Test'
                    }
                  ]
                }
              ],
              synonyms: [],
              antonyms: []
            }
          ]
        }
      ],
      sourceUrl: 'https://en.wiktionary.org/wiki/test',
      source: 'network'
    });

    render(App);

    await fireEvent.click(await screen.findByLabelText('Include translations'));
    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Russian: тест')).toBeInTheDocument();
    expect(screen.getByText('German: Test')).toBeInTheDocument();

    const languageSelect = screen.getByRole('combobox') as HTMLSelectElement;
    languageSelect.value = 'ru';
    await fireEvent.change(languageSelect);

    expect(await screen.findByText('тест')).toBeInTheDocument();
    expect(screen.queryByText('German: Test')).not.toBeInTheDocument();
    expect(screen.queryByText('Russian: тест')).not.toBeInTheDocument();
  });

  it('shows persistent storage status and requests protection', async () => {
    render(App);

    expect(await screen.findByText('Persistent storage is not enabled.')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Protect app data' }));

    expect(await screen.findByText('Persistent storage is enabled.')).toBeInTheDocument();
  });

  it('logs runtime window errors', async () => {
    render(App);

    const errorEvent = new ErrorEvent('error', {
      message: 'Boom',
      filename: 'https://example.com/app.js',
      lineno: 12,
      colno: 7,
      error: new Error('Boom')
    });
    window.dispatchEvent(errorEvent);

    expect(appendDictionaryLog).toHaveBeenCalledWith(
      expect.objectContaining({
        word: 'runtime',
        type: 'runtime_error',
        source: 'unknown',
        message: 'Boom (https://example.com/app.js:12:7)'
      })
    );
  });

  it('saves a definition without translation in all-languages mode', async () => {
    render(App);

    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    expect(saveSense).toHaveBeenCalledWith(
      expect.objectContaining({
        word: 'test',
        languageCode: 'en',
        partOfSpeech: 'noun',
        definition: 'A test definition',
        translation: undefined
      })
    );
  });

  it('saves a definition with a user-provided translation from the save menu', async () => {
    render(App);

    await fireEvent.click(await screen.findByLabelText('Include translations'));
    const languageSelect = screen.getByRole('combobox') as HTMLSelectElement;
    await fireEvent.change(languageSelect, { target: { value: 'ru' } });
    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'More save options' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Save with custom translation' }));
    await fireEvent.input(screen.getByPlaceholderText('Your translation'), {
      target: { value: 'quality check' }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Save translation' }));

    expect(saveSense).toHaveBeenCalledWith(
      expect.objectContaining({
        word: 'test',
        languageCode: 'en',
        partOfSpeech: 'noun',
        definition: 'A test definition',
        translation: {
          languageCode: 'ru',
          languageName: 'Russian',
          source: 'user',
          words: ['quality check']
        }
      })
    );
    expect(await screen.findByText('quality check')).toBeInTheDocument();
  });

  it('edits a user-provided translation from the search result', async () => {
    render(App);

    await fireEvent.click(await screen.findByLabelText('Include translations'));
    const languageSelect = screen.getByRole('combobox') as HTMLSelectElement;
    await fireEvent.change(languageSelect, { target: { value: 'ru' } });
    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'More save options' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Save with custom translation' }));
    await fireEvent.input(screen.getByPlaceholderText('Your translation'), {
      target: { value: 'quality check' }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Save translation' }));

    await fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const customTranslationInput = screen.getByPlaceholderText(
      'Your translation'
    ) as HTMLInputElement;
    expect(customTranslationInput.value).toBe('quality check');
    await fireEvent.input(customTranslationInput, { target: { value: 'manual check' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save translation' }));

    expect(await screen.findByText('manual check')).toBeInTheDocument();
    expect(screen.queryByText('quality check')).not.toBeInTheDocument();
  });

  it('deletes a user-provided translation from the search result', async () => {
    render(App);

    await fireEvent.click(await screen.findByLabelText('Include translations'));
    const languageSelect = screen.getByRole('combobox') as HTMLSelectElement;
    await fireEvent.change(languageSelect, { target: { value: 'ru' } });
    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'More save options' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Save with custom translation' }));
    await fireEvent.input(screen.getByPlaceholderText('Your translation'), {
      target: { value: 'quality check' }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Save translation' }));

    await fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(removeSavedSenseMock).toHaveBeenCalled();
    expect(screen.queryByText('quality check')).not.toBeInTheDocument();
  });

  it('requires a specific language before saving a custom translation', async () => {
    render(App);

    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'More save options' }));

    expect(screen.getByRole('button', { name: 'Choose a language first' })).toBeDisabled();
    expect(screen.queryByText('Save with custom translation')).not.toBeInTheDocument();
  });

  it('closes the save options menu when clicking outside it', async () => {
    render(App);

    await fireEvent.click(await screen.findByLabelText('Include translations'));
    const languageSelect = screen.getByRole('combobox') as HTMLSelectElement;
    await fireEvent.change(languageSelect, { target: { value: 'ru' } });
    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'More save options' }));

    expect(
      screen.getByRole('button', { name: 'Save with custom translation' })
    ).toBeInTheDocument();

    await fireEvent.pointerDown(input);

    expect(
      screen.queryByRole('button', { name: 'Save with custom translation' })
    ).not.toBeInTheDocument();
  });

  it('removes a saved definition directly from dictionary view', async () => {
    render(App);

    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    expect(getSavedSenses()).toHaveLength(1);

    await fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    expect(getSavedSenses()).toHaveLength(0);
  });

  it('opens the saved panel and renders saved senses', async () => {
    render(App);

    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    expect(getSavedSenses()).toHaveLength(1);

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Saved' }));

    expect(await screen.findByText('Saved senses')).toBeInTheDocument();
    expect(screen.getAllByText('A test definition')).toHaveLength(2);
  });

  it('removes a saved sense from the saved panel', async () => {
    render(App);

    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
    const savedPanel = screen.getByText('Saved senses').closest('section');
    await fireEvent.click(
      within(savedPanel as HTMLElement).getByRole('button', { name: 'Remove' })
    );

    expect(confirm).toHaveBeenCalledWith('Remove this saved sense?');
    expect(getSavedSenses()).toHaveLength(0);
  });

  it('clears all saved senses from the saved panel', async () => {
    render(App);

    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Clear saved' }));

    expect(confirm).toHaveBeenCalledWith('Clear all saved senses?');
    expect(clearSavedSensesMock).toHaveBeenCalled();
    expect(getSavedSenses()).toHaveLength(0);
    expect(screen.getByText('No saved senses yet.')).toBeInTheDocument();
  });

  it('exports saved senses as JSON from the saved panel', async () => {
    render(App);

    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:saved-senses');
  });

  it('filters saved senses by search term', async () => {
    render(App);

    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Saved' }));

    const savedSearch = screen.getByPlaceholderText('Search saved senses');
    await fireEvent.input(savedSearch, { target: { value: 'missing' } });

    expect(screen.getByText('No saved senses yet.')).toBeInTheDocument();

    await fireEvent.input(savedSearch, { target: { value: 'test definition' } });
    expect(screen.getAllByText('A test definition')).toHaveLength(2);
  });

  it('sorts saved senses by word', async () => {
    render(App);

    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    savedSensesStore.unshift({
      id: 'saved-0',
      savedAt: '2026-05-09T12:00:00.000Z',
      word: 'alpha',
      languageCode: 'en',
      languageName: 'English',
      partOfSpeech: 'noun',
      phonetic: '/alpha/',
      pronunciations: [],
      definition: 'Alpha definition',
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: [],
      sourceUrl: 'https://en.wiktionary.org/wiki/alpha'
    });

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Saved' }));

    const sortSelect = screen.getByDisplayValue('Newest first');
    await fireEvent.change(sortSelect, { target: { value: 'word' } });

    const savedPanel = screen.getByText('Saved senses').closest('section');
    await waitFor(() => {
      const headings = within(savedPanel as HTMLElement)
        .getAllByRole('heading', { level: 3 })
        .filter((heading) => heading.textContent === 'alpha' || heading.textContent === 'test');
      const headingTexts = headings.map((heading) => heading.textContent);
      expect(headingTexts.indexOf('alpha')).toBeLessThan(headingTexts.indexOf('test'));
    });
  });

  it('logs unhandled promise rejections', async () => {
    render(App);

    const rejectionEvent = new Event('unhandledrejection') as Event & {
      reason: Error;
    };
    rejectionEvent.reason = new Error('boom');
    window.dispatchEvent(rejectionEvent);

    expect(appendDictionaryLog).toHaveBeenCalledWith(
      expect.objectContaining({
        word: 'runtime',
        type: 'unhandled_rejection',
        source: 'unknown',
        message: 'boom'
      })
    );
  });

  it('shows storage events in a separate log section', async () => {
    getDictionaryLogs.mockReturnValue([
      {
        id: '1',
        timestamp: '2026-05-09T10:00:00.000Z',
        word: 'test',
        type: 'success',
        source: 'network',
        message: 'Lookup succeeded for "test".'
      },
      {
        id: '2',
        timestamp: '2026-05-09T10:05:00.000Z',
        word: 'persistent-storage',
        type: 'storage_unsupported',
        source: 'unknown',
        message: 'Persistent storage is not supported in this browser.'
      }
    ]);
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Log' }));

    expect(await screen.findByText('Dictionary events')).toBeInTheDocument();
    expect(await screen.findByText('Storage events')).toBeInTheDocument();
    expect(
      await screen.findByText('Persistent storage is not supported in this browser.')
    ).toBeInTheDocument();
  });

  it('opens the log panel and filters entries', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Log' }));

    expect(await screen.findByText('Log history')).toBeInTheDocument();
    const filter = screen.getByDisplayValue('all');
    await fireEvent.change(filter, { target: { value: 'success' } });
    expect(screen.getByText('Lookup succeeded for "test".')).toBeInTheDocument();
  });

  it('opens the cache panel and filters cache entries', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Cache' }));

    expect(await screen.findByText('Cache entries')).toBeInTheDocument();
    const search = screen.getByPlaceholderText('Search cache by word or URL');
    await fireEvent.input(search, { target: { value: 'test' } });
    expect(
      screen.getByText('https://freedictionaryapi.com/api/v1/entries/en/test')
    ).toBeInTheDocument();
    expect(screen.getByText('https://en.wiktionary.org/wiki/test')).toBeInTheDocument();
  });

  it('shows the current build version in the side menu', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));

    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('0.0.0')).toBeInTheDocument();
    expect(screen.getByText('SHA')).toBeInTheDocument();
    expect(screen.getByText(/-dev$/)).toBeInTheDocument();
    expect(screen.getByText(/^Built:/)).toBeInTheDocument();
  });

  it('starts PWA installation from the side menu', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted'; platform: string }>;
    };
    installEvent.prompt = prompt;
    installEvent.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    render(App);
    window.dispatchEvent(installEvent);

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Install app' }));

    expect(prompt).toHaveBeenCalledOnce();
  });

  it('prompts to activate a newly deployed PWA build', async () => {
    needRefreshStore.set(true);

    render(App);

    expect(await screen.findByText('A new version is ready.')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Update now' }));

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('parses cache entry words without query parameters', async () => {
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue({
        keys: vi
          .fn()
          .mockResolvedValue([
            new Request('https://freedictionaryapi.com/api/v1/entries/en/shit?translations=true')
          ]),
        match: vi.fn().mockImplementation(
          async () =>
            new Response(
              JSON.stringify({
                entries: [],
                sourceUrl: 'https://en.wiktionary.org/wiki/shit',
                source: 'cache'
              })
            )
        ),
        delete: cacheDelete
      })
    });

    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Cache' }));

    expect(await screen.findByText('shit')).toBeInTheDocument();
    expect(screen.queryByText('shit?translations=true')).not.toBeInTheDocument();
  });

  it('clears log history and cache with confirmation', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Clear log' }));
    expect(clearDictionaryLogs).toHaveBeenCalled();

    await fireEvent.click(screen.getAllByRole('button', { name: 'Close log' })[1]);
    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Cache' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Clear cache' }));
    expect(clearDictionaryCache).toHaveBeenCalled();
  });

  it('opens a cached entry in the dictionary', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Cache' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Open' }));

    expect(fetchDefinition).toHaveBeenCalledWith('test', {
      includeTranslations: false,
      translationLanguageCode: 'all'
    });
    expect(await screen.findByText('A test definition')).toBeInTheDocument();
  });

  it('deletes a single cache entry after confirmation', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Cache' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(confirm).toHaveBeenCalledWith('Delete this cache entry?');
    expect(cacheDelete).toHaveBeenCalledWith(
      'https://freedictionaryapi.com/api/v1/entries/en/test'
    );
  });

  it('shows the dictionary not-found message for missing words', async () => {
    fetchDefinition.mockRejectedValueOnce(new DictionaryLookupError('Word not found', 'not_found'));
    render(App);

    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'missing' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Word not found')).toBeInTheDocument();
    expect(appendDictionaryLog).toHaveBeenCalledWith(
      expect.objectContaining({
        word: 'missing',
        type: 'not_found',
        message: 'Word not found'
      })
    );
  });

  it('shows the generic fallback message for unexpected errors', async () => {
    fetchDefinition.mockRejectedValueOnce(new Error('boom'));
    render(App);

    const input = await screen.findByPlaceholderText('Search for a word...');
    await fireEvent.input(input, { target: { value: 'broken' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByText('Something went wrong while searching. Please try again.')
    ).toBeInTheDocument();
    expect(appendDictionaryLog).toHaveBeenCalledWith(
      expect.objectContaining({
        word: 'broken',
        type: 'unknown',
        source: 'unknown'
      })
    );
  });
});
