import { NextResponse } from 'next/server';
import { getValkeyClient } from '@twicely/db/cache';
import { logger } from '@twicely/logger';

const MARKETPLACE_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  // SEC-018: Exchange one-time code for token (never passes JWT in URL)
  const code = searchParams.get('code');
  // Backward compat: also accept direct token (will be removed in next release)
  let token = searchParams.get('token');

  if (code) {
    try {
      const valkey = getValkeyClient();
      const codeKey = `ext-auth-code:${code}`;
      const storedToken = await valkey.get(codeKey);
      if (!storedToken) {
        return new NextResponse('Authorization code expired or invalid', { status: 400 });
      }
      // Delete immediately — one-time use
      await valkey.del(codeKey);
      token = storedToken;
    } catch (err) {
      logger.error('[extension/callback] Failed to exchange auth code', { error: String(err) });
      return new NextResponse('Authorization service temporarily unavailable', { status: 503 });
    }
  }

  if (!token) {
    return new NextResponse('Missing authorization', { status: 400 });
  }

  // Security: Use specific origin for postMessage (not '*'), and use sessionStorage instead of localStorage
  const html = `<!DOCTYPE html>
<html>
<head><title>Twicely Extension Authorization</title></head>
<body>
  <h2>Connecting to Twicely Extension...</h2>
  <p id="status">Sending authorization to extension...</p>
  <script>
    var token = ${JSON.stringify(token)};
    var marketplaceOrigin = ${JSON.stringify(MARKETPLACE_ORIGIN)};
    if (window.opener) {
      window.opener.postMessage({ type: 'TWICELY_EXTENSION_TOKEN', token: token }, marketplaceOrigin);
      document.getElementById('status').textContent = 'Authorization sent! You can close this tab.';
      setTimeout(function() { window.close(); }, 2000);
    } else {
      try {
        sessionStorage.setItem('twicely_extension_token', token);
        document.getElementById('status').textContent = 'Authorization complete! You can close this tab.';
        setTimeout(function() { window.close(); }, 2000);
      } catch (e) {
        document.getElementById('status').textContent = 'Authorization complete. Please close this tab and return to the extension.';
      }
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
