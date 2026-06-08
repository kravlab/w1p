import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DictionaryLookupError,
  buildSavedSenseId,
  clearSavedSenses,
  enMessages,
  getSearchHistory,
  getSavedSenses
} from '@workspace/shared';
import App from '../App.svelte';

const createObjectURL = vi.fn(() => 'blob:saved-senses');
const revokeObjectURL = vi.fn();
const scrollToMock = vi.fn();
const serviceWorkerUpdateMock = vi.fn();
const t = enMessages;

function setWindowScrollY(value: number): void {
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value
  });
}

function setWindowSelectionText(
  value: string,
  rect: Partial<DOMRect> = { bottom: 120, height: 18, left: 40, width: 90 }
): void {
  vi.spyOn(window, 'getSelection').mockReturnValue({
    rangeCount: 1,
    getRangeAt: vi.fn(() => ({
      getBoundingClientRect: () => ({
        bottom: rect.bottom ?? 120,
        height: rect.height ?? 18,
        left: rect.left ?? 40,
        right: rect.right ?? 130,
        top: rect.top ?? 102,
        width: rect.width ?? 90,
        x: rect.x ?? rect.left ?? 40,
        y: rect.y ?? rect.top ?? 102,
        toJSON: () => ({})
      })
    })),
    toString: () => value
  } as unknown as Selection);
}

async function withExpectedConsoleError(run: () => Promise<void>): Promise<void> {
  // Search failure tests intentionally exercise logged error paths; keep Vitest output clean.
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  try {
    await run();
  } finally {
    consoleErrorSpy.mockRestore();
  }
}

