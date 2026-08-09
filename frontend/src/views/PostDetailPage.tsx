import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ApiError, getFeed } from '../lib/api';
import type { Post } from '../lib/types';
import { useAgentId } from '../lib/useAgentId';
import AgentConnect from '../components/AgentConnect';
import PostDetailView from '../components/PostDetailView';
import { PostNotFound } from '../components/States';
import '../styles/feed.css';

export function PostDetailPage() {
  const { postId } = useParams();
  const [, setSearchParams] = useSearchParams();
  const agentId = useAgentId();

  if (!agentId) {
    return <AgentConnect onSelect={(id) => setSearchParams({ agentId: id })} />;
  }

  if (!postId) {
    return <PostNotFound />;
  }

  return <PostDetailPane agentId={agentId} postId={postId} />;
}

function PostDetailPane({ agentId, postId }: { agentId: string; postId: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFeed(agentId)
      .then((data) => {
        if (cancelled) return;
        const found = (data.posts ?? []).find((p) => p.id === postId);
        setPost(found ?? null);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e as ApiError);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, postId]);

  if (error) {
    return (
      <div className="feed-state feed-state--error" role="alert">
        <p className="section-title">Unable to reach Sentinel</p>
        <p className="placeholder-body">{error.message}</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="mono" role="status" aria-live="polite">
        Standing by…
      </div>
    );
  }
  if (!post) {
    return <PostNotFound />;
  }
  return <PostDetailView post={post} agentId={agentId} />;
}

export default PostDetailPage;