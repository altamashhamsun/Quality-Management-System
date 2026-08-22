import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  const clientId = !!process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = !!process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = !!process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? "";
  const configured = clientId && clientSecret && refreshToken;
  return NextResponse.json({ configured, clientId, clientSecret, refreshToken, folderId });
}
