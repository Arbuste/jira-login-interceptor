import { useState } from 'react';
import CopyButton from './CopyButton';

interface Props {
  apiKey: string | null;
  generating: boolean;
  onGenerate: () => void;
}

export default function StepSecurity({ apiKey, generating, onGenerate }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="section">
      <h3 className="section-title">API Key</h3>
      <p className="section-desc">
        This key authenticates requests from the Chrome extension to the Forge app.
        Generate one below — it will be stored securely in the Forge app storage.
      </p>

      {apiKey ? (
        <>
          <label>Current API Key</label>
          <div className="copyable-field">
            <input type="text" readOnly value={apiKey} />
            <CopyButton text={apiKey} />
          </div>

          {showConfirm ? (
            <div className="confirm-box">
              <strong>Regenerate API key?</strong> The current key will stop
              working immediately. You will need to update the Chrome extension
              with the new key.
              <div className="btn-row">
                <button
                  className="btn-danger btn-small"
                  onClick={() => { onGenerate(); setShowConfirm(false); }}
                  disabled={generating}
                >
                  {generating ? 'Generating...' : 'Yes, regenerate'}
                </button>
                <button
                  className="btn-secondary btn-small"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn-secondary btn-small"
              onClick={() => setShowConfirm(true)}
            >
              Regenerate key
            </button>
          )}
        </>
      ) : (
        <>
          <div className="info-box">
            No API key has been generated yet. Click the button below to create one.
          </div>
          <button
            className="btn-primary"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate API Key'}
          </button>
        </>
      )}
    </div>
  );
}
