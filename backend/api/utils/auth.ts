import { VercelRequest, VercelResponse } from "@vercel/node";

const COOKIE_NAME = "github_token";

const parseCookies = (cookieHeader?: string) => {
  if (!cookieHeader) return {} as Record<string, string>;

  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [key, ...rest] = pair.split("=");
        return [decodeURIComponent(key), decodeURIComponent(rest.join("="))];
      })
  );
};

export const getGitHubToken = (req: VercelRequest): string | null => {
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice("bearer ".length);
  }

  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] ?? null;
};

export const requireGitHubToken = (req: VercelRequest, res: VercelResponse): string | null => {
  const token = getGitHubToken(req);

  if (!token) {
    res.status(401).json({ error: "Missing GitHub token" });
    return null;
  }

  return token;
};

export const buildCallbackUrl = (req: VercelRequest) => {
  const host = req.headers.host;
  const forwardedProto = req.headers["x-forwarded-proto"] as string | undefined;
  const protocol = forwardedProto?.split(",")[0] ?? (host?.includes("localhost") ? "http" : "https");

  if (!host) {
    throw new Error("Unable to determine host for callback URL");
  }

  return process.env.GITHUB_REDIRECT_URI ?? `${protocol}://${host}/api/auth/callback`;
};

export const getFrontendRedirectUrl = (stateParam?: string | string[]) => {
  if (typeof stateParam === "string" && stateParam.trim()) {
    return decodeURIComponent(stateParam);
  }

  return process.env.FRONTEND_APP_URL ?? process.env.FRONTEND_URL ?? "http://localhost:5173";
};

export const oauthCookie = (token: string) => {
  const maxAgeSeconds = 60 * 60 * 24 * 30; // 30 days
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
};
