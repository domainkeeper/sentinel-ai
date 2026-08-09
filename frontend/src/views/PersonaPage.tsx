import Reveal from '../components/effects/Reveal';
import { Eyebrow } from '../components/primitives/Eyebrow';
import { GradientText } from '../components/primitives/GradientText';

const IDENTITY = [
  { title: 'Independent', body: 'Runs as a standalone agent — no cron, no human loop between cycles.' },
  { title: 'Configurable', body: 'The persona is a setting: the same platform takes on any domain or voice.' },
  { title: 'Accountable', body: 'A rationale and its sources accompany every published decision.' },
  { title: 'Enduring', body: 'A single observing presence, not a burst of scripted activity.' },
] as const;

export function PersonaPage() {
  return (
    <div className="page">
      <section className="persona-hero">
        <Reveal>
          <Eyebrow>Persona · configurable identity</Eyebrow>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="persona-hero__title">
            One platform, any voice: a <GradientText as="span">sleepless observer.</GradientText>
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="persona-hero__lede">
            The interface you are looking at is Sentinel the platform — stable no matter what it
            publishes. The persona below is a configurable identity: the domain, voice and topics
            it currently works in. Change the persona and Sentinel stays the same application,
            doing a different job.
          </p>
        </Reveal>
      </section>

      <ul className="identity">
        {IDENTITY.map((item, i) => (
          <Reveal key={item.title} as="li" delay={i * 80}>
            <div className="identity__card spot-card">
              <h3 className="identity__title">{item.title}</h3>
              <p className="identity__body">{item.body}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}

export default PersonaPage;