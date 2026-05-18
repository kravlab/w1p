import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.svelte';

describe('Extension App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders captured text from chrome.storage', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn((_: string[], callback: (value: { sharedText: string }) => void) =>
            callback({ sharedText: 'Selected text' })
          )
        }
      }
    });

    render(App);

    expect(await screen.findByText('"Selected text"')).toBeInTheDocument();
  });

  it('renders the empty hint when no text is stored', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn((_: string[], callback: (value: { sharedText: string }) => void) =>
            callback({ sharedText: '' })
          )
        }
      }
    });

    render(App);

    expect(await screen.findByText(/Right-click text on any page/i)).toBeInTheDocument();
  });
});
