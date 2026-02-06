import admin from "@/firebase/firebaseAdmin";
import { NextResponse } from "next/server";

export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  const idToken = match[1];
  let payload: { uid?: string; email?: string } | null = null;
  try {
    payload = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  const uid = payload?.uid;
  const email = (payload?.email || "").toLowerCase();
  if (!uid) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  try {
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (email && adminEmails.includes(email)) {
      return { ok: true, uid, email } as const;
    }
  } catch {
    // ignore env parsing errors
  }

  try {
    const snap = await admin.firestore().doc(`admins/${uid}`).get();
    if (snap.exists) {
      return { ok: true, uid, email } as const;
    }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Server error" }, { status: 500 }),
    } as const;
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  } as const;
}
