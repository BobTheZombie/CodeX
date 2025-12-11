import { VercelRequest, VercelResponse } from "@vercel/node";
import { Octokit } from "@octokit/rest";

const ensureGitHubToken = () => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not set");
  }
  return token;
};

interface Change {
  path: string;
  operation: "create" | "modify" | "delete";
  contents?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { owner, repo, baseBranch, newBranchName, changes = [], commitMessage, openPullRequest } = req.body ?? {};

  if (!owner || !repo || !baseBranch || !newBranchName || !commitMessage || !Array.isArray(changes)) {
    res.status(400).json({ error: "owner, repo, baseBranch, newBranchName, commitMessage, and changes are required" });
    return;
  }

  try {
    const octokit = new Octokit({ auth: ensureGitHubToken() });

    const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
    const baseCommitSha = baseRef.data.object.sha;
    const baseCommit = await octokit.git.getCommit({ owner, repo, commit_sha: baseCommitSha });

    const treeItems = [] as Array<{ path: string; mode: string; type: "blob"; sha: string | null }>;

    for (const change of changes as Change[]) {
      if (change.operation === "delete") {
        treeItems.push({ path: change.path, mode: "100644", type: "blob", sha: null });
        continue;
      }
      const blob = await octokit.git.createBlob({
        owner,
        repo,
        content: change.contents ?? "",
        encoding: "utf-8",
      });
      treeItems.push({ path: change.path, mode: "100644", type: "blob", sha: blob.data.sha });
    }

    const tree = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseCommit.data.tree.sha,
      tree: treeItems,
    });

    const commit = await octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: tree.data.sha,
      parents: [baseCommitSha],
    });

    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranchName}`,
      sha: commit.data.sha,
    });

    let pullRequestUrl: string | null = null;
    if (openPullRequest) {
      const pr = await octokit.pulls.create({
        owner,
        repo,
        head: newBranchName,
        base: baseBranch,
        title: commitMessage,
      });
      pullRequestUrl = pr.data.html_url;
    }

    res.status(200).json({ branch: newBranchName, commitSha: commit.data.sha, pullRequestUrl });
  } catch (error: any) {
    console.error(error);
    res.status(error.status ?? 500).json({ error: error.message ?? "Failed to apply changes" });
  }
}
