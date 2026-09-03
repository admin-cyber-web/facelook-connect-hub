import { shareViaCapacitor } from "./capacitorMediaShare";

// ── Universal post sharing util ────────────────────────────────────────────────
// Goal: when sharing to WhatsApp / Instagram / etc., the receiver sees the post
// IMAGE *plus* the caption text together (FB-style).
//
// Why we render a share-card instead of just passing { text, files }:
//   WhatsApp & Instagram silently DROP the `text` payload when `files` are
//   attached via the Web Share API. So the only reliable cross-app way to
//   ship the caption with the image is to bake the caption INTO the image.
//
// Behaviour:
//   1. If the post has an image → compose a card (image on top + caption below
//      + author/credit footer) and share that single PNG file.
//   2. If the post is video / has no image → fall back to text-only share.
//   3. Final fallback → copy text to clipboard.

export interface SharePostOptions {
  postId: string;
  caption?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null; // "image" | "video" | etc.
  authorName?: string | null;
  /** AI-generated SEO title from posts.meta_title — used as the share headline */
  metaTitle?: string | null;
  /** AI-generated SEO description from posts.meta_description — used as share body */
  metaDescription?: string | null;
}

const BASE_URL = "https://flicksindia.online";
const MAX_CAPTION_CHARS = 240; // ~4-5 lines on the share card
const PROMO_FOOTER = "🎬 Join Flicks and update every time, everywhere.\n— Flicks India · flicksindia.online";

// ── helpers ────────────────────────────────────────────────────────────────
async function urlToFile(url: string, filename: string): Promise<File | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "application/octet-stream" });
  } catch {
    return null;
  }
}

async function urlToImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function truncateCaption(text: string, max = MAX_CAPTION_CHARS): string {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

function isImageMedia(url: string, mediaType?: string | null): boolean {
  if (mediaType?.startsWith("image")) return true;
  if (mediaType?.startsWith("video")) return false;
  const u = url.toLowerCase().split("?")[0];
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/.test(u);
}

/** Word-wrap text to fit a max width, returns lines. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para.trim()) { lines.push(""); continue; }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length >= maxLines) break;
  }
  if (lines.length > maxLines) {
    lines.length = maxLines;
  }
  // Add ellipsis if we cut something off
  if (lines.length === maxLines) {
    const totalRendered = lines.join(" ").length;
    if (totalRendered < text.length - 3) {
      let last = lines[maxLines - 1];
      while (last && ctx.measureText(last + "…").width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = last + "…";
    }
  }
  return lines;
}

/**
 * Compose a "share card" PNG: post image on top, caption below, footer with
 * author + Flicks India branding. Returns a File ready for navigator.share.
 */
async function buildShareCard(opts: {
  imageUrl: string;
  caption: string;
  authorName?: string | null;
}): Promise<File | null> {
  try {
    const img = await urlToImage(opts.imageUrl);
    if (!img || !img.width || !img.height) return null;

    // Card layout — fixed width, dynamic height based on caption length
    const W = 1080;
    const PAD = 36;
    const TITLE_BAR_H = 0;

    // Scale image to width, capped to keep card from being absurdly tall
    const imgScale = W / img.width;
    const imgH = Math.min(Math.round(img.height * imgScale), 1350);
    const imgDrawH = imgH;

    // Estimate text block height
    const tmpCanvas = document.createElement("canvas");
    const tmpCtx = tmpCanvas.getContext("2d")!;
    const captionText = truncateCaption(opts.caption || "");
    const FONT_SIZE = 38;
    const LINE_H = 50;
    const MAX_LINES = 5;
    tmpCtx.font = `500 ${FONT_SIZE}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const captionLines = captionText
      ? wrapText(tmpCtx, captionText, W - PAD * 2, MAX_LINES)
      : [];
    const captionBlockH = captionLines.length > 0
      ? captionLines.length * LINE_H + PAD * 2
      : 0;

    const FOOTER_H = 110;
    const totalH = TITLE_BAR_H + imgDrawH + captionBlockH + FOOTER_H;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = totalH;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, totalH);

    // Image (cover within imgH so we never letterbox)
    const imgRatio = img.width / img.height;
    const targetRatio = W / imgDrawH;
    let sx = 0, sy = 0, sW = img.width, sH = img.height;
    if (imgRatio > targetRatio) {
      // image wider than slot → crop sides
      sW = img.height * targetRatio;
      sx = (img.width - sW) / 2;
    } else if (imgRatio < targetRatio) {
      // image taller than slot → crop top/bottom
      sH = img.width / targetRatio;
      sy = (img.height - sH) / 2;
    }
    ctx.drawImage(img, sx, sy, sW, sH, 0, 0, W, imgDrawH);

    // Caption
    let cursorY = imgDrawH + PAD + FONT_SIZE * 0.85;
    if (captionLines.length > 0) {
      ctx.fillStyle = "#0f172a";
      ctx.font = `500 ${FONT_SIZE}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.textBaseline = "alphabetic";
      for (const line of captionLines) {
        ctx.fillText(line, PAD, cursorY);
        cursorY += LINE_H;
      }
      cursorY += PAD - FONT_SIZE * 0.25;
    } else {
      cursorY = imgDrawH;
    }

    // Footer divider
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(PAD, cursorY, W - PAD * 2, 2);

    // Footer: author + Flicks India branding
    const footerTop = cursorY + 2;
    const footerCenterY = footerTop + FOOTER_H / 2;

    ctx.fillStyle = "#0f172a";
    ctx.font = `800 36px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = "middle";
    const authorLabel = opts.authorName ? opts.authorName : "Flicks India";
    ctx.fillText(authorLabel, PAD, footerCenterY - 8);

    ctx.fillStyle = "#6366f1";
    ctx.font = `700 24px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText("Flicks India · flicksindia.online", PAD, footerCenterY + 28);

    // Logo dot on the right
    const dotR = 30;
    const dotCx = W - PAD - dotR;
    const dotCy = footerCenterY;
    const grad = ctx.createLinearGradient(dotCx - dotR, dotCy - dotR, dotCx + dotR, dotCy + dotR);
    grad.addColorStop(0, "#2563eb");
    grad.addColorStop(1, "#7c3aed");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(dotCx, dotCy, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 32px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("F", dotCx, dotCy + 1);
    ctx.textAlign = "start";

    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(b => resolve(b), "image/jpeg", 0.92),
    );
    if (!blob) return null;
    return new File([blob], "flicks-post.jpg", { type: "image/jpeg" });
  } catch (e) {
    console.warn("[sharePost] buildShareCard failed:", e);
    return null;
  }
}

