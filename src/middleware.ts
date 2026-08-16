import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = guard(request);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

function guard(request: NextRequest) {
  const username = process.env.APP_USERNAME;
  const password = process.env.APP_PASSWORD;
  const path = request.nextUrl.pathname;
  if (!username || !password || path.startsWith("/api/elevenlabs/webhook") || path.startsWith("/api/cron/")) return NextResponse.next();
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const [candidateUser, candidatePassword] = atob(auth.slice(6)).split(":", 2);
      if (candidateUser === username && candidatePassword === password) return NextResponse.next();
    } catch {
      // Fall through to the challenge response.
    }
  }
  return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="FieldBrief", charset="UTF-8"' } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
