import { useMemo, useState } from "react";

export interface ProposedChangeSet {
  changes: Array<{
    path: string;
    operation: "create" | "modify" | "delete";
    contents?: string;
  }>;
  commitMessage: string;
}

interface Props {
  changeSet: ProposedChangeSet;
  onApply: (branch: string, openPr: boolean) => void;
  applyResult: { branch: string; commitSha: string; pullRequestUrl: string | null } | null;
}

const ChangePreview = ({ changeSet, onApply, applyResult }: Props) => {
  const [branchName, setBranchName] = useState<string>("ai/feature-");
  const [openPr, setOpenPr] = useState<boolean>(true);

  const summary = useMemo(
    () => `${changeSet.changes.length} change(s) · commit: ${changeSet.commitMessage}`,
    [changeSet]
  );

  return (
    <div>
      <h3>Proposed Changes</h3>
      <p>{summary}</p>
      {changeSet.changes.map((change) => (
        <div key={change.path} style={{ marginBottom: "1rem" }}>
          <strong>
            {change.operation.toUpperCase()} · {change.path}
          </strong>
          {change.contents && <pre className="code-block">{change.contents}</pre>}
          {!change.contents && change.operation === "delete" && <div>File will be deleted.</div>}
        </div>
      ))}

      <div className="flex-row">
        <label htmlFor="branch" style={{ marginBottom: 0 }}>New branch:</label>
        <input
          id="branch"
          className="small-input"
          value={branchName}
          onChange={(e) => setBranchName(e.target.value)}
        />
        <label style={{ marginBottom: 0 }}>
          <input type="checkbox" checked={openPr} onChange={(e) => setOpenPr(e.target.checked)} /> Open PR
        </label>
        <button onClick={() => onApply(branchName, openPr)}>Apply & Commit</button>
      </div>

      {applyResult && (
        <div style={{ marginTop: "1rem" }}>
          <div>Branch: {applyResult.branch}</div>
          <div>Commit: {applyResult.commitSha}</div>
          {applyResult.pullRequestUrl && (
            <div>
              PR: <a href={applyResult.pullRequestUrl}>{applyResult.pullRequestUrl}</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChangePreview;
