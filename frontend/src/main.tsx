import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AmbientBackground } from './components/effects/AmbientBackground';
import { InteractiveDotGrid } from './components/effects/InteractiveDotGrid';
import './styles/tokens.css';
import './styles/global.css';
import './styles/ambient.css';
import './styles/orbit.css';
import './styles/layout.css';
import './styles/premium.css';
import './styles/feed.css';
import './styles/views.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <AmbientBackground />
      <InteractiveDotGrid
        baseColor="rgba(25, 26, 31, 0.10)"
        activeColor="#7c3aed"
        dotSize={5}
        gap={16}
        proximity={130}
        shockRadius={320}
        shockStrength={6}
        speedTrigger={140}
        maxSpeed={5200}
        resistance={0.9}
        returnDuration={1.6}
      />
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
);