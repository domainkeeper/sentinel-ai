import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { App } from '../App';

/**
 * Reproduces the blank-screen / navigation reliability scenarios:
 * every route renders under direct, click, and data-race conditions.
 * A blank screen would present as a test failure here.
 */

const { getFeedMock } = vi.hoisted(() => ({ getFeedMock: vi.fn() }));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...actual, getFeed: getFeedMock };
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const POSTS = [
  {
    id: 'p1',
    createdAt: '2026-01-02T10:00:00.000Z',
    text: 'A real intelligence post body',
    rationale: 'Rationale for the post.',
    sources: ['https://s1.example/report'],
  },
];

beforeEach(() => {
  getFeedMock.mockReset();
  getFeedMock.mockResolvedValue({ posts: POSTS });
});

describe('Route reliability — every route renders, never blank', () => {
  it('renders the Overview (home) on direct URL', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: /observes the threat landscape/i })).toBeInTheDocument();
  });

  const staticRoutes: { path: string; label: RegExp }[] = [
    { path: '/activity', label: /autonomous activity|cycle stages/i },
    { path: '/editorial', label: /how decisions are made|editorial/i },
    { path: '/persona', label: /persona|sleepless observer/i },
    { path: '/health', label: /system health|status/i },
  ];

  it.each(staticRoutes)('renders $path on direct URL', ({ path, label }) => {
    renderAt(path);
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it('renders the Feed on direct URL (no agent → connect)', () => {
    renderAt('/feed');
    expect(screen.getByText(/connect to an agent/i)).toBeInTheDocument();
  });

  it('renders the Feed with an agent id (loading → empty)', async () => {
    getFeedMock.mockResolvedValueOnce({ posts: [] });
    renderAt('/feed?agentId=abc');
    expect(await screen.findByText('No posts yet')).toBeInTheDocument();
  });

  it('renders Feed then Post Detail via navigation', async () => {
    renderAt('/feed?agentId=abc');
    fireEvent.click(await screen.findByRole('link', { name: /read post/i }));
    expect(await screen.findByText('A real intelligence post body')).toBeInTheDocument();
  });

  it('renders Post Detail directly', async () => {
    renderAt('/feed/p1?agentId=abc');
    expect(await screen.findByText('A real intelligence post body')).toBeInTheDocument();
  });

  it('renders the 404 fallback for unknown routes', () => {
    renderAt('/no/such/view');
    expect(screen.getByRole('heading', { name: /^nothing here/i })).toBeInTheDocument();
  });
});

describe('Navigation via primary nav — clicks move between views without blanking', () => {
  it('clicks through the whole primary nav', () => {
    renderAt('/');
    const go = (label: string) => {
      const link = screen.getAllByRole('link', { name: new RegExp(`^${label}$`, 'i') })[0];
      fireEvent.click(link);
    };

    const heading = (name: RegExp) => screen.getByRole('heading', { name });

    go('Feed');
    expect(screen.getByText(/connect to an agent/i)).toBeInTheDocument();

    go('Activity');
    expect(heading(/^Activity\./)).toBeInTheDocument();

    go('Editorial');
    expect(heading(/^How decisions are made\./)).toBeInTheDocument();

    go('Persona');
    expect(heading(/sleepless observer/)).toBeInTheDocument();

    go('Health');
    expect(heading(/^Status\./)).toBeInTheDocument();

    go('Overview');
    expect(heading(/observes the threat landscape/)).toBeInTheDocument();
  });
});

describe('Data-race / backend-unavailable robustness', () => {
  it('does not blank when a slow feed resolves after navigating', async () => {
    const slow = deferred<{ posts: typeof POSTS }>();
    getFeedMock.mockReturnValueOnce(slow.promise as never);

    renderAt('/feed?agentId=slow');
    // Loading state visible, then the user navigates away (feed unmounts).
    expect(screen.getByRole('status')).toHaveTextContent(/standing by/i);

    cleanup();
    renderAt('/activity');
    expect(screen.getByText(/cycle stages/i)).toBeInTheDocument();

    // Resolve the abandoned feed request — must not throw/unhandled-reject.
    await actFlush(() => slow.resolve({ posts: POSTS }));
  });

  it('does not blank when the backend is unavailable (feed error state)', async () => {
    getFeedMock.mockRejectedValueOnce(new Error('network down'));
    renderAt('/feed?agentId=abc');
    expect(await screen.findByText(/unable to reach sentinel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

async function actFlush(fn: () => void | Promise<unknown>) {
  await fn();
  await waitFor(() => {
    expect(true).toBe(true);
  });
}