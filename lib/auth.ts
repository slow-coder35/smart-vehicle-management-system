import { randomBytes, createHash } from "node:crypto";
import { query } from "./db";
import type { User, Role } from "./types";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_ERROR",
  ) {
    super(message);
  }
}
export const hashToken = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export async function userFromRequest(req: Request): Promise<User | null> {
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("motive_session="))
    ?.split("=")[1];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await query<User & { [key: string]: unknown }>(
    "SELECT u.id,u.name,u.email,u.role,u.centre_id,c.name centre_name FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN service_centres c ON c.id=u.centre_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active",
    [hashToken(token)],
  );
  return rows[0] ?? null;
}
export function requireRole(user: User, ...roles: Role[]) {
  if (!roles.includes(user.role))
    throw new ApiError(
      403,
      "Your role cannot perform this action.",
      "FORBIDDEN",
    );
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await query(
    "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '24 hours')",
    [userId, hashToken(token)],
  );
  return `motive_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${process.env.NODE_ENV === "production" && !process.env.APP_ORIGIN?.startsWith("http://localhost") ? "; Secure" : ""}`;
}
export function assertOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const expected = process.env.APP_ORIGIN || "http://localhost:3000";
  if (req.headers.get("origin") !== expected)
    throw new ApiError(403, "Request origin is not allowed.", "ORIGIN_DENIED");
}
const attempts = new Map<string, { count: number; until: number }>();
export function limitAuth(key: string) {
  const now = Date.now();
  if (attempts.size > 10000)
    for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  const a = attempts.get(key);
  if (!a || a.until < now) {
    attempts.set(key, { count: 1, until: now + 15 * 60000 });
    return;
  }
  a.count++;
  if (a.count > 30)
    throw new ApiError(
      429,
      "Too many attempts. Try again in 15 minutes.",
      "RATE_LIMITED",
    );
}
