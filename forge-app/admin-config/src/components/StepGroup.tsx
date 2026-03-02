import { useState } from 'react';
import { invoke } from '@forge/bridge';
import type { AdminResource } from '../types';
import SearchableSelect from './SearchableSelect';

interface Props {
  orgId: string;
  directoryId: string;
  groupId: string;
  hasAdminApiKey: boolean;
  orgs: AdminResource[];
  directories: AdminResource[];
  groups: AdminResource[];
  loadingOrgs: boolean;
  loadingDirectories: boolean;
  loadingGroups: boolean;
  onAdminApiKeySaved: () => void;
  onOrgChange: (id: string) => void;
  onDirectoryChange: (id: string) => void;
  onGroupChange: (id: string) => void;
  onError: (msg: string) => void;
}

export default function StepGroup({
  orgId,
  directoryId,
  groupId,
  hasAdminApiKey,
  orgs,
  directories,
  groups,
  loadingOrgs,
  loadingDirectories,
  loadingGroups,
  onAdminApiKeySaved,
  onOrgChange,
  onDirectoryChange,
  onGroupChange,
  onError,
}: Props) {
  // Admin API key input
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const handleSaveAdminKey = async () => {
    if (!adminKeyInput.trim()) return;
    setSavingKey(true);
    try {
      await invoke('setAdminApiKey', { adminApiKey: adminKeyInput.trim() });
      onAdminApiKeySaved();
    } catch (err: unknown) {
      onError(`Failed to save Admin API key: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <div className="section">
      <h3 className="section-title">Select Target Group</h3>

      {/* Admin API Key section */}
      {!hasAdminApiKey ? (
        <>
          <p className="section-desc">
            First, create an organization API key and paste it below.
          </p>
          <div className="info-box">
            <strong>How to create the key:</strong>
            <ol className="tip-steps">
              <li>Go to <strong>admin.atlassian.com</strong> and select your organization</li>
              <li>Navigate to <strong>Settings &rarr; API keys</strong></li>
              <li>Click <strong>Create API key</strong></li>
              <li>Leave scopes empty (the key needs access to directory and group endpoints which don't support scoped keys yet)</li>
              <li>Copy the key immediately &mdash; it won't be shown again</li>
            </ol>
          </div>
          <label htmlFor="admin-api-key">Organization API Key</label>
          <div className="copyable-field">
            <input
              id="admin-api-key"
              type="password"
              value={adminKeyInput}
              onChange={(e) => setAdminKeyInput(e.target.value)}
              placeholder="Paste your API key here"
            />
            <button
              className="btn-primary btn-small"
              onClick={handleSaveAdminKey}
              disabled={savingKey || !adminKeyInput.trim()}
            >
              {savingKey ? 'Saving...' : 'Save key'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="section-desc">
            Choose the organization, directory, and group that users will be
            automatically added to when they log in.
          </p>

          <label>Organization</label>
          <SearchableSelect
            items={orgs}
            value={orgId}
            placeholder="Search organization..."
            loading={loadingOrgs}
            onChange={(id) => {
              onOrgChange(id);
              onDirectoryChange('');
              onGroupChange('');
            }}
          />

          <label>Directory</label>
          <SearchableSelect
            items={directories}
            value={directoryId}
            placeholder="Search directory..."
            disabled={!orgId}
            loading={loadingDirectories}
            onChange={(id) => {
              onDirectoryChange(id);
              onGroupChange('');
            }}
          />

          <label>Group</label>
          <SearchableSelect
            items={groups}
            value={groupId}
            placeholder="Search group..."
            disabled={!directoryId}
            loading={loadingGroups}
            onChange={(id) => onGroupChange(id)}
          />
        </>
      )}
    </div>
  );
}
