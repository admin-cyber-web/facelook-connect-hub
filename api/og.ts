import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = "https://rxwvvhvretostbiknuek.supabase.co";
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/surveys`;
const FALLBACK_IMAGE = `${SUPABASE_URL}/storage/v1/object/public/avatars/app-icon.png`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const surveyId = req.query.survey_id as string | undefined;

  if (!surveyId) {
    res.status(400).send("Missing survey_id");
    return;
  }

  const key =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  try {
    const [surveyRes, votesRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/surveys?id=eq.${encodeURIComponent(surveyId)}&select=question,image_url,survey_options(id,text)&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/votes?survey_id=eq.${encodeURIComponent(surveyId)}&select=option_id`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      ),
    ]);

    const surveys = await surveyRes.json();
    const votes = await votesRes.json();
    const survey = surveys?.[0];

    if (!survey) {
      res.redirect(302, FALLBACK_IMAGE);
      return;
    }

    // Build vote-percentage description
    const total: number = Array.isArray(votes) ? votes.length : 0;
    const voteCounts: Record<string, number> = {};
    if (Array.isArray(votes)) {
      votes.forEach((v: { option_id: string }) => {
        voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1;
      });
    }

    const opts: Array<{ id: string; text: string }> = Array.isArray(survey.survey_options)
      ? survey.survey_options.slice(0, 4)
      : [];

    const description =
      total > 0
        ? opts
            .map((o) => {
              const pct = Math.round(((voteCounts[o.id] || 0) / total) * 100);
              return `${o.text} ${pct}%`;
            })
            .join(" · ") + ` · ${total} votes`
        : opts.map((o) => o.text).join(" · ") + " — Vote now!";

    // Resolve survey's own image (if any) as the OG image
    const rawImg: string | null = survey.image_url ?? null;
    let imageUrl: string;
    if (rawImg) {
      imageUrl = rawImg.startsWith("http") ? rawImg : `${STORAGE_BASE}/${rawImg}`;
    } else {
      imageUrl = FALLBACK_IMAGE;
    }

    // Return an HTML meta-redirect page so crawlers (FB, Twitter, WhatsApp)
    // read the og: tags and users get forwarded to the SPA.
    const appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://flicksindia.replit.app";
    const deepLink = `${appUrl}?survey=${surveyId}`;

    const html = `<!DOCTYPE html>
<html prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="utf-8" />
  <title>${escHtml(survey.question)} – FlicksIndia Survey</title>

  <!-- Open Graph -->
  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="FlicksIndia" />
  <meta property="og:title"       content="${escHtml(survey.question)}" />
  <meta property="og:description" content="${escHtml(description)}" />
  <meta property="og:image"       content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url"         content="${deepLink}" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${escHtml(survey.question)}" />
  <meta name="twitter:description" content="${escHtml(description)}" />
  <meta name="twitter:image"       content="${imageUrl}" />

  <!-- Redirect real users to the SPA -->
  <meta http-equiv="refresh" content="0; url=${deepLink}" />
</head>
<body>
  <a href="${deepLink}">Click here to vote →</a>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.status(200).send(html);
  } catch (err) {
    res.redirect(302, FALLBACK_IMAGE);
  }
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
