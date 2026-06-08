<script lang="ts">
  import { _ } from 'svelte-i18n';
  import {
    removeSavedSense,
    saveSense,
    SharedComponent,
    type Definition,
    type DictionaryEntry,
    type DictionarySearchResult,
    type SavedSense
  } from '@workspace/shared';
  import {
    buildCustomSavedSenseInput,
    buildSavedSenseInput,
    canSaveCustomTranslation,
    getCustomSavedSenseId,
    getSavedCustomTranslation,
    getSavedSenseId,
    isDefinitionSaved
  } from '../lib/saved-sense-view';

  interface Props {
    getSearchResultActionButtonClass: (isSaved: boolean) => string;
    getSearchResultSaveButtonIcon: (isSaved: boolean) => string;
    getTranslationText: (languageName: string, word: string) => string;
    onSavedSensesChanged: () => void;
    searchResult: DictionarySearchResult;
    savedSenseIds: string[];
    savedSenses: SavedSense[];
    translationLanguageCode: string;
  }

  let {
    getSearchResultActionButtonClass,
    getSearchResultSaveButtonIcon,
    getTranslationText,
    onSavedSensesChanged,
    searchResult,
    savedSenseIds,
    savedSenses,
    translationLanguageCode
  }: Props = $props();

  let openSaveMenuKey = $state('');
  let customTranslationFormKey = $state('');
  let customTranslationValue = $state('');

  function getResultSavedSenseId(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): string {
    return getSavedSenseId(entry, partOfSpeech, definition, translationLanguageCode);
  }

  function getResultCustomSavedSenseId(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): string {
    return getCustomSavedSenseId(entry, partOfSpeech, definition, translationLanguageCode);
  }

  function getResultSavedCustomTranslation(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): SavedSense['translation'] | undefined {
    return getSavedCustomTranslation(
      savedSenses,
      entry,
      partOfSpeech,
      definition,
      translationLanguageCode
    );
  }

  function isResultDefinitionSaved(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): boolean {
    return isDefinitionSaved(
      savedSenseIds,
      entry,
      partOfSpeech,
      definition,
      translationLanguageCode
    );
  }

  function saveDefinition(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): void {
    saveSense(
      buildSavedSenseInput(
        entry,
        partOfSpeech,
        definition,
        translationLanguageCode,
        searchResult.sourceUrl
      )
    );
    onSavedSensesChanged();
  }

  function openCustomTranslationForm(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): void {
    customTranslationFormKey = getResultCustomSavedSenseId(entry, partOfSpeech, definition);
    customTranslationValue =
      getResultSavedCustomTranslation(entry, partOfSpeech, definition)?.words[0] ?? '';
    openSaveMenuKey = '';
  }

  function closeCustomTranslationForm(): void {
    customTranslationFormKey = '';
    customTranslationValue = '';
  }

  function saveDefinitionWithCustomTranslation(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): void {
    const savedSenseInput = buildCustomSavedSenseInput(
      entry,
      partOfSpeech,
      definition,
      translationLanguageCode,
      customTranslationValue,
      searchResult.sourceUrl
    );
    if (!savedSenseInput) {
      return;
    }

    saveSense(savedSenseInput);
    closeCustomTranslationForm();
    onSavedSensesChanged();
  }

  function deleteCustomTranslation(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): void {
    if (!confirm($_('saved_remove_confirm'))) {
      return;
    }

    removeSavedSense(getResultCustomSavedSenseId(entry, partOfSpeech, definition));
    closeCustomTranslationForm();
    onSavedSensesChanged();
  }

  function toggleDefinitionSaved(
    entry: DictionaryEntry,
    partOfSpeech: string,
    definition: Definition
  ): void {
    const savedSenseId = getResultSavedSenseId(entry, partOfSpeech, definition);

    if (savedSenseIds.includes(savedSenseId)) {
      removeSavedSense(savedSenseId);
      onSavedSensesChanged();
      return;
    }

    saveDefinition(entry, partOfSpeech, definition);
  }

  function toggleSaveMenu(key: string): void {
    openSaveMenuKey = openSaveMenuKey === key ? '' : key;
  }

  /**
   * Save option menus are local to result rows, so outside-click dismissal is
   * owned here alongside the menu state instead of by the page container.
   */
  $effect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (openSaveMenuKey && target instanceof Element && !target.closest('[data-save-menu]')) {
        openSaveMenuKey = '';
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  });
</script>

{#each searchResult.entries as entry, index (`${entry.word}-${entry.phonetic || 'no-phonetic'}-${index}`)}
  <!-- The upstream API can return multiple entries with identical word and phonetic. -->
  {@const shouldShowEntryWord = index === 0 || searchResult.entries[index - 1].word !== entry.word}
  {#if shouldShowEntryWord}
    <div class="text-left mt-8 mb-4">
      <h2 class="flex min-w-0 items-baseline gap-2 break-words text-2xl font-black text-gray-900">
        {entry.word}
      </h2>
    </div>
  {/if}
  {#each entry.meanings as meaning (meaning.partOfSpeech)}
    <SharedComponent title={meaning.partOfSpeech} subtitle={entry.phonetic}>
      <ul class="list-disc list-outside ml-4 space-y-3">
        {#each meaning.definitions as def (def.definition)}
          {@const customSaveKey = getResultCustomSavedSenseId(entry, meaning.partOfSpeech, def)}
          {@const savedCustomTranslation = getResultSavedCustomTranslation(
            entry,
            meaning.partOfSpeech,
            def
          )}
          <li class="text-gray-700">
            <div class="mb-2 flex flex-wrap items-start gap-2">
              <button
                type="button"
                class={getSearchResultActionButtonClass(
                  isResultDefinitionSaved(entry, meaning.partOfSpeech, def)
                )}
                aria-label={isResultDefinitionSaved(entry, meaning.partOfSpeech, def)
                  ? $_('remove_sense')
                  : $_('save_sense')}
                onclick={() => toggleDefinitionSaved(entry, meaning.partOfSpeech, def)}
              >
                <span class="text-base leading-none font-black">
                  {getSearchResultSaveButtonIcon(
                    isResultDefinitionSaved(entry, meaning.partOfSpeech, def)
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
                    {#if canSaveCustomTranslation(translationLanguageCode)}
                      <button
                        type="button"
                        class="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        onclick={() => openCustomTranslationForm(entry, meaning.partOfSpeech, def)}
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
              <p class="text-xs italic text-gray-500 mt-1.5 border-l-2 border-gray-100 pl-3">
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
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                      {getTranslationText(translation.languageName, translation.word)}
                    </span>
                  {/each}
                  {#if savedCustomTranslation}
                    {#each savedCustomTranslation.words as word (`${customSaveKey}-${word}`)}
                      <span
                        class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800"
                      >
                        <span>
                          {getTranslationText(savedCustomTranslation.languageName ?? '', word)}
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
                          onclick={() => deleteCustomTranslation(entry, meaning.partOfSpeech, def)}
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
  <section class="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left">
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
