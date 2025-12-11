import { VercelRequest, VercelResponse } from "@vercel/node";
import { buildCallbackUrl, getFrontendRedirectUrl, oauthCookie } from "../utils/auth";

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { code, state } = req.query;
  if (!code || Array.isArray(code)) {
    res.status(400).json({ error: "Missing authorization code" });
    return;
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).json({ error: "GitHub OAuth is not configured" });
    return;
  }

  try {
    const redirectUri = buildCallbackUrl(req);

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    });

    const payload = (await tokenResponse.json()) as TokenResponse;
    if (!tokenResponse.ok || !payload.access_token) {
      const message = payload.error_description ?? payload.error ?? "Failed to exchange authorization code";
      res.status(400).json({ error: message });
      return;
    }

    res.setHeader("Set-Cookie", oauthCookie(payload.access_token));

    const redirectTarget = getFrontendRedirectUrl(state);
    res.writeHead(302, { Location: redirectTarget });
    res.end();
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message ?? "GitHub OAuth callback failed" });
  }
}
