import { Routes, Route, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import AppLayout from './components/AppLayout';
import OverviewPage from './views/OverviewPage';
import FeedPage from './views/FeedPage';
import PostDetailPage from './views/PostDetailPage';
import ActivityPage from './views/ActivityPage';
import EditorialPage from './views/EditorialPage';
import PersonaPage from './views/PersonaPage';
import HealthPage from './views/HealthPage';
import NotFoundPage from './views/NotFoundPage';
import { RouteBoundary } from './components/RouteBoundary';

/**
 * Routing uses React Router's canonical layout-route pattern: one `<Routes>`
 * tree, a layout `<Route path="/">` whose element renders `<Outlet/>`, and
 * absolute leaf routes. NOTE: do NOT nest a second `<Routes>` inside a route
 * element for this layout — that layering matches nothing and renders a
 * completely blank screen. Each view is additionally isolated by a
 * `RouteBoundary` so a single failing view never blanks the whole app.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<RouteView><OverviewPage /></RouteView>} />
        <Route path="feed" element={<RouteView><FeedPage /></RouteView>} />
        <Route path="feed/:postId" element={<RouteView><PostDetailPage /></RouteView>} />
        <Route path="activity" element={<RouteView><ActivityPage /></RouteView>} />
        <Route path="editorial" element={<RouteView><EditorialPage /></RouteView>} />
        <Route path="persona" element={<RouteView><PersonaPage /></RouteView>} />
        <Route path="health" element={<RouteView><HealthPage /></RouteView>} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

/**
 * Wraps a view in a route-scoped error boundary plus a CSS enter transition
 * keyed by pathname. A crash here shows the styled Sentinel fallback and never
 * blanks the app shell or nav.
 */
function RouteView({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <RouteBoundary>
      <div key={location.pathname} className="page-enter">
        {children}
      </div>
    </RouteBoundary>
  );
}

export default App;