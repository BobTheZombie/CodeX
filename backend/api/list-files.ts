import { VercelRequest, VercelResponse } from "@vercel/node";
import { Octokit } from "@octokit/rest";
import { requireGitHubToken } from "./utils/auth";

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

  const token = requireGitHubToken(req, res);
  if (!token) return;

  try {
    const octokit = new Octokit({ auth: token });
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
