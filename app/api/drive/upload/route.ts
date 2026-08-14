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
    const { filename, base64, mime } = await req.json();
    if (!filename || !base64) {
      return NextResponse.json(
        { error: "filename and base64 are required" },
        { status: 400 },
      );
    }

    const accessToken = await getAccessToken();
    const buffer = Buffer.from(base64, "base64");

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const metadata: Record<string, unknown> = { name: filename };
    if (folderId) metadata.parents = [folderId];

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], {
        type: "application/json; charset=UTF-8",
      }),
    );
    form.append(
      "file",
      new Blob([buffer], { type: mime || "application/octet-stream" }),
      filename,
    );

    const upRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      },
    );
    const upData = await upRes.json();
    if (!upRes.ok || !upData.id) {
      return NextResponse.json(
        { error: `Upload failed: ${JSON.stringify(upData)}` },
        { status: 500 },
      );
    }

    try {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${upData.id}/permissions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "reader", type: "anyone" }),
        },
      );
    } catch {
      // public permission is best-effort
    }

    return NextResponse.json({
      id: upData.id as string,
      name: upData.name as string,
      webViewLink: (upData.webViewLink as string) ?? "",
      publicLink: `https://drive.google.com/file/d/${upData.id}/view`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
