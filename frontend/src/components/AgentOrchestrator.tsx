import React from "react";

export interface ProposedChangeOutline {
  path: string;
  summary: string;
  rationale?: string;
}

export interface AgentFinding {
  role: string;
  summary: string;
  proposedChanges: ProposedChangeOutline[];
  risks: string[];
  testPlan: string[];
  confidence: number;
}

export interface AgentWorkflowResult {
  agents: AgentFinding[];
  recommendedTests: string[];
  notes?: string[];
}

interface AgentOrchestratorProps {
  result: AgentWorkflowResult | null;
  onRun: () => void;
  disabled?: boolean;
  isRunning?: boolean;
  error?: string | null;
}

const formatPercent = (value: number) => `${Math.max(0, Math.min(1, value)) * 100}%`;

const AgentOrchestrator: React.FC<AgentOrchestratorProps> = ({
  result,
  onRun,
  disabled = false,
  isRunning = false,
  error,
}) => {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h3>Multi-agent planning</h3>
          <p style={{ marginBottom: "0.5rem" }}>
            Launch concurrent research, coding, revision, quality, and testing agents. Each agent proposes code changes and test
            steps so you can validate before committing.
          </p>
        </div>
        <button onClick={onRun} disabled={disabled || isRunning}>
          {isRunning ? "Running agents..." : "Run agents"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {result && (
        <div style={{ marginTop: "1rem", display: "grid", gap: "1rem" }}>
          {result.agents.map((agent) => (
            <div key={agent.role} className="card" style={{ background: "var(--muted-bg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                <div>
                  <h4 style={{ margin: 0 }}>{agent.role}</h4>
                  <div style={{ fontSize: "0.9rem", color: "var(--muted-text)" }}>Confidence: {formatPercent(agent.confidence)}
                  </div>
                </div>
                <div style={{ minWidth: "8rem", textAlign: "right" }}>
                  <strong>Risks</strong>
                  <ul style={{ margin: 0 }}>
                    {agent.risks.length === 0 && <li>None noted</li>}
                    {agent.risks.map((risk, index) => (
                      <li key={index}>{risk}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p style={{ marginTop: "0.5rem" }}>{agent.summary}</p>
              {agent.proposedChanges.length > 0 && (
                <div>
                  <strong>Proposed changes</strong>
                  <ul>
                    {agent.proposedChanges.map((change, index) => (
                      <li key={`${agent.role}-change-${index}`}>
                        <code>{change.path}</code>: {change.summary}
                        {change.rationale && <span style={{ color: "var(--muted-text)" }}> — {change.rationale}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {agent.testPlan.length > 0 && (
                <div>
                  <strong>Tests</strong>
                  <ul>
                    {agent.testPlan.map((test, index) => (
                      <li key={`${agent.role}-test-${index}`}>{test}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}

          {result.recommendedTests.length > 0 && (
            <div className="card" style={{ background: "var(--muted-bg)" }}>
              <h4 style={{ marginTop: 0 }}>Aggregated pre-commit checks</h4>
              <ul>
                {result.recommendedTests.map((test, index) => (
                  <li key={`agg-test-${index}`}>{test}</li>
                ))}
              </ul>
            </div>
          )}

          {result.notes && result.notes.length > 0 && (
            <div className="card" style={{ background: "var(--muted-bg)" }}>
              <h4 style={{ marginTop: 0 }}>Notes</h4>
              <ul>
                {result.notes.map((note, index) => (
                  <li key={`note-${index}`}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentOrchestrator;
