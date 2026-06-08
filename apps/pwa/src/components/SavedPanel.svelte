<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { SavedSense } from '@workspace/shared';
  import type { SavedSenseSortOrder } from '../lib/saved-sense-view';

  interface Props {
    entries: SavedSense[];
    onClear: () => void;
    onClose: () => void;
    onExport: () => void;
    onOpenSense: (word: string) => void | Promise<void>;
    onRemoveSense: (id: string) => void;
    onSortChange: (event: Event) => void;
    savedSearchTerm: string;
    savedSensesCount: number;
    savedSortOrder: SavedSenseSortOrder;
  }

  let {
    entries,
    onClear,
    onClose,
    onExport,
    onOpenSense,
    onRemoveSense,
    onSortChange,
    savedSearchTerm = $bindable(),
    savedSensesCount,
    savedSortOrder
  }: Props = $props();
</script>

<button
  type="button"
  class="fixed inset-0 z-40 bg-slate-950/45"
  aria-label={$_('saved_close')}
  onclick={onClose}
></button>
<section
  class="fixed inset-y-0 right-0 z-50 flex w-full min-w-0 max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
>
  <header
    class="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
  >
    <div class="min-w-0">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
        {$_('menu_saved')}
      </p>
      <h2 class="mt-1 text-xl font-black text-slate-900">{$_('saved_title')}</h2>
    </div>
    <div class="flex flex-wrap items-center gap-2 sm:justify-end">
      <button
        type="button"
        class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!savedSensesCount}
        onclick={onExport}
      >
        {$_('saved_export')}
      </button>
      <button
        type="button"
        class="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!savedSensesCount}
        onclick={onClear}
      >
        {$_('saved_clear')}
      </button>
      <button
        type="button"
        class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        onclick={onClose}
      >
        {$_('saved_close')}
      </button>
    </div>
  </header>

  <div class="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
    <div class="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
      <input
        type="text"
        bind:value={savedSearchTerm}
        placeholder={$_('saved_search_placeholder')}
        class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
      />
      <select
        value={savedSortOrder}
        onchange={onSortChange}
        class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
      >
        <option value="recent">{$_('saved_sort_recent')}</option>
        <option value="oldest">{$_('saved_sort_oldest')}</option>
        <option value="word">{$_('saved_sort_word')}</option>
      </select>
    </div>

    {#if !entries.length}
      <div
        class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500"
      >
        {$_('saved_empty')}
      </div>
    {:else}
      <div class="space-y-4">
        {#each entries as savedSense (savedSense.id)}
          <article class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm">
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
                  onclick={() => onOpenSense(savedSense.word)}
                >
                  {$_('saved_open')}
                </button>
                <button
                  type="button"
                  class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                  onclick={() => onRemoveSense(savedSense.id)}
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
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
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
