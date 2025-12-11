import { useEffect, useState } from "react";
import { RepoSummary } from "./RepoSelector";

interface Entry {
  type: "file" | "dir";
  name: string;
  path: string;
  size: number;
}

interface Props {
  repo: RepoSummary;
  baseBranch: string;
  selected: string[];
  onChange: (paths: string[]) => void;
}

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

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

const FileSelector = ({ repo, baseBranch, selected, onChange }: Props) => {
  const [path, setPath] = useState<string>("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async (targetPath: string) => {
    if (!baseBranch) return;
    try {
      setError(null);
      const data = await postJson<Entry[]>("/api/list-files", {
        owner: repo.fullName.split("/")[0],
        repo: repo.name,
        path: targetPath,
        ref: baseBranch,
      });
      setEntries(data);
    } catch (err: any) {
      if (err.status === 401) {
        setError("Authentication required. Please log in with GitHub.");
      } else {
        setError(err.message ?? "Failed to load files");
      }
    }
  };

  useEffect(() => {
    load("");
    setPath("");
  }, [repo.fullName, baseBranch]);

  const togglePath = (filePath: string) => {
    if (selected.includes(filePath)) {
      onChange(selected.filter((p) => p !== filePath));
    } else {
      onChange([...selected, filePath]);
    }
  };

  return (
    <div>
      <div className="flex-row" style={{ justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="path">Browse path</label>
          <input
            id="path"
            placeholder="src"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
        </div>
        <button style={{ marginTop: "1.6rem" }} onClick={() => load(path)} disabled={!baseBranch}>
          Load
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <div>
        {entries.length === 0 && <div>No entries.</div>}
        {entries.map((entry) => (
          <div key={entry.path} className="flex-row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{entry.type === "dir" ? "📁" : "📄"}</strong> {entry.path}
            </div>
            {entry.type === "file" && (
              <button onClick={() => togglePath(entry.path)}>
                {selected.includes(entry.path) ? "Remove" : "Add"}
              </button>
            )}
            {entry.type === "dir" && (
              <button onClick={() => load(entry.path)}>Open</button>
            )}
          </div>
        ))}
      </div>
      {selected.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h4>Selected files</h4>
          <ul>
            {selected.map((path) => (
              <li key={path}>
                {path} <button onClick={() => togglePath(path)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileSelector;
