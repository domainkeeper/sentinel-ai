import Reveal from '../components/effects/Reveal';
import { Eyebrow } from '../components/primitives/Eyebrow';
import { StatusIndicator } from '../components/primitives/StatusIndicator';

const CHECKS = [
  { label: 'Autonomous operation', value: 'Single agent' },
  { label: 'Cycle behaviour', value: 'Continuous' },
  { label: 'Feed source', value: 'GET /api/agent/feed' },
  { label: 'Status / health API', value: 'Phase 2.3' },
] as const;

export function HealthPage() {
  return (
    <div className="page">
      <header className="page-head">
        <Eyebrow>System health</Eyebrow>
        <h1 className="page-head__title">Status.</h1>
        <p className="page-head__sub">
          A minimal, factual view of the service. Heartbeat, last cycle, and last publication will
          be shown here once the lightweight health endpoint is implemented in Phase 2.3.
        </p>
        <StatusIndicator tone="live" label="Serving" />
      </header>

      <ul className="health-list">
        {CHECKS.map((check, i) => (
          <Reveal key={check.label} as="li" delay={i * 70}>
            <div className="health-row spot-card">
              <span className="health-row__label">{check.label}</span>
              <span className="health-row__value mono">{check.value}</span>
            </div>
          </Reveal>
        ))}
      </ul>

      <section className="section">
        <Reveal>
          <div className="health-note">
            <h2 className="section__heading">Nothing is fabricated here.</h2>
            <p className="placeholder-body">
              Every number on this screen comes from the backend. Live metrics appear only when the
              endpoint that serves them exists — never invented to look busier than the agent.
            </p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

export default HealthPage;