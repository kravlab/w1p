import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { createRawSnippet } from 'svelte';
import SharedComponent from '../SharedComponent.svelte';

/**
 * Tests for the SharedComponent presentation component.
 * Verifies rendering of the title and children snippets.
 */
describe('SharedComponent', () => {
  /**
   * Test case for rendering the title.
   */
  it('renders the title', () => {
    render(SharedComponent, { title: 'Test Title' });
    const heading = screen.getByRole('heading', { level: 3 });
    // Text is transformed to uppercase in CSS/HTML via classes
    expect(heading.textContent?.trim()).toBe('Test Title');
  });

  it('renders a compact subtitle next to the title', () => {
    render(SharedComponent, { title: 'Noun', subtitle: '/test/' });

    expect(screen.getByRole('heading', { level: 3 }).textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Noun /test/'
    );
    expect(screen.getByText('/test/')).toHaveClass('text-xs', 'text-gray-400');
  });

  /**
   * Test case for rendering children snippet.
   */
  it('renders children snippet', () => {
    const children = createRawSnippet(() => ({
      render: () => '<span>Test Content</span>'
    }));

    render(SharedComponent, {
      title: 'Test',
      children
    });
    expect(screen.getByText('Test Content')).toBeTruthy();
  });
});
