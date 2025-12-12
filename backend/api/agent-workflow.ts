import { VercelRequest, VercelResponse } from "@vercel/node";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import { requireGitHubToken, requireOpenAiApiKey } from "./utils/auth";

interface AgentTask {
  id: string;
  role: string;
  objective: string;
}

interface ProposedChangeOutline {
  path: string;
  summary: string;
  rationale?: string;
}

interface AgentFinding {
  role: string;
  summary: string;
  proposedChanges: ProposedChangeOutline[];
  risks: string[];
  testPlan: string[];
  confidence: number;
}

interface AgentWorkflowResponse {
  agents: AgentFinding[];
  recommendedTests: string[];
  notes?: string[];
}

const agentTasks: AgentTask[] = [
  {
    id: "research",
    role: "Research Agent",
    objective:
      "Perform grounded research on the request, summarize relevant context from the repo files, and cite which files/areas you would study to gain clarity.",
  },
  {
    id: "generation",
    role: "Generation Agent",
    objective:
      "Draft new or revised code to address the request using the supported language set. Focus on correctness and completeness while keeping the diff minimal.",
  },
  {
    id: "revision",
    role: "Revision Agent",
    objective:
      "Review the proposed implementation for potential regressions and highlight any refinements to improve readability or maintainability.",
  },
  {
    id: "feature",
    role: "Feature Expansion Agent",
    objective:
      "Identify small, high-impact enhancements related to the prompt that could be delivered in the same change safely.",
  },
  {
    id: "qa",
    role: "Quality Agent",
    objective:
      "Validate logic, edge cases, and API contracts. Flag ambiguous requirements and provide acceptance criteria.",
  },
  {
    id: "tests",
    role: "Testing Agent",
    objective:
      "Design targeted, automated tests and quick manual checks to verify the change before commit.",
  },
];

const agentPrompt = (
  task: AgentTask,
  languages: string[],
  userPrompt: string,
  fileContext: string
) => `You are the ${task.role} working inside a multi-agent swarm. Stay concise and structured.\n\n` +
  `User request:\n${userPrompt}\n\n` +
  `Repository context (only what is provided):\n${fileContext || "No files were selected"}\n\n` +
  `Supported languages for implementation: ${languages.join(", ")}.\n` +
  `${task.objective}\n` +
  "Respond only as JSON with the shape:\n" +
  `{\n"role": "${task.role}",\n"summary": "one or two sentences",\n"proposedChanges": [{"path": "string", "summary": "string", "rationale": "string (optional)"}],\n"risks": ["string"],\n"testPlan": ["string"],\n"confidence": 0.0 // between 0 and 1\n}`;

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { owner, repo, baseBranch, filePaths = [], userPrompt } = req.body ?? {};
  if (!owner || !repo || !baseBranch || !userPrompt || !Array.isArray(filePaths)) {
    res.status(400).json({ error: "owner, repo, baseBranch, userPrompt, and filePaths are required" });
    return;
  }

  const token = requireGitHubToken(req, res);
  if (!token) return;

  try {
    const octokit = new Octokit({ auth: token });
    const openAiApiKey = requireOpenAiApiKey(req, res);
    if (!openAiApiKey) return;
    const openai = new OpenAI({ apiKey: openAiApiKey });

    const fileContents: string[] = [];

    for (const path of filePaths) {
      const { data } = await octokit.repos.getContent({ owner, repo, path, ref: baseBranch });
      if (!("content" in data) || typeof data.content !== "string") {
        throw new Error(`Unable to read file: ${path}`);
      }
      const content = Buffer.from(data.content, "base64").toString("utf8");
      fileContents.push(`FILE: ${path}\n${content}`);
    }

    const condensedContext = fileContents.join("\n\n");

    const runAgent = async (task: AgentTask): Promise<AgentFinding> => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: agentPrompt(task, supportedLanguages, userPrompt, condensedContext) },
          { role: "user", content: "Generate your JSON report." },
        ],
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error(`${task.role} returned an empty response`);
      }

      const parsed = JSON.parse(content) as AgentFinding;
      return {
        role: task.role,
        summary: parsed.summary ?? "",
        proposedChanges: parsed.proposedChanges ?? [],
        risks: parsed.risks ?? [],
        testPlan: parsed.testPlan ?? [],
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      };
    };

    const agentPromises = agentTasks.map((task) => runAgent(task));

    const results = await Promise.all(agentPromises);

    const aggregatedTests = Array.from(
      new Set(results.flatMap((agent) => agent.testPlan.filter((item) => typeof item === "string" && item.trim())))
    );

    const response: AgentWorkflowResponse = {
      agents: results,
      recommendedTests: aggregatedTests,
      notes: [
        "Agents run concurrently to cross-validate proposals before commit.",
        "Use the recommended tests to gate the commit and pull request steps.",
      ],
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error(error);
    res.status(error.status ?? 500).json({ error: error.message ?? "Failed to orchestrate agents" });
  }
}
