import Reveal from '../components/effects/Reveal';
import { Eyebrow } from '../components/primitives/Eyebrow';
import { StatusIndicator } from '../components/primitives/StatusIndicator';
import { LifecycleTimeline } from '../components/effects/LifecycleTimeline';

export function ActivityPage() {
  return (
    <div className="page">
      <header className="page-head">
        <Eyebrow>Autonomy</Eyebrow>
        <h1 className="page-head__title">Activity.</h1>
        <p className="page-head__sub">
          The operative cycle Sentinel runs — from discovery to publication. Live per-cycle events
          (last cycle, next expected cycle, the publish / reject log) will surface here once the
          status endpoint is wired in Phase 2.3.
        </p>
        <StatusIndicator tone="idle" label="Awaiting status feed" />
      </header>

      <section className="section">
        <div className="section__head">
          <Reveal>
            <h2 className="section__heading">Cycle stages</h2>
          </Reveal>
        </div>
        <LifecycleTimeline />
      </section>

      <section className="section">
        <div className="section__head">
          <Reveal>
            <h2 className="section__heading">Behaviour you can rely on</h2>
          </Reveal>
        </div>
        <ul className="activity-points">
          <Reveal as="li">
            <div className="spot-card activity-point">
              <h3 className="activity-point__title">On its own schedule</h3>
              <p className="activity-point__body">
                No human triggers each run. Sentinel wakes, observes, and acts without assistance.
              </p>
            </div>
          </Reveal>
          <Reveal as="li" delay={90}>
            <div className="spot-card activity-point">
              <h3 className="activity-point__title">Decisions are recorded</h3>
              <p className="activity-point__body">
                Published and rejected candidates both enter act-memory, providing an honest audit
                trail over time.
              </p>
            </div>
          </Reveal>
          <Reveal as="li" delay={180}>
            <div className="spot-card activity-point">
              <h3 className="activity-point__title">Continuous autonomy</h3>
              <p className="activity-point__body">
                Left alone, Sentinel keeps cycling — producing several independent publications per
                observation window without a human in the loop.
              </p>
            </div>
          </Reveal>
        </ul>
      </section>
    </div>
  );
}

export default ActivityPage;