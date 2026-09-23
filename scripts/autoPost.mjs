import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { JWT } from 'google-auth-library';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import ws from 'ws';

// ── Paths ─────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITEMAP_SCRIPT = path.join(__dirname, 'generateSitemap.mjs');

// ── Config ────────────────────────────────────────────────────────────────────
const NEWS_INTERVAL_MS = 4 * 60 * 60 * 1000;   // News: every 4 h
const BASE_URL = "https://www.flicksindia.online";
const GNEWS_URL = "https://gnews.io/api/v4/top-headlines?category=general&lang=hi&country=in&max=10&apikey=900fd7ed7efdb6e4452411241eeb548e";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const geminiApiKey = process.env.VITE_GEMINI_API_KEY;

// Direct fix for environment variables
const googleSvcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_ACCOUNT;
const googleSvcKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_KEY)?.replace(/\\n/g, '\n');

if (!supabaseAnonKey || !geminiApiKey) {
  console.error("[AutoPost] ❌ Required secrets missing. Exiting.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

const ai = new GoogleGenAI({ apiKey: geminiApiKey });
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const FLICKS_TV_NAME = 'Flicks TV 📺';

// ── Time helpers ──────────────────────────────────────────────────────────────
const toIST = (ms = Date.now()) => new Date(ms).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', hour12: true, dateStyle: 'medium', timeStyle: 'short',
});

// ══════════════════════════════════════════════════════════════════════════════
// VIDEO LIBRARY
// ══════════════════════════════════════════════════════════════════════════════
const VIDEO_LIBRARY = [
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", title: "Incredible India - Monsoon Fire Vibes", category: "Nature", tags: ["India Nature", "Monsoon", "Viral India"] },
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", title: "Hidden India - Travel Escape Reel", category: "Travel", tags: ["India Travel", "Hidden Places", "Tourism"] },
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4", title: "Desi Vibes - Pure Fun Moments", category: "Fun", tags: ["Desi Fun", "Viral India", "Entertainment"] },
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4", title: "Joyride India - Road Trip Reel", category: "Lifestyle", tags: ["Road Trip India", "Travel Vlog", "Viral"] },
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4", title: "Drama Ka Scene - Full Filmy Moment", category: "Comedy", tags: ["Desi Drama", "Funny India", "Comedy Reel"] },
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4", title: "India Road Life - Streets & Vibes", category: "Lifestyle", tags: ["Indian Streets", "City Life", "Desi Vibes"] },
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4", title: "Bullrun India - High Energy Festival Reel", category: "Festival", tags: ["Indian Festival", "High Energy", "Culture"] },
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4", title: "Speed & Style - Desi Car Culture", category: "Automotive", tags: ["Car India", "Desi Style", "Viral Reel"] },
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", title: "Animated Short - Feel Good Desi Reel", category: "Animation", tags: ["Feel Good", "Animated India", "Family Reel"] },
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", title: "Dreamscape India - Cinematic Reel", category: "Cinematic", tags: ["Cinematic India", "Short Film", "Viral Art"] },
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4", title: "Epic India - Fantasy Short Film Vibes", category: "Cinematic", tags: ["Epic India", "Fantasy", "Short Film"] },
  { url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4", title: "Iron & Soul - Desi Sci-Fi Short", category: "Sci-Fi", tags: ["Sci-Fi India", "Desi Future", "Viral Short"] },
  { url: "https://assets.mixkit.co/videos/preview/mixkit-woman-running-above-the-camera-on-a-running-track-32809-large.mp4", title: "Morning Run - Desi Fitness Goals", category: "Fitness", tags: ["Fitness India", "Morning Routine", "Desi Gym"] },
  { url: "https://assets.mixkit.co/videos/preview/mixkit-young-woman-talking-on-smartphone-in-a-modern-kitchen-39572-large.mp4", title: "Modern India - Youth & Tech Life", category: "Lifestyle", tags: ["Modern India", "Youth India", "Desi Tech"] },
  { url: "https://assets.mixkit.co/videos/preview/mixkit-hands-holding-a-smartphone-with-a-dark-background-12593-large.mp4", title: "Digital India - Social Media Reel", category: "Tech", tags: ["Digital India", "Social Media", "Viral"] },
  { url: "https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-city-traffic-at-night-11-large.mp4", title: "India City Nights - Aerial Glow Reel", category: "City", tags: ["Indian City", "Night Life", "Aerial India"] },
  { url: "https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-1173-large.mp4", title: "Phool Khile - Spring India Vibes", category: "Nature", tags: ["Indian Spring", "Nature India", "Flowers"] },
  { url: "https://assets.mixkit.co/videos/preview/mixkit-cascading-waterfall-surrounded-by-trees-17180-large.mp4", title: "Jungle Waterfall - Wilderness India Reel", category: "Nature", tags: ["Indian Jungle", "Waterfall", "Wildlife India"] },
  { url: "https://assets.mixkit.co/videos/preview/mixkit-countryside-meadow-4075-large.mp4", title: "Gaon Ki Mitti - Village India Reel", category: "Rural", tags: ["Village India", "Rural Life", "Desi Gaon"] },
  { url: "https://assets.mixkit.co/videos/preview/mixkit-sun-and-clouds-in-the-sky-6-large.mp4", title: "Indian Sky - Golden Hour Reel", category: "Nature", tags: ["Indian Sky", "Golden Hour", "Sunset India"] },
];

const postedVideoIds = new Set();

// ── FEATURE 1: Google Indexing API Ping ───────────────────────────────────────
async function pingGoogleIndexingApi(postUrl) {
  if (!googleSvcEmail || !googleSvcKey) {
    console.log("[Indexing] ⚠️  Creds not set — skipping.");
    return;
  }
  try {
    const jwtClient = new JWT({
      email: googleSvcEmail,
      key: googleSvcKey,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });
    const { token } = await jwtClient.getAccessToken();
    if (!token) throw new Error("No token from Google");

    const res = await fetch('https://indexing.googleapis.com/v1/urlNotifications:publish', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: postUrl, type: 'URL_UPDATED' }),
    });
    const body = await res.json();
    if (!res.ok) console.warn(`[Indexing] ⚠️  ${res.status}:`, JSON.stringify(body).slice(0, 150));
    else console.log(`[Indexing] ✅ Pinged: ${postUrl}`);
  } catch (err) {
    console.warn("[Indexing] ⚠️  Non-fatal:", err.message?.slice(0, 100));
  }
}

// ── Sitemap trigger ───────────────────────────────────────────────────────────
function triggerSitemapUpdate() {
  console.log("[AutoPost] 🗺️  Triggering sitemap refresh...");
  const child = execFile('node', [SITEMAP_SCRIPT], { timeout: 60_000 }, (err, stdout) => {
    if (err) { console.warn("[Sitemap] ⚠️ Non-fatal:", err.message.slice(0, 100)); return; }
    if (stdout.trim()) console.log("[Sitemap]", stdout.trim());
    console.log("[AutoPost] ✅ Sitemap refreshed.");
  });
  child.on('error', (e) => console.warn("[AutoPost] ⚠️  Spawn failed:", e.message));
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT CATEGORY ROTATION ENGINE
// ══════════════════════════════════════════════════════════════════════════════
const POST_CATEGORIES = [
  {
    name: "Desi Comedy / Jokes",
    vibe: "shuddh desi maza, relatable everyday Indian group humor, chai-time banter energy, light — NO double meaning",
    endings: [
      "Tag karo apne woh kamine dost jisko ye bilkul fit baithe 👇😂",
      "Aisa kuch hua hai tumhare saath? Neeche batao 😂👇",
      "Agree ho toh ek solid Like thok do bhai ❤️👇",
    ],
  },
  {
    name: "UP-Bihar Local / Culture",
    vibe: "Purvanchal mitti ka pyaar, litti-chokha warmth, mild Bhojpuri/Maithili flavor mixed naturally in Hindi, gaon ki yaad wala feel",
    endings: [
      "UP-Bihar ka koi hai yahan? Comment mein 'Jai Ho' likho 🙏👇",
      "Gaon walon ek like thok do bhai ❤️🔥",
      "Tumhara gaon kaun sa hai? Neeche batao 👇",
    ],
  },
  {
    name: "Deep Love / Heart-touching Shayari",
    vibe: "raw real emotions, modern relationships, dil ko chhune wali baat — poetic but spoken naturally like a real person",
    endings: [
      "Kisi khaas insaan ko tag karo jo tumhara sab samjhe 💕👇",
      "Agar yeh dil ko chua ho toh ek ❤️ zaroor maaro 👇",
    ],
  },
  {
    name: "Latest Trending / News Buzz",
    vibe: "sensational but factual, national buzz energy, aaj ki taza khabar feel, WhatsApp forward style but verified",
    endings: [
      "Aapka kya maanna hai ispe? Comment mein batao 👇",
      "Share karo taaki sab jaane 📢🔥",
    ],
  },
  {
    name: "Solid Motivation",
    vibe: "heavy real-talk hustle energy, grounded desi wisdom, street-smart not corporate",
    endings: [
      "Save karo aur roz subah padho 💪🔥",
      "Agree ho toh ek 🔥 maaro comments mein!",
    ],
  },
];

// FIXED ROTATION LOGIC (No Chinese characters, no undefined variable errors)
function getRotatingCategory() {
  const seed = Date.now();
  const idx = Math.floor(seed / 1000) % POST_CATEGORIES.length;
  return POST_CATEGORIES[idx];
}

// ── Gemini: News content + clickbait title ────────────────────────────────────
async function transformNewsWithGemini(article) {
  const cat = getRotatingCategory();
  const ending = cat.endings[Math.floor(Math.random() * cat.endings.length)];

  const contentPrompt = `You are a real Indian person writing a viral Hinglish post on Facebook for "Flicks India" — a desi social app.
Style: ${cat.name}
Vibe: ${cat.vibe}

Task: Rewrite this news as an authentic Indian Facebook post. End EXACTLY with: "${ending}"
No markdown, max 120 words. No banned words like "bhai dekho", "miss mat kro".

News Title: ${article.title}
OUTPUT: Only the post text.`;

  const titlePrompt = `Write a HIGH-CTR Indian headline for this news in max 58 characters. Hinglish, starts with ONE emoji. No "breaking".
News: ${article.title}
OUTPUT: Only the title.`;

  const [contentRes, titleRes] = await Promise.allSettled([
    ai.models.generateContent({ model: 'gemini-2.5-flash', contents: contentPrompt, config: { maxOutputTokens: 900, temperature: 1.0 } }),
    ai.models.generateContent({ model: 'gemini-2.5-flash', contents: titlePrompt, config: { maxOutputTokens: 80, temperature: 0.85 } }),
  ]);

  return {
    content: contentRes.status === 'fulfilled' ? (contentRes.value.text || "").trim() : "",
    metaTitle: titleRes.status === 'fulfilled' ? (titleRes.value.text || "").trim() : "",
  };
}

// ── SEO Fields Builder ────────────────────────────────────────────────────────
function buildSeoFields(article, finalContent, geminiTitle) {
  const rawTitle = (article.title || '').replace(/["'']/g, '').trim();
  let meta_title = geminiTitle?.length > 5 ? geminiTitle : `🔥 Update: ${rawTitle}`;
  if (meta_title.length > 60) meta_title = meta_title.slice(0, 57).trimEnd() + '...';

  const cleanContent = finalContent.replace(/["''#@*`]/g, '').replace(/\s+/g, ' ').trim();
  const meta_description = cleanContent.length > 150 ? cleanContent.slice(0, 147).trimEnd() + '...' : cleanContent;

  return { meta_title, meta_description, seo_keywords: 'flicks india, taza khabar hindi, breaking news' };
}

// ══════════════════════════════════════════════════════════════════════════════
// NEWS ENGINE
// ══════════════════════════════════════════════════════════════════════════════
async function runAutoPostEngine() {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[AutoPost] 📰 News cycle started at ${toIST()}`);
  console.log(`${'─'.repeat(60)}`);

  let posted = 0;

  try {
    const response = await fetch(GNEWS_URL);
    if (!response.ok) throw new Error(`GNews fetch failed — HTTP ${response.status}`);

    const data = await response.json();
    const articles = data.articles || [];
    console.log(`[AutoPost] 📰 Articles fetched: ${articles.length}`);

    for (const article of articles) {
      if (posted >= 1) break;

      const sourceUrl = article.url || '';
      if (!sourceUrl) continue;

      const { data: existing } = await supabase
        .from('posts').select('id').eq('is_admin_post', true)
        .eq('metadata->>source_url', sourceUrl).maybeSingle();

      if (existing) {
        console.log("[AutoPost] ⏭  Already posted, skipping:", article.title?.slice(0, 60));
        continue;
      }

      console.log(`[AutoPost] 🎯 Processing: "${article.title?.slice(0, 70)}"`);
      console.log("[AutoPost] ⏳ Waiting 5 s before Gemini...");
      await delay(5000);

      let finalContent = "";
      let geminiTitle = "";

      try {
        const result = await transformNewsWithGemini(article);
        finalContent = result.content;
        geminiTitle = result.metaTitle;
        console.log(`[AutoPost] 🤖 Gemini content generated successfully.`);
      } catch (aiErr) {
        console.warn("[AutoPost] ⚠️ Gemini skipped:", aiErr.message || aiErr);
      }

      if (!finalContent) {
        const safeTitle = (article.title || '').replace(/"/g, "'").replace(/\s+/g, ' ').trim();
        const cat = getRotatingCategory();
        const ending = cat.endings[Math.floor(Math.random() * cat.endings.length)];
        finalContent = `Badi khabar saamne aa rahi hai: ${safeTitle}\n\n${ending}\n\n#FlicksIndia #TazaKhabar`;
      }

      const { meta_title, meta_description, seo_keywords } = buildSeoFields(article, finalContent, geminiTitle);

      const { data: inserted, error: insertErr } = await supabase
        .from('posts')
        .insert([{
          content: finalContent,
          meta_title,
          meta_description,
          seo_keywords,
          is_admin_post: true,
          visibility: 'public',
          type: 'text',
          media_url: article.image || '',
          metadata: {
            source_url: sourceUrl,
            source_name: article.source?.name || 'GNews',
            published_at: article.publishedAt,
            posted_by: FLICKS_TV_NAME,
          },
        }])
        .select('id')
        .single();

      if (insertErr) {
        console.error("[AutoPost] ❌ DB insert error:", insertErr.message);
      } else {
        console.log(`🎉 [AutoPost] News post published! ID = ${inserted?.id}`);
        posted++;
        triggerSitemapUpdate();
        if (inserted?.id) await pingGoogleIndexingApi(`${BASE_URL}/post/${inserted.id}`);
      }
    }

    console.log(`[AutoPost] ✅ News cycle done — published: ${posted}`);
  } catch (cycleErr) {
    console.error(`[AutoPost] ❌ News cycle error:`, cycleErr.message?.slice(0, 150));
  }
}

async function newsLoop() {
  await runAutoPostEngine();
  console.log(`\n[AutoPost] ⏰ Next news cycle: ${toIST(Date.now() + NEWS_INTERVAL_MS)}`);
  setTimeout(newsLoop, NEWS_INTERVAL_MS);
}

// ── Entry point ───────────────────────────────────────────────────────────────
console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║         FLICKS INDIA — AutoPost v8 (Fixed)                 ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log(`[Boot] ▶  Started at ${toIST()} IST`);
console.log(`[Boot] 📰 News: every ${NEWS_INTERVAL_MS / 3_600_000} h`);
console.log(`[Boot] 📡 Google Indexing: ${googleSvcEmail ? '✅ active' : '⚠️  skipped'}`);
console.log(`[Boot] 🎥 Video library: ${VIDEO_LIBRARY.length} clips available\n`);

await runAutoPostEngine();
newsLoop();