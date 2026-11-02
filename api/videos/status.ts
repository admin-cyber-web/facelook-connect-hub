type VideoStatusRequest = {
  method?: string;
  body?: { videoId?: unknown; videoIds?: unknown };
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

  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID || "795734";
  const apiKey = process.env.BUNNY_STREAM_API_KEY?.trim();
  if (!apiKey) {
    res.status(500).send({ message: "Missing Bunny Stream API Key in environment variables" });
    return;
  }

  const requestedIds = Array.isArray(req.body?.videoIds)
    ? req.body.videoIds
    : [req.body?.videoId];
  if (requestedIds.length > 30) {
    res.status(400).send({ message: "A maximum of 30 Bunny Stream video IDs can be checked at once" });
    return;
  }
  const videoIds = [...new Set(requestedIds.filter(
    (id): id is string => typeof id === "string" && /^[\w-]{8,64}$/.test(id.trim()),
  ).map((id) => id.trim()))];
  if (!videoIds.length || videoIds.length !== new Set(requestedIds).size) {
    res.status(400).send({ message: "Valid Bunny Stream video IDs are required" });
    return;
  }

  try {
    const statuses = await Promise.all(videoIds.map(async (videoId) => {
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
          if (response.ok) throw new Error("Bunny Stream returned an invalid status response");
        }

        if (!response.ok) {
          const message = data.message || responseText || "Could not read Bunny Stream video status";
          console.error("Bunny Stream status request failed:", { status: response.status, videoId, message });
          return [videoId, { ready: false, failed: false, message }] as const;
        }

        const hasAvailableResolutions = Array.isArray(data.availableResolutions)
          ? data.availableResolutions.length > 0
          : Boolean(data.availableResolutions?.trim());
        const encodeProgress = Number.isFinite(data.encodeProgress) ? data.encodeProgress : null;
        const failed = data.status === 5;
        return [videoId, {
          videoId: data.guid || videoId,
          status: data.status ?? null,
          encodeProgress,
          availableResolutions: data.availableResolutions || null,
          ready: data.status === 4 || (encodeProgress === 100 && hasAvailableResolutions),
          failed,
          message: failed
            ? data.errorMessage || data.message || "Bunny Stream could not encode this video."
            : null,
        }] as const;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Could not read Bunny Stream video status";
        console.error("Bunny Stream status check error:", { videoId, message });
        return [videoId, { ready: false, failed: false, message }] as const;
      }
    }));

    if (Array.isArray(req.body?.videoIds)) {
      res.status(200).send({ statuses: Object.fromEntries(statuses) });
      return;
    }

    const singleStatus = statuses[0]?.[1];
    res.status(200).send(singleStatus);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not read Bunny Stream video status";
    console.error("Bunny Stream status check error:", message);
    res.status(502).send({ message });
  }
}
