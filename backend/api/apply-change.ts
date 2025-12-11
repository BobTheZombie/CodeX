import { VercelRequest, VercelResponse } from "@vercel/node";
import { Octokit } from "@octokit/rest";
import { requireGitHubToken } from "./utils/auth";

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

  const token = requireGitHubToken(req, res);
  if (!token) return;

  try {
    const octokit = new Octokit({ auth: token });

    const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
    const baseCommitSha = baseRef.data.object.sha;
    const baseCommit = await octokit.git.getCommit({ owner, repo, commit_sha: baseCommitSha });

    try {
      await octokit.git.getRef({ owner, repo, ref: `heads/${newBranchName}` });
      res
        .status(400)
        .json({ error: `Branch ${newBranchName} already exists. Please choose a different branch name.` });
      return;
    } catch (error: any) {
      if (error.status !== 404) {
        throw error;
      }
    }

    const treeItems = [] as Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }>;

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

    let commit: Awaited<ReturnType<typeof octokit.git.createCommit>>;
    try {
      const tree = await octokit.git.createTree({
        owner,
        repo,
        base_tree: baseCommit.data.tree.sha,
        tree: treeItems,
      });

      commit = await octokit.git.createCommit({
        owner,
        repo,
        message: commitMessage,
        tree: tree.data.sha,
        parents: [baseCommitSha],
      });
    } catch (error: any) {
      console.error(error);
      res.status(error.status ?? 500).json({ error: error.message ?? "Failed to create commit" });
      return;
    }

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
