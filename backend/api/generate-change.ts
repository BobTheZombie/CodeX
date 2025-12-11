import { VercelRequest, VercelResponse } from "@vercel/node";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";

const ensureEnv = () => {
  const githubToken = process.env.GITHUB_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!githubToken) {
    throw new Error("GITHUB_TOKEN is not set");
  }
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return { githubToken, openaiKey };
};

const systemPrompt = `You are an expert software engineer assistant. Return ONLY JSON with the shape:\n{\n  "changes": [\n    {\n      "path": "string",\n      "operation": "create" | "modify" | "delete",\n      "contents": "string"\n    }\n  ],\n  "commitMessage": "string"\n}\n- Include full file contents for create/modify.\n- Do not include Markdown.\n- Keep the response concise.`;

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

  try {
    const { githubToken, openaiKey } = ensureEnv();
    const octokit = new Octokit({ auth: githubToken });
    const openai = new OpenAI({ apiKey: openaiKey });

    const fileContents: string[] = [];

    for (const path of filePaths) {
      const { data } = await octokit.repos.getContent({ owner, repo, path, ref: baseBranch });
      if (!("content" in data) || typeof data.content !== "string") {
        throw new Error(`Unable to read file: ${path}`);
      }
      const content = Buffer.from(data.content, "base64").toString("utf8");
      fileContents.push(`FILE: ${path}\n${content}`);
    }

    const prompt = [
      "You will propose code changes.",
      "Existing files:",
      fileContents.join("\n\n"),
      "User instructions:",
      userPrompt,
    ].join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("OpenAI returned an empty response");
    }

    res.status(200).send(raw);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message ?? "Failed to generate changes" });
  }
}
