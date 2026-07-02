import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─────────────────────────────────────────────────────────────────────────────
// /api/survey?survey_id=<uuid>
// Mapped from  /survey/:survey_id  via vercel.json rewrite.
//
// Behaviour:
//   • Crawlers (WhatsApp, Facebook, Twitter, Telegram …) receive a full HTML
//     page with correct per-survey OG / Twitter Card meta tags, including the
//     exact image_url the survey author uploaded.
//   • Real users are meta-refreshed to /?survey=<id> so the React SPA picks
//     up the deep-link and scrolls to that survey.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://rxwvvhvretostbiknuek.supabase.co";
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/surveys`;

function resolveImage(raw: string | null | undefined): string {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  // Strip any accidental leading "surveys/" bucket prefix
  const clean = raw.replace(/^surveys\//, "");
  return `${STORAGE_BASE}/${clean}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const surveyId = (req.query.survey_id as string | undefined) || "";

  if (!surveyId) {
    res.status(400).send("Missing survey_id");
    return;
  }

  const key =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  try {
    // ── 1. Fetch the survey row (question + image_url + options) ──────────────
    const [surveyRes, votesRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/surveys` +
          `?id=eq.${encodeURIComponent(surveyId)}` +
          `&select=question,image_url,survey_options(id,text)` +
          `&limit=1`,
        { headers }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/votes` +
          `?survey_id=eq.${encodeURIComponent(surveyId)}` +
          `&select=option_id`,
        { headers }
      ),
    ]);

    if (!surveyRes.ok) throw new Error(`Supabase error: ${surveyRes.status}`);

    const surveys = await surveyRes.json();
    const votes = await votesRes.json();
    const survey = Array.isArray(surveys) ? surveys[0] : null;

    if (!survey) {
      // Survey not found — redirect to SPA home
      res.redirect(302, "/");
      return;
    }

    // ── 2. Build per-option vote percentages for og:description ──────────────
    const total: number = Array.isArray(votes) ? votes.length : 0;
    const voteCounts: Record<string, number> = {};
    if (Array.isArray(votes)) {
      votes.forEach((v: { option_id: string }) => {
        voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1;
      });
    }

    const opts: Array<{ id: string; text: string }> = Array.isArray(
      survey.survey_options
    )
      ? survey.survey_options.slice(0, 5)
      : [];

    const description =
      total > 0
        ? opts
            .map((o) => {
              const pct = Math.round(((voteCounts[o.id] || 0) / total) * 100);
              return `${o.text} ${pct}%`;
            })
            .join(" · ") + ` · ${total} vote${total !== 1 ? "s" : ""}`
        : opts.map((o) => o.text).join(" · ") +
          (opts.length ? " — Vote now on FlicksIndia!" : "Vote now on FlicksIndia!");

    // ── 3. Resolve the og:image to the survey's own uploaded image ────────────
    const ogImage = resolveImage(survey.image_url);

    // ── 4. Build canonical URLs ───────────────────────────────────────────────
    const appOrigin = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || "https://flicksindia.replit.app";

    const canonicalUrl = `${appOrigin}/survey/${surveyId}`;
    const spaDeepLink = `${appOrigin}/?survey=${surveyId}`;
    const question = survey.question as string;

    // ── 5. Render full OG HTML ────────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(question)} – FlicksIndia Survey</title>
  <meta name="description" content="${esc(description)}" />

  <!-- ── Open Graph ───────────────────────────────────────────────────── -->
  <meta property="og:type"         content="website" />
  <meta property="og:site_name"    content="FlicksIndia" />
  <meta property="og:title"        content="${esc(question)}" />
  <meta property="og:description"  content="${esc(description)}" />
  <meta property="og:url"          content="${esc(canonicalUrl)}" />
${ogImage ? `  <meta property="og:image"        content="${esc(ogImage)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt"    content="${esc(question)}" />` : ""}

  <!-- ── Twitter / X Card ─────────────────────────────────────────────── -->
  <meta name="twitter:card"        content="${ogImage ? "summary_large_image" : "summary"}" />
  <meta name="twitter:title"       content="${esc(question)}" />
  <meta name="twitter:description" content="${esc(description)}" />
${ogImage ? `  <meta name="twitter:image"       content="${esc(ogImage)}" />` : ""}

  <!-- ── Redirect real users to the SPA ───────────────────────────────── -->
  <meta http-equiv="refresh" content="0; url=${esc(spaDeepLink)}" />
  <link rel="canonical" href="${esc(canonicalUrl)}" />

  <style>
    body { margin: 0; background: #0d0d1a; color: #fff;
           font-family: system-ui, sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; text-align: center; padding: 2rem; }
    a { color: #818cf8; font-weight: 700; }
  </style>
</head>
<body>
  <div>
    <p style="font-size: 1.25rem; font-weight: 900; max-width: 600px;">
      ${esc(question)}
    </p>
    <p style="color: rgba(255,255,255,0.5); margin: .5rem 0 1.5rem;">
      ${esc(description)}
    </p>
    <a href="${esc(spaDeepLink)}">Vote on FlicksIndia →</a>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Cache 60s; CDN can hold for 5 min while revalidating
    res.setHeader(
      "Cache-Control",
      "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
    );
    res.status(200).send(html);
  } catch {
    // On any error, redirect to the SPA — never show a broken page
    res.redirect(302, `/?survey=${surveyId}`);
  }
}
