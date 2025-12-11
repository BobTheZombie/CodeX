interface Props {
  prompt: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  disabled?: boolean;
}

const PromptPanel = ({ prompt, onChange, onGenerate, disabled }: Props) => {
  return (
    <div>
      <label htmlFor="prompt">Instructions</label>
      <textarea
        id="prompt"
        placeholder="Describe what you want to build or change"
        value={prompt}
        onChange={(e) => onChange(e.target.value)}
      />
      <button onClick={onGenerate} disabled={disabled}>
        Generate Changes
      </button>
    </div>
  );
};

export default PromptPanel;
