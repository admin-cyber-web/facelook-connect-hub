/**
 * universalShare.ts
 * Forwarding bridge to shareUtils.ts
 */

import { shareToSocial, copyToClipboard, formatShareUrl, type SocialPlatform } from "./shareUtils";

export type PostType = "post" | "reel" | "circle" | "hook" | "quote" | "story";
export type ShareTarget = "whatsapp" | "messenger" | "facebook" | "twitter" | "telegram";
export type ShareOutcome = "shared-with-file" | "shared-url-only" | "copied" | "cancelled" | "error";

export interface UniversalShareInput {
  title: string;
  text: string;
  url: string;
  mediaUrl?: string;
  previewUrl?: string;
  authorName?: string;
  canvas?: HTMLCanvasElement;
  type?: PostType;
}

export interface ShareTargetInput {
  title: string;
  text: string;
  url: string;
  mediaUrl?: string;
  previewUrl?: string;
  authorName?: string;
  type?: PostType;
}

export function buildPostShareUrl(postId: string): string {
  return formatShareUrl(`/post/${encodeURIComponent(postId)}`);
}

export function canonicalShareUrl(value: string): string {
  return formatShareUrl(value);
}

export function buildShareText(body?: string | null, url?: string | null): string {
  const caption = (body || "").trim();
  const shareUrl = formatShareUrl(url);
  if (caption) return `🎬 ${caption}\n\n👉 Watch on Flicks India: ${shareUrl}`;
  return `👉 Check this out on Flicks India: ${shareUrl}`;
}

export async function copyShareText(text: string): Promise<boolean> {
  return copyToClipboard(text);
}

export async function launchShareTarget(
  platform: ShareTarget,
  input: ShareTargetInput,
) {
  const success = await shareToSocial(platform as SocialPlatform, {
    title: input.title,
    text: input.text,
    url: input.url,
    mediaUrl: input.mediaUrl || input.previewUrl,
  });
  return success ? "opened" : "error";
}

export async function universalShare(input: UniversalShareInput): Promise<ShareOutcome> {
  const success = await shareToSocial("native", {
    title: input.title,
    text: input.text,
    url: input.url,
    mediaUrl: input.mediaUrl || input.previewUrl,
  });
  return success ? "shared-url-only" : "error";
}

export function resolveShareMediaUrl(post: {
  type?: string | null;
  media_type?: string | null;
  media_url?: string | null;
  video_url?: string | null;
  cover_url?: string | null;
  meta_image?: string | null;
}): string | undefined {
  return post.video_url || post.media_url || post.cover_url || post.meta_image || undefined;
}

export function resolveSharePreviewFromPost(post: any): string {
  return post.mediaUrl || post.media_url || post.imageUrl || post.image_url || post.cover_url || post.meta_image || "";
}

export async function shareViaAndroid(caption: string, mediaUrl?: string | null) {
  return shareToSocial("native", { text: caption, url: mediaUrl || "" });
}
