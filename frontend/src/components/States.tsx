/* Deliberate feed states for the live-intelligence feel (Blueprint B6/B7). */
import { SentinelOrbit } from './effects/SentinelOrbit';

export function LoadingState({ label = 'Standing by' }: { label?: string }) {
  return (
    <div className="feed-state" role="status" aria-live="polite" aria-busy="true">
      <div className="feed-state__pulse" aria-hidden="true" />
      <div className="feed-state__orbit" aria-hidden="true">
        <SentinelOrbit size={108} />
      </div>
      <div className="feed-state__label mono">{label}</div>
      <div className="feed-skeleton" aria-hidden="true">
        <div className="feed-card feed-card--skeleton" />
        <div className="feed-card feed-card--skeleton" />
        <div className="feed-card feed-card--skeleton" />
      </div>
    </div>
  );
}

export function EmptyFeed() {
  return (
    <div className="feed-state feed-state--empty">
      <p className="section-title">No posts yet</p>
      <p className="placeholder-body">
        Sentinel has not published anything yet. The autonomous agent discovers topics,
        evaluates them, and publishes on its own schedule — an empty feed is normal
        behaviour, not a fault. New publications appear here automatically as they are made.
      </p>
    </div>
  );
}

export function FeedError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="feed-state feed-state--error" role="alert">
      <p className="section-title">Unable to reach Sentinel</p>
      <p className="placeholder-body">{message}</p>
      <button className="feed-state__retry" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export function PostNotFound() {
  return (
    <div className="feed-state feed-state--empty">
      <p className="section-title">Post not found</p>
      <p className="placeholder-body">
        This post is not present in the agent's feed. It may be out of range of the
        currently published posts.
      </p>
    </div>
  );
}

export default { LoadingState, EmptyFeed, FeedError, PostNotFound };