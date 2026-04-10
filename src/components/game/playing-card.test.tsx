// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlayingCard } from './playing-card';

afterEach(() => cleanup());

describe('PlayingCard', () => {
  it('renders accessible article with rank and suit label', () => {
    render(<PlayingCard card={{ rank: 'A', suit: 'spades' }} />);
    expect(screen.getByRole('article', { name: 'A of spades' })).toBeDefined();
  });

  it('renders rank 10 as "10"', () => {
    render(<PlayingCard card={{ rank: '10', suit: 'hearts' }} />);
    expect(screen.getByRole('article', { name: '10 of hearts' })).toBeDefined();
  });

  it('shows the spades suit symbol', () => {
    render(<PlayingCard card={{ rank: 'K', suit: 'spades' }} />);
    expect(screen.getAllByText('♠').length).toBeGreaterThan(0);
  });

  it('shows the hearts suit symbol', () => {
    render(<PlayingCard card={{ rank: 'Q', suit: 'hearts' }} />);
    expect(screen.getAllByText('♥').length).toBeGreaterThan(0);
  });

  it('shows the diamonds suit symbol', () => {
    render(<PlayingCard card={{ rank: 'J', suit: 'diamonds' }} />);
    expect(screen.getAllByText('♦').length).toBeGreaterThan(0);
  });

  it('shows the clubs suit symbol', () => {
    render(<PlayingCard card={{ rank: '2', suit: 'clubs' }} />);
    expect(screen.getAllByText('♣').length).toBeGreaterThan(0);
  });

  it('renders with sm size class applied', () => {
    const { container } = render(<PlayingCard card={{ rank: '5', suit: 'spades' }} size="sm" />);
    const article = container.querySelector('article');
    expect(article?.className).toContain('w-10');
  });

  it('renders with lg size class applied', () => {
    const { container } = render(<PlayingCard card={{ rank: '5', suit: 'spades' }} size="lg" />);
    const article = container?.querySelector('article');
    expect(article?.className).toContain('w-20');
  });

  it('renders rank text in the card body', () => {
    render(<PlayingCard card={{ rank: '7', suit: 'clubs' }} />);
    // rank appears multiple times (top-left + bottom-right)
    const rankEls = screen.getAllByText('7');
    expect(rankEls.length).toBeGreaterThanOrEqual(1);
  });
});
