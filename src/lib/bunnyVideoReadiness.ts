import { apiUrl } from "@/lib/apiUrl";
import { getBunnyVideoId } from "@/hooks/useBunnyVideoStatus";

type VideoRow = {
  author_id?: string | null;
  bunny_ready?: boolean;
  media_url?: string | null;
  video_url?: string | null;
  metadata?: Record<string, unknown> | string | null;
};

type StatusResult = {
  ready?: boolean;
};

export function getPostBunnyVideoId(post: VideoRow): string | null {
  let metadata = post.metadata;
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }
  return getBunnyVideoId(
    post.video_url || post.media_url || "",
    metadata && typeof metadata === "object" ? metadata.bunny_video_id : undefined,
  );
}

export function isBunnyVideoVisibleToViewer(post: VideoRow, viewerId?: string | null): boolean {
  if (!getPostBunnyVideoId(post)) return true;
  if (viewerId && post.author_id === viewerId) return true;
  return post.bunny_ready === true;
}

export async function fetchBunnyVideoReadiness(
  videoIds: string[],
): Promise<Map<string, boolean>> {
  const uniqueIds = [...new Set(videoIds)];
  const readiness = new Map<string, boolean>();
  for (let offset = 0; offset < uniqueIds.length; offset += 30) {
    const batch = uniqueIds.slice(offset, offset + 30);
    try {
      const response = await fetch(apiUrl("/api/videos/status"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds: batch }),
      });
      if (!response.ok) {
        console.warn("[Bunny] Feed readiness check failed:", response.status);
        continue;
      }

      // Read raw text first so empty/HTML/malformed bodies cannot throw an
      // unhandled SyntaxError from response.json(). Handle gracefully instead.
      const responseText = await response.text();
      if (!responseText || !responseText.trim()) {
        console.warn("[Bunny] Feed readiness check failed: empty response body");
        continue;
      }
      if (/^\s*</i.test(responseText)) {
        console.warn("[Bunny] Feed readiness check failed: received HTML instead of JSON");
        continue;
      }
      let result: { statuses?: Record<string, StatusResult> };
      try {
        result = JSON.parse(responseText);
      } catch {
        console.warn(
          "[Bunny] Feed readiness check failed: malformed JSON response",
          responseText.slice(0, 200),
        );
        continue;
      }
      batch.forEach((videoId) => {
        readiness.set(videoId, result.statuses?.[videoId]?.ready === true);
      });
    } catch (error) {
      console.warn("[Bunny] Feed readiness check failed:", error);
    }
  }
  return readiness;
}
