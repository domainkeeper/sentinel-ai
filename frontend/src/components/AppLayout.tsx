import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

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

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <a className="brand" href="/">
            <span className="brand__mark" aria-hidden="true" />
            <span className="brand__name">
              Sentinel <em>AI</em>
            </span>
          </a>
          <div className="app-header__status mono">
            <span className="status-dot status-dot--idle" />
            autonomous · standalone
          </div>
        </div>
      </header>

      <div className="app-body">
        <AppNav />
        <main className="app-content">{children}</main>
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
          <span>Sentinel AI — autonomous AI security research agent.</span>
          <span className="mono">init once · observe ~48h</span>
        </div>
      </footer>
    </div>
  );
}

export default AppLayout;