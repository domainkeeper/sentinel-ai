import { useCallback, useEffect, useState } from 'react';
import { ApiError, getFeed } from '../lib/api';
import type { Post } from '../lib/types';
import { PostCard } from './PostCard';
import { LoadingState, EmptyFeed, FeedError } from './States';

interface FeedFeedListProps {
  agentId: string;
  /** Live polling interval in ms. A value <= 0 disables polling. */
  refreshIntervalMs?: number;
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

export function FeedList({ agentId, refreshIntervalMs = 60000 }: FeedFeedListProps) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const doFetch = useCallback(
    async (background: boolean, signal?: AbortSignal) => {
      if (!background) {
        setLoading(true);
      }
      setError(null);
      try {
        const data = signal
          ? await getFeed(agentId, { signal })
          : await getFeed(agentId);
        setPosts(data.posts ?? []);
      } catch (e) {
        if (!isAbort(e)) {
          setError(e as ApiError);
        }
      } finally {
        if (!background) {
          setLoading(false);
        }
      }
    },
    [agentId],
  );

  useEffect(() => {
    void doFetch(false);
    return () => {
      // doFetch handles its own abort via request timeout; nothing else to cancel here.
    };
  }, [doFetch, reloadKey]);

  useEffect(() => {
    if (refreshIntervalMs > 0) {
      const id = window.setInterval(() => void doFetch(true), refreshIntervalMs);
      return () => window.clearInterval(id);
    }
  }, [doFetch, refreshIntervalMs]);

  const retry = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const sorted = posts ? [...posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];

  // First load failed.
  if (error && posts === null) {
    return <FeedError message={error.message} onRetry={retry} />;
  }
  // First load in progress.
  if (posts === null && loading) {
    return <LoadingState />;
  }
  // Loaded but empty.
  if (posts !== null && posts.length === 0) {
    return <EmptyFeed />;
  }

  return (
    <div className="feed-list">
      <p className="section-title">
        Live feed · {sorted.length} post{sorted.length === 1 ? '' : 's'}
      </p>
      {sorted.map((post, i) => (
        <PostCard key={post.id} post={post} agentId={agentId} index={i} />
      ))}
    </div>
  );
}

export default FeedList;