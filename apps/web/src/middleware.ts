import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

  // Protect /app routes
  if (pathname.startsWith("/app")) {
    if (!token) {
      const signInUrl = new URL("/auth/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Check business access for /app/:businessId/* routes
    const businessIdMatch = pathname.match(/^\/app\/([^\/]+)/);
    if (businessIdMatch && businessIdMatch[1] !== "switch") {
      const requestedBusinessId = businessIdMatch[1];
      
      // TODO: Verify user has access to this business
      // For now, we allow if user is authenticated
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};

