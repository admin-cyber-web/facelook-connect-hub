export function getVideoMimeType(source: string): string {
  const path = source.split(/[?#]/, 1)[0].toLowerCase();
  if (path.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".ogg") || path.endsWith(".ogv")) return "video/ogg";
  if (path.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}
