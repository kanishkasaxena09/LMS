import { type NextRequest, NextResponse } from "next/server";
import { AuthenticationError, requireAuthenticatedUser } from "@/lib/auth";
import { CSRF_HEADER_NAME, validateCsrfToken } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { changePatronPassword, changeStaffPassword } from "@/services/auth";

export async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuthenticatedUser(undefined, { request: req });
    const body = await req.json().catch(() => ({}));
    const submittedCsrf = req.headers.get(CSRF_HEADER_NAME) ?? body.csrfToken;

    // CSRF Guard (FR-AU-07, NFR-S-04)
    if (!validateCsrfToken(authContext.session.csrfToken, submittedCsrf)) {
      return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 });
    }

    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Both current and new password are required" },
        { status: 400 },
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

    if ("user" in authContext) {
      // Staff user
      const result = await changeStaffPassword({
        userId: authContext.user.id,
        currentPassword,
        newPassword,
        ipAddress,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "Password updated successfully" });
    }

    if ("patron" in authContext) {
      // Patron user
      const result = await changePatronPassword({
        patronId: authContext.patron.id,
        currentPassword,
        newPassword,
        ipAddress,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "Password updated successfully" });
    }

    return NextResponse.json({ error: "Invalid session user type" }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    logger.error({ err }, "Change password route failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
