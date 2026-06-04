import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = rawCode.trim().toLowerCase();
  const url = new URL("/account", request.url);
  url.searchParams.set("ref", code);

  const response = NextResponse.redirect(url);
  response.cookies.set("dolar_mza_ref", code, {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: true
  });

  return response;
}