const {
  fetchDefinition,
  getDictionaryLogs,
  clearDictionaryLogs,
  clearDictionaryCache,
  appendDictionaryLog,
  cacheDelete,
  connectSyncProviderMock,
  disconnectSyncProviderMock,
  saveSense,
  getSavedSensesMock,
  clearSavedSensesMock,
  initializeSavedSensesSyncMock,
  removeSavedSenseMock,
  needRefreshStore,
  syncSavedSensesMock,
  updateServiceWorker,
  savedSensesStore
} = vi.hoisted(() => ({
  fetchDefinition: vi.fn(),
  getDictionaryLogs: vi.fn(),
  clearDictionaryLogs: vi.fn(),
  clearDictionaryCache: vi.fn(),
  appendDictionaryLog: vi.fn(),
  cacheDelete: vi.fn().mockResolvedValue(true),
  connectSyncProviderMock: vi.fn().mockResolvedValue(undefined),
  disconnectSyncProviderMock: vi.fn(),
  initializeSavedSensesSyncMock: vi.fn().mockResolvedValue(false),
  syncSavedSensesMock: vi.fn().mockResolvedValue(undefined),
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
    connectSyncProvider: connectSyncProviderMock,
    saveSense,
    getSavedSenses: getSavedSensesMock,
    clearSavedSenses: clearSavedSensesMock,
    disconnectSyncProvider: disconnectSyncProviderMock,
    initializeSavedSensesSync: initializeSavedSensesSyncMock,
    removeSavedSense: removeSavedSenseMock,
    syncSavedSenses: syncSavedSensesMock,
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
    setWindowScrollY(0);
    window.scrollTo = scrollToMock;
    document.body.style.overflow = '';
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
      serviceWorker: {
        getRegistration: vi.fn().mockResolvedValue({
          update: serviceWorkerUpdateMock,
          waiting: null
        })
      },
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

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));

    expect(fetchDefinition).toHaveBeenCalledWith('test', {
      includeTranslations: false,
      translationLanguageCode: 'all'
    });
    expect(await screen.findByText('A test definition')).toBeInTheDocument();
    expect(screen.getByTestId('search-chrome')).toHaveClass('sticky');
    expect(screen.getAllByText(t.saved_source_link)).toHaveLength(1);
    expect(getSearchHistory()[0]).toMatchObject({
      query: 'test',
      status: 'success'
    });
  });

  it('renders a repeated search word heading only once for multiple meanings', async () => {
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
                  definition: 'A noun definition',
                  synonyms: [],
                  antonyms: [],
                  translations: []
                }
              ],
              synonyms: [],
              antonyms: []
            }
          ]
        },
        {
          word: 'test',
          phonetic: '/test/',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'verb',
              definitions: [
                {
                  definition: 'A verb definition',
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
      source: 'network'
    });

    render(App);

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));

    expect(await screen.findByText('A noun definition')).toBeInTheDocument();
    expect(screen.getByText('A verb definition')).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .filter((heading) => heading.textContent?.trim().startsWith('test'))
    ).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'noun /test/', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'verb /test/', level: 3 })).toBeInTheDocument();
    expect(screen.getAllByText('/test/')[0]).toHaveClass('text-xs', 'text-gray-400');
  });

  it('clears the current dictionary search from the search toolbar', async () => {
    render(App);

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    expect(await screen.findByText('A test definition')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: t.clear_search }));

    expect(input).toHaveValue('');
    expect(screen.queryByText('A test definition')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.clear_search })).toBeDisabled();
    expect(localStorage.getItem('pwa-search-state')).toBeNull();
  });

  it('keeps search toolbar controls aligned to the same height', async () => {
    render(App);

    expect(await screen.findByRole('button', { name: t.open_menu })).toHaveClass('h-11', 'w-11');
    expect(screen.getByPlaceholderText(t.search_placeholder)).toHaveClass('h-11');
    expect(screen.getByRole('button', { name: t.clear_search })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: t.search_button })).toHaveClass('h-11');
  });

  it('keeps the mobile shell constrained without breaking sticky search chrome', async () => {
    render(App);

    const main = await screen.findByRole('main');
    const searchChrome = await screen.findByTestId('search-chrome');

    expect(main).toHaveClass('min-h-dvh', 'w-full');
    expect(main).not.toHaveClass('overflow-x-hidden');
    expect(searchChrome.closest('.flex')).not.toHaveClass('overflow-x-hidden');
    expect(searchChrome.closest('section')).toHaveClass('min-w-0');

    await fireEvent.click(screen.getByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_log }));

    const logPanel = screen.getByText(t.log_title).closest('section') as HTMLElement;
    const logHeader = screen.getByText(t.log_title).closest('header') as HTMLElement;

    expect(logPanel).toHaveClass('w-full', 'min-w-0');
    expect(logHeader).toHaveClass('flex-col', 'sm:flex-row');
  });

  it('locks page scrolling while the side menu is open', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));

    const sideMenu = screen.getByRole('complementary');
    expect(document.body.style.overflow).toBe('hidden');
    expect(sideMenu).toHaveClass('overflow-y-auto', 'overscroll-contain');

    await fireEvent.click(screen.getAllByRole('button', { name: t.close_menu })[0]);

    await waitFor(() => {
      expect(document.body.style.overflow).toBe('');
    });
  });

  it('hides the search chrome while scrolling down and shows it while scrolling up', async () => {
    render(App);

    const searchChrome = await screen.findByTestId('search-chrome');
    expect(searchChrome).toHaveClass('sticky', 'top-3', 'translate-y-0', 'opacity-100');
    expect(searchChrome.closest('.flex')).not.toHaveClass('overflow-x-hidden');

    setWindowScrollY(140);
    window.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      expect(searchChrome).toHaveClass(
        'pointer-events-none',
        '-translate-y-[calc(100%+1rem)]',
        'opacity-0'
      );
    });

    setWindowScrollY(80);
    window.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      expect(searchChrome).toHaveClass('translate-y-0', 'opacity-100');
    });
  });

  it('shows a back-to-top button after scrolling and jumps to the page start', async () => {
    render(App);

    expect(screen.queryByRole('button', { name: t.scroll_to_top })).not.toBeInTheDocument();

    setWindowScrollY(260);
    window.dispatchEvent(new Event('scroll'));

    const backToTopButton = await screen.findByRole('button', { name: t.scroll_to_top });
    await fireEvent.click(backToTopButton);

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: t.scroll_to_top })).not.toBeInTheDocument();
    });
  });

  it('keeps search-result action buttons the same size', async () => {
    render(App);

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));

    await screen.findByText('A test definition');

    expect(screen.getByRole('button', { name: t.save_sense })).toHaveClass('h-9', 'w-9');
    expect(screen.getByRole('button', { name: t.save_menu_label })).toHaveClass('h-9', 'w-9');
  });

  it('shows selection actions and searches selected page text', async () => {
    setWindowSelectionText('  selected   word  ');
    render(App);

    document.dispatchEvent(new Event('selectionchange'));

    const selectionButton = await screen.findByRole('button', { name: t.selection_search_button });
    expect(selectionButton).toHaveTextContent('Search');
    expect(selectionButton).toHaveStyle({ top: '130px', left: '85px' });
    await fireEvent.click(selectionButton);

    expect(fetchDefinition).toHaveBeenCalledWith('selected word', {
      includeTranslations: false,
      translationLanguageCode: 'all'
    });
    expect(await screen.findByDisplayValue('selected word')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.selection_search_button })
    ).not.toBeInTheDocument();
  });

  it('asks for confirmation before deleting a custom translation', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false)
    );
    render(App);

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));

    await screen.findByText('A test definition');
    await fireEvent.click(screen.getByRole('checkbox', { name: t.translations_toggle }));
    await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ru' } });
    await fireEvent.click(screen.getByRole('button', { name: t.save_menu_label }));
    await fireEvent.click(screen.getByRole('button', { name: t.save_with_custom_translation }));

    const translationInput = screen.getByPlaceholderText(t.custom_translation_placeholder);
    await fireEvent.input(translationInput, { target: { value: 'my translation' } });
    await fireEvent.click(screen.getByRole('button', { name: t.custom_translation_save }));

    await fireEvent.click(screen.getByRole('button', { name: t.custom_translation_delete }));

    expect(confirm).toHaveBeenCalledWith('Remove this saved sense?');
    expect(removeSavedSenseMock).not.toHaveBeenCalled();
    expect(screen.getByText('my translation')).toBeInTheDocument();
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

  it('prefills the search input from shared text query params', async () => {
    localStorage.setItem(
      'pwa-search-state',
      JSON.stringify({
        searchTerm: 'persisted',
        includeTranslations: false,
        translationLanguageCode: 'all',
        rawSearchResult: { entries: [], source: 'cache' },
        searchResult: { entries: [], source: 'cache' }
      })
    );
    window.history.replaceState(
      {},
      '',
      '/?title=Shared&text=shared%20word&url=https://example.com'
    );

    render(App);

    expect(await screen.findByDisplayValue('shared word')).toBeInTheDocument();
    expect(window.location.search).toBe('');
    expect(screen.queryByText('Received Shared Data')).not.toBeInTheDocument();
  });

  it('preserves unrelated query params after consuming shared text', async () => {
    window.history.replaceState(
      {},
      '',
      '/?keep=1&title=Shared&text=shared%20word&url=https://example.com#dictionary'
    );

    render(App);

    expect(await screen.findByDisplayValue('shared word')).toBeInTheDocument();
    expect(window.location.search).toBe('?keep=1');
    expect(window.location.hash).toBe('#dictionary');
  });

  it('removes a duplicated shared URL from the search prefill', async () => {
    window.history.replaceState(
      {},
      '',
      '/?text=tree%20https%3A%2F%2Fexample.com%2Ftree&url=https%3A%2F%2Fexample.com%2Ftree'
    );

    render(App);

    expect(await screen.findByDisplayValue('tree')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/https:\/\/example.com\/tree/)).not.toBeInTheDocument();
  });

  it('keeps shared text phrases while removing the duplicated shared URL', async () => {
    window.history.replaceState(
      {},
      '',
      '/?text=big%20green%20tree%20https%3A%2F%2Fexample.com%2Ftree&url=https%3A%2F%2Fexample.com%2Ftree'
    );

    render(App);

    expect(await screen.findByDisplayValue('big green tree')).toBeInTheDocument();
  });

  it('removes a duplicated text-fragment URL from the shared search prefill', async () => {
    const sharedUrl =
      'https://example.com/abcd-123456#:~:text=Qwerty%20copy%2Dpaste-,query,-from%20zx%20cvbnm';
    window.history.replaceState(
      {},
      '',
      `/?text=${encodeURIComponent(`"query" ${sharedUrl}`)}&url=${encodeURIComponent(sharedUrl)}`
    );

    render(App);

    expect(await screen.findByDisplayValue('query')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/medium\.com/)).not.toBeInTheDocument();
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

    await fireEvent.click(await screen.findByLabelText(t.translations_toggle));
    const languageSelect = screen.getByRole('combobox') as HTMLSelectElement;
    languageSelect.value = 'ru';
    await fireEvent.change(languageSelect);
    expect(languageSelect.value).toBe('ru');
    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));

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

    await fireEvent.click(await screen.findByLabelText(t.translations_toggle));
    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));

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

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_about }));

    expect(await screen.findByText(t.storage_persistent_disabled)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: t.storage_request_button }));

    expect(await screen.findByText(t.storage_persistent_enabled)).toBeInTheDocument();
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

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_sense }));

    expect(saveSense).toHaveBeenCalledWith(
      expect.objectContaining({
        word: 'test',
        languageCode: 'en',
        partOfSpeech: 'noun',
        definition: 'A test definition',
        translation: undefined
      })
    );
    expect(await screen.findByRole('button', { name: t.remove_sense })).toHaveClass(
      'border-rose-200',
      'bg-rose-50',
      'text-rose-700'
    );
  });

  it('updates the search result button to remove when a selected translation language has no match', async () => {
    render(App);

    await fireEvent.click(await screen.findByLabelText(t.translations_toggle));
    const languageSelect = screen.getByRole('combobox') as HTMLSelectElement;
    await fireEvent.change(languageSelect, { target: { value: 'ru' } });
    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));

    await fireEvent.click(await screen.findByRole('button', { name: t.save_sense }));

    expect(await screen.findByRole('button', { name: t.remove_sense })).toHaveClass(
      'border-rose-200',
      'bg-rose-50',
      'text-rose-700'
    );
  });

  it('saves a definition with a user-provided translation from the save menu', async () => {
    render(App);

    await fireEvent.click(await screen.findByLabelText(t.translations_toggle));
    const languageSelect = screen.getByRole('combobox') as HTMLSelectElement;
    await fireEvent.change(languageSelect, { target: { value: 'ru' } });
    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_menu_label }));
    await fireEvent.click(screen.getByRole('button', { name: t.save_with_custom_translation }));
    await fireEvent.input(screen.getByPlaceholderText(t.custom_translation_placeholder), {
      target: { value: 'quality check' }
    });
    await fireEvent.click(screen.getByRole('button', { name: t.custom_translation_save }));

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

    await fireEvent.click(await screen.findByLabelText(t.translations_toggle));
    const languageSelect = screen.getByRole('combobox') as HTMLSelectElement;
    await fireEvent.change(languageSelect, { target: { value: 'ru' } });
    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_menu_label }));
    await fireEvent.click(screen.getByRole('button', { name: t.save_with_custom_translation }));
    await fireEvent.input(screen.getByPlaceholderText(t.custom_translation_placeholder), {
      target: { value: 'quality check' }
    });
    await fireEvent.click(screen.getByRole('button', { name: t.custom_translation_save }));

    await fireEvent.click(await screen.findByRole('button', { name: t.custom_translation_edit }));
    const customTranslationInput = screen.getByPlaceholderText(
      t.custom_translation_placeholder
    ) as HTMLInputElement;
    expect(customTranslationInput.value).toBe('quality check');
    await fireEvent.input(customTranslationInput, { target: { value: 'manual check' } });
    await fireEvent.click(screen.getByRole('button', { name: t.custom_translation_save }));

    expect(await screen.findByText('manual check')).toBeInTheDocument();
    expect(screen.queryByText('quality check')).not.toBeInTheDocument();
  });

  it('deletes a user-provided translation from the search result', async () => {
    render(App);

    await fireEvent.click(await screen.findByLabelText(t.translations_toggle));
    const languageSelect = screen.getByRole('combobox') as HTMLSelectElement;
    await fireEvent.change(languageSelect, { target: { value: 'ru' } });
    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_menu_label }));
    await fireEvent.click(screen.getByRole('button', { name: t.save_with_custom_translation }));
    await fireEvent.input(screen.getByPlaceholderText(t.custom_translation_placeholder), {
      target: { value: 'quality check' }
    });
    await fireEvent.click(screen.getByRole('button', { name: t.custom_translation_save }));

    await fireEvent.click(await screen.findByRole('button', { name: t.custom_translation_delete }));

    expect(removeSavedSenseMock).toHaveBeenCalled();
    expect(screen.queryByText('quality check')).not.toBeInTheDocument();
  });

  it('requires a specific language before saving a custom translation', async () => {
    render(App);

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_menu_label }));

    expect(
      screen.getByRole('button', { name: t.custom_translation_choose_language })
    ).toBeDisabled();
    expect(screen.queryByText(t.save_with_custom_translation)).not.toBeInTheDocument();
  });

  it('closes the save options menu when clicking outside it', async () => {
    render(App);

    await fireEvent.click(await screen.findByLabelText(t.translations_toggle));
    const languageSelect = screen.getByRole('combobox') as HTMLSelectElement;
    await fireEvent.change(languageSelect, { target: { value: 'ru' } });
    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_menu_label }));

    expect(
      screen.getByRole('button', { name: t.save_with_custom_translation })
    ).toBeInTheDocument();

    await fireEvent.pointerDown(input);

    expect(
      screen.queryByRole('button', { name: t.save_with_custom_translation })
    ).not.toBeInTheDocument();
  });

  it('removes a saved definition directly from dictionary view', async () => {
    render(App);

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_sense }));

    expect(getSavedSenses()).toHaveLength(1);

    await fireEvent.click(await screen.findByRole('button', { name: t.remove_sense }));

    expect(getSavedSenses()).toHaveLength(0);
  });

  it('opens the saved panel and renders saved senses', async () => {
    render(App);

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_sense }));

    expect(getSavedSenses()).toHaveLength(1);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_saved }));

    expect(await screen.findByText(t.saved_title)).toBeInTheDocument();
    expect(screen.getAllByText('A test definition')).toHaveLength(2);
  });

  it('opens a saved sense in the dictionary', async () => {
    render(App);

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_sense }));

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_saved }));
    const savedPanel = screen.getByText(t.saved_title).closest('section');
    await fireEvent.click(
      within(savedPanel as HTMLElement).getByRole('button', { name: t.saved_open })
    );

    expect(fetchDefinition).toHaveBeenLastCalledWith('test', {
      includeTranslations: false,
      translationLanguageCode: 'all'
    });
    expect(await screen.findByText('A test definition')).toBeInTheDocument();
  });

  it('removes a saved sense from the saved panel', async () => {
    render(App);

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_sense }));

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_saved }));
    const savedPanel = screen.getByText(t.saved_title).closest('section');
    await fireEvent.click(
      within(savedPanel as HTMLElement).getByRole('button', { name: t.remove_sense })
    );

    expect(confirm).toHaveBeenCalledWith('Remove this saved sense?');
    expect(getSavedSenses()).toHaveLength(0);
  });

  it('clears all saved senses from the saved panel', async () => {
    render(App);

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_sense }));

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_saved }));
    await fireEvent.click(screen.getByRole('button', { name: t.saved_clear }));

    expect(confirm).toHaveBeenCalledWith('Clear all saved senses?');
    expect(clearSavedSensesMock).toHaveBeenCalled();
    expect(getSavedSenses()).toHaveLength(0);
    expect(screen.getByText(t.saved_empty)).toBeInTheDocument();
  });

  it('exports saved senses as JSON from the saved panel', async () => {
    render(App);

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_sense }));

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_saved }));
    await fireEvent.click(screen.getByRole('button', { name: t.saved_export }));

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:saved-senses');
  });

  it('filters saved senses by search term', async () => {
    render(App);

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_sense }));

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_saved }));

    const savedSearch = screen.getByPlaceholderText(t.saved_search_placeholder);
    await fireEvent.input(savedSearch, { target: { value: 'missing' } });

    expect(screen.getByText(t.saved_empty)).toBeInTheDocument();

    await fireEvent.input(savedSearch, { target: { value: 'test definition' } });
    expect(screen.getAllByText('A test definition')).toHaveLength(2);
  });

  it('sorts saved senses by word', async () => {
    render(App);

    const input = await screen.findByPlaceholderText(t.search_placeholder);
    await fireEvent.input(input, { target: { value: 'test' } });
    await fireEvent.click(screen.getByRole('button', { name: t.search_button }));
    await fireEvent.click(await screen.findByRole('button', { name: t.save_sense }));

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

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_saved }));

    const sortSelect = screen.getByDisplayValue(t.saved_sort_recent);
    await fireEvent.change(sortSelect, { target: { value: 'word' } });

    const savedPanel = screen.getByText(t.saved_title).closest('section');
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
        message: t.storage_unavailable
      }
    ]);
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_log }));

    expect(await screen.findByText(t.log_section_dictionary)).toBeInTheDocument();
    expect(await screen.findByText(t.log_section_storage)).toBeInTheDocument();
    expect(await screen.findByText(t.storage_unavailable)).toBeInTheDocument();
  });

  it('opens the log panel and filters entries', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_log }));

    expect(await screen.findByText(t.log_title)).toBeInTheDocument();
    const filter = screen.getByRole('combobox', { name: t.log_type_filter });
    await fireEvent.change(filter, { target: { value: 'success' } });
    expect(screen.getByText('Lookup succeeded for "test".')).toBeInTheDocument();
  });

  it('filters log entries by source', async () => {
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
        word: 'runtime',
        type: 'runtime_error',
        source: 'unknown',
        message: 'Runtime broke.'
      }
    ]);
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_log }));
    await fireEvent.change(screen.getByRole('combobox', { name: t.log_source }), {
      target: { value: 'unknown' }
    });

    expect(screen.getByText('Runtime broke.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Lookup succeeded for "test".')).not.toBeInTheDocument();
    });
  });

  it('opens the cache panel and filters cache entries', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_cache }));

    expect(await screen.findByText(t.cache_title)).toBeInTheDocument();
    const search = screen.getByPlaceholderText(t.cache_search_placeholder);
    await fireEvent.input(search, { target: { value: 'test' } });
    expect(
      screen.getByText('https://freedictionaryapi.com/api/v1/entries/en/test')
    ).toBeInTheDocument();
    expect(screen.getByText('https://en.wiktionary.org/wiki/test')).toBeInTheDocument();
  });

  it('shows the current build version in the about panel', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_about }));

    expect(await screen.findByText(t.about_title)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.about_website_link })).toHaveAttribute(
      'href',
      new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString()
    );
    expect(screen.getByText(t.build_version_title)).toBeInTheDocument();
    expect(screen.getByText('0.0.0')).toBeInTheDocument();
    expect(screen.getByText(t.build_sha_title)).toBeInTheDocument();
    expect(screen.getByText(/-dev$/)).toBeInTheDocument();
    expect(screen.getByText(/^Built:/)).toBeInTheDocument();
  });

  it('checks for PWA updates from the about panel', async () => {
    serviceWorkerUpdateMock.mockResolvedValueOnce(undefined);
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_about }));
    await fireEvent.click(screen.getByRole('button', { name: t.update_check_button }));

    expect(serviceWorkerUpdateMock).toHaveBeenCalledOnce();
    expect(await screen.findByText(t.update_current)).toBeInTheDocument();
  });

  it('shows when the app update channel is not active yet', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persisted: vi.fn().mockResolvedValue(false),
        persist: vi.fn().mockResolvedValue(true)
      }
    });
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_about }));
    await fireEvent.click(screen.getByRole('button', { name: t.update_check_button }));

    expect(await screen.findByText(t.update_unavailable)).toBeInTheDocument();
  });

  it('groups developer tools in the side menu development section', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));

    expect(screen.getByText(t.menu_development)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.menu_log })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.menu_cache })).toBeInTheDocument();
  });

  it('opens the sync panel from the side menu', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_sync }));

    expect(await screen.findByText(t.sync_title)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.sync_provider_label })).toHaveValue(
      'google-drive'
    );
    expect(screen.getByRole('button', { name: t.sync_connect })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.sync_now })).toBeInTheDocument();
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

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_install }));

    expect(prompt).toHaveBeenCalledOnce();
  });

  it('prompts to activate a newly deployed PWA build', async () => {
    needRefreshStore.set(true);

    render(App);

    expect(await screen.findByText(t.pwa_update_ready)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: t.pwa_update_button }));

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('dismisses the PWA update prompt without activating the update', async () => {
    needRefreshStore.set(true);

    render(App);

    expect(await screen.findByText(t.pwa_update_ready)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: t.pwa_update_later }));

    await waitFor(() => {
      expect(screen.queryByText(t.pwa_update_ready)).not.toBeInTheDocument();
    });
    expect(updateServiceWorker).not.toHaveBeenCalled();
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

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_cache }));

    expect(await screen.findByText('shit')).toBeInTheDocument();
    expect(screen.queryByText('shit?translations=true')).not.toBeInTheDocument();
  });

  it('clears log history and cache with confirmation', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_log }));
    await fireEvent.click(screen.getByRole('button', { name: t.log_clear }));
    expect(clearDictionaryLogs).toHaveBeenCalled();

    await fireEvent.click(screen.getAllByRole('button', { name: t.log_close })[1]);
    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_cache }));
    await fireEvent.click(screen.getByRole('button', { name: t.cache_clear }));
    expect(clearDictionaryCache).toHaveBeenCalled();
  });

  it('opens a cached entry in the dictionary', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_cache }));
    await fireEvent.click(await screen.findByRole('button', { name: t.saved_open }));

    expect(fetchDefinition).toHaveBeenCalledWith('test', {
      includeTranslations: false,
      translationLanguageCode: 'all'
    });
    expect(await screen.findByText('A test definition')).toBeInTheDocument();
  });

  it('deletes a single cache entry after confirmation', async () => {
    render(App);

    await fireEvent.click(await screen.findByRole('button', { name: t.open_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_cache }));
    await fireEvent.click(await screen.findByRole('button', { name: t.custom_translation_delete }));

    expect(confirm).toHaveBeenCalledWith('Delete this cache entry?');
    expect(cacheDelete).toHaveBeenCalledWith(
      'https://freedictionaryapi.com/api/v1/entries/en/test'
    );
  });

  it('shows the dictionary not-found message for missing words', async () => {
    await withExpectedConsoleError(async () => {
      fetchDefinition.mockRejectedValueOnce(
        new DictionaryLookupError('Word not found', 'not_found')
      );
      render(App);

      const input = await screen.findByPlaceholderText(t.search_placeholder);
      await fireEvent.input(input, { target: { value: 'missing' } });
      await fireEvent.click(screen.getByRole('button', { name: t.search_button }));

      expect(await screen.findByText('Word not found')).toBeInTheDocument();
      expect(appendDictionaryLog).toHaveBeenCalledWith(
        expect.objectContaining({
          word: 'missing',
          type: 'not_found',
          message: 'Word not found'
        })
      );
      expect(getSearchHistory()[0]).toMatchObject({
        query: 'missing',
        status: 'not_found'
      });
    });
  });

  it('shows the generic fallback message for unexpected errors', async () => {
    await withExpectedConsoleError(async () => {
      fetchDefinition.mockRejectedValueOnce(new Error('boom'));
      render(App);

      const input = await screen.findByPlaceholderText(t.search_placeholder);
      await fireEvent.input(input, { target: { value: 'broken' } });
      await fireEvent.click(screen.getByRole('button', { name: t.search_button }));

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
      expect(getSearchHistory()[0]).toMatchObject({
        query: 'broken',
        status: 'failed',
        failureReason: 'unknown'
      });
    });
  });

  it('retries a failed search from the search input history', async () => {
    await withExpectedConsoleError(async () => {
      fetchDefinition.mockRejectedValueOnce(new Error('offline'));
      render(App);

      const input = await screen.findByPlaceholderText(t.search_placeholder);
      await fireEvent.input(input, { target: { value: 'retryme' } });
      await fireEvent.click(screen.getByRole('button', { name: t.search_button }));

      expect(
        await screen.findByText('Something went wrong while searching. Please try again.')
      ).toBeInTheDocument();

      await fireEvent.focus(input);
      await fireEvent.click(screen.getByRole('button', { name: /retryme/ }));

      expect(fetchDefinition).toHaveBeenLastCalledWith('retryme', {
        includeTranslations: false,
        translationLanguageCode: 'all'
      });
      expect(await screen.findByText('A test definition')).toBeInTheDocument();
      expect(getSearchHistory()[0]).toMatchObject({
        query: 'retryme',
        status: 'success',
        attempts: 2
      });
    });
  });
});
