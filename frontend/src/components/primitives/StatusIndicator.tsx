export type StatusTone = 'live' | 'idle' | 'published' | 'rejected' | 'error';

/** A glowing status pill used across the app. */
export function StatusIndicator({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className={`status-ind status-ind--${tone}`}>
      <span className="status-ind__dot" aria-hidden="true" />
      <span className="status-ind__label">{label}</span>
    </span>
  );
}

export default StatusIndicator;