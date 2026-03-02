import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@forge/bridge';
import type { AppConfig, AdminResource } from './types';
import { resolveDisplayName } from './utils';
import SetupWizard from './SetupWizard';
import ConfigOverview from './components/ConfigOverview';
import './styles.css';

type Status = { type: 'success' | 'error'; message: string } | null;
type View = 'loading' | 'wizard' | 'overview';

export default function ConfigPage() {
  // View routing
  const [view, setView] = useState<View>('loading');
  const [step, setStep] = useState(0);

  // Config state
  const [orgId, setOrgId] = useState('');
  const [directoryId, setDirectoryId] = useState('');
  const [groupId, setGroupId] = useState('');

  // Lists (kept in parent so SetupWizard + overview can resolve display names)
  const [orgs, setOrgs] = useState<AdminResource[]>([]);
  const [directories, setDirectories] = useState<AdminResource[]>([]);
  const [groups, setGroups] = useState<AdminResource[]>([]);

  // API keys & webhook
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [hasAdminApiKey, setHasAdminApiKey] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  // Loading states
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingDirectories, setLoadingDirectories] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // UI state
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  // ── Boot: load existing config, API key, admin key status, webhook URL ──
  useEffect(() => {
    (async () => {
      try {
        const [config, keyResult, adminKeyResult, urlResult] = await Promise.all([
          invoke<AppConfig>('getConfig'),
          invoke<{ apiKey: string | null }>('getApiKey'),
          invoke<{ hasKey: boolean }>('getAdminApiKey'),
          invoke<{ url: string }>('getWebhookUrl'),
        ]);

        setWebhookUrl(urlResult?.url ?? '');
        setApiKey(keyResult?.apiKey ?? null);
        setHasAdminApiKey(adminKeyResult?.hasKey ?? false);

        if (config?.orgId) setOrgId(config.orgId);
        if (config?.directoryId) setDirectoryId(config.directoryId);
        if (config?.groupId) setGroupId(config.groupId);

        // If fully configured → show overview
        const isConfigured = !!(
          config?.orgId && config?.directoryId && config?.groupId
          && keyResult?.apiKey && adminKeyResult?.hasKey
        );
        setView(isConfigured ? 'overview' : 'wizard');
        // Sync effects on hasAdminApiKey/orgId/directoryId will load lists automatically
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus({ type: 'error', message: `Failed to load: ${msg}` });
        setView('wizard');
      }
    })();
  }, []);

  // ── Keep lists in sync when IDs change ──
  useEffect(() => {
    if (!hasAdminApiKey) { setOrgs([]); return; }
    setLoadingOrgs(true);
    (async () => {
      try {
        const orgList = await invoke<AdminResource[]>('listOrgs');
        setOrgs(orgList ?? []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus({ type: 'error', message: `Failed to load organizations: ${msg}` });
      } finally {
        setLoadingOrgs(false);
      }
    })();
  }, [hasAdminApiKey]);

  useEffect(() => {
    if (!orgId || !hasAdminApiKey) { setDirectories([]); return; }
    setLoadingDirectories(true);
    (async () => {
      try {
        const dirs = await invoke<AdminResource[]>('listDirectories', { orgId });
        setDirectories(dirs ?? []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus({ type: 'error', message: `Failed to load directories: ${msg}` });
      } finally {
        setLoadingDirectories(false);
      }
    })();
  }, [orgId, hasAdminApiKey]);

  useEffect(() => {
    if (!orgId || !directoryId || !hasAdminApiKey) { setGroups([]); return; }
    setLoadingGroups(true);
    (async () => {
      try {
        const grps = await invoke<AdminResource[]>('listGroups', { orgId, directoryId });
        setGroups(grps ?? []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus({ type: 'error', message: `Failed to load groups: ${msg}` });
      } finally {
        setLoadingGroups(false);
      }
    })();
  }, [orgId, directoryId, hasAdminApiKey]);

  // ── Handlers ──
  const handleAdminApiKeySaved = useCallback(() => {
    setHasAdminApiKey(true);
    setStatus({ type: 'success', message: 'Admin API key saved.' });
  }, []);

  const handleGenerateApiKey = useCallback(async () => {
    setGenerating(true);
    try {
      const result = await invoke<{ apiKey: string }>('generateApiKey');
      setApiKey(result.apiKey);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ type: 'error', message: `Failed to generate API key: ${msg}` });
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!orgId || !directoryId || !groupId) {
      setStatus({ type: 'error', message: 'Please select an organization, directory, and group.' });
      return;
    }
    setSaving(true);
    try {
      await invoke('setConfig', { orgId, directoryId, groupId });
      setStatus({ type: 'success', message: 'Configuration saved successfully.' });
      setView('overview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ type: 'error', message: `Failed to save: ${msg}` });
    } finally {
      setSaving(false);
    }
  }, [orgId, directoryId, groupId]);

  const handleEditFromOverview = useCallback((targetStep: number) => {
    setStep(targetStep);
    setView('wizard');
  }, []);

  // ── Render ──
  if (view === 'loading') {
    return (
      <div className="container loading-screen">
        <div className="spinner" />
        <p className="loading-text">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="container">
      {status && (
        <div className={`banner ${status.type}`}>
          {status.message}
        </div>
      )}

      {view === 'overview' && apiKey && (
        <ConfigOverview
          orgName={resolveDisplayName(orgs, orgId)}
          directoryName={resolveDisplayName(directories, directoryId)}
          groupName={resolveDisplayName(groups, groupId)}
          apiKey={apiKey}
          webhookUrl={webhookUrl}
          onEdit={handleEditFromOverview}
        />
      )}

      {view === 'wizard' && (
        <SetupWizard
          step={step}
          orgId={orgId}
          directoryId={directoryId}
          groupId={groupId}
          apiKey={apiKey}
          webhookUrl={webhookUrl}
          hasAdminApiKey={hasAdminApiKey}
          generating={generating}
          saving={saving}
          orgs={orgs}
          directories={directories}
          groups={groups}
          loadingOrgs={loadingOrgs}
          loadingDirectories={loadingDirectories}
          loadingGroups={loadingGroups}
          onAdminApiKeySaved={handleAdminApiKeySaved}
          onOrgChange={setOrgId}
          onDirectoryChange={setDirectoryId}
          onGroupChange={setGroupId}
          onGenerateApiKey={handleGenerateApiKey}
          onSave={handleSave}
          onNext={() => setStep((s) => Math.min(s + 1, 2))}
          onBack={() => setStep((s) => Math.max(s - 1, 0))}
          onError={(msg) => setStatus({ type: 'error', message: msg })}
        />
      )}
    </div>
  );
}
