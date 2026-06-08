<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { DictionaryCacheEntry } from '../lib/cache-entries';

  interface Props {
    cacheSearchTerm: string;
    entries: DictionaryCacheEntry[];
    onClear: () => void | Promise<void>;
    onClose: () => void;
    onDeleteEntry: (url: string) => void | Promise<void>;
    onOpenEntry: (word: string) => void | Promise<void>;
  }

  let {
    cacheSearchTerm = $bindable(),
    entries,
    onClear,
    onClose,
    onDeleteEntry,
    onOpenEntry
  }: Props = $props();
</script>

<button
  type="button"
  class="fixed inset-0 z-40 bg-slate-950/45"
  aria-label={$_('cache_close')}
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
        {$_('menu_cache')}
      </p>
      <h2 class="mt-1 text-xl font-black text-slate-900">{$_('cache_title')}</h2>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        onclick={onClear}
      >
        {$_('cache_clear')}
      </button>
      <button
        type="button"
        class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        onclick={onClose}
      >
        {$_('cache_close')}
      </button>
    </div>
  </header>

  <div class="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
    <div class="mb-5">
      <input
        type="text"
        bind:value={cacheSearchTerm}
        placeholder={$_('cache_search_placeholder')}
        class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
      />
    </div>

    {#if !entries.length}
      <div
        class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500"
      >
        {$_('cache_empty')}
      </div>
    {:else}
      <div class="space-y-4">
        {#each entries as entry (entry.url)}
          <article class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm">
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
                onclick={() => onOpenEntry(entry.word)}
              >
                {$_('cache_open_entry')}
              </button>
              <button
                type="button"
                class="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                onclick={() => onDeleteEntry(entry.url)}
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
