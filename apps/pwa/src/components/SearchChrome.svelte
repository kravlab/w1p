<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { SearchHistoryEntry, TranslationLanguageOption } from '@workspace/shared';

  interface Props {
    dictionaryError: string;
    getSearchHistoryStatusClass: (entry: SearchHistoryEntry) => string;
    getSearchHistoryStatusIcon: (entry: SearchHistoryEntry) => string;
    includeTranslations: boolean;
    isSearchChromeHidden: boolean;
    isSearchHistoryOpen: boolean;
    isSearching: boolean;
    languageOptions: TranslationLanguageOption[];
    onClear: () => void;
    onHistoryEntryOpen: (entry: SearchHistoryEntry) => void | Promise<void>;
    onHistoryOpenChange: (isOpen: boolean) => void;
    onKeydown: (event: KeyboardEvent) => void;
    onMenuOpen: () => void;
    onSearch: () => void | Promise<void>;
    onTranslationLanguageChange: (event: Event) => void;
    searchDisabled: boolean;
    searchTerm: string;
    translationLanguageCode: string;
    visibleSearchHistory: SearchHistoryEntry[];
  }

  let {
    dictionaryError,
    getSearchHistoryStatusClass,
    getSearchHistoryStatusIcon,
    includeTranslations = $bindable(),
    isSearchChromeHidden,
    isSearchHistoryOpen,
    isSearching,
    languageOptions,
    onClear,
    onHistoryEntryOpen,
    onHistoryOpenChange,
    onKeydown,
    onMenuOpen,
    onSearch,
    onTranslationLanguageChange,
    searchDisabled,
    searchTerm = $bindable(),
    translationLanguageCode,
    visibleSearchHistory
  }: Props = $props();
</script>

<div
  class={`sticky top-3 z-20 mb-5 rounded-2xl border border-white/70 bg-slate-100/95 p-3 shadow-lg backdrop-blur transition-all duration-200 ease-out ${isSearchChromeHidden ? 'pointer-events-none -translate-y-[calc(100%+1rem)] opacity-0' : 'translate-y-0 opacity-100'}`}
  data-testid="search-chrome"
>
  <section class="text-center" id="dictionary">
    <div class="flex min-w-0 gap-2">
      <button
        type="button"
        class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
        aria-label={$_('open_menu')}
        onclick={onMenuOpen}
      >
        <span class="text-xl leading-none">☰</span>
      </button>
      <div class="relative min-w-0 flex-1" data-search-history>
        <input
          type="text"
          bind:value={searchTerm}
          onfocus={() => onHistoryOpenChange(true)}
          oninput={() => onHistoryOpenChange(true)}
          onkeydown={onKeydown}
          placeholder={$_('search_placeholder')}
          class="h-11 w-full rounded-xl border-2 border-gray-200 bg-white px-3 outline-none transition-all focus:border-blue-500"
        />
        {#if isSearchHistoryOpen && visibleSearchHistory.length}
          <div
            class="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-xl"
          >
            {#each visibleSearchHistory as entry (entry.id)}
              <button
                type="button"
                class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                onclick={() => onHistoryEntryOpen(entry)}
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
        type="button"
        class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-black leading-none text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={$_('clear_search')}
        disabled={searchDisabled}
        onclick={onClear}
      >
        ×
      </button>
      <button
        onclick={() => onSearch()}
        disabled={isSearching}
        class="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 px-4 font-bold text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50 sm:px-6"
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
        onchange={onTranslationLanguageChange}
        class="max-w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        {#each languageOptions as language (language.code)}
          <option value={language.code}>{language.label}</option>
        {/each}
      </select>
    </div>
    {#if dictionaryError}
      <p class="mt-2 text-sm font-medium text-red-500">{dictionaryError}</p>
    {/if}
  </section>
</div>
