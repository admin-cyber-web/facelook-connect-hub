---
name: Supabase storage URL helper pitfall
description: resolveMediaUrl's "strip bucket-name prefix from path" logic silently breaks a bucket when uploaded object keys use a subfolder with the same name as the bucket.
---

Generic storage-URL helpers that strip a leading `"<bucket>/"` segment from a
stored path (to avoid double-prefixing when a bucket name was accidentally
saved into the path) will incorrectly strip a legitimate subfolder segment if
uploads for that bucket use a subfolder whose name matches the bucket name
itself (e.g. bucket `stories`, object key `stories/<file>`). The result is a
public URL missing one path segment → 404/400 on load, while other buckets
without that naming coincidence work fine.

**Why:** In this project, `resolveMediaUrl(path, bucket)` in `src/lib/mediaUrl.ts`
strips `path.slice(bucket.length + 1)` whenever `path.startsWith(bucket + "/")`.
The `stories` bucket's upload code builds object keys as
`stories/${userId}-...${ext}` (a real subfolder, not an accidental bucket-name
prefix), so the helper strips it and produces a broken URL. `StoryBar.tsx` was
never migrated to this helper and instead calls
`supabase.storage.from("stories").getPublicUrl(path).data.publicUrl` directly,
which is why stories rendered correctly there but 404'd elsewhere (e.g. in
`ChatSystem.tsx` before the fix).

**How to apply:** Before reusing a generic "resolve storage path" helper for a
new bucket, check how objects in that bucket are actually keyed (list an
upload call for that bucket). If the upload path includes a subfolder with the
same name as the bucket, do not run it through prefix-stripping logic — use
`supabase.storage.from(bucket).getPublicUrl(path)` directly instead (only
special-casing already-absolute `http(s)://` URLs). `ChatSystem.tsx` now uses
a dedicated `resolveStoryImageUrl()` helper for the `stories` bucket instead of
the shared `resolveMediaUrl`, mirroring `StoryBar.tsx`.
