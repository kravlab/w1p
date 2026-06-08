export interface ViewportSize {
  height: number;
  width: number;
}

export function normalizePageSelection(selection: Selection | null): string {
  return (selection?.toString() ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Selection actions are anchored near the first selected range, with a viewport
 * fallback for collapsed or unavailable ranges so the button stays reachable.
 */
export function getSelectionActionPosition(
  selection: Selection | null,
  viewport: ViewportSize
): { top: number; left: number } {
  if (!selection?.rangeCount) {
    return { top: viewport.height - 88, left: viewport.width / 2 };
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (!rect.width && !rect.height) {
    return { top: viewport.height - 88, left: viewport.width / 2 };
  }

  return {
    top: Math.min(rect.bottom + 10, viewport.height - 56),
    left: Math.min(Math.max(rect.left + rect.width / 2, 56), viewport.width - 56)
  };
}
