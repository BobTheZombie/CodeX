import { VercelRequest, VercelResponse } from "@vercel/node";
import { oauthCookie, parseCookies } from "../utils/auth";

const COOKIE_NAME = "github_token";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || !token.trim()) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    res.setHeader("Set-Cookie", oauthCookie(token.trim()));
    res.status(200).json({ stored: true });
    return;
  }

  if (req.method === "DELETE") {
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
    );
    res.status(200).json({ stored: false });
    return;
  }

  if (req.method === "GET") {
    const cookies = parseCookies(req.headers.cookie);
    res.status(200).json({ hasToken: Boolean(cookies[COOKIE_NAME]) });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
