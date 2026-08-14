import { NextRequest, NextResponse } from "next/server";

const SCOPES = "https://www.googleapis.com/auth/drive.file";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  if (!clientId) {
    return new Response(
      "Google Drive is not configured yet (missing GOOGLE_DRIVE_CLIENT_ID).",
      { status: 500 },
    );
  }
  const origin = new URL(req.url).origin;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/drive/callback`,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
