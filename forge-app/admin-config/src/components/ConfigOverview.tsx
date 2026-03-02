import { useState } from 'react';
import CopyButton from './CopyButton';
import DownloadConfigButton from './DownloadConfigButton';

interface Props {
  orgName: string;
  directoryName: string;
  groupName: string;
  apiKey: string;
  webhookUrl: string;
  onEdit: (step: number) => void;
}

export default function ConfigOverview({
  orgName,
  directoryName,
  groupName,
  apiKey,
  webhookUrl,
  onEdit,
}: Props) {
  const [revealed, setRevealed] = useState(false);

  const maskedKey = apiKey
    ? apiKey.slice(0, 4) + '\u2022'.repeat(apiKey.length - 8) + apiKey.slice(-4)
    : '';

  return (
    <div>
      <h2 className="heading">Group Auto-Joiner</h2>
      <p className="subtitle">Configuration is active and ready.</p>

      <div className="overview-card">
        <h3>Target Group</h3>
        <div className="overview-row">
          <span className="overview-label">Organization</span>
          <span className="overview-value">{orgName}</span>
        </div>
        <div className="overview-row">
          <span className="overview-label">Directory</span>
          <span className="overview-value">{directoryName}</span>
        </div>
        <div className="overview-row">
          <span className="overview-label">Group</span>
          <span className="overview-value">{groupName}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn-secondary btn-small" onClick={() => onEdit(0)}>
            Edit group
          </button>
        </div>
      </div>

      <div className="overview-card">
        <h3>Chrome Extension Connection</h3>

        <label>Webtrigger URL</label>
        <div className="copyable-field">
          <input type="text" readOnly value={webhookUrl} />
          <CopyButton text={webhookUrl} />
        </div>

        <label>API Key</label>
        <div className="copyable-field">
          <input
            type="text"
            readOnly
            value={revealed ? apiKey : maskedKey}
            className={revealed ? 'api-key-display' : 'masked-key'}
          />
          <button
            className="btn-copy"
            onClick={() => setRevealed((r) => !r)}
            type="button"
          >
            {revealed ? 'Hide' : 'Reveal'}
          </button>
          <CopyButton text={apiKey} />
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <DownloadConfigButton webhookUrl={webhookUrl} apiKey={apiKey} />
          <button className="btn-secondary btn-small" onClick={() => onEdit(1)}>
            Edit security
          </button>
        </div>
      </div>
    </div>
  );
}
