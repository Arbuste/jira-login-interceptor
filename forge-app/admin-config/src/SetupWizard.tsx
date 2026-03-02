import type { AdminResource } from './types';
import { resolveDisplayName } from './utils';
import StepGroup from './components/StepGroup';
import StepSecurity from './components/StepSecurity';
import StepReview from './components/StepReview';

const STEPS = ['Group', 'Security', 'Review & Save'];

interface Props {
  step: number;
  orgId: string;
  directoryId: string;
  groupId: string;
  apiKey: string | null;
  webhookUrl: string;
  hasAdminApiKey: boolean;
  generating: boolean;
  saving: boolean;
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
  onGenerateApiKey: () => void;
  onSave: () => void;
  onNext: () => void;
  onBack: () => void;
  onError: (msg: string) => void;
}

export default function SetupWizard({
  step,
  orgId,
  directoryId,
  groupId,
  apiKey,
  webhookUrl,
  hasAdminApiKey,
  generating,
  saving,
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
  onGenerateApiKey,
  onSave,
  onNext,
  onBack,
  onError,
}: Props) {
  const canAdvanceStep0 = hasAdminApiKey && !!(orgId && directoryId && groupId);
  const canAdvanceStep1 = !!apiKey;

  return (
    <div>
      <h2 className="heading">Group Auto-Joiner Setup</h2>
      <p className="subtitle">Configure the plugin in three simple steps.</p>

      {/* Progress bar */}
      <div className="progress-bar">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`progress-step${i === step ? ' active' : ''}${i < step ? ' completed' : ''}`}
          >
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <StepGroup
          orgId={orgId}
          directoryId={directoryId}
          groupId={groupId}
          hasAdminApiKey={hasAdminApiKey}
          orgs={orgs}
          directories={directories}
          groups={groups}
          loadingOrgs={loadingOrgs}
          loadingDirectories={loadingDirectories}
          loadingGroups={loadingGroups}
          onAdminApiKeySaved={onAdminApiKeySaved}
          onOrgChange={onOrgChange}
          onDirectoryChange={onDirectoryChange}
          onGroupChange={onGroupChange}
          onError={onError}
        />
      )}

      {step === 1 && (
        <StepSecurity
          apiKey={apiKey}
          generating={generating}
          onGenerate={onGenerateApiKey}
        />
      )}

      {step === 2 && (
        <StepReview
          orgName={resolveDisplayName(orgs, orgId)}
          directoryName={resolveDisplayName(directories, directoryId)}
          groupName={resolveDisplayName(groups, groupId)}
          apiKey={apiKey!}
          webhookUrl={webhookUrl}
          saving={saving}
          onSave={onSave}
        />
      )}

      {/* Navigation */}
      <div className="btn-row">
        {step > 0 && (
          <button className="btn-secondary" onClick={onBack}>
            Back
          </button>
        )}
        {step < 2 && (
          <button
            className="btn-primary"
            onClick={onNext}
            disabled={step === 0 ? !canAdvanceStep0 : !canAdvanceStep1}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
