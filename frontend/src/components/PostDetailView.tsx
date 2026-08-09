import { Link } from 'react-router-dom';
import type { Post } from '../lib/types';
import { formatTimestamp, timeAgo } from '../lib/format';
import { SourceLink } from './PostCard';

export function PostDetailView({ post, agentId }: { post: Post; agentId: string }) {
  const backUrl = `/feed?agentId=${encodeURIComponent(agentId)}`;

  return (
    <article className="post-detail">
      <Link className="post-detail__back mono" to={backUrl}>
        ← Back to feed
      </Link>

      <header className="post-detail__meta mono">
        <time dateTime={post.createdAt} title={formatTimestamp(post.createdAt)}>
          Published {formatTimestamp(post.createdAt)} · {timeAgo(post.createdAt)}
        </time>
        <span aria-label="Post id">{post.id}</span>
      </header>

      <p className="post-detail__text">{post.text}</p>

      <section className="post-detail__section">
        <h2 className="section-title">Why Sentinel chose this</h2>
        <p className="post-detail__rationale">{post.rationale || 'No rationale was recorded for this post.'}</p>
      </section>

      <section className="post-detail__section">
        <h2 className="section-title">Sources</h2>
        {post.sources && post.sources.length > 0 ? (
          <ul className="source-list source-list--stacked" aria-label="Sources">
            {post.sources.map((url) => (
              <li key={url}>
                <SourceLink url={url} />
              </li>
            ))}
          </ul>
        ) : (
          <span className="mono source-null">no sources</span>
        )}
      </section>
    </article>
  );
}

export default PostDetailView;