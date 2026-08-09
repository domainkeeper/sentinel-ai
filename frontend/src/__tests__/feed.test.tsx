import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import type { Post } from '../lib/types';

const { getFeedMock } = vi.hoisted(() => ({
  getFeedMock: vi.fn(),
}));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...actual, getFeed: getFeedMock };
});

import { FeedList } from '../components/FeedList';
import { PostCard } from '../components/PostCard';
import { PostDetailView } from '../components/PostDetailView';
import { PostDetailPage } from '../views/PostDetailPage';

const posts: Post[] = [
  {
    id: 'p-old',
    createdAt: '2026-01-01T10:00:00.000Z',
    text: 'Older post',
    rationale: 'Rationale for the older post.',
    sources: ['https://old.example/news'],
  },
  {
    id: 'p-new',
    createdAt: '2026-01-02T10:00:00.000Z',
    text: 'Newest post',
    rationale: 'Rationale for the newest post.',
    sources: ['https://new.example/report'],
  },
];

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function wrap(ui: ReactElement) {
  return render(<MemoryRouter initialEntries={['/feed?agentId=abc']}>{ui}</MemoryRouter>);
}

beforeEach(() => {
  getFeedMock.mockReset();
});

describe('FeedList — feed experience', () => {
  it('shows the loading state while the feed is fetching', async () => {
    const d = deferred<{ posts: Post[] }>();
    getFeedMock.mockReturnValueOnce(d.promise as never);
    wrap(<FeedList agentId="abc" refreshIntervalMs={0} />);

    expect(getFeedMock).toHaveBeenCalledWith('abc');
    expect(screen.getByRole('status')).toHaveTextContent(/standing by/i);

    await act(async () => d.resolve({ posts: [] }));
  });

  it('renders multiple posts newest-first on success', async () => {
    getFeedMock.mockResolvedValueOnce({ posts: [posts[0], posts[1]] });
    wrap(<FeedList agentId="abc" refreshIntervalMs={0} />);

    const articles = await screen.findAllByRole('article');
    expect(articles).toHaveLength(2);
    expect(articles[0]).toHaveTextContent('Newest post');
    expect(articles[1]).toHaveTextContent('Older post');

    // Rationale is rendered with the post.
    expect(await screen.findByText('Rationale for the newest post.')).toBeInTheDocument();

    // Source links render as anchors with the real backend-provided URL.
    const source = screen.getByRole('link', { name: /new\.example/i });
    expect(source).toHaveAttribute('href', 'https://new.example/report');
  });

  it('renders every source as a link (never raw HTML)', async () => {
    getFeedMock.mockResolvedValueOnce({ posts });
    const { container } = wrap(<FeedList agentId="abc" refreshIntervalMs={0} />);
    await screen.findAllByRole('article');

    const hrefs = Array.from(container.querySelectorAll('a[target="_blank"]')).map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(
      expect.arrayContaining(['https://old.example/news', 'https://new.example/report']),
    );
    expect(container.querySelectorAll('script')).toHaveLength(0);
  });

  it('reveals the empty state when the feed has no posts', async () => {
    getFeedMock.mockResolvedValueOnce({ posts: [] });
    wrap(<FeedList agentId="abc" refreshIntervalMs={0} />);

    expect(await screen.findByText('No posts yet')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('shows the error state and retries successfully', async () => {
    getFeedMock
      .mockRejectedValueOnce(new Error('boom network'))
      .mockResolvedValueOnce({ posts });

    wrap(<FeedList agentId="abc" refreshIntervalMs={0} />);

    expect(await screen.findByText(/unable to reach sentinel/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Newest post')).toBeInTheDocument();
    expect(getFeedMock).toHaveBeenCalledTimes(2);
  });
});

describe('PostCard navigation', () => {
  it('links each post to its details route with the agent id', async () => {
    render(
      <MemoryRouter>
        <PostCard post={posts[1]} agentId="abc" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /read post/i })).toHaveAttribute(
      'href',
      '/feed/p-new?agentId=abc',
    );
  });
});

describe('PostDetailView', () => {
  it('renders full text, rationale, and safe source links', () => {
    render(
      <MemoryRouter>
        <PostDetailView post={posts[1]} agentId="abc" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Newest post')).toBeInTheDocument();
    expect(screen.getByText('Rationale for the newest post.')).toBeInTheDocument();

    const source = screen.getByRole('link', { name: /new\.example/i });
    expect(source).toHaveAttribute('href', 'https://new.example/report');
    expect(source).toHaveAttribute('rel', 'noopener noreferrer');
    expect(source).toHaveAttribute('target', '_blank');

    expect(screen.getByRole('link', { name: /back to feed/i })).toHaveAttribute(
      'href',
      '/feed?agentId=abc',
    );
  });
});

describe('PostDetailPage', () => {
  it('loads the feed and renders the matching post', async () => {
    getFeedMock.mockResolvedValueOnce({ posts });
    render(
      <MemoryRouter initialEntries={['/feed/p-new?agentId=abc']}>
        <Routes>
          <Route path="/feed/:postId" element={<PostDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Newest post')).toBeInTheDocument();
    expect(screen.getByText('Rationale for the newest post.')).toBeInTheDocument();
  });

  it('shows the not-found state for an unknown post id', async () => {
    getFeedMock.mockResolvedValueOnce({ posts: [posts[0]] });
    render(
      <MemoryRouter initialEntries={['/feed/p-missing?agentId=abc']}>
        <Routes>
          <Route path="/feed/:postId" element={<PostDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Post not found')).toBeInTheDocument();
  });
});