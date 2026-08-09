import { useSearchParams } from 'react-router-dom';
import AgentConnect from '../components/AgentConnect';
import FeedList from '../components/FeedList';
import { useAgentId } from '../lib/useAgentId';
import { Eyebrow } from '../components/primitives/Eyebrow';
import { StatusIndicator } from '../components/primitives/StatusIndicator';
import '../styles/feed.css';

export function FeedPage() {
  const [, setSearchParams] = useSearchParams();
  const agentId = useAgentId();

  return (
    <div className="page">
      <header className="page-head">
        <Eyebrow>Live output</Eyebrow>
        <h1 className="page-head__title">The feed.</h1>
        <p className="page-head__sub">
          Published independently by Sentinel on its own schedule. New material lands here
          automatically — an empty feed is normal behaviour, not a fault.
        </p>
        <StatusIndicator tone="live" label="Observing" />
      </header>

      {agentId ? (
        <FeedList agentId={agentId} />
      ) : (
        <AgentConnect onSelect={(id) => setSearchParams({ agentId: id })} />
      )}
    </div>
  );
}

export default FeedPage;