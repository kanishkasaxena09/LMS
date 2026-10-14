import { type NextRequest, NextResponse } from "next/server";
import { AuthenticationError, ForbiddenError, requirePermission } from "@/lib/auth";
import { CSRF_HEADER_NAME, validateCsrfToken } from "@/lib/csrf";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { permission } = body;

    if (!permission) {
      return NextResponse.json({ error: "Permission code is required" }, { status: 400 });
    }

    // Require staff with permission
    const authContext = await requirePermission(permission);

    // CSRF verification on state-changing actions
    const submittedCsrf = req.headers.get(CSRF_HEADER_NAME);
    if (!validateCsrfToken(authContext.session.csrfToken, submittedCsrf)) {
      return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      message: `Access granted for permission: ${permission}`,
      user: authContext.user.username,
      role: authContext.user.roleCode,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof AuthenticationError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    logger.error({ err }, "Permission test route failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