/**
 * Share a post.
 *   1. If the post has an image → bake caption INTO the image (FB-style card)
 *      and share that one PNG so caption + visual always travel together.
 *   2. Video / no media → text-only share with caption + link.
 *   3. Fallback → copy to clipboard.
 */
export async function sharePost(opts: SharePostOptions): Promise<"shared" | "copied" | "cancelled"> {
  const { postId, caption, mediaUrl, mediaType, authorName, metaTitle, metaDescription } = opts;
  const postUrl = `${BASE_URL}/post/${postId}`;
  const cleanCaption = (caption || "").trim();
  const credit = authorName ? `— ${authorName} on Flicks India` : "Flicks India";

  // Build a rich text payload for the Web Share API's `text:` field.
  // This text appears in WhatsApp / Telegram / iMessage previews when no image
  // file is attached (video posts, no-media posts, clipboard fallback).
  // Priority: AI-generated SEO fields → raw caption → plain credit+link.
  const headlineRaw = (metaTitle || "").trim();
  const bodyRaw = (metaDescription || "").trim();
  const headline = headlineRaw || truncateCaption(cleanCaption, 80);
  const body = bodyRaw
    || (cleanCaption && cleanCaption !== headline ? truncateCaption(cleanCaption, 200) : "");

  const parts: string[] = [];
  if (headline) parts.push(headline);
  if (body && body !== headline) parts.push(body);
  parts.push(PROMO_FOOTER);
  parts.push(`${credit}\n${postUrl}`);
  const shareText = parts.join("\n\n");

  // On Android, use a cache-backed native URI first so image and video posts
  // show their actual media preview in the OS share sheet.
  const capacitorOutcome = await shareViaCapacitor({
    title: headline,
    text: shareText,
    url: postUrl,
    mediaUrl,
    type: mediaType?.startsWith("video") ? "reel" : "post",
    appendPromoFooter: false,
  });
  if (capacitorOutcome === "shared-with-file" || capacitorOutcome === "shared-url-only") {
    return "shared";
  }
  if (capacitorOutcome === "cancelled") return "cancelled";

  const hasImage = !!mediaUrl && isImageMedia(mediaUrl, mediaType);

  // ── 1. Image post → composed share-card (image + caption baked together) ──
  if (hasImage && typeof navigator !== "undefined" && (navigator as any).canShare) {
    const file = await buildShareCard({
      imageUrl: mediaUrl!,
      caption: cleanCaption,
      authorName,
    });
    if (file) {
      const payload: any = { files: [file], text: shareText };
      try {
        if ((navigator as any).canShare(payload)) {
          await (navigator as any).share(payload);
          return "shared";
        }
        // Some browsers refuse text+files together — try files-only
        const filesOnly: any = { files: [file] };
        if ((navigator as any).canShare(filesOnly)) {
          await (navigator as any).share(filesOnly);
          return "shared";
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return "cancelled";
        // fall through
      }
    }
    // Composition or share failed → try sharing the original image directly
    try {
      const original = await urlToFile(mediaUrl!, "flicks-post.jpg");
      if (original && (navigator as any).canShare?.({ files: [original] })) {
        await (navigator as any).share({ files: [original], text: shareText });
        return "shared";
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return "cancelled";
    }
  }

  // ── 2. Video / no-image / unsupported → text+link share ──
  if (typeof navigator !== "undefined" && (navigator as any).share) {
    try {
      await (navigator as any).share({ text: shareText });
      return "shared";
    } catch (err: any) {
      if (err?.name === "AbortError") return "cancelled";
    }
  }

  // ── 3. Clipboard fallback ──
  try {
    await navigator.clipboard?.writeText(shareText);
    return "copied";
  } catch {
    return "cancelled";
  }
}
