# AI Codex Web App

This repository hosts a minimal end-to-end “Codex-style” experience with:

- **Frontend**: React + Vite single-page app deployed to GitHub Pages.
- **Backend**: Node.js + TypeScript serverless API designed for Vercel.
- **Capabilities**: Uses OpenAI for code generation plus GitHub read/write access to list repositories, inspect files, generate change plans, and apply them by creating branches/commits (with optional PRs).

## Project Structure

```
backend/          # Vercel serverless functions (TypeScript)
  api/            # API endpoints
frontend/         # React + Vite frontend for GitHub Pages
.github/workflows # GitHub Actions for Pages deployment
```

## Backend (Vercel) Setup

1. Create a new Vercel project and point the **Root Directory** to `backend`.
2. Ensure "Framework Preset" is set to **Other** (functions only).
3. Add environment variables:
   - `OPENAI_API_KEY`: OpenAI API key.
   - `GITHUB_TOKEN`: Personal Access Token with `repo` scope (or swap to a GitHub App token later).
4. Deploy. The API endpoints will be exposed under `/api/*`.

### Local development

```bash
cd backend
npm install
npm run dev   # runs vercel dev
```

## Frontend (GitHub Pages) Setup

1. In repo settings, enable GitHub Pages to serve from the `gh-pages` branch.
2. On pushes to `main`, the provided workflow builds `frontend` and publishes `frontend/dist` to `gh-pages`.
3. Configure the frontend to talk to the backend by setting a repository secret used at build-time, e.g. add to the GitHub Actions environment:
   - `VITE_API_BASE_URL=https://<your-vercel-app>.vercel.app`

### Local development

```bash
cd frontend
npm install
npm run dev
```

## API Overview

- `POST /api/list-repos` — lists repositories accessible by the token.
- `POST /api/list-files` — lists files/directories at a given path and ref.
- `POST /api/generate-change` — fetches file contents and asks OpenAI to propose JSON-formatted changes + commit message.
- `POST /api/apply-change` — creates a branch, commits blobs/trees for the proposed changes, and optionally opens a PR.

## Environment Variables

Backend (Vercel):
- `OPENAI_API_KEY`
- `GITHUB_TOKEN`

Frontend (build-time):
- `VITE_API_BASE_URL` — base URL of the deployed backend (e.g., `https://your-api.vercel.app`).

## Usage Flow

1. Choose a repository and base branch.
2. Browse/select files to use as context.
3. Enter a prompt describing the desired change and generate a proposal.
4. Review the proposed file contents and commit message.
5. Apply the changes by creating a branch/commit and optionally a pull request.

## Notes

- The frontend never stores secrets; all secret usage is in the backend via environment variables.
- The backend is written to be swapped to a GitHub App token in the future without significant changes.
- The experience is designed to mirror Codex without app-level prompt caps (no hourly, weekly, or monthly limits beyond your own
  API quotas).
