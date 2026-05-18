<script lang="ts">
  let { title = '', children } = $props();
</script>

<section
  class="border-l-4 border-blue-500 pl-4 py-3 my-6 bg-blue-50 text-left rounded-r-lg transition-all hover:bg-blue-100/50"
>
  <h3 class="font-bold text-blue-900 text-sm uppercase tracking-wide mb-1">{title}</h3>
  <div class="text-blue-700 text-sm leading-relaxed">
    {@render children?.()}
  </div>
</section>
