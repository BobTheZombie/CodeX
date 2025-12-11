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

  try {
    const octokit = new Octokit({ auth: ensureGitHubToken() });
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
