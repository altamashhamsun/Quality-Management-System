import { NextRequest, NextResponse } from "next/server";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Drive is not configured (missing env vars).");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Failed to refresh access token: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

export async function GET(_req: NextRequest) {
  try {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      return NextResponse.json(
        { error: "GOOGLE_DRIVE_FOLDER_ID is not set.", files: [], totalSize: 0 },
        { status: 200 },
      );
    }
    const accessToken = await getAccessToken();
    const q = `'${folderId}' in parents and trashed=false`;
    const fields = "files(id,name,mimeType,size,createdTime,webViewLink)";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${fields}&orderBy=createdTime desc&pageSize=200`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: `Drive API error: ${JSON.stringify(data)}`, files: [], totalSize: 0 },
        { status: 500 },
      );
    }
    const files = (data.files ?? []).map(
      (f: { id: string; name: string; mimeType: string; size?: string; createdTime?: string; webViewLink?: string }) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: Number(f.size ?? 0),
        createdTime: f.createdTime ?? null,
        webViewLink: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
      }),
    );
    const totalSize = files.reduce((sum: number, f: { size: number }) => sum + f.size, 0);
    return NextResponse.json({ files, totalSize });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list files.", files: [], totalSize: 0 },
      { status: 500 },
    );
  }
}
