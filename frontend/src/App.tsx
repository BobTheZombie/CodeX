import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import RepoSelector, { RepoSummary } from "./components/RepoSelector";
import FileSelector from "./components/FileSelector";
import PromptPanel from "./components/PromptPanel";
import ChangePreview, { ProposedChangeSet } from "./components/ChangePreview";
import AgentOrchestrator, { AgentWorkflowResult } from "./components/AgentOrchestrator";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
const authRedirectUri = `${apiBase}/api/auth/callback`;
const supportedLanguages = [
  "C",
  "C++",
  "Python",
  "Rust",
  "Lua",
  "XML",
  "Java",
  "Bash",
  "Perl",
  "Assembly",
  "HTML",
  "HTML5",
];

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
  const [hasOpenAiKey, setHasOpenAiKey] = useState(false);
  const [openAiKey, setOpenAiKey] = useState("");
  const [openAiError, setOpenAiError] = useState<string | null>(null);
  const [agentResult, setAgentResult] = useState<AgentWorkflowResult | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [isRunningAgents, setIsRunningAgents] = useState(false);
  const [hasGitHubToken, setHasGitHubToken] = useState(false);
  const [githubTokenInput, setGithubTokenInput] = useState("");
  const [githubError, setGithubError] = useState<string | null>(null);

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

  const loadRepos = useCallback(async () => {
    try {
      setRepoError(null);
      const data = await postJson<RepoSummary[]>("/api/list-repos");
      setRepos(data);
      setHasGitHubToken(true);
    } catch (error: any) {
      if (error.status === 401) {
        setRepoError("Please log in with GitHub or paste a token to continue.");
        setHasGitHubToken(false);
      } else {
        setRepoError(error.message ?? "Failed to load repositories");
      }
    }
  }, []);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  useEffect(() => {
    const fetchGitHubStatus = async () => {
      try {
        setGithubError(null);
        const response = await fetch(`${apiBase}/api/auth/github-token`, { credentials: "include" });
        if (!response.ok) {
          throw new Error("Failed to verify GitHub login");
        }
        const data = (await response.json()) as { hasToken?: boolean };
        setHasGitHubToken(Boolean(data.hasToken));
      } catch (error: any) {
        setGithubError(error.message ?? "Failed to verify GitHub login");
      }
    };

    fetchGitHubStatus();
  }, []);

  useEffect(() => {
    const fetchOpenAiStatus = async () => {
      try {
        setOpenAiError(null);
        const response = await fetch(`${apiBase}/api/auth/openai-key`, { credentials: "include" });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || response.statusText);
        }
        const data = (await response.json()) as { hasApiKey?: boolean };
        setHasOpenAiKey(Boolean(data.hasApiKey));
      } catch (error: any) {
        setOpenAiError(error.message ?? "Failed to verify OpenAI login");
      }
    };

    fetchOpenAiStatus();
  }, []);

  const handleOpenAiSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!openAiKey.trim()) {
      setOpenAiError("Please paste your OpenAI API key.");
      return;
    }

    try {
      setOpenAiError(null);
      const response = await fetch(`${apiBase}/api/auth/openai-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apiKey: openAiKey.trim() }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || response.statusText);
      }

      setHasOpenAiKey(true);
      setOpenAiKey("");
    } catch (error: any) {
      setOpenAiError(error.message ?? "Failed to store OpenAI API key");
    }
  };

  const handleOpenAiLogout = async () => {
    try {
      const response = await fetch(`${apiBase}/api/auth/openai-key`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || response.statusText);
      }

      setHasOpenAiKey(false);
    } catch (error: any) {
      setOpenAiError(error.message ?? "Failed to remove OpenAI API key");
    }
  };

  const handleGitHubTokenSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!githubTokenInput.trim()) {
      setGithubError("Please paste a GitHub Personal Access Token.");
      return;
    }

    try {
      setGithubError(null);
      const response = await fetch(`${apiBase}/api/auth/github-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: githubTokenInput.trim() }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || response.statusText);
      }

      setHasGitHubToken(true);
      setGithubTokenInput("");
      await loadRepos();
    } catch (error: any) {
      setGithubError(error.message ?? "Failed to store GitHub token");
    }
  };

  const handleGitHubLogout = async () => {
    try {
      const response = await fetch(`${apiBase}/api/auth/github-token`, { method: "DELETE", credentials: "include" });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || response.statusText);
      }
      setHasGitHubToken(false);
      setRepos([]);
      setSelectedRepo(null);
    } catch (error: any) {
      setGithubError(error.message ?? "Failed to clear GitHub token");
    }
  };

  const handleGenerate = async () => {
    if (!selectedRepo || !baseBranch || !userPrompt) return;
    setIsGenerating(true);
    setChangeSet(null);
    setApplyResult(null);
    setAgentResult(null);
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

  const handleRunAgents = async () => {
    if (!selectedRepo || !baseBranch || !userPrompt) return;
    setIsRunningAgents(true);
    setAgentError(null);
    setAgentResult(null);
    try {
      const response = await postJson<AgentWorkflowResult>("/api/agent-workflow", {
        owner: selectedRepo.fullName.split("/")[0],
        repo: selectedRepo.name,
        baseBranch,
        filePaths: selectedFiles,
        userPrompt,
      });
      setAgentResult(response);
    } catch (error: any) {
      setAgentError(error.message ?? "Failed to run agent swarm");
    } finally {
      setIsRunningAgents(false);
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
      <div className="card notice">
        <h3>Unlimited prompt flow</h3>
        <p style={{ margin: 0 }}>
          This interface mirrors the original Codex-style workflow without imposing 5-hour, weekly, or monthly
          caps. You can iterate freely; usage is only bound by your own OpenAI and GitHub account quotas.
        </p>
      </div>
      <div className="card" style={{ display: "flex", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3>Authentication</h3>
          <p style={{ marginBottom: "0.5rem" }}>
            Sign in with GitHub or paste a Personal Access Token to list repositories and apply commits directly from CodeX.
          </p>
          <form onSubmit={handleGitHubTokenSubmit} className="flex-row" style={{ gap: "0.5rem", alignItems: "center" }}>
            <input
              type="password"
              placeholder="ghp_..."
              value={githubTokenInput}
              onChange={(e) => setGithubTokenInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit">Save Token</button>
            <button type="button" onClick={handleGitHubLogout} disabled={!hasGitHubToken}>
              Remove token
            </button>
          </form>
          {hasGitHubToken && <div style={{ marginTop: "0.25rem" }}>GitHub access is configured.</div>}
          {githubError && <div className="error">{githubError}</div>}
        </div>
        <button onClick={handleLogin} disabled={!authorizeUrl}>
          Login with GitHub
        </button>
      </div>

      <div className="card" style={{ display: "flex", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <h3>OpenAI Account</h3>
          <p style={{ marginBottom: "0.5rem" }}>
            Log in to your OpenAI account and paste an API key so Codex can generate changes on your behalf.
            You can create or view keys on the
            <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noreferrer"> OpenAI API keys page</a>.
          </p>
          <form onSubmit={handleOpenAiSubmit} className="flex-row" style={{ gap: "0.5rem", alignItems: "center" }}>
            <input
              type="password"
              placeholder="sk-..."
              value={openAiKey}
              onChange={(e) => setOpenAiKey(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit">Save API Key</button>
            <button type="button" onClick={handleOpenAiLogout} disabled={!hasOpenAiKey}>
              Remove key
            </button>
          </form>
          {hasOpenAiKey && <div style={{ marginTop: "0.25rem" }}>OpenAI API key is stored for this browser.</div>}
          {openAiError && <div className="error">{openAiError}</div>}
        </div>
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
            setAgentResult(null);
            setAgentError(null);
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
            disabled={isGenerating || !baseBranch || !hasOpenAiKey}
            supportedLanguages={supportedLanguages}
          />
          {applyError && <div className="error">{applyError}</div>}
        </div>
      )}

      {selectedRepo && (
        <AgentOrchestrator
          onRun={handleRunAgents}
          result={agentResult}
          disabled={!hasOpenAiKey || !userPrompt || !baseBranch}
          isRunning={isRunningAgents}
          error={agentError}
        />
      )}

      {changeSet && (
        <div className="card">
          <ChangePreview
            changeSet={changeSet}
            onChange={(updatedChangeSet) => setChangeSet(updatedChangeSet)}
            onApply={handleApply}
            applyResult={applyResult}
          />
        </div>
      )}
    </div>
  );
}

export default App;
