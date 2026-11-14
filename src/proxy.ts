// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createCustomServerClient } from "@/utils/supabase/server";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  // Initialize Supabase server client with cookie handling
  const supabase = await createCustomServerClient();

  // Read the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = req.nextUrl.clone();

  // If not authenticated and not on login page, redirect
  if (!user && url.pathname !== "/login") {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If authenticated and on login page, redirect
  if (user && url.pathname === "/login") {
    url.pathname = "/calendar";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
