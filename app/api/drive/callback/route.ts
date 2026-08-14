import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  const error = new URL(req.url).searchParams.get("error");
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

  if (error) {
    return htmlPage("Authorization failed", `<p>Google returned: ${error}</p>`);
  }
  if (!code) return htmlPage("Missing code", "<p>No authorization code received.</p>");
  if (!clientId || !clientSecret) {
    return htmlPage(
      "Not configured",
      "<p>GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET are not set on the server.</p>",
    );
  }

  const origin = new URL(req.url).origin;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/drive/callback`,
      grant_type: "authorization_code",
    }),
  });
  const data = await tokenRes.json();

  if (!tokenRes.ok || !data.refresh_token) {
    return htmlPage(
      "Token exchange failed",
      `<p>Could not get tokens. ${JSON.stringify(data)}</p>`,
    );
  }

  const safeToken = data.refresh_token.replace(/\u0026/g, "&amp;").replace(/</g, "&lt;");
  return htmlPage(
    "Google Drive connected",
    `<p>Connected as <strong>${data.email || "your Google account"}</strong>. The app can now upload photos to your Drive.</p>
     <p>One-time setup: copy the refresh token below and store it in the server env variable <code>GOOGLE_DRIVE_REFRESH_TOKEN</code>, then redeploy.</p>
     <textarea readonly id="tok" rows="4" style="width:100%;font-family:monospace;font-size:12px">${safeToken}</textarea>
     <br/>
     <button onclick="navigator.clipboard.writeText(document.getElementById('tok').value)">Copy token</button>
     <p><a href="/audit">Back to Audit</a></p>`,
  );
}

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head>
     <body style="font-family:system-ui,sans-serif;background:#050507;color:#e4e4e7;padding:2rem">
       <h1>${title}</h1>${body}
     </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
