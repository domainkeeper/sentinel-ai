import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <article>
      <h1>Not found</h1>
      <p className="placeholder-tag">404</p>
      <p className="placeholder-body">
        This view does not exist. Return to the <Link to="/">overview</Link>.
      </p>
    </article>
  );
}

export default NotFoundPage;