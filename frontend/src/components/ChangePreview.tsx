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
  onChange: (changeSet: ProposedChangeSet) => void;
  applyResult: { branch: string; commitSha: string; pullRequestUrl: string | null } | null;
}

const ChangePreview = ({ changeSet, onApply, onChange, applyResult }: Props) => {
  const [branchName, setBranchName] = useState<string>("ai/feature-");
  const [openPr, setOpenPr] = useState<boolean>(true);

  const summary = useMemo(
    () => `${changeSet.changes.length} change(s) · commit: ${changeSet.commitMessage}`,
    [changeSet]
  );

  const handleContentChange = (index: number, value: string) => {
    const updatedChanges = changeSet.changes.map((change, i) =>
      i === index ? { ...change, contents: value } : change
    );
    onChange({ ...changeSet, changes: updatedChanges });
  };

  const handleCommitMessageChange = (value: string) => {
    onChange({ ...changeSet, commitMessage: value });
  };

  return (
    <div>
      <h3>Proposed Changes</h3>
      <p>{summary}</p>
      {changeSet.changes.map((change, index) => (
        <div key={change.path} style={{ marginBottom: "1rem" }}>
          <strong>
            {change.operation.toUpperCase()} · {change.path}
          </strong>
          {change.contents !== undefined && (
            <textarea
              className="code-block"
              value={change.contents}
              onChange={(e) => handleContentChange(index, e.target.value)}
              rows={Math.min(Math.max(change.contents.split("\n").length, 4), 30)}
            />
          )}
          {!change.contents && change.operation === "delete" && <div>File will be deleted.</div>}
        </div>
      ))}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <label htmlFor="commit-message" style={{ marginBottom: 0 }}>
          Commit message:
        </label>
        <input
          id="commit-message"
          className="small-input"
          value={changeSet.commitMessage}
          onChange={(e) => handleCommitMessageChange(e.target.value)}
        />
      </div>

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
