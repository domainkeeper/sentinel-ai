import { useState } from 'react';

interface Props {
  onSelect: (agentId: string) => void;
}

/**
 * Points the read-only frontend at an already-initialized agent. This never
 * calls init, never triggers generation, and never mutates agent state — it
 * only records which existing agent the judge is viewing.
 */
export function AgentConnect({ onSelect }: Props) {
  const [value, setValue] = useState('');

  return (
    <div className="agent-connect">
      <p className="section-title">Connect to an agent</p>
      <p className="placeholder-body">
        Enter the agent ID returned by <code className="mono">POST /api/agent/init</code> to
        view its feed. This is read-only; viewing the feed never triggers generation.
      </p>
      <form
        className="agent-connect__form"
        onSubmit={(e) => {
          e.preventDefault();
          const id = value.trim();
          if (id) {
            onSelect(id);
          }
        }}
      >
        <input
          className="agent-connect__input mono"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="agent-id"
          aria-label="Agent ID"
          spellCheck={false}
          autoComplete="off"
        />
        <button className="agent-connect__submit" type="submit">
          View feed
        </button>
      </form>
    </div>
  );
}

export default AgentConnect;