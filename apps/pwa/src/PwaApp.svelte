<script lang="ts">
  import { onMount } from 'svelte';
  import { _, isLoading, waitLocale } from 'svelte-i18n';
  import {
    appendDictionaryLog,
    clearDictionaryCache,
    clearSavedSenses,
    configureSyncProviders,
    connectSyncProvider,
    disconnectSyncProvider,
    DICTIONARY_TRANSLATION_LANGUAGES,
    filterDictionarySearchResult,
    getSavedSensesSyncState,
    getSavedSenses,
    initializeSavedSensesSync,
    listSyncProviders,
    LOGGING_ENABLED,
    DictionaryLookupError,
    fetchDefinition,
    getDictionaryLogs,
    clearDictionaryLogs,
    getSearchHistory,
    recordSearchHistory,
    removeSavedSense,
    subscribeToSavedSensesSyncState,
    syncSavedSenses,
    type DictionaryLogType,
    type DictionaryLogEntry,
    type DictionaryLogSource,
    type DictionarySearchResult,
    type SavedSense,
    type SyncProviderId,
    type SyncState,
    type SearchHistoryEntry,
    type SearchHistoryFailureReason
  } from '@workspace/shared';
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import AboutPanel from './components/AboutPanel.svelte';
  import AppDrawer from './components/AppDrawer.svelte';
  import CachePanel from './components/CachePanel.svelte';
  import DevFooter from './components/DevFooter.svelte';
  import FloatingActions from './components/FloatingActions.svelte';
  import LoadingScreen from './components/LoadingScreen.svelte';
  import LogPanel from './components/LogPanel.svelte';
  import SavedPanel from './components/SavedPanel.svelte';
  import SearchChrome from './components/SearchChrome.svelte';
  import SearchResults from './components/SearchResults.svelte';
  import SearchingIndicator from './components/SearchingIndicator.svelte';
  import SyncPanel from './components/SyncPanel.svelte';
  import UpdateBanner from './components/UpdateBanner.svelte';
  import {
    deleteDictionaryCacheEntry,
    filterDictionaryCacheEntries,
    listDictionaryCacheEntries,
    type DictionaryCacheEntry
  } from './lib/cache-entries';
  import { filterSavedSenses, type SavedSenseSortOrder } from './lib/saved-sense-view';
  import {
    getFilteredLogEntries as filterLogEntriesForView,
    getLogSections as buildLogSections,
    getLogTypeBadgeClass,
    logSourceOptions,
    logTypeOptions
  } from './lib/log-view';
  import { downloadJsonFile } from './lib/download-json';
  import {
    getSearchHistoryFailureReason,
    getSearchHistoryStatusClass,
    getSearchHistoryStatusIcon,
    getVisibleSearchHistory as selectVisibleSearchHistory
  } from './lib/search-history-view';
  import {
    readPersistentStorageStatus,
    requestPersistentStoragePermission
  } from './lib/persistent-storage';
  import { checkServiceWorkerUpdate } from './lib/pwa-update';
  import {
    clearStoredSearchState,
    readStoredSearchState,
    writeStoredSearchState,
    type StoredSearchState
  } from './lib/search-state';
  import {
    getSelectionActionPosition as resolveSelectionActionPosition,
    normalizePageSelection
  } from './lib/selection-view';
  import { consumeSharedSearchParams } from './lib/share-target';
  import './app.css';

  type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };

  /**
   * Build metadata is injected by Vite for every environment so the side menu
   * can always expose the exact bundle identity and build timestamp.
   * Test runners may not apply the same env injection pipeline, so the UI keeps
   * a local fallback that matches the Vite config defaults.
   */
  const buildVersion = (import.meta.env.VITE_APP_VERSION || '0.0.0').trim();
  const buildSha = (import.meta.env.VITE_APP_SHA || 'unknown-dev').trim();
  const buildTime = (import.meta.env.VITE_BUILD_TIME || new Date().toISOString()).trim();
  const pwaWebsiteUrl = new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString();
  const googleDriveClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  configureSyncProviders({ googleDriveClientId });

  let installPrompt = $state<BeforeInstallPromptEvent | null>(null);
  let isDrawerOpen = $state(false);
  let isLogOpen = $state(false);
  let isCacheOpen = $state(false);
  let isSavedOpen = $state(false);
  let isSyncOpen = $state(false);
  let isAboutOpen = $state(false);

  let searchTerm = $state('');
  let includeTranslations = $state(false);
  let translationLanguageCode = $state('all');
  let logSearchTerm = $state('');
  let cacheSearchTerm = $state('');
  let savedSearchTerm = $state('');
  let savedSortOrder = $state<SavedSenseSortOrder>('recent');
  let logTypeFilter = $state<'all' | DictionaryLogType>('all');
  let logSourceFilter = $state<'all' | DictionaryLogSource>('all');
  let rawSearchResult = $state<DictionarySearchResult>({ entries: [], source: 'network' });
  let searchResult = $state<DictionarySearchResult>({ entries: [], source: 'network' });
  let logEntries = $state<DictionaryLogEntry[]>([]);
  let savedSenses = $state<SavedSense[]>([]);
  let savedSenseIds = $state<string[]>([]);
  let cacheEntries = $state<DictionaryCacheEntry[]>([]);
  let searchHistory = $state<SearchHistoryEntry[]>([]);
  let isSearchHistoryOpen = $state(false);
  let lastWindowScrollY = 0;
  let isSearchChromeHidden = $state(false);
  let isScrollTopButtonVisible = $state(false);
  let isSearching = $state(false);
  let dictionaryError = $state('');
  let isPersistentStorageSupported = $state(false);
  let isPersistentStorageEnabled = $state(false);
  let isRequestingPersistentStorage = $state(false);
  let isUpdateBannerDismissed = $state(false);
  let isCheckingForUpdates = $state(false);
  let updateCheckMessageKey = $state('');
  let selectedPageText = $state('');
  let selectionActionPosition = $state({ top: 0, left: 0 });
  let selectedSyncProvider = $state<SyncProviderId>('google-drive');
  let syncState = $state<SyncState>(getSavedSensesSyncState());
  const syncProviders = listSyncProviders().filter((provider) => provider.implemented);

  function persistSearchState(): void {
    writeStoredSearchState({
      searchTerm,
      includeTranslations,
      translationLanguageCode,
      rawSearchResult,
      searchResult
    } satisfies StoredSearchState);
  }

  function clearPersistedSearchState(): void {
    clearStoredSearchState();
  }

  function restoreSearchState(): void {
    const storedState = readStoredSearchState();
    if (!storedState) {
      return;
    }

    searchTerm = storedState.searchTerm;
    includeTranslations = storedState.includeTranslations;
    translationLanguageCode = storedState.translationLanguageCode;
    rawSearchResult = storedState.rawSearchResult;
    searchResult = storedState.searchResult;
  }

  function refreshSearchHistory(): void {
    searchHistory = getSearchHistory();
  }

  function getVisibleSearchHistory(): SearchHistoryEntry[] {
    return selectVisibleSearchHistory(searchHistory, searchTerm);
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

  function clearCurrentSearch(): void {
    searchTerm = '';
    dictionaryError = '';
    rawSearchResult = { entries: [], source: 'network' };
    searchResult = { entries: [], source: 'network' };
    isSearchHistoryOpen = false;
    clearPersistedSearchState();
  }

  function getSelectionActionPosition(selection: Selection | null): { top: number; left: number } {
    return resolveSelectionActionPosition(selection, {
      height: window.innerHeight,
      width: window.innerWidth
    });
  }

  function closeSelectionActions(): void {
    selectedPageText = '';
  }

  async function searchSelectedPageText(): Promise<void> {
    const selectedText = selectedPageText.trim();
    if (!selectedText) {
      return;
    }

    searchTerm = selectedText;
    closeSelectionActions();
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
    const result = await readPersistentStorageStatus();
    isPersistentStorageSupported = result.supported;
    isPersistentStorageEnabled = result.enabled;

    if (result.log) {
      appendDictionaryLog(result.log);
      refreshLogs();
    }
  }

  async function requestPersistentStorage(): Promise<void> {
    isRequestingPersistentStorage = true;
    try {
      const result = await requestPersistentStoragePermission();
      isPersistentStorageSupported = result.supported;
      isPersistentStorageEnabled = result.enabled;

      if (result.log) {
        appendDictionaryLog(result.log);
        refreshLogs();
      }
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

  function closePanels(): void {
    isLogOpen = false;
    isCacheOpen = false;
    isSavedOpen = false;
    isSyncOpen = false;
    isAboutOpen = false;
  }

  /**
   * The drawer owns wheel/touch scrolling while it is open. Locking the page
   * prevents scroll chaining from moving the dictionary results behind it.
   */
  $effect(() => {
    if (typeof document === 'undefined' || !isDrawerOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  });

  function openLog(): void {
    closePanels();
    isLogOpen = true;
    isDrawerOpen = false;
    refreshLogs();
  }

  function closeLog(): void {
    isLogOpen = false;
  }

  function openCache(): void {
    closePanels();
    isCacheOpen = true;
    isDrawerOpen = false;
    void refreshCacheEntries();
  }

  function closeCache(): void {
    isCacheOpen = false;
  }

  function openSaved(): void {
    closePanels();
    isSavedOpen = true;
    isDrawerOpen = false;
    refreshSavedSenses();
  }

  function closeSaved(): void {
    isSavedOpen = false;
  }

  function openSync(): void {
    closePanels();
    isSyncOpen = true;
    isDrawerOpen = false;
  }

  function closeSync(): void {
    isSyncOpen = false;
  }

  function openAbout(): void {
    closePanels();
    isAboutOpen = true;
    isDrawerOpen = false;
  }

  function closeAbout(): void {
    isAboutOpen = false;
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

  function getSelectedSyncProviderDefinition() {
    return syncProviders.find((provider) => provider.id === selectedSyncProvider);
  }

  function getSyncStatusMessageKey(): string {
    return `sync_status_${syncState.status.replaceAll('-', '_')}`;
  }

  function isSelectedSyncProviderAvailable(): boolean {
    const provider = getSelectedSyncProviderDefinition();
    return Boolean(
      provider?.implemented && selectedSyncProvider === 'google-drive' && googleDriveClientId
    );
  }

  function handleSyncProviderChange(event: Event): void {
    selectedSyncProvider = (event.currentTarget as HTMLSelectElement).value as SyncProviderId;
  }

  async function connectSelectedSyncProvider(): Promise<void> {
    await connectSyncProvider(selectedSyncProvider);
    refreshSavedSenses();
  }

  function disconnectSelectedSyncProvider(): void {
    disconnectSyncProvider(selectedSyncProvider);
  }

  async function syncSelectedProvider(): Promise<void> {
    await syncSavedSenses(selectedSyncProvider);
    refreshSavedSenses();
  }

  function getFilteredSavedSenses(): SavedSense[] {
    return filterSavedSenses(savedSenses, savedSearchTerm, savedSortOrder);
  }

  function handleSavedSortChange(event: Event): void {
    savedSortOrder = (event.currentTarget as HTMLSelectElement).value as SavedSenseSortOrder;
  }

  function clearLogHistory(): void {
    if (!confirm($_('log_clear_confirm'))) {
      return;
    }

    clearDictionaryLogs();
    refreshLogs();
  }

  async function refreshCacheEntries(): Promise<void> {
    cacheEntries = await listDictionaryCacheEntries();
  }

  async function clearCacheHistory(): Promise<void> {
    if (!confirm($_('cache_clear_confirm'))) {
      return;
    }

    await clearDictionaryCache();
    await refreshCacheEntries();
  }

  function getFilteredCacheEntries(): DictionaryCacheEntry[] {
    return filterDictionaryCacheEntries(cacheEntries, cacheSearchTerm);
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

    await deleteDictionaryCacheEntry(url);
    await refreshCacheEntries();
  }

  /**
   * The UI consumes a pre-sectioned log model from shared utilities so the
   * component only handles labels and rendering concerns.
   */
  function getFilteredLogEntries(): DictionaryLogEntry[] {
    return filterLogEntriesForView(logEntries, {
      type: logTypeFilter,
      source: logSourceFilter,
      searchTerm: logSearchTerm
    });
  }

  function getLogSections(): Array<{
    id: 'dictionary' | 'storage';
    title: string;
    groups: Array<{ date: string; entries: DictionaryLogEntry[] }>;
  }> {
    return buildLogSections(logEntries, {
      type: logTypeFilter,
      source: logSourceFilter,
      searchTerm: logSearchTerm,
      dictionaryTitle: $_('log_section_dictionary'),
      storageTitle: $_('log_section_storage')
    });
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

  /** Outside clicks dismiss the search-history popover without changing input state. */
  function handleDocumentPointerDown(event: PointerEvent): void {
    if (!isSearchHistoryOpen) {
      return;
    }

    const target = event.target;
    if (target instanceof Element) {
      if (isSearchHistoryOpen && !target.closest('[data-search-history]')) {
        isSearchHistoryOpen = false;
      }
    }
  }

  function exportLogs(): void {
    if (!LOGGING_ENABLED) {
      return;
    }

    downloadJsonFile(`dictionary-log-history-${new Date().toISOString()}.json`, logEntries);
  }

  function exportSavedSenses(): void {
    downloadJsonFile(`saved-senses-${new Date().toISOString()}.json`, savedSenses);
  }

  /**
   * The search chrome hides while reading downward and returns on any upward
   * window scroll. Its ancestors must not use overflow clipping, because that
   * changes sticky positioning semantics in mobile browsers.
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

  function updatePwa(): void {
    void updateServiceWorker(true);
  }

  function dismissUpdateBanner(): void {
    isUpdateBannerDismissed = true;
  }

  /**
   * Manual update checks ask the active service worker registration to revalidate
   * its script. The PWA plugin flips `needRefresh` when a waiting worker appears,
   * so this function only owns the user-triggered status message.
   */
  async function checkForUpdates(): Promise<void> {
    isCheckingForUpdates = true;
    updateCheckMessageKey = 'update_checking';

    try {
      updateCheckMessageKey = await checkServiceWorkerUpdate();
    } finally {
      isCheckingForUpdates = false;
    }
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
      await initializeSavedSensesSync();
      refreshSavedSenses();
      await refreshCacheEntries();
      await refreshPersistentStorageStatus();

      const sharedText = consumeSharedSearchParams(window.location, window.history);
      if (sharedText) {
        searchTerm = sharedText;
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

    const handleSelectionChange = (): void => {
      const selection = window.getSelection();
      const selectionText = normalizePageSelection(selection);
      selectedPageText = selectionText;
      if (selectionText) {
        selectionActionPosition = getSelectionActionPosition(selection);
      }
    };
    const unsubscribeSyncState = subscribeToSavedSensesSyncState((nextState) => {
      syncState = nextState;
    });

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('pointerdown', handleDocumentPointerDown, true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('scroll', handleWindowScroll);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      unsubscribeSyncState();
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

<main class="min-h-dvh w-full bg-slate-100 font-sans">
  {#if $isLoading}
    <LoadingScreen />
  {:else}
    <FloatingActions
      {isDrawerOpen}
      {isScrollTopButtonVisible}
      {selectedPageText}
      {selectionActionPosition}
      onCloseDrawer={closeDrawer}
      onScrollTop={scrollToPageTop}
      onSearchSelection={searchSelectedPageText}
    />

    {#if isLogOpen}
      <LogPanel
        bind:logSearchTerm
        {getLogTypeBadgeClass}
        {logSourceFilter}
        {logSourceOptions}
        {logTypeFilter}
        {logTypeOptions}
        matchingEntries={getFilteredLogEntries()}
        onClear={clearLogHistory}
        onClose={closeLog}
        onExport={exportLogs}
        onSourceFilterChange={handleLogSourceFilterChange}
        onTypeFilterChange={handleLogTypeFilterChange}
        sections={getLogSections()}
      />
    {/if}

    {#if isCacheOpen}
      <CachePanel
        bind:cacheSearchTerm
        entries={getFilteredCacheEntries()}
        onClear={clearCacheHistory}
        onClose={closeCache}
        onDeleteEntry={deleteCacheEntry}
        onOpenEntry={openCachedEntry}
      />
    {/if}

    {#if isSavedOpen}
      <SavedPanel
        bind:savedSearchTerm
        entries={getFilteredSavedSenses()}
        onClear={clearSavedLibrary}
        onClose={closeSaved}
        onExport={exportSavedSenses}
        onOpenSense={openSavedSense}
        onRemoveSense={deleteSavedSense}
        onSortChange={handleSavedSortChange}
        savedSensesCount={savedSenses.length}
        {savedSortOrder}
      />
    {/if}

    {#if isSyncOpen}
      <SyncPanel
        {googleDriveClientId}
        isProviderAvailable={isSelectedSyncProviderAvailable()}
        onClose={closeSync}
        onConnect={connectSelectedSyncProvider}
        onDisconnect={disconnectSelectedSyncProvider}
        onProviderChange={handleSyncProviderChange}
        onSync={syncSelectedProvider}
        {selectedSyncProvider}
        {syncProviders}
        {syncState}
        syncStatusMessageKey={getSyncStatusMessageKey()}
      />
    {/if}

    {#if isAboutOpen}
      <AboutPanel
        {buildSha}
        {buildTime}
        {buildVersion}
        {isCheckingForUpdates}
        {isPersistentStorageEnabled}
        {isPersistentStorageSupported}
        {isRequestingPersistentStorage}
        {pwaWebsiteUrl}
        {updateCheckMessageKey}
        onCheckForUpdates={checkForUpdates}
        onClose={closeAbout}
        onRequestPersistentStorage={requestPersistentStorage}
      />
    {/if}

    <div class="flex min-h-dvh w-full min-w-0">
      <AppDrawer
        installPromptAvailable={Boolean(installPrompt)}
        {isDrawerOpen}
        onAboutOpen={openAbout}
        onCacheOpen={openCache}
        onClose={closeDrawer}
        onInstall={handleInstall}
        onLogOpen={openLog}
        onSavedOpen={openSaved}
        onSyncOpen={openSync}
      />

      <section
        class="flex min-h-dvh min-w-0 flex-1 items-start justify-center px-3 py-3 sm:p-4 lg:p-8"
      >
        <div class="w-full min-w-0 max-w-4xl">
          <SearchChrome
            bind:includeTranslations
            bind:searchTerm
            {dictionaryError}
            {getSearchHistoryStatusClass}
            {getSearchHistoryStatusIcon}
            {isSearchChromeHidden}
            {isSearchHistoryOpen}
            {isSearching}
            languageOptions={DICTIONARY_TRANSLATION_LANGUAGES}
            onClear={clearCurrentSearch}
            onHistoryEntryOpen={openSearchHistoryEntry}
            onHistoryOpenChange={(isOpen) => (isSearchHistoryOpen = isOpen)}
            onKeydown={handleKeydown}
            onMenuOpen={openDrawer}
            onSearch={() => {
              isSearchHistoryOpen = false;
              void performSearch();
            }}
            onTranslationLanguageChange={handleTranslationLanguageChange}
            searchDisabled={!searchTerm && !searchResult.entries.length && !dictionaryError}
            {translationLanguageCode}
            visibleSearchHistory={getVisibleSearchHistory()}
          />

          {#if $needRefresh && !isUpdateBannerDismissed}
            <UpdateBanner onDismiss={dismissUpdateBanner} onUpdate={updatePwa} />
          {/if}

          <SearchingIndicator active={isSearching} />

          <SearchResults
            {getSearchResultActionButtonClass}
            {getSearchResultSaveButtonIcon}
            {getTranslationText}
            onSavedSensesChanged={refreshSavedSenses}
            {searchResult}
            {savedSenseIds}
            {savedSenses}
            {translationLanguageCode}
          />

          <DevFooter />
        </div>
      </section>
    </div>
  {/if}
</main>
