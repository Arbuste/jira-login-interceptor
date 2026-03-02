import CopyButton from './CopyButton';
import DownloadConfigButton from './DownloadConfigButton';

interface Props {
  orgName: string;
  directoryName: string;
  groupName: string;
  apiKey: string;
  webhookUrl: string;
  saving: boolean;
  onSave: () => void;
}

export default function StepReview({
  orgName,
  directoryName,
  groupName,
  apiKey,
  webhookUrl,
  saving,
  onSave,
}: Props) {
  return (
    <div className="section">
      <h3 className="section-title">Review &amp; Connect</h3>
      <p className="section-desc">
        Verify your configuration below, then click Save. Copy the webtrigger URL
        and API key into the Chrome extension settings page.
      </p>

      <table className="summary-table">
        <tbody>
          <tr>
            <td>Organization</td>
            <td>{orgName}</td>
          </tr>
          <tr>
            <td>Directory</td>
            <td>{directoryName}</td>
          </tr>
          <tr>
            <td>Group</td>
            <td>{groupName}</td>
          </tr>
        </tbody>
      </table>

      <label>Webtrigger URL</label>
      <div className="copyable-field">
        <input type="text" readOnly value={webhookUrl} />
        <CopyButton text={webhookUrl} />
      </div>

      <label>API Key</label>
      <div className="copyable-field">
        <input type="text" readOnly value={apiKey} />
        <CopyButton text={apiKey} />
      </div>

      <div className="info-box">
        <strong>Next step:</strong> Download the <code>config.json</code> file
        and drop it into the Chrome extension folder before distributing it.
        This pre-configures the extension with the correct URL and API key.
      </div>

      <div className="btn-row">
        <button
          className="btn-primary"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
        <DownloadConfigButton webhookUrl={webhookUrl} apiKey={apiKey} />
      </div>
    </div>
  );
}
