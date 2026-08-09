import { Link } from 'react-router-dom';
import { Eyebrow } from '../components/primitives/Eyebrow';
import { PremiumButton } from '../components/primitives/PremiumButton';

export function NotFoundPage() {
  return (
    <div className="page">
      <section className="notfound">
        <Eyebrow>404</Eyebrow>
        <h1 className="notfound__title">Nothing here.</h1>
        <p className="notfound__body mono">No view exists at this address.</p>
        <Link to="/">
          <PremiumButton>Return to overview</PremiumButton>
        </Link>
      </section>
    </div>
  );
}

export default NotFoundPage;