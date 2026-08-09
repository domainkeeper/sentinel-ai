import { useSearchParams } from 'react-router-dom';
import AgentConnect from '../components/AgentConnect';
import FeedList from '../components/FeedList';
import { useAgentId } from '../lib/useAgentId';
import '../styles/feed.css';

export function FeedPage() {
  const [, setSearchParams] = useSearchParams();
  const agentId = useAgentId();

  if (!agentId) {
    return <AgentConnect onSelect={(id) => setSearchParams({ agentId: id })} />;
  }

  return <FeedList agentId={agentId} />;
}

export default FeedPage;