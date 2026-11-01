import { createHash } from "node:crypto";

type VideoCreateRequest = {
  method?: string;
  body?: { title?: unknown };
};

type VideoCreateResponse = {
  status: (statusCode: number) => VideoCreateResponse;
  send: (body: unknown) => void;
};

export default async function handler(req: VideoCreateRequest, res: VideoCreateResponse) {
  if (req.method !== "POST") {
    res.status(405).send({ message: "Method not allowed" });
    return;
  }

  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID || "795734";
  const apiKey = process.env.BUNNY_STREAM_API_KEY?.trim();
  if (!apiKey) {
    res.status(500).send({ message: "Missing Bunny Stream API Key in environment variables" });
    return;
  }

  try {
    const title = typeof req.body?.title === "string" && req.body.title.trim()
      ? req.body.title.trim()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method: "POST",
        headers: {
          "AccessKey": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      }
    );

    const responseText = await response.text();
    let data: { guid?: string; id?: string; message?: string; error?: string } = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      if (response.ok) {
        console.error("Bunny Stream create video returned invalid JSON:", responseText);
        res.status(502).send({ message: "Bunny Stream returned an invalid response" });
        return;
      }
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || responseText || "Failed to create video";
      console.error("Bunny Stream create video failed:", {
        status: response.status,
        message: errorMessage,
      });
      res.status(response.status).send({ message: errorMessage });
      return;
    }

    const videoId = data.guid || data.id;
    if (!videoId) {
      console.error("Bunny Stream create video response did not include a video ID");
      res.status(502).send({ message: "Bunny Stream did not return a video ID" });
      return;
    }

    const cdnHostname = (process.env.BUNNY_STREAM_CDN_HOSTNAME || "https://vz-7117c555-c5c.b-cdn.net").replace(/\/+$/, "");
    const authorizationExpire = Math.floor(Date.now() / 1000) + 60 * 60;
    const authorizationSignature = createHash("sha256")
      .update(`${libraryId}${apiKey}${authorizationExpire}${videoId}`)
      .digest("hex");
    const hlsUrl = `${cdnHostname}/${videoId}/playlist.m3u8`;
    const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;

    res.status(200).send({
      videoId,
      libraryId,
      hlsUrl,
      embedUrl,
      cdnHostname,
      uploadUrl: "https://video.bunnycdn.com/tusupload",
      authorizationSignature,
      authorizationExpire,
    });
  } catch (error: unknown) {
    console.error("Bunny video creation error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).send({
      message: error instanceof Error ? error.message : "Failed to create video",
    });
  }
}