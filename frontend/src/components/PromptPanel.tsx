interface Props {
  prompt: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  disabled?: boolean;
  supportedLanguages?: string[];
}

const PromptPanel = ({ prompt, onChange, onGenerate, disabled, supportedLanguages }: Props) => {
  const languageList = supportedLanguages?.join(", ");

  return (
    <div>
      <label htmlFor="prompt">Instructions</label>
      <textarea
        id="prompt"
        placeholder="Describe what you want to build or change"
        value={prompt}
        onChange={(e) => onChange(e.target.value)}
      />
      {languageList && (
        <p style={{ marginTop: "0.25rem", fontSize: "0.95rem", color: "#475569" }}>
          Enabled languages: {languageList}
        </p>
      )}
      <button onClick={onGenerate} disabled={disabled}>
        Generate Changes
      </button>
    </div>
  );
};

export default PromptPanel;
