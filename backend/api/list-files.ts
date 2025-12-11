import { VercelRequest, VercelResponse } from "@vercel/node";
import { Octokit } from "@octokit/rest";

const ensureGitHubToken = () => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not set");
  }
  return token;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { owner, repo, path = "", ref } = req.body ?? {};

  if (!owner || !repo) {
    res.status(400).json({ error: "owner and repo are required" });
    return;
  }

  try {
    const octokit = new Octokit({ auth: ensureGitHubToken() });
    const response = await octokit.repos.getContent({ owner, repo, path, ref });

    if (!Array.isArray(response.data)) {
      res.status(200).json([]);
      return;
    }

    const entries = response.data.map((entry) => ({
      type: entry.type,
      name: entry.name,
      path: entry.path,
      size: entry.size,
    }));

    res.status(200).json(entries);
  } catch (error: any) {
    console.error(error);
    res.status(error.status ?? 500).json({ error: error.message ?? "Failed to list files" });
  }
}
