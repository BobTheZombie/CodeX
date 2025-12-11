export interface RepoSummary {
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
}

interface Props {
  repos: RepoSummary[];
  selectedRepo: RepoSummary | null;
  onSelect: (repo: RepoSummary | null) => void;
}

const RepoSelector = ({ repos, selectedRepo, onSelect }: Props) => {
  return (
    <div>
      <label htmlFor="repo">Repository</label>
      <select
        id="repo"
        value={selectedRepo?.fullName ?? ""}
        onChange={(e) => {
          const repo = repos.find((r) => r.fullName === e.target.value) ?? null;
          onSelect(repo);
        }}
      >
        <option value="">Select a repository</option>
        {repos.map((repo) => (
          <option key={repo.fullName} value={repo.fullName}>
            {repo.fullName} {repo.private ? "(private)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
};

export default RepoSelector;
