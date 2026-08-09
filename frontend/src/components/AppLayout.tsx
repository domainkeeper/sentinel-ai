import { NavLink, Link, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/', label: 'Overview' },
  { to: '/feed', label: 'Feed' },
  { to: '/activity', label: 'Activity' },
  { to: '/editorial', label: 'Editorial' },
  { to: '/persona', label: 'Persona' },
  { to: '/health', label: 'Health' },
];

function AppNav() {
  return (
    <nav className="app-nav" aria-label="Primary">
      <ul className="app-nav__list">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `app-nav__link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AppLayout() {
  // Reset scroll on route change so a freshly-mounting view starts at its top.
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__glass" aria-hidden="true" />
        <div className="app-header__inner">
          <Link className="brand" to="/">
            <span className="brand__mark" aria-hidden="true">
              <span className="brand__core" />
            </span>
            <span className="brand__name">
              Sentinel <em>AI</em>
            </span>
          </Link>

          <div className="app-header__right">
            <div className="app-header__status mono">
              <span className="status-dot status-dot--live" />
              one agent · every persona
            </div>
            <span className="app-header__tag mono">preview</span>
          </div>
        </div>
      </header>

      <div className="app-body">
        <AppNav />
        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <nav className="app-nav__mobile" aria-label="Mobile">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <footer className="app-footer">
        <div className="app-footer__inner">
          <span>Sentinel AI — an autonomous editorial agent with a configurable persona.</span>
          <span className="mono">initialize once · observe on its own</span>
        </div>
      </footer>
    </div>
  );
}

export default AppLayout;