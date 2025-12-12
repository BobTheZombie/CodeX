import { FormEvent, useMemo, useState } from "react";

interface Props {
  prompt: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  disabled?: boolean;
  supportedLanguages?: string[];
  selectedFiles?: string[];
  repoName?: string;
  baseBranch?: string;
}

const PromptPanel = ({
  prompt,
  onChange,
  onGenerate,
  disabled,
  supportedLanguages,
  selectedFiles = [],
  repoName,
  baseBranch,
}: Props) => {
  const languageList = supportedLanguages?.join(", ");
  const [objective, setObjective] = useState("Describe the change you want to ship");
  const [requirements, setRequirements] = useState("Be explicit about APIs, UX, and error handling expectations.");
  const [testPlan, setTestPlan] = useState("List commands or acceptance criteria to verify the change.");
  const [error, setError] = useState<string | null>(null);

  const composedPrompt = useMemo(() => {
    const sections = [
      "You are proposing a change for a GitHub repository.",
      objective.trim(),
      requirements.trim(),
    ].filter(Boolean);

    if (selectedFiles.length > 0) {
      sections.push(`Context files to read (${selectedFiles.length}):\n- ${selectedFiles.join("\n- ")}`);
    }

    if (repoName || baseBranch) {
      sections.push(
        [
          repoName ? `Repository: ${repoName}` : null,
          baseBranch ? `Base branch: ${baseBranch}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      );
    }

    if (testPlan.trim()) {
      sections.push(`Tests and acceptance criteria:\n${testPlan.trim()}`);
    }

    return sections.join("\n\n");
  }, [objective, requirements, selectedFiles, repoName, baseBranch, testPlan]);

  const handleCompose = () => {
    setError(null);
    onChange(composedPrompt);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!prompt.trim()) {
      setError("Add instructions before generating changes.");
      return;
    }
    setError(null);
    onGenerate();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.5rem" }}>
      <div className="flex-row" style={{ gap: "1rem", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="objective">Goal</label>
          <input
            id="objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Summarize the task, e.g. 'Add dark mode toggle to navbar'"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="requirements">Details</label>
          <textarea
            id="requirements"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="Important requirements, APIs, design notes, or constraints"
            rows={4}
          />
        </div>
      </div>

      <label htmlFor="tests" style={{ marginBottom: 0 }}>
        Tests & Acceptance Criteria
      </label>
      <textarea
        id="tests"
        value={testPlan}
        onChange={(e) => setTestPlan(e.target.value)}
        placeholder="List commands or behaviors to verify (one per line)"
        rows={3}
      />

      <div className="card" style={{ background: "var(--muted-bg)", margin: 0 }}>
        <div className="flex-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>Prompt preview</strong>
            <p style={{ margin: "0.25rem 0", color: "var(--muted-text)" }}>
              Compose a ready-to-send prompt and edit it directly if needed.
            </p>
          </div>
          <button type="button" onClick={handleCompose}>
            Compose prompt
          </button>
        </div>
        <textarea
          id="prompt"
          placeholder="Describe what you want to build or change"
          value={prompt}
          onChange={(e) => onChange(e.target.value)}
          style={{ marginBottom: 0 }}
        />
        {languageList && (
          <p style={{ marginTop: "0.25rem", fontSize: "0.95rem", color: "#475569" }}>
            Enabled languages: {languageList}
          </p>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="flex-row" style={{ justifyContent: "flex-end" }}>
        <button type="submit" disabled={disabled}>
          Generate Changes
        </button>
      </div>
    </form>
  );
};

export default PromptPanel;
