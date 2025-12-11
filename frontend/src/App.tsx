import { useEffect, useMemo, useState } from "react";
import RepoSelector, { RepoSummary } from "./components/RepoSelector";
import FileSelector from "./components/FileSelector";
import PromptPanel from "./components/PromptPanel";
import ChangePreview, { ProposedChangeSet } from "./components/ChangePreview";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
const authRedirectUri = `${apiBase}/api/auth/callback`;

const postJson = async <T,>(path: string, body?: unknown): Promise<T> => {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) {
    const message = await response.text();
    const error = new Error(message || response.statusText) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
};

function App() {
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<RepoSummary | null>(null);
  const [baseBranch, setBaseBranch] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [changeSet, setChangeSet] = useState<ProposedChangeSet | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [applyResult, setApplyResult] = useState<{ branch: string; commitSha: string; pullRequestUrl: string | null } | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const authorizeUrl = useMemo(() => {
    if (!githubClientId) return null;
    return `https://github.com/login/oauth/authorize?client_id=${githubClientId}&scope=repo&redirect_uri=${encodeURIComponent(authRedirectUri)}`;
  }, [authRedirectUri, githubClientId]);

  const handleLogin = () => {
    if (!authorizeUrl) {
      setRepoError("GitHub OAuth client ID is not configured.");
      return;
    }
    window.location.href = authorizeUrl;
  };

  useEffect(() => {
    const loadRepos = async () => {
      try {
        setRepoError(null);
        const data = await postJson<RepoSummary[]>("/api/list-repos");
        setRepos(data);
      } catch (error: any) {
        if (error.status === 401) {
          setRepoError("Please log in with GitHub to continue.");
        } else {
          setRepoError(error.message ?? "Failed to load repositories");
        }
      }
    };
    loadRepos();
  }, []);

  const handleGenerate = async () => {
    if (!selectedRepo || !baseBranch || !userPrompt) return;
    setIsGenerating(true);
    setChangeSet(null);
    setApplyResult(null);
    setApplyError(null);
    try {
      const response = await postJson<ProposedChangeSet>("/api/generate-change", {
        owner: selectedRepo.fullName.split("/")[0],
        repo: selectedRepo.name,
        baseBranch,
        filePaths: selectedFiles,
        userPrompt,
      });
      setChangeSet(response);
    } catch (error: any) {
      setApplyError(error.message ?? "Failed to generate changes");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = async (branch: string, openPr: boolean) => {
    if (!selectedRepo || !baseBranch || !changeSet) return;
    setApplyError(null);
    setApplyResult(null);
    try {
      const response = await postJson<{ branch: string; commitSha: string; pullRequestUrl: string | null }>("/api/apply-change", {
        owner: selectedRepo.fullName.split("/")[0],
        repo: selectedRepo.name,
        baseBranch,
        newBranchName: branch,
        changes: changeSet.changes,
        commitMessage: changeSet.commitMessage,
        openPullRequest: openPr,
      });
      setApplyResult(response);
    } catch (error: any) {
      setApplyError(error.message ?? "Failed to apply changes");
    }
  };

  const repoOptions = useMemo(() => repos.sort((a, b) => a.fullName.localeCompare(b.fullName)), [repos]);

  return (
    <div className="container">
      <h1>AI Codex Control Panel</h1>
      <div className="card" style={{ display: "flex", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3>Authentication</h3>
          <p style={{ marginBottom: 0 }}>Sign in with GitHub to list repositories and apply changes.</p>
        </div>
        <button onClick={handleLogin} disabled={!authorizeUrl}>
          Login with GitHub
        </button>
      </div>

      <div className="card">
        <RepoSelector
          repos={repoOptions}
          selectedRepo={selectedRepo}
          onSelect={(repo) => {
            setSelectedRepo(repo);
            setBaseBranch(repo?.defaultBranch ?? "");
            setChangeSet(null);
            setApplyResult(null);
          }}
        />
        {selectedRepo && (
          <div className="flex-row">
            <label htmlFor="branch" style={{ marginBottom: 0 }}>Base branch:</label>
            <input
              id="branch"
              className="small-input"
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
            />
          </div>
        )}
        {repoError && <div className="error">{repoError}</div>}
      </div>

      {selectedRepo && (
        <div className="card">
          <FileSelector
            repo={selectedRepo}
            baseBranch={baseBranch}
            selected={selectedFiles}
            onChange={setSelectedFiles}
          />
        </div>
      )}

      {selectedRepo && (
        <div className="card">
          <PromptPanel
            prompt={userPrompt}
            onChange={setUserPrompt}
            onGenerate={handleGenerate}
            disabled={isGenerating || !baseBranch || selectedFiles.length === 0}
          />
          {applyError && <div className="error">{applyError}</div>}
        </div>
      )}

      {changeSet && (
        <div className="card">
          <ChangePreview
            changeSet={changeSet}
            onApply={handleApply}
            applyResult={applyResult}
          />
        </div>
      )}
    </div>
  );
}

export default App;
