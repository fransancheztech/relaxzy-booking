import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

// The app's only login check, run by Next.js before every page and API route: it refreshes the
// Supabase session, sends signed-out visitors to /login (except /login itself and the /auth email
// links) and signed-in ones from /login to the calendar. See updateSession.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Every path except:
     * - _next/static, _next/image (build files) and favicon.ico
     * - /error (the error page must show to anyone)
     * - images in /public, such as the logo on the login page
     */
    "/((?!_next/static|_next/image|favicon.ico|error|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
