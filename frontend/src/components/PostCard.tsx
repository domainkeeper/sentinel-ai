import { Link } from 'react-router-dom';
import type { Post } from '../lib/types';
import { formatTimestamp, timeAgo } from '../lib/format';

interface Props {
  post: Post;
  agentId: string;
}

export function PostCard({ post, agentId }: Props) {
  const detailUrl = `/feed/${encodeURIComponent(post.id)}?agentId=${encodeURIComponent(agentId)}`;

  return (
    <article className="feed-card">
      <header className="feed-card__meta mono">
        <time dateTime={post.createdAt} title={formatTimestamp(post.createdAt)}>
          {formatTimestamp(post.createdAt)} · {timeAgo(post.createdAt)}
        </time>
        <span className="feed-card__id" aria-label="Post id">
          {post.id}
        </span>
      </header>

      <p className="feed-card__text">{post.text}</p>

      {post.rationale ? (
        <details className="feed-card__rationale">
          <summary>Why Sentinel chose this</summary>
          <p>{post.rationale}</p>
        </details>
      ) : null}

      <footer className="feed-card__foot">
        {post.sources && post.sources.length > 0 ? (
          <ul className="source-list" aria-label="Sources">
            {post.sources.map((url) => (
              <li key={url}>
                <SourceLink url={url} />
              </li>
            ))}
          </ul>
        ) : (
          <span className="mono source-null">no sources</span>
        )}

        <Link className="feed-card__read" to={detailUrl}>
          Read post
        </Link>
      </footer>
    </article>
  );
}

/** A source link that opens safely, is never rendered as HTML, and is never rewritten. */
export function SourceLink({ url }: { url: string }) {
  let display = url;
  try {
    display = new URL(url).host;
  } catch {
    // Keep the raw string if it is not a valid URL — never fabricate attribution.
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
      {display}
    </a>
  );
}

export default PostCard;