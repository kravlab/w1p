<script lang="ts">
  import { _ } from 'svelte-i18n';

  interface Props {
    isDrawerOpen: boolean;
    isScrollTopButtonVisible: boolean;
    onCloseDrawer: () => void;
    onScrollTop: () => void;
    onSearchSelection: () => void | Promise<void>;
    selectedPageText: string;
    selectionActionPosition: { top: number; left: number };
  }

  let {
    isDrawerOpen,
    isScrollTopButtonVisible,
    onCloseDrawer,
    onScrollTop,
    onSearchSelection,
    selectedPageText,
    selectionActionPosition
  }: Props = $props();
</script>

{#if isDrawerOpen}
  <button
    type="button"
    class="fixed inset-0 z-30 bg-slate-950/45"
    aria-label={$_('close_menu')}
    onclick={onCloseDrawer}
  ></button>
{/if}

{#if isScrollTopButtonVisible}
  <button
    type="button"
    class="fixed bottom-5 right-5 z-20 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white shadow-xl ring-1 ring-white/50 transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
    aria-label={$_('scroll_to_top')}
    onclick={onScrollTop}
  >
    ↑
  </button>
{/if}

{#if selectedPageText}
  <button
    type="button"
    class="fixed z-30 -translate-x-1/2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-2xl ring-1 ring-white/40 transition active:scale-95"
    style={`top: ${selectionActionPosition.top}px; left: ${selectionActionPosition.left}px;`}
    aria-label={$_('selection_search_button')}
    onclick={() => onSearchSelection()}
  >
    Search
  </button>
{/if}
