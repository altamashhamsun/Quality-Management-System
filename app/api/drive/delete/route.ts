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

export async function POST(req: NextRequest) {
  try {
    const body: { ids?: unknown } = await req.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => /^[a-zA-Z0-9_-]+$/.test(String(id)))
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    const accessToken = await getAccessToken();
    let deleted = 0;
    for (const id of ids) {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (res.ok || res.status === 404) deleted++;
    }
    return NextResponse.json({ deleted });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete files." },
      { status: 500 },
    );
  }
}
