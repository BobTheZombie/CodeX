import { VercelRequest, VercelResponse } from "@vercel/node";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import { requireGitHubToken, requireOpenAiApiKey } from "./utils/auth";

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

const systemPrompt = `You are an expert software engineer assistant. Return ONLY JSON with the shape:\n{\n  "changes": [\n    {\n      "path": "string",\n      "operation": "create" | "modify" | "delete",\n      "contents": "string"\n    }\n  ],\n  "commitMessage": "string"\n}\n- Include full file contents for create/modify.\n- Do not include Markdown.\n- Keep the response concise.\n- Code generation is enabled for: ${supportedLanguages.join(", ")}.`;

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

    const promptSections = ["You will propose code changes."];

    if (fileContents.length > 0) {
      promptSections.push("Existing files:", fileContents.join("\n\n"));
    }

    promptSections.push("User instructions:", userPrompt);

    const prompt = promptSections.join("\n\n");

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });
    } catch (apiError: any) {
      console.error(apiError);
      res.status(500).json({ error: apiError.message ?? "Failed to generate changes" });
      return;
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("OpenAI returned an empty response");
    }

    try {
      const parsed = JSON.parse(raw);
      res.status(200).json(parsed);
    } catch (parseError) {
      console.error(parseError);
      res.status(500).json({ error: "Invalid JSON from AI" });
    }
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message ?? "Failed to generate changes" });
  }
}
