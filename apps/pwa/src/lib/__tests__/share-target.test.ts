import { describe, expect, it, vi } from 'vitest';
import { consumeSharedSearchParams, normalizeSharedSearchText } from '../share-target';

describe('PWA share target adapters', () => {
  it('removes a duplicated shared URL suffix without tokenizing text fragments', () => {
    const sharedUrl =
      'https://example.com/abcd-123456#:~:text=Qwerty%20copy%2Dpaste-,query,-from%20zx%20cvbnm';

    expect(normalizeSharedSearchText(`"query" ${sharedUrl}`, sharedUrl)).toBe('query');
    expect(
      normalizeSharedSearchText(
        'big green tree https://example.com/tree',
        'https://example.com/tree'
      )
    ).toBe('big green tree');
    expect(normalizeSharedSearchText('plain text', '')).toBe('plain text');
  });

  it('consumes only share-target params while preserving unrelated URL state', () => {
    const url = new URL(
      'https://w1p.example/app?keep=1&title=Shared&text=shared%20word&url=https://example.com#dictionary'
    );
    const replaceState = vi.fn();

    const sharedText = consumeSharedSearchParams(
      url as unknown as Location,
      {
        replaceState
      } as unknown as History
    );

    expect(sharedText).toBe('shared word');
    expect(replaceState).toHaveBeenCalledWith({}, '', '/app?keep=1#dictionary');
  });

  it('ignores URLs without shared text params', () => {
    const url = new URL('https://w1p.example/app?keep=1');
    const replaceState = vi.fn();

    expect(
      consumeSharedSearchParams(
        url as unknown as Location,
        {
          replaceState
        } as unknown as History
      )
    ).toBe('');
    expect(replaceState).not.toHaveBeenCalled();
  });
});
