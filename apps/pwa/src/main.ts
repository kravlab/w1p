import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

/**
 * Mounts the Svelte application to the DOM for the PWA.
 * The target element is expected to have an ID of 'app'.
 */
const app = mount(App, {
  target: document.getElementById('app')!
});

export default app;
