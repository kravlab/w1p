import { describe, expect, it, vi } from 'vitest';
import { getSelectionActionPosition, normalizePageSelection } from '../selection-view';

describe('selection view helpers', () => {
  it('normalizes selected page text', () => {
    expect(normalizePageSelection({ toString: () => '  selected\n\ntext  ' } as Selection)).toBe(
      'selected text'
    );
    expect(normalizePageSelection(null)).toBe('');
  });

  it('positions selection actions near the selected range or viewport fallback', () => {
    const viewport = { height: 800, width: 400 };
    const selection = {
      rangeCount: 1,
      getRangeAt: vi.fn(() => ({
        getBoundingClientRect: () => ({
          bottom: 100,
          height: 20,
          left: 120,
          width: 80
        })
      }))
    } as unknown as Selection;
    const collapsedSelection = {
      rangeCount: 1,
      getRangeAt: vi.fn(() => ({
        getBoundingClientRect: () => ({
          bottom: 0,
          height: 0,
          left: 0,
          width: 0
        })
      }))
    } as unknown as Selection;

    expect(getSelectionActionPosition(selection, viewport)).toEqual({ top: 110, left: 160 });
    expect(getSelectionActionPosition(collapsedSelection, viewport)).toEqual({
      top: 712,
      left: 200
    });
    expect(getSelectionActionPosition(null, viewport)).toEqual({ top: 712, left: 200 });
  });
});
