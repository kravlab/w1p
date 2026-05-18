<script lang="ts">
  import { onMount } from 'svelte';
  import { _, isLoading, waitLocale } from 'svelte-i18n';
  import {
    SharedComponent,
    appendDictionaryLog,
    buildSavedSenseId,
    buildSavedSenseTranslation,
    clearDictionaryCache,
    clearSavedSenses,
    DICTIONARY_CACHE_NAME,
    DICTIONARY_TRANSLATION_LANGUAGES,
    filterDictionarySearchResult,
    filterDictionaryLogs,
    getSavedSenses,
    groupDictionaryLogsByDate,
    LOGGING_ENABLED,
    DictionaryLookupError,
    fetchDefinition,
    getDictionaryLogs,
    clearDictionaryLogs,
    getSearchHistory,
    mapPhoneticsToSavedPronunciations,
    recordSearchHistory,
    removeSavedSense,
    saveSense,
    sectionDictionaryLogs,
    type DictionaryLogType,
    type DictionaryLogEntry,
    type DictionaryLogSource,
    type DictionarySearchResult,
    type Definition,
    type DictionaryEntry,
    type SavedSense,
    type SearchHistoryEntry,
    type SearchHistoryFailureReason
  } from '@workspace/shared';
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import './app.css';

  type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };

  const SEARCH_STATE_STORAGE_KEY = 'pwa-search-state';

  interface StoredSearchState {
    searchTerm: string;
    includeTranslations: boolean;
    translationLanguageCode: string;
    rawSearchResult: DictionarySearchResult;
    searchResult: DictionarySearchResult;
  }

  /**
   * Build metadata is injected by Vite for every environment so the side menu
   * can always expose the exact bundle identity and build timestamp.
   * Test runners may not apply the same env injection pipeline, so the UI keeps
   * a local fallback that matches the Vite config defaults.
   */
  const buildVersion = (import.meta.env.VITE_APP_VERSION || '0.0.0').trim();
  const buildSha = (import.meta.env.VITE_APP_SHA || 'unknown-dev').trim();
  const buildTime = (import.meta.env.VITE_BUILD_TIME || new Date().toISOString()).trim();

  let installPrompt = $state<BeforeInstallPromptEvent | null>(null);
  let isDrawerOpen = $state(false);
  let isLogOpen = $state(false);
  let isCacheOpen = $state(false);
  let isSavedOpen = $state(false);

  let searchTerm = $state('');
  let includeTranslations = $state(false);
  let translationLanguageCode = $state('all');
  let logSearchTerm = $state('');
  let cacheSearchTerm = $state('');
  let savedSearchTerm = $state('');
  let savedSortOrder = $state<'recent' | 'oldest' | 'word'>('recent');
  let logTypeFilter = $state<'all' | DictionaryLogType>('all');
  let logSourceFilter = $state<'all' | DictionaryLogSource>('all');
  let rawSearchResult = $state<DictionarySearchResult>({ entries: [], source: 'network' });
  let searchResult = $state<DictionarySearchResult>({ entries: [], source: 'network' });
  let logEntries = $state<DictionaryLogEntry[]>([]);
  let savedSenses = $state<SavedSense[]>([]);
  let savedSenseIds = $state<string[]>([]);
  let cacheEntries = $state<Array<{ url: string; word: string; sourceUrl?: string }>>([]);
  let searchHistory = $state<SearchHistoryEntry[]>([]);
  let isSearchHistoryOpen = $state(false);
  let openSaveMenuKey = $state('');
  let lastWindowScrollY = 0;
  let isSearchChromeHidden = $state(false);
  let isScrollTopButtonVisible = $state(false);
  let customTranslationFormKey = $state('');
  let customTranslationValue = $state('');
  let isSearching = $state(false);
  let dictionaryError = $state('');
  let isPersistentStorageSupported = $state(false);
  let isPersistentStorageEnabled = $state(false);
  let isRequestingPersistentStorage = $state(false);

  const logTypeOptions: Array<'all' | DictionaryLogType> = [
    'all',
    'success',
    'not_found',
    'network',
    'server',
    'unknown',
    'runtime_error',
    'unhandled_rejection',
    'storage_granted',
    'storage_denied',
    'storage_unsupported'
  ];
  const logSourceOptions: Array<'all' | DictionaryLogSource> = [
    'all',
    'network',
    'cache',
    'unknown'
  ];

  function canUseLocalStorage(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  /**
   * The last lookup is kept locally so reloads, service-worker refreshes, and
   * installed PWA restarts can restore the user's current dictionary context.
   */
  function persistSearchState(): void {
    if (!canUseLocalStorage()) {
      return;
    }

    localStorage.setItem(
      SEARCH_STATE_STORAGE_KEY,
      JSON.stringify({
        searchTerm,
        includeTranslations,
        translationLanguageCode,
        rawSearchResult,
        searchResult
      } satisfies StoredSearchState)
    );
  }

  function restoreSearchState(): void {
    if (!canUseLocalStorage()) {
      return;
    }

    try {
      const rawValue = localStorage.getItem(SEARCH_STATE_STORAGE_KEY);
      if (!rawValue) {
        return;
      }

      const storedState = JSON.parse(rawValue) as Partial<StoredSearchState>;
      if (!storedState.searchTerm || !storedState.rawSearchResult || !storedState.searchResult) {
        return;
      }

      searchTerm = storedState.searchTerm;
      includeTranslations = Boolean(storedState.includeTranslations);
      translationLanguageCode = storedState.translationLanguageCode || 'all';
      rawSearchResult = storedState.rawSearchResult;
      searchResult = storedState.searchResult;
    } catch (error) {
      console.warn('Failed to restore search state', error);
    }
  }

  function refreshSearchHistory(): void {
    searchHistory = getSearchHistory();
  }

  function getVisibleSearchHistory(): SearchHistoryEntry[] {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchingEntries = normalizedSearch
      ? searchHistory.filter((entry) => entry.normalizedQuery.includes(normalizedSearch))
      : searchHistory;

    return matchingEntries.slice(0, 8);
  }

  function getSearchHistoryStatusIcon(entry: SearchHistoryEntry): string {
    if (entry.status === 'failed') {
      return '!';
    }

    if (entry.status === 'not_found') {
      return '?';
    }

    return '';
  }

  function getSearchHistoryStatusClass(entry: SearchHistoryEntry): string {
    if (entry.status === 'failed') {
      return 'border-rose-200 bg-rose-50 text-rose-700';
    }

    if (entry.status === 'not_found') {
      return 'border-amber-200 bg-amber-50 text-amber-700';
    }

    return 'border-slate-200 bg-white text-slate-400';
  }

  function getSearchHistoryFailureReason(
    type: DictionaryLookupError['code']
  ): SearchHistoryFailureReason | undefined {
    if (type === 'network' || type === 'server') {
      return type;
    }

    return undefined;
  }

  function recordSearchAttempt(
    query: string,
    status: SearchHistoryEntry['status'],
    options: {
      failureReason?: SearchHistoryFailureReason;
      message?: string;
    } = {}
  ): void {
    recordSearchHistory({
      query,
      status,
      failureReason: options.failureReason,
      message: options.message,
      includeTranslations,
      translationLanguageCode
    });
    refreshSearchHistory();
  }

  /**
   * Replaces previous results with the latest lookup attempt.
   * Errors are surfaced as plain text because the dictionary client already
   * distinguishes between "word not found" and generic fetch failures.
   */
  async function performSearch(): Promise<void> {
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm) return;

    isSearching = true;
    dictionaryError = '';
    rawSearchResult = { entries: [], source: 'network' };
    searchResult = { entries: [], source: 'network' };

    try {
      rawSearchResult = await fetchDefinition(trimmedTerm, {
        includeTranslations,
        translationLanguageCode: 'all'
      });
      searchResult = includeTranslations
        ? filterDictionarySearchResult(rawSearchResult, translationLanguageCode)
        : rawSearchResult;
      persistSearchState();
      appendDictionaryLog({
        word: trimmedTerm,
        type: 'success',
        source: searchResult.source,
        message: `Lookup succeeded for "${trimmedTerm}".`
      });
      recordSearchAttempt(trimmedTerm, 'success');
      refreshLogs();
      refreshCacheEntries();
    } catch (e: any) {
      console.error('Dictionary search failed in PWA', {
        word: trimmedTerm,
        error: e
      });

      if (e instanceof DictionaryLookupError) {
        dictionaryError = e.message;
        appendDictionaryLog({
          word: trimmedTerm,
          type: e.code,
          source: 'network',
          message: e.message,
          rawError: e
        });
        recordSearchAttempt(trimmedTerm, e.code === 'not_found' ? 'not_found' : 'failed', {
          failureReason: getSearchHistoryFailureReason(e.code),
          message: e.message
        });
      } else {
        dictionaryError = 'Something went wrong while searching. Please try again.';
        appendDictionaryLog({
          word: trimmedTerm,
          type: 'unknown',
          source: 'unknown',
          message: dictionaryError,
          rawError: e
        });
        recordSearchAttempt(trimmedTerm, 'failed', {
          failureReason: 'unknown',
          message: dictionaryError
        });
      }
      refreshLogs();
    } finally {
      isSearching = false;
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      isSearchHistoryOpen = false;
      performSearch();
    }
  }

  async function openSearchHistoryEntry(entry: SearchHistoryEntry): Promise<void> {
    searchTerm = entry.query;
    includeTranslations = entry.includeTranslations;
    translationLanguageCode = entry.translationLanguageCode;
    isSearchHistoryOpen = false;
    await performSearch();
  }

  function handleTranslationLanguageChange(event: Event): void {
    translationLanguageCode = (event.currentTarget as HTMLSelectElement).value;
    if (includeTranslations && rawSearchResult.entries.length) {
      searchResult = filterDictionarySearchResult(rawSearchResult, translationLanguageCode);
      persistSearchState();
    }
  }

  function handleLogTypeFilterChange(event: Event): void {
    logTypeFilter = (event.currentTarget as HTMLSelectElement).value as 'all' | DictionaryLogType;
  }

  function handleLogSourceFilterChange(event: Event): void {
    logSourceFilter = (event.currentTarget as HTMLSelectElement).value as
      | 'all'
      | DictionaryLogSource;
  }

  async function refreshPersistentStorageStatus(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
      isPersistentStorageSupported = false;
      isPersistentStorageEnabled = false;
      appendDictionaryLog({
        word: 'persistent-storage',
        type: 'storage_unsupported',
        source: 'unknown',
        message: 'Persistent storage is not supported in this browser.'
      });
      refreshLogs();
      return;
    }

    isPersistentStorageSupported = true;
    isPersistentStorageEnabled = await navigator.storage.persisted();
  }

  async function requestPersistentStorage(): Promise<void> {
    if (!navigator.storage?.persist) {
      isPersistentStorageSupported = false;
      appendDictionaryLog({
        word: 'persistent-storage',
        type: 'storage_unsupported',
        source: 'unknown',
        message: 'Persistent storage is not supported in this browser.'
      });
      refreshLogs();
      return;
    }

    isRequestingPersistentStorage = true;
    try {
      isPersistentStorageEnabled = await navigator.storage.persist();
      isPersistentStorageSupported = true;
      appendDictionaryLog({
        word: 'persistent-storage',
        type: isPersistentStorageEnabled ? 'storage_granted' : 'storage_denied',
        source: 'unknown',
        message: isPersistentStorageEnabled
          ? 'Persistent storage permission was granted.'
          : 'Persistent storage permission was denied.'
      });
      refreshLogs();
    } finally {
      isRequestingPersistentStorage = false;
    }
  }

  /**
   * Global browser failures are persisted into the same log store so debugging
   * does not depend on keeping DevTools open on a physical device.
   */
  function recordRuntimeFailure(
    type: 'runtime_error' | 'unhandled_rejection',
    options: {
      message: string;
      rawError?: unknown;
      url?: string;
    }
  ): void {
    appendDictionaryLog({
      word: 'runtime',
      type,
      source: 'unknown',
      message: options.message,
      rawError: options.rawError,
      url: options.url
    });
    refreshLogs();
  }

  function openDrawer(): void {
    isDrawerOpen = true;
  }

  function closeDrawer(): void {
    isDrawerOpen = false;
  }

  function openLog(): void {
    isLogOpen = true;
    isCacheOpen = false;
    isSavedOpen = false;
    isDrawerOpen = false;
    refreshLogs();
  }

  function closeLog(): void {
    isLogOpen = false;
  }

  function openCache(): void {
    isCacheOpen = true;
    isLogOpen = false;
    isSavedOpen = false;
    isDrawerOpen = false;
    void refreshCacheEntries();
  }

  function closeCache(): void {
    isCacheOpen = false;
  }

  function openSaved(): void {
    isSavedOpen = true;
    isLogOpen = false;
    isCacheOpen = false;
    isDrawerOpen = false;
    refreshSavedSenses();
  }

  function closeSaved(): void {
    isSavedOpen = false;
  }

  function refreshLogs(): void {
    logEntries = getDictionaryLogs();
  }

  function refreshSavedSenseIds(): void {
    savedSenseIds = getSavedSenses().map((entry) => entry.id);
  }

  function refreshSavedSenses(): void {
    savedSenses = getSavedSenses();
    refreshSavedSenseIds();
  }

  function getFilteredSavedSenses(): SavedSense[] {
    const normalizedSearch = savedSearchTerm.trim().toLowerCase();

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

    if (savedSortOrder === 'recent') {
      return [...filteredSenses].sort((left, right) => right.savedAt.localeCompare(left.savedAt));
    }

    if (savedSortOrder === 'oldest') {
      return [...filteredSenses].sort((left, right) => left.savedAt.localeCompare(right.savedAt));
    }

    return [...filteredSenses].sort((left, right) => left.word.localeCompare(right.word));
  }

  function handleSavedSortChange(event: Event): void {
    savedSortOrder = (event.currentTarget as HTMLSelectElement).value as
      | 'recent'
      | 'oldest'
      | 'word';
  }

  function clearLogHistory(): void {
    if (!confirm($_('log_clear_confirm'))) {
      return;
    }

    clearDictionaryLogs();
    refreshLogs();
  }

  async function refreshCacheEntries(): Promise<void> {
    if (typeof caches === 'undefined') {
      cacheEntries = [];
      return;
    }

    const cache = await caches.open(DICTIONARY_CACHE_NAME);
    const requests = await cache.keys();
    cacheEntries = await Promise.all(
      requests.map(async (request) => {
        const response = await cache.match(request);
        const data = response ? ((await response.json()) as DictionarySearchResult) : undefined;
        const url = request.url;
        const pathname = new URL(url).pathname;
        const word = decodeURIComponent(pathname.split('/').pop() || '');
        return { url, word, sourceUrl: data?.sourceUrl };
      })
    );
  }

  async function clearCacheHistory(): Promise<void> {
    if (!confirm($_('cache_clear_confirm'))) {
      return;
    }

    await clearDictionaryCache();
    await refreshCacheEntries();
  }

  function getFilteredCacheEntries(): Array<{ url: string; word: string; sourceUrl?: string }> {
    const normalizedSearch = cacheSearchTerm.trim().toLowerCase();

    return cacheEntries.filter((entry) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        entry.word.toLowerCase().includes(normalizedSearch) ||
        entry.url.toLowerCase().includes(normalizedSearch) ||
        entry.sourceUrl?.toLowerCase().includes(normalizedSearch)
      );
    });
  }

  async function openCachedEntry(word: string): Promise<void> {
    searchTerm = word;
    closeCache();
    await performSearch();
  }

  async function openSavedSense(word: string): Promise<void> {
    searchTerm = word;
    closeSaved();
    await performSearch();
  }

  async function deleteCacheEntry(url: string): Promise<void> {
    if (!confirm($_('cache_delete_confirm'))) {
      return;
    }

    if (typeof caches === 'undefined') {
      return;
    }

    const cache = await caches.open(DICTIONARY_CACHE_NAME);
    await cache.delete(url);
    await refreshCacheEntries();
  }

  /**
   * The UI consumes a pre-sectioned log model from shared utilities so the
   * component only handles labels and rendering concerns.
   */
  function getFilteredLogEntries(): DictionaryLogEntry[] {
    return filterDictionaryLogs(logEntries, {
      type: logTypeFilter,
      source: logSourceFilter,
      searchTerm: logSearchTerm
    });
  }

  /**
   * The UI consumes a pre-sectioned log model from shared utilities so the
   * component only handles labels and rendering concerns.
   */
  function getLogSections(): Array<{
    id: 'dictionary' | 'storage';
    title: string;
    groups: Array<{ date: string; entries: DictionaryLogEntry[] }>;
  }> {
    return sectionDictionaryLogs(getFilteredLogEntries()).map((section) => ({
      id: section.id,
      title: section.id === 'dictionary' ? $_('log_section_dictionary') : $_('log_section_storage'),
      groups: groupDictionaryLogsByDate(section.entries)
    }));
  }

  /**
   * Log types map to fixed semantic colors so the history panel communicates
   * severity at a glance without relying on the raw enum labels alone.
   */
  function getLogTypeBadgeClass(type: DictionaryLogType): string {
    switch (type) {
      case 'success':
        return 'bg-emerald-100 text-emerald-800';
      case 'not_found':
        return 'bg-amber-100 text-amber-800';
      case 'network':
        return 'bg-orange-100 text-orange-800';
      case 'server':
        return 'bg-rose-100 text-rose-800';
      case 'unknown':
        return 'bg-slate-200 text-slate-700';
      case 'runtime_error':
        return 'bg-rose-100 text-rose-800';
      case 'unhandled_rejection':
        return 'bg-fuchsia-100 text-fuchsia-800';
      case 'storage_granted':
        return 'bg-emerald-100 text-emerald-800';
      case 'storage_denied':
        return 'bg-amber-100 text-amber-800';
      case 'storage_unsupported':
        return 'bg-slate-200 text-slate-700';
    }
  }

  /**
   * Language names are only useful when multiple translation languages are
   * rendered at once. In a single-language mode the UI keeps the chip shorter.
   */
  function getTranslationText(languageName: string, word: string): string {
    if (translationLanguageCode === 'all') {
      return `${languageName}: ${word}`;
    }

    return word;
  }

  function getSavedSenseId(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
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

  function getCustomSavedSenseId(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): string {
    return buildSavedSenseId({
      word: entry.word,
      languageCode: 'en',
      partOfSpeech,
      definition: definition.definition,
      translationLanguageCode: translationLanguageCode
    });
  }

  function getSelectedTranslationLanguage(): { code: string; label: string } {
    return (
      DICTIONARY_TRANSLATION_LANGUAGES.find(
        (language) => language.code === translationLanguageCode
      ) ?? DICTIONARY_TRANSLATION_LANGUAGES[0]
    );
  }

  function canSaveCustomTranslation(): boolean {
    return translationLanguageCode !== 'all';
  }

  function getSavedCustomTranslation(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): SavedSense['translation'] | undefined {
    return savedSenses.find(
      (savedSense) =>
        savedSense.id === getCustomSavedSenseId(entry, partOfSpeech, definition) &&
        savedSense.translation?.source === 'user'
    )?.translation;
  }

  function isDefinitionSaved(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): boolean {
    return savedSenseIds.includes(getSavedSenseId(entry, partOfSpeech, definition));
  }

  /**
   * Search-result action buttons share the same 36px hit area so the save,
   * remove, and overflow controls stay visually aligned in the result list.
   */
  function getSearchResultActionButtonClass(isSaved: boolean): string {
    return isSaved
      ? 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-default disabled:bg-rose-50 disabled:text-rose-300'
      : 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500';
  }

  function getSearchResultSaveButtonIcon(isSaved: boolean): string {
    return isSaved ? '×' : '+';
  }

  /**
   * A saved sense captures the currently visible meaning card. In "All
   * languages" mode the sense is stored without translation to avoid smuggling
   * extra languages into a single saved card.
   */
  function saveDefinition(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): void {
    saveSense({
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
      sourceUrl: searchResult.sourceUrl
    });
    refreshSavedSenses();
  }

  function openCustomTranslationForm(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): void {
    customTranslationFormKey = getCustomSavedSenseId(entry, partOfSpeech, definition);
    customTranslationValue =
      getSavedCustomTranslation(entry, partOfSpeech, definition)?.words[0] ?? '';
    openSaveMenuKey = '';
  }

  function closeCustomTranslationForm(): void {
    customTranslationFormKey = '';
    customTranslationValue = '';
  }

  /**
   * User translations keep the currently selected translation language so they
   * can replace an API wording for that language without inventing a fake code.
   */
  function saveDefinitionWithCustomTranslation(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): void {
    const customTranslation = customTranslationValue.trim();
    if (!customTranslation || !canSaveCustomTranslation()) {
      return;
    }

    const selectedTranslationLanguage = getSelectedTranslationLanguage();
    saveSense({
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
        words: [customTranslation]
      },
      sourceUrl: searchResult.sourceUrl
    });
    closeCustomTranslationForm();
    refreshSavedSenses();
  }

  function deleteCustomTranslation(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): void {
    if (!confirm($_('saved_remove_confirm'))) {
      return;
    }

    removeSavedSense(getCustomSavedSenseId(entry, partOfSpeech, definition));
    closeCustomTranslationForm();
    refreshSavedSenses();
  }

  function deleteSavedSense(id: string): void {
    if (!confirm($_('saved_remove_confirm'))) {
      return;
    }

    removeSavedSense(id);
    refreshSavedSenses();
  }

  function clearSavedLibrary(): void {
    if (!confirm($_('saved_clear_confirm'))) {
      return;
    }

    clearSavedSenses();
    refreshSavedSenses();
  }

  function toggleDefinitionSaved(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): void {
    const savedSenseId = getSavedSenseId(entry, partOfSpeech, definition);

    if (savedSenseIds.includes(savedSenseId)) {
      removeSavedSense(savedSenseId);
      refreshSavedSenses();
      return;
    }

    saveDefinition(entry, partOfSpeech, definition);
  }

  function toggleSaveMenu(key: string): void {
    openSaveMenuKey = openSaveMenuKey === key ? '' : key;
  }

  /**
   * Save option menus are intentionally local to each definition row; outside
   * clicks should dismiss the active menu without affecting the inline custom
   * translation form.
   */
  function handleDocumentPointerDown(event: PointerEvent): void {
    if (!openSaveMenuKey && !isSearchHistoryOpen) {
      return;
    }

    const target = event.target;
    if (target instanceof Element) {
      if (openSaveMenuKey && !target.closest('[data-save-menu]')) {
        openSaveMenuKey = '';
      }

      if (isSearchHistoryOpen && !target.closest('[data-search-history]')) {
        isSearchHistoryOpen = false;
      }
    }
  }

  function exportLogs(): void {
    if (typeof document === 'undefined' || !LOGGING_ENABLED) {
      return;
    }

    const payload = JSON.stringify(logEntries, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = blobUrl;
    link.download = `dictionary-log-history-${new Date().toISOString()}.json`;
    link.click();

    URL.revokeObjectURL(blobUrl);
  }

  function exportSavedSenses(): void {
    if (typeof document === 'undefined') {
      return;
    }

    const payload = JSON.stringify(savedSenses, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = blobUrl;
    link.download = `saved-senses-${new Date().toISOString()}.json`;
    link.click();

    URL.revokeObjectURL(blobUrl);
  }

  /**
   * Long result pages should keep reading space clear while moving down, but
   * the primary search controls must return as soon as the user scrolls back up.
   */
  function handleWindowScroll(): void {
    const currentScrollY = Math.max(window.scrollY, 0);
    const isScrollingDown = currentScrollY > lastWindowScrollY;
    const isScrollingUp = currentScrollY < lastWindowScrollY;

    if (currentScrollY < 80 || isScrollingUp) {
      isSearchChromeHidden = false;
    } else if (isScrollingDown) {
      isSearchChromeHidden = true;
    }

    isScrollTopButtonVisible = currentScrollY >= 240;
    lastWindowScrollY = currentScrollY;
  }

  /**
   * The explicit top jump mirrors browser-reader behavior: after activating it,
   * the controls are visible immediately instead of waiting for the smooth
   * scroll animation to emit another scroll event.
   */
  function scrollToPageTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    lastWindowScrollY = 0;
    isSearchChromeHidden = false;
    isScrollTopButtonVisible = false;
  }

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (r) console.info('PWA Service Worker registered');
    }
  });

  /**
   * Activates the waiting service worker and reloads the app so the installed
   * PWA moves to the newly deployed build immediately after user confirmation.
   */
  function updatePwa(): void {
    void updateServiceWorker(true);
  }

  /**
   * The PWA accepts shared `title/text/url` values through query params on `/`.
   * Install prompt listeners are attached once because browsers expose that
   * prompt through a transient event rather than a reusable API.
   */
  onMount(() => {
    void (async () => {
      await waitLocale();
      restoreSearchState();
      refreshLogs();
      refreshSearchHistory();
      refreshSavedSenses();
      await refreshCacheEntries();
      await refreshPersistentStorageStatus();

      const params = new URLSearchParams(window.location.search);
      if (params.has('text')) {
        const sharedText = params.get('text') || '';

        if (sharedText) {
          searchTerm = sharedText;
        }
      }
    })();

    const handleBeforeInstallPrompt = (e: Event): void => {
      e.preventDefault();
      installPrompt = e as BeforeInstallPromptEvent;
    };

    const handleAppInstalled = (): void => {
      installPrompt = null;
    };

    const handleWindowError = (event: ErrorEvent): void => {
      const location =
        event.filename && event.lineno
          ? `${event.filename}:${event.lineno}:${event.colno}`
          : event.filename || undefined;
      const message = event.message || 'Unexpected runtime error';

      recordRuntimeFailure('runtime_error', {
        message: location ? `${message} (${location})` : message,
        rawError: event.error ?? event.message,
        url: location
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
      const reason =
        typeof event.reason === 'string'
          ? event.reason
          : event.reason instanceof Error
            ? event.reason.message
            : 'Unhandled promise rejection';

      recordRuntimeFailure('unhandled_rejection', {
        message: reason,
        rawError: event.reason
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    document.addEventListener('pointerdown', handleDocumentPointerDown, true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('scroll', handleWindowScroll);
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
    };
  });

  async function handleInstall(): Promise<void> {
    if (installPrompt) {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === 'accepted') {
        installPrompt = null;
      }
      isDrawerOpen = false;
    }
  }
</script>

<main class="min-h-screen bg-slate-100 font-sans">
  {#if $isLoading}
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="flex items-center justify-center space-x-2 animate-pulse" aria-hidden="true">
        <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
        <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
        <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
      </div>
    </div>
  {:else}
    {#if isDrawerOpen}
      <button
        type="button"
        class="fixed inset-0 z-30 bg-slate-950/45"
        aria-label={$_('close_menu')}
        onclick={closeDrawer}
      ></button>
    {/if}

    {#if isScrollTopButtonVisible}
      <button
        type="button"
        class="fixed bottom-5 right-5 z-20 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white shadow-xl ring-1 ring-white/50 transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={$_('scroll_to_top')}
        onclick={scrollToPageTop}
      >
        ↑
      </button>
    {/if}

    {#if isLogOpen}
      <button
        type="button"
        class="fixed inset-0 z-40 bg-slate-950/45"
        aria-label={$_('log_close')}
        onclick={closeLog}
      ></button>
      <section
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <header class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {$_('menu_log')}
            </p>
            <h2 class="mt-1 text-xl font-black text-slate-900">{$_('log_title')}</h2>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onclick={exportLogs}
            >
              {$_('log_export')}
            </button>
            <button
              type="button"
              class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onclick={clearLogHistory}
            >
              {$_('log_clear')}
            </button>
            <button
              type="button"
              class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              onclick={closeLog}
            >
              {$_('log_close')}
            </button>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-5">
          <div class="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
            <input
              type="text"
              bind:value={logSearchTerm}
              placeholder={$_('log_search_placeholder')}
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            />
            <select
              value={logTypeFilter}
              onchange={handleLogTypeFilterChange}
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
              aria-label="Type"
            >
              {#each logTypeOptions as option (option)}
                <option value={option}>{option}</option>
              {/each}
            </select>
            <select
              value={logSourceFilter}
              onchange={handleLogSourceFilterChange}
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
              aria-label={$_('log_source')}
            >
              {#each logSourceOptions as option (option)}
                <option value={option}>{option}</option>
              {/each}
            </select>
          </div>

          {#if !getFilteredLogEntries().length}
            <div
              class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500"
            >
              {$_('log_empty')}
            </div>
          {:else}
            <div class="space-y-6">
              {#each getLogSections() as section (section.id)}
                <section class="space-y-4">
                  <div
                    class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.24em] text-white"
                  >
                    {section.title}
                  </div>
                  {#each section.groups as group (`${section.id}-${group.date}`)}
                    <section class="space-y-4">
                      <div
                        class="sticky top-0 z-10 rounded-xl bg-slate-100/90 px-3 py-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-500 backdrop-blur"
                      >
                        {group.date}
                      </div>

                      {#each group.entries as entry (entry.id)}
                        <article
                          class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm"
                        >
                          <div class="flex items-start justify-between gap-3">
                            <div>
                              <p
                                class={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getLogTypeBadgeClass(entry.type)}`}
                              >
                                {entry.type}
                              </p>
                              <p class="mt-1 text-sm text-slate-700">{entry.message}</p>
                            </div>
                            <span
                              class="rounded-full bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
                            >
                              {entry.source}
                            </span>
                          </div>

                          <dl class="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                            <div>
                              <dt class="font-semibold text-slate-700">{$_('log_word')}</dt>
                              <dd class="mt-1 break-all">{entry.word}</dd>
                            </div>
                            <div>
                              <dt class="font-semibold text-slate-700">{$_('log_time')}</dt>
                              <dd class="mt-1">{new Date(entry.timestamp).toLocaleString()}</dd>
                            </div>
                            <div>
                              <dt class="font-semibold text-slate-700">{$_('log_source')}</dt>
                              <dd class="mt-1">{entry.source}</dd>
                            </div>
                          </dl>

                          {#if entry.rawError}
                            <details class="mt-4 rounded-xl bg-white p-3 text-xs text-slate-600">
                              <summary class="cursor-pointer font-semibold text-slate-700">
                                Raw error
                              </summary>
                              <pre
                                class="mt-3 overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(
                                  entry.rawError,
                                  null,
                                  2
                                )}</pre>
                            </details>
                          {/if}
                        </article>
                      {/each}
                    </section>
                  {/each}
                </section>
              {/each}
            </div>
          {/if}
        </div>
      </section>
    {/if}

    {#if isCacheOpen}
      <button
        type="button"
        class="fixed inset-0 z-40 bg-slate-950/45"
        aria-label={$_('cache_close')}
        onclick={closeCache}
      ></button>
      <section
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <header class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {$_('menu_cache')}
            </p>
            <h2 class="mt-1 text-xl font-black text-slate-900">{$_('cache_title')}</h2>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onclick={clearCacheHistory}
            >
              {$_('cache_clear')}
            </button>
            <button
              type="button"
              class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              onclick={closeCache}
            >
              {$_('cache_close')}
            </button>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-5">
          <div class="mb-5">
            <input
              type="text"
              bind:value={cacheSearchTerm}
              placeholder={$_('cache_search_placeholder')}
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            />
          </div>

          {#if !getFilteredCacheEntries().length}
            <div
              class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500"
            >
              {$_('cache_empty')}
            </div>
          {:else}
            <div class="space-y-4">
              {#each getFilteredCacheEntries() as entry (entry.url)}
                <article
                  class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm"
                >
                  <dl class="grid gap-3 text-sm text-slate-700">
                    <div>
                      <dt class="font-semibold text-slate-900">{$_('cache_word')}</dt>
                      <dd class="mt-1 break-all">{entry.word}</dd>
                    </div>
                    <div>
                      <dt class="font-semibold text-slate-900">{$_('cache_url')}</dt>
                      <dd class="mt-1 break-all text-xs">
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noreferrer"
                          class="text-blue-700 underline decoration-blue-200 underline-offset-4"
                        >
                          {entry.url}
                        </a>
                      </dd>
                    </div>
                    {#if entry.sourceUrl}
                      <div>
                        <dt class="font-semibold text-slate-900">{$_('cache_source_url')}</dt>
                        <dd class="mt-1 break-all text-xs">
                          <a
                            href={entry.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            class="text-blue-700 underline decoration-blue-200 underline-offset-4"
                          >
                            {entry.sourceUrl}
                          </a>
                        </dd>
                      </div>
                    {/if}
                  </dl>
                  <div class="mt-4 flex gap-2">
                    <button
                      type="button"
                      class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      onclick={() => openCachedEntry(entry.word)}
                    >
                      {$_('cache_open_entry')}
                    </button>
                    <button
                      type="button"
                      class="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                      onclick={() => deleteCacheEntry(entry.url)}
                    >
                      {$_('cache_delete_entry')}
                    </button>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </div>
      </section>
    {/if}

    {#if isSavedOpen}
      <button
        type="button"
        class="fixed inset-0 z-40 bg-slate-950/45"
        aria-label={$_('saved_close')}
        onclick={closeSaved}
      ></button>
      <section
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <header class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {$_('menu_saved')}
            </p>
            <h2 class="mt-1 text-xl font-black text-slate-900">{$_('saved_title')}</h2>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!savedSenses.length}
              onclick={exportSavedSenses}
            >
              {$_('saved_export')}
            </button>
            <button
              type="button"
              class="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!savedSenses.length}
              onclick={clearSavedLibrary}
            >
              {$_('saved_clear')}
            </button>
            <button
              type="button"
              class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              onclick={closeSaved}
            >
              {$_('saved_close')}
            </button>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-5">
          <div class="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <input
              type="text"
              bind:value={savedSearchTerm}
              placeholder={$_('saved_search_placeholder')}
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            />
            <select
              value={savedSortOrder}
              onchange={handleSavedSortChange}
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
            >
              <option value="recent">{$_('saved_sort_recent')}</option>
              <option value="oldest">{$_('saved_sort_oldest')}</option>
              <option value="word">{$_('saved_sort_word')}</option>
            </select>
          </div>

          {#if !getFilteredSavedSenses().length}
            <div
              class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500"
            >
              {$_('saved_empty')}
            </div>
          {:else}
            <div class="space-y-4">
              {#each getFilteredSavedSenses() as savedSense (savedSense.id)}
                <article
                  class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <h3 class="text-lg font-black text-slate-900">{savedSense.word}</h3>
                      <p class="mt-1 text-sm font-medium text-slate-500">
                        {savedSense.partOfSpeech}
                        {#if savedSense.phonetic}
                          <span class="ml-2 text-slate-400">{savedSense.phonetic}</span>
                        {/if}
                      </p>
                    </div>
                    <div class="flex gap-2">
                      <button
                        type="button"
                        class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        onclick={() => openSavedSense(savedSense.word)}
                      >
                        {$_('saved_open')}
                      </button>
                      <button
                        type="button"
                        class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                        onclick={() => deleteSavedSense(savedSense.id)}
                      >
                        {$_('saved_remove')}
                      </button>
                    </div>
                  </div>

                  <p class="mt-4 text-sm font-medium text-slate-900">{savedSense.definition}</p>

                  {#if savedSense.examples.length}
                    <div
                      class="mt-3 space-y-2 border-l-2 border-slate-200 pl-3 text-xs italic text-slate-500"
                    >
                      {#each savedSense.examples as example (`${savedSense.id}-${example}`)}
                        <p>"{example}"</p>
                      {/each}
                    </div>
                  {/if}

                  {#if savedSense.translation}
                    <div class="mt-3 flex flex-wrap items-start gap-2 text-xs">
                      <span class="font-semibold uppercase tracking-wide text-slate-500">
                        {$_('translations_label')}
                      </span>
                      <div class="flex flex-wrap gap-2">
                        {#each savedSense.translation.words as word (`${savedSense.id}-${word}`)}
                          <span
                            class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700"
                          >
                            {savedSense.translation.languageName}: {word}
                          </span>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  {#if savedSense.sourceUrl}
                    <div class="mt-4">
                      <a
                        href={savedSense.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        class="text-sm font-medium text-blue-700 underline decoration-blue-200 underline-offset-4"
                      >
                        {$_('saved_source_link')}
                      </a>
                    </div>
                  {/if}
                </article>
              {/each}
            </div>
          {/if}
        </div>
      </section>
    {/if}

    <div class="flex min-h-screen">
      <aside
        class={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white/95 shadow-2xl backdrop-blur transition-transform duration-200 ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div class="flex h-full flex-col">
          <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                {$_('menu_title')}
              </p>
              <h2 class="mt-1 text-lg font-black text-slate-900">{$_('pwa_page')}</h2>
            </div>
            <button
              type="button"
              class="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              aria-label={$_('close_menu')}
              onclick={closeDrawer}
            >
              ✕
            </button>
          </div>

          <nav class="space-y-3 px-4 py-5">
            <a
              href="#dictionary"
              class="block rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              onclick={closeDrawer}>{$_('menu_dictionary')}</a
            >

            {#if installPrompt}
              <button
                type="button"
                class="block w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                onclick={handleInstall}
              >
                {$_('menu_install')}
              </button>
            {/if}

            <button
              type="button"
              class="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onclick={openSaved}
            >
              {$_('menu_saved')}
            </button>
          </nav>

          <div class="mt-auto border-t border-slate-200 px-5 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {$_('menu_development')}
            </p>
            <div class="mt-3 grid gap-2">
              <button
                type="button"
                class="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onclick={openLog}
              >
                {$_('menu_log')}
              </button>
              <button
                type="button"
                class="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onclick={openCache}
              >
                {$_('menu_cache')}
              </button>
            </div>

            <p class="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {$_('menu_status')}
            </p>
            <div class="mt-3 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-left">
              <span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              <div>
                <p class="text-sm font-bold text-emerald-900">{$_('menu_ready')}</p>
                <p class="text-xs text-emerald-700">Dictionary and share target are available.</p>
              </div>
            </div>
            <div class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
              <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                {$_('storage_title')}
              </p>
              <p class="mt-2 text-sm text-slate-700">
                {#if !isPersistentStorageSupported}
                  {$_('storage_unavailable')}
                {:else if isPersistentStorageEnabled}
                  {$_('storage_persistent_enabled')}
                {:else}
                  {$_('storage_persistent_disabled')}
                {/if}
              </p>
              {#if isPersistentStorageSupported && !isPersistentStorageEnabled}
                <button
                  type="button"
                  class="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isRequestingPersistentStorage}
                  onclick={requestPersistentStorage}
                >
                  {$_('storage_request_button')}
                </button>
              {/if}
            </div>
            <div class="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left">
              <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                {$_('build_version_title')}
              </p>
              <p class="mt-2 font-mono text-sm font-semibold text-slate-900">{buildVersion}</p>
              <p class="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                {$_('build_sha_title')}
              </p>
              <p class="mt-2 font-mono text-sm font-semibold text-slate-900">{buildSha}</p>
              <p class="mt-3 text-xs text-slate-500">{$_('build_time_label')}: {buildTime}</p>
            </div>
          </div>
        </div>
      </aside>

      <section class="flex min-h-screen flex-1 items-start justify-center p-4 lg:p-8">
        <div class="w-full max-w-4xl">
          <!-- Keep the menu button and search controls near the viewport, but
               hide them while scrolling down so long result lists keep focus. -->
          <div
            class={`sticky top-3 z-20 mb-5 rounded-2xl border border-white/70 bg-slate-100/95 p-3 shadow-lg backdrop-blur transition-all duration-200 ease-out ${isSearchChromeHidden ? 'pointer-events-none -translate-y-[calc(100%+1rem)] opacity-0' : 'translate-y-0 opacity-100'}`}
            data-testid="search-chrome"
          >
            <section class="text-center" id="dictionary">
              <div class="flex gap-2">
                <button
                  type="button"
                  class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
                  aria-label={$_('open_menu')}
                  onclick={openDrawer}
                >
                  <span class="text-xl leading-none">☰</span>
                </button>
                <div class="relative min-w-0 flex-1" data-search-history>
                  <input
                    type="text"
                    bind:value={searchTerm}
                    onfocus={() => (isSearchHistoryOpen = true)}
                    oninput={() => (isSearchHistoryOpen = true)}
                    onkeydown={handleKeydown}
                    placeholder={$_('search_placeholder')}
                    class="w-full rounded-xl border-2 border-gray-200 bg-white p-3 outline-none transition-all focus:border-blue-500"
                  />
                  {#if isSearchHistoryOpen && getVisibleSearchHistory().length}
                    <div
                      class="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-xl"
                    >
                      {#each getVisibleSearchHistory() as entry (entry.id)}
                        <button
                          type="button"
                          class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                          onclick={() => openSearchHistoryEntry(entry)}
                        >
                          <span
                            class={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black ${getSearchHistoryStatusClass(entry)}`}
                            aria-hidden="true"
                          >
                            {getSearchHistoryStatusIcon(entry)}
                          </span>
                          <span class="min-w-0 flex-1 truncate font-semibold text-slate-800">
                            {entry.query}
                          </span>
                          {#if entry.attempts > 1}
                            <span class="shrink-0 text-xs font-semibold text-slate-400">
                              {entry.attempts}
                            </span>
                          {/if}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
                <button
                  onclick={() => {
                    isSearchHistoryOpen = false;
                    void performSearch();
                  }}
                  disabled={isSearching}
                  class="rounded-xl bg-blue-600 px-6 font-bold text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                >
                  {isSearching ? $_('searching') : $_('search_button')}
                </button>
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <label class="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    bind:checked={includeTranslations}
                    class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{$_('translations_toggle')}</span>
                </label>
                <select
                  value={translationLanguageCode}
                  disabled={!includeTranslations}
                  onchange={handleTranslationLanguageChange}
                  class="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {#each DICTIONARY_TRANSLATION_LANGUAGES as language (language.code)}
                    <option value={language.code}>{language.label}</option>
                  {/each}
                </select>
              </div>
              {#if dictionaryError}
                <p class="mt-2 text-sm font-medium text-red-500">{dictionaryError}</p>
              {/if}
            </section>
          </div>

          {#if $needRefresh}
            <section
              class="mb-8 rounded-2xl border-2 border-amber-100 bg-amber-50 p-5 transition-all"
            >
              <p class="mb-2 font-bold text-amber-900">{$_('pwa_update_ready')}</p>
              <p class="mb-4 text-sm text-amber-800">{$_('pwa_update_description')}</p>
              <button
                type="button"
                onclick={updatePwa}
                class="w-full rounded-xl bg-amber-600 py-3 font-bold text-white shadow-lg transition-all hover:bg-amber-700 active:scale-95"
              >
                {$_('pwa_update_button')}
              </button>
            </section>
          {/if}

          {#if isSearching}
            <div
              class="flex items-center justify-center space-x-2 my-8 animate-pulse"
              aria-hidden="true"
            >
              <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
              <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
              <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
            </div>
          {/if}

          {#each searchResult.entries as entry, index (`${entry.word}-${entry.phonetic || 'no-phonetic'}-${index}`)}
            <!-- The upstream API can return multiple entries with identical word and phonetic. -->
            <div class="text-left mt-8 mb-4">
              <h2 class="text-2xl font-black text-gray-900 flex items-baseline gap-2">
                {entry.word}
                {#if entry.phonetic}
                  <span class="text-sm font-medium text-gray-400">{entry.phonetic}</span>
                {/if}
              </h2>
            </div>
            {#each entry.meanings as meaning (meaning.partOfSpeech)}
              <SharedComponent title={meaning.partOfSpeech}>
                <ul class="list-disc list-outside ml-4 space-y-3">
                  {#each meaning.definitions as def (def.definition)}
                    {@const customSaveKey = getCustomSavedSenseId(entry, meaning.partOfSpeech, def)}
                    {@const savedCustomTranslation = getSavedCustomTranslation(
                      entry,
                      meaning.partOfSpeech,
                      def
                    )}
                    <li class="text-gray-700">
                      <div class="mb-2 flex flex-wrap items-start gap-2">
                        <button
                          type="button"
                          class={getSearchResultActionButtonClass(
                            isDefinitionSaved(entry, meaning.partOfSpeech, def)
                          )}
                          aria-label={isDefinitionSaved(entry, meaning.partOfSpeech, def)
                            ? $_('remove_sense')
                            : $_('save_sense')}
                          onclick={() => toggleDefinitionSaved(entry, meaning.partOfSpeech, def)}
                        >
                          <span class="text-base leading-none font-black">
                            {getSearchResultSaveButtonIcon(
                              isDefinitionSaved(entry, meaning.partOfSpeech, def)
                            )}
                          </span>
                        </button>
                        <div class="relative" data-save-menu>
                          <button
                            type="button"
                            class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500"
                            aria-label={$_('save_menu_label')}
                            aria-expanded={openSaveMenuKey === customSaveKey}
                            onclick={() => toggleSaveMenu(customSaveKey)}
                          >
                            <span class="text-base leading-none">⋯</span>
                          </button>
                          {#if openSaveMenuKey === customSaveKey}
                            <div
                              class="absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
                            >
                              {#if canSaveCustomTranslation()}
                                <button
                                  type="button"
                                  class="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                  onclick={() =>
                                    openCustomTranslationForm(entry, meaning.partOfSpeech, def)}
                                >
                                  {$_('save_with_custom_translation')}
                                </button>
                              {:else}
                                <button
                                  type="button"
                                  class="block w-full cursor-not-allowed rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-400"
                                  disabled
                                >
                                  {$_('custom_translation_choose_language')}
                                </button>
                              {/if}
                            </div>
                          {/if}
                        </div>
                      </div>
                      {#if customTranslationFormKey === customSaveKey}
                        <form
                          class="mb-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row"
                          onsubmit={(event) => {
                            event.preventDefault();
                            saveDefinitionWithCustomTranslation(entry, meaning.partOfSpeech, def);
                          }}
                        >
                          <input
                            type="text"
                            bind:value={customTranslationValue}
                            placeholder={$_('custom_translation_placeholder')}
                            class="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                          />
                          <div class="flex gap-2">
                            <button
                              type="submit"
                              class="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!customTranslationValue.trim()}
                            >
                              {$_('custom_translation_save')}
                            </button>
                            <button
                              type="button"
                              class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                              onclick={closeCustomTranslationForm}
                            >
                              {$_('custom_translation_cancel')}
                            </button>
                          </div>
                        </form>
                      {/if}
                      <span class="font-medium text-gray-900">{def.definition}</span>
                      {#if def.example}
                        <p
                          class="text-xs italic text-gray-500 mt-1.5 border-l-2 border-gray-100 pl-3"
                        >
                          "{def.example}"
                        </p>
                      {/if}
                      {#if def.translations.length || savedCustomTranslation}
                        <div class="mt-2 flex flex-wrap items-start gap-2 text-xs">
                          <span class="font-semibold uppercase tracking-wide text-slate-500">
                            {$_('translations_label')}
                          </span>
                          <div class="flex flex-wrap gap-2">
                            {#each def.translations as translation, translationIndex (`${translation.languageCode}-${translation.word}-${translationIndex}`)}
                              <span
                                class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700"
                              >
                                {getTranslationText(translation.languageName, translation.word)}
                              </span>
                            {/each}
                            {#if savedCustomTranslation}
                              {#each savedCustomTranslation.words as word (`${customSaveKey}-${word}`)}
                                <span
                                  class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800"
                                >
                                  <span>
                                    {getTranslationText(
                                      savedCustomTranslation.languageName ?? '',
                                      word
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    class="rounded-full px-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 transition hover:bg-amber-200"
                                    aria-label={$_('custom_translation_edit')}
                                    onclick={() =>
                                      openCustomTranslationForm(entry, meaning.partOfSpeech, def)}
                                  >
                                    ✎
                                  </button>
                                  <button
                                    type="button"
                                    class="rounded-full px-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 transition hover:bg-amber-200"
                                    aria-label={$_('custom_translation_delete')}
                                    onclick={() =>
                                      deleteCustomTranslation(entry, meaning.partOfSpeech, def)}
                                  >
                                    ×
                                  </button>
                                </span>
                              {/each}
                            {/if}
                          </div>
                        </div>
                      {/if}
                    </li>
                  {/each}
                </ul>
              </SharedComponent>
            {/each}
          {/each}

          {#if searchResult.entries.length}
            <section
              class="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left"
            >
              <p class="mt-2 text-sm text-slate-700">
                {#if searchResult.sourceUrl}
                  <a
                    href={searchResult.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    class="text-sm font-medium text-blue-700 underline decoration-blue-200 underline-offset-4"
                  >
                    {$_('attribution_source_link')}
                  </a>
                  <span class="mx-2 text-slate-300">•</span>
                {/if}
                {$_('attribution_provider_prefix')}
                <a
                  href="https://freedictionaryapi.com/"
                  target="_blank"
                  rel="noreferrer"
                  class="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4"
                >
                  FreeDictionaryAPI.com
                </a>
              </p>
            </section>
          {/if}

          {#if import.meta.env.DEV}
            <footer class="mt-8 pt-6 border-t border-gray-100">
              <div
                class="flex items-center justify-center gap-2 text-xs font-medium text-green-600 bg-green-50 py-2 px-4 rounded-full inline-flex"
              >
                <span class="relative flex h-2 w-2">
                  <span
                    class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"
                  ></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span>System Active • {new Date().toLocaleTimeString()}</span>
              </div>
            </footer>
          {/if}
        </div>
      </section>
    </div>
  {/if}
</main>
