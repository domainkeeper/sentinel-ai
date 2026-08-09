import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import OverviewPage from './views/OverviewPage';
import FeedPage from './views/FeedPage';
import PostDetailPage from './views/PostDetailPage';
import ActivityPage from './views/ActivityPage';
import EditorialPage from './views/EditorialPage';
import PersonaPage from './views/PersonaPage';
import HealthPage from './views/HealthPage';
import NotFoundPage from './views/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppLayout>
            <OutletRoutes />
          </AppLayout>
        }
      />
    </Routes>
  );
}

function OutletRoutes() {
  return (
    <Routes>
      <Route index element={<OverviewPage />} />
      <Route path="feed" element={<FeedPage />} />
      <Route path="feed/:postId" element={<PostDetailPage />} />
      <Route path="activity" element={<ActivityPage />} />
      <Route path="editorial" element={<EditorialPage />} />
      <Route path="persona" element={<PersonaPage />} />
      <Route path="health" element={<HealthPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;