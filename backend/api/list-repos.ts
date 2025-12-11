import { VercelRequest, VercelResponse } from "@vercel/node";
import { Octokit } from "@octokit/rest";
import { requireGitHubToken } from "./utils/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = requireGitHubToken(req, res);
  if (!token) return;

  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.repos.listForAuthenticatedUser({ per_page: 100 });

    const repos = data.map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
    }));

    res.status(200).json(repos);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message ?? "Failed to list repositories" });
  }
}
