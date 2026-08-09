import { Reveal } from '../effects/Reveal';

export interface LifecycleStage {
  id: string;
  title: string;
  code: string;
  blurb: string;
}

const STAGES: LifecycleStage[] = [
  {
    id: 'discover',
    title: 'Discover',
    code: 'DB',
    blurb: 'Scours primary sources for candidate signals.',
  },
  {
    id: 'evaluate',
    title: 'Evaluate',
    code: 'EV',
    blurb: 'Assesses relevance and confidence against its standing-mission.',
  },
  {
    id: 'select',
    title: 'Select',
    code: 'SE',
    blurb: 'Commission nothing. Only advances candidates that clear the bar.',
  },
  {
    id: 'generate',
    title: 'Generate',
    code: 'GN',
    blurb: 'Drafts the post and an honest rationale for the decision.',
  },
  {
    id: 'remember',
    title: 'Remember',
    code: 'RM',
    blurb: 'Logs both published and rejected decisions to act-memory.',
  },
  {
    id: 'publish',
    title: 'Publish',
    code: 'PB',
    blurb: 'Releases the surviving post to the public feed.',
  },
] satisfies LifecycleStage[];

/**
 * Presentational map of the agent's operative model (Blueprint Part A).
 * Shows the intended cycle only — it is never wired to fake live events.
 */
export function LifecycleTimeline() {
  return (
    <div className="lifecycle">
      <div className="lifecycle__beam" aria-hidden="true">
        <span className="lifecycle__signal" />
      </div>
      <ol className="lifecycle__track" aria-label="Autonomous operative lifecycle">
        {STAGES.map((stage, i) => (
          <Reveal key={stage.id} as="li" delay={i * 90} className="lifecycle__item">
            <div className="lifecycle__node" aria-hidden="true">
              <span className="lifecycle__code">{stage.code}</span>
            </div>
            <div className="lifecycle__body">
              <h3 className="lifecycle__title">{stage.title}</h3>
              <p className="lifecycle__blurb">{stage.blurb}</p>
            </div>
          </Reveal>
        ))}
      </ol>
      <p className="lifecycle__note mono">
        Decorative signal — live per-cycle events appear under Activity with the status endpoint.
      </p>
    </div>
  );
}

export default LifecycleTimeline;