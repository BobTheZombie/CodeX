import { VercelRequest, VercelResponse } from "@vercel/node";
import { clearOpenAiCookie, getOpenAiApiKey, openAiCookie } from "../utils/auth";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    const { apiKey } = req.body ?? {};
    if (typeof apiKey !== "string" || !apiKey.trim()) {
      res.status(400).json({ error: "apiKey is required" });
      return;
    }

    res.setHeader("Set-Cookie", openAiCookie(apiKey.trim()));
    res.status(200).json({ stored: true });
    return;
  }

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearOpenAiCookie());
    res.status(200).json({ stored: false });
    return;
  }

  if (req.method === "GET") {
    const hasApiKey = Boolean(getOpenAiApiKey(req));
    res.status(200).json({ hasApiKey });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
