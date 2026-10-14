import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const authContext = await getCurrentSession();

    if (!authContext) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    if ("user" in authContext) {
      return NextResponse.json({
        authenticated: true,
        userType: "STAFF",
        user: authContext.user,
        permissions: authContext.permissions,
        csrfToken: authContext.session.csrfToken,
      });
    }

    if ("patron" in authContext) {
      return NextResponse.json({
        authenticated: true,
        userType: "PATRON",
        patron: {
          id: authContext.patron.id,
          cardNo: authContext.patron.cardNo,
          rollNo: authContext.patron.rollNo,
          employeeId: authContext.patron.employeeId,
          name: `${authContext.patron.firstName} ${authContext.patron.lastName ?? ""}`.trim(),
          patronType: authContext.patron.patronType,
          mustChangePassword: authContext.patron.mustChangePassword,
        },
        csrfToken: authContext.session.csrfToken,
      });
    }

    return NextResponse.json({ authenticated: false }, { status: 200 });
  } catch (err) {
    logger.error({ err }, "Session lookup route failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
