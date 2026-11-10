export const config = {
  runtime: 'edge',
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

export default async function handler(req: Request) {
  // Handle CORS preflight (OPTIONS) immediately with 204 No Content
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, message: 'Method not allowed' }, 405);
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') || formData.get('image');

    if (!file || typeof file === 'string') {
      return jsonResponse({ success: false, message: 'No valid image file provided' }, 400);
    }
    if (file.size === 0) {
      return jsonResponse({ success: false, message: 'Uploaded file is empty' }, 400);
    }

    const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME || 'flicks-india-storage';
    const apiKey = process.env.BUNNY_STORAGE_API_KEY?.trim();
    const pullZone = (process.env.BUNNY_STORAGE_PULL_ZONE || 'https://flicksindiacdn.b-cdn.net').replace(/\/+$/, '');

    console.log('[Bunny Storage] API key configured:', Boolean(apiKey), 'length:', apiKey?.length || 0);

    if (!apiKey) {
      return jsonResponse({
        success: false,
        message: 'Missing Bunny Storage API Key in environment variables',
      }, 500);
    }

    const suppliedFileName = formData.get('fileName');
    const originalName = typeof suppliedFileName === 'string' && suppliedFileName.trim()
      ? suppliedFileName
      : file.name || 'upload.bin';
    const safeName = originalName.split(/[\\/]/).pop()?.replace(/[^\w.-]/g, '_') || 'upload.bin';
    const fileName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const uploadUrl = `https://storage.bunnycdn.com/${encodeURIComponent(storageZone)}/${encodeURIComponent(fileName)}`;

    const arrayBuffer = await file.arrayBuffer();

    const bunnyRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: arrayBuffer,
    });

    if (!bunnyRes.ok) {
      console.error('[Bunny Storage] Upload failed with status:', bunnyRes.status);
      return jsonResponse({
        success: false,
        message: `Bunny Storage upload failed (${bunnyRes.status})`,
        upstreamStatus: bunnyRes.status,
      }, 502);
    }

    const publicUrl = `${pullZone}/${fileName}`;

    return jsonResponse({ success: true, url: publicUrl }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Bunny Upload Error:', message);
    return jsonResponse({ success: false, message }, 500);
  }
}