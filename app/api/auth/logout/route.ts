import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getCurrentSession, PATRON_SESSION_COOKIE, STAFF_SESSION_COOKIE } from "@/lib/auth";
import { CSRF_HEADER_NAME, validateCsrfToken } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { logout } from "@/services/auth";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const staffSessionId = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
    const patronSessionId = cookieStore.get(PATRON_SESSION_COOKIE)?.value;
    const sessionId = staffSessionId || patronSessionId;

    if (sessionId) {
      const authContext = await getCurrentSession();
      if (authContext) {
        // Enforce CSRF protection on state-changing logout
        const submittedCsrf = req.headers.get(CSRF_HEADER_NAME);
        if (!validateCsrfToken(authContext.session.csrfToken, submittedCsrf)) {
          return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 });
        }
      }

      const ipAddress =
        req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
      await logout(sessionId, ipAddress);
    }

    const response = NextResponse.json({ success: true, message: "Logged out successfully" });
    response.cookies.delete(STAFF_SESSION_COOKIE);
    response.cookies.delete(PATRON_SESSION_COOKIE);

    return response;
  } catch (err) {
    logger.error({ err }, "Logout route failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
