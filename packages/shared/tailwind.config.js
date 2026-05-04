/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "../../apps/*/index.html",
    "../../apps/*/src/**/*.{html,js,svelte,ts}",
    "./src/**/*.{html,js,svelte,ts}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
