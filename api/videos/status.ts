type VideoStatusRequest = {
  method?: string;
  body?: { videoId?: unknown };
};

type VideoStatusResponse = {
  status: (statusCode: number) => VideoStatusResponse;
  send: (body: unknown) => void;
};

type BunnyVideoStatus = {
  guid?: string;
  status?: number;
  encodeProgress?: number;
  availableResolutions?: string | string[];
  message?: string;
  errorMessage?: string;
};

export default async function handler(req: VideoStatusRequest, res: VideoStatusResponse) {
  if (req.method !== "POST") {
    res.status(405).send({ message: "Method not allowed" });
    return;
  }

  const videoId = typeof req.body?.videoId === "string" ? req.body.videoId.trim() : "";
  if (!/^[\w-]{8,64}$/.test(videoId)) {
    res.status(400).send({ message: "A valid Bunny Stream video ID is required" });
    return;
  }

  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID || "795734";
  const apiKey = process.env.BUNNY_STREAM_API_KEY?.trim();
  if (!apiKey) {
    res.status(500).send({ message: "Missing Bunny Stream API Key in environment variables" });
    return;
  }

  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(videoId)}`,
      {
        method: "GET",
        headers: { AccessKey: apiKey, Accept: "application/json" },
      },
    );
    const responseText = await response.text();
    let data: BunnyVideoStatus = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      if (response.ok) {
        console.error("Bunny Stream status returned invalid JSON:", responseText);
        res.status(502).send({ message: "Bunny Stream returned an invalid status response" });
        return;
      }
    }

    if (!response.ok) {
      const message = data.message || responseText || "Could not read Bunny Stream video status";
      console.error("Bunny Stream status request failed:", { status: response.status, videoId, message });
      res.status(response.status).send({ message });
      return;
    }

    const hasAvailableResolutions = Array.isArray(data.availableResolutions)
      ? data.availableResolutions.length > 0
      : Boolean(data.availableResolutions?.trim());
    const failed = data.status === 5;

    res.status(200).send({
      videoId: data.guid || videoId,
      status: data.status ?? null,
      encodeProgress: Number.isFinite(data.encodeProgress) ? data.encodeProgress : null,
      availableResolutions: data.availableResolutions || null,
      ready: data.status === 4 || hasAvailableResolutions,
      failed,
      message: failed
        ? data.errorMessage || data.message || "Bunny Stream could not encode this video."
        : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not read Bunny Stream video status";
    console.error("Bunny Stream status check error:", message);
    res.status(502).send({ message });
  }
}
