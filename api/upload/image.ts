export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') || formData.get('image');

    if (!file || typeof file === 'string') {
      return new Response(JSON.stringify({ success: false, message: 'No valid image file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME || 'flicks-india-storage';
    const apiKey = process.env.BUNNY_STORAGE_API_KEY;
    const pullZone = process.env.BUNNY_STORAGE_PULL_ZONE || 'https://flicks-india-storage.b-cdn.net';

    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, message: 'Missing Bunny Storage API Key in environment variables' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const originalName = file.name || 'upload.jpg';
    const fileName = `${Date.now()}-${originalName.replace(/\s+/g, '_')}`;
    const uploadUrl = `https://storage.bunnycdn.com/${storageZone}/${fileName}`;

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
      const errText = await bunnyRes.text();
      throw new Error(`Bunny Storage failed (${bunnyRes.status}): ${errText}`);
    }

    const publicUrl = `${pullZone}/${fileName}`;

    return new Response(JSON.stringify({ success: true, url: publicUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Bunny Upload Error:', error);
    return new Response(JSON.stringify({ success: false, message: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}