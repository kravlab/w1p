<script lang="ts">
  let { title = '', subtitle = '', children } = $props();
</script>

<section
  class="border-l-4 border-blue-500 pl-4 py-3 my-6 bg-blue-50 text-left rounded-r-lg transition-all hover:bg-blue-100/50"
>
  <h3
    class="mb-1 flex items-baseline gap-3 font-bold text-blue-900 text-sm uppercase tracking-wide"
  >
    <span>{title}</span>
    {#if subtitle}
      <span class="text-xs font-medium normal-case tracking-normal text-gray-400">{subtitle}</span>
    {/if}
  </h3>
  <div class="text-blue-700 text-sm leading-relaxed">
    {@render children?.()}
  </div>
</section>
