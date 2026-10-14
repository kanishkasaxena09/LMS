import { type NextRequest, NextResponse } from "next/server";
import { STAFF_SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { loginStaff } from "@/services/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    const ipAddress =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

    const result = await loginStaff({
      username,
      password,
      ipAddress,
    });

    if (!result.success || !result.session) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      user: result.user,
      permissions: result.permissions,
      csrfToken: result.session.csrfToken,
    });

    response.cookies.set(STAFF_SESSION_COOKIE, result.session.id, sessionCookieOptions);

    return response;
  } catch (err) {
    logger.error({ err }, "Staff login route failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
