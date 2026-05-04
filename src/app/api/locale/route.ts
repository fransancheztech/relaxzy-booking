import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const VALID_LOCALES = ["en", "es", "th"];

export async function POST(req: Request) {
  const { locale } = await req.json();
  if (!VALID_LOCALES.includes(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }
  const store = await cookies();
  store.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return NextResponse.json({ ok: true });
}
