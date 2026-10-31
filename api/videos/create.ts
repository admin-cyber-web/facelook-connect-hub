import type { VercelRequest, VercelResponse } from "@vercel/node";

const BUNNY_STREAM_LIBRARY_ID = process.env.VITE_BUNNY_STREAM_LIBRARY_ID || "795734";
const BUNNY_STREAM_API_KEY = process.env.VITE_BUNNY_STREAM_API_KEY || "334a6c67-44ac-444e-81a3f47e584e-ac0d-41e5";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send({ error: "Method not allowed" });
    return;
  }

  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos`,
      {
        method: "POST",
        headers: {
          "AccessKey": BUNNY_STREAM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Bunny Stream create video error:", data);
      res.status(response.status).send({ error: data.message || "Failed to create video" });
      return;
    }

    // Build CDN and playback URLs
    const cdnHostname = process.env.VITE_BUNNY_STREAM_CDN_HOSTNAME || "https://vz-7117c555-c5c.b-cdn.net";
    const videoId = data.guid || data.id;
    const hlsUrl = `${cdnHostname}/${videoId}/playlist.m3u8`;
    const embedUrl = `https://iframe.mediadelivery.net/embed/${BUNNY_STREAM_LIBRARY_ID}/${videoId}`;

    res.status(200).send({
      videoId,
      hlsUrl,
      embedUrl,
      cdnHostname,
      uploadUrl: `${cdnHostname}/${videoId}`,
    });
  } catch (error: any) {
    console.error("Bunny video creation error:", error);
    res.status(500).send({ error: error.message || "Failed to create video" });
  }
}