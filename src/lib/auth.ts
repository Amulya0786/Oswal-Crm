import { SignJWT, jwtVerify } from "jose";

export type SessionPayload = { uid: string; role: string };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.uid)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const uid = typeof payload.uid === "string" ? payload.uid : payload.sub;
    const role = payload.role;
    if (!uid || typeof role !== "string") return null;
    return { uid, role };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "oswal_session";
