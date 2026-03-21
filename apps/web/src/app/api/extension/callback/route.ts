import { NextResponse } from 'next/server';

const MARKETPLACE_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return new NextResponse('Missing token', { status: 400 });
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
