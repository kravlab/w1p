<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type {
    DictionaryLogEntry,
    DictionaryLogSource,
    DictionaryLogType
  } from '@workspace/shared';
  import type { DictionaryLogSectionView } from '../lib/log-view';

  interface Props {
    getLogTypeBadgeClass: (type: DictionaryLogType) => string;
    logSearchTerm: string;
    logSourceFilter: 'all' | DictionaryLogSource;
    logSourceOptions: Array<'all' | DictionaryLogSource>;
    logTypeFilter: 'all' | DictionaryLogType;
    logTypeOptions: Array<'all' | DictionaryLogType>;
    matchingEntries: DictionaryLogEntry[];
    onClear: () => void;
    onClose: () => void;
    onExport: () => void;
    onSourceFilterChange: (event: Event) => void;
    onTypeFilterChange: (event: Event) => void;
    sections: DictionaryLogSectionView[];
  }

  let {
    getLogTypeBadgeClass,
    logSearchTerm = $bindable(),
    logSourceFilter,
    logSourceOptions,
    logTypeFilter,
    logTypeOptions,
    matchingEntries,
    onClear,
    onClose,
    onExport,
    onSourceFilterChange,
    onTypeFilterChange,
    sections
  }: Props = $props();
</script>

<button
  type="button"
  class="fixed inset-0 z-40 bg-slate-950/45"
  aria-label={$_('log_close')}
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
        {$_('menu_log')}
      </p>
      <h2 class="mt-1 text-xl font-black text-slate-900">{$_('log_title')}</h2>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        onclick={onExport}
      >
        {$_('log_export')}
      </button>
      <button
        type="button"
        class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        onclick={onClear}
      >
        {$_('log_clear')}
      </button>
      <button
        type="button"
        class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        onclick={onClose}
      >
        {$_('log_close')}
      </button>
    </div>
  </header>

  <div class="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
    <div class="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
      <input
        type="text"
        bind:value={logSearchTerm}
        placeholder={$_('log_search_placeholder')}
        class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
      />
      <select
        value={logTypeFilter}
        onchange={onTypeFilterChange}
        class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
        aria-label={$_('log_type_filter')}
      >
        {#each logTypeOptions as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </select>
      <select
        value={logSourceFilter}
        onchange={onSourceFilterChange}
        class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
        aria-label={$_('log_source')}
      >
        {#each logSourceOptions as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </select>
    </div>

    {#if !matchingEntries.length}
      <div
        class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500"
      >
        {$_('log_empty')}
      </div>
    {:else}
      <div class="space-y-6">
        {#each sections as section (section.id)}
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
