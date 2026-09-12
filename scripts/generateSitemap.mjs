import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import ws from 'ws';

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.error("[Sitemap] ❌ Missing Supabase Anon Key!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

const SITE_URL = "https://www.flicksindia.online";
const PAGE_SIZE = 1000;
// Keep pagination bounded while leaving room for the sitemap's 50,000 URL limit.
const MAX_PAGES = 50;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_FILE = path.join(process.cwd(), '.cache', 'sitemap-data.json');

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchPaginated(label, buildQuery) {
  const rows = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let response;

    try {
      response = await buildQuery().range(from, to);
    } catch (error) {
      throw new Error(`${label} query failed: ${error?.message || error}`);
    }

    // Supabase normally fulfills the promise even when the response contains
    // an error, so checking only Promise rejection is not sufficient.
    if (response?.error) {
      throw new Error(`${label} query failed: ${response.error.message || response.error}`);
    }
    if (!Array.isArray(response?.data)) {
      throw new Error(`${label} query returned no data`);
    }

    rows.push(...response.data);
    if (response.data.length < PAGE_SIZE) {
      return rows;
    }
  }

  throw new Error(
    `${label} exceeded the ${MAX_PAGES}-page sitemap limit; refusing to generate a truncated sitemap`,
  );
}

async function generateSitemap() {
  console.log("[Sitemap] Generating sitemap.xml via Supabase...");

  try {
    // Fetch public posts + active stories (last 24 h) in parallel
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let cached;
    try {
      const stat = fs.statSync(CACHE_FILE);
      if (Date.now() - stat.mtimeMs <= CACHE_TTL_MS) {
        cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      }
    } catch {
      // A missing, stale, or malformed local artifact is not a data source.
      // Fetching below preserves the existing error behavior.
    }

    const [posts, stories] = cached?.posts && cached?.stories
      ? [cached.posts, cached.stories]
      : await Promise.all([
        fetchPaginated("Posts", () => supabase
          .from('posts')
          .select('id, created_at')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })),
        fetchPaginated("Stories", () => supabase
          .from('stories')
          .select('id, created_at')
          .gte('created_at', since24h)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })),
      ]);

    if (!cached?.posts || !cached?.stories) {
      fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
      const tempFile = `${CACHE_FILE}.${process.pid}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify({ posts, stories }));
      fs.renameSync(tempFile, CACHE_FILE);
    }

    let xmlItems = [];

    // 1. Home Page
    xmlItems.push(`  <url>\n    <loc>${SITE_URL}/</loc>\n    <priority>1.0</priority>\n    <changefreq>hourly</changefreq>\n  </url>`);

    // 2. Static Pages
    xmlItems.push(`  <url>\n    <loc>${SITE_URL}/privacy</loc>\n    <priority>0.3</priority>\n    <changefreq>yearly</changefreq>\n  </url>`);
    xmlItems.push(`  <url>\n    <loc>${SITE_URL}/terms</loc>\n    <priority>0.3</priority>\n    <changefreq>yearly</changefreq>\n  </url>`);

    // 3. Dynamic Post Pages
    posts.forEach(post => {
      const lastmod = post.created_at ? String(post.created_at).slice(0, 10) : '';
      xmlItems.push(`  <url>\n    <loc>${escapeXml(`${SITE_URL}/post/${post.id}`)}</loc>\n    <priority>0.8</priority>\n    <changefreq>weekly</changefreq>${lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''}\n  </url>`);
    });

    // 4. Active Story Pages (ephemeral — high crawl priority while live)
    stories.forEach(story => {
      const lastmod = story.created_at ? String(story.created_at).slice(0, 10) : '';
      xmlItems.push(`  <url>\n    <loc>${escapeXml(`${SITE_URL}/story/${story.id}`)}</loc>\n    <priority>0.6</priority>\n    <changefreq>daily</changefreq>${lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''}\n  </url>`);
    });

    const totalLinks = xmlItems.length;

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlItems.join('\n')}
</urlset>`;

    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml);
    console.log(`🎉 SUCCESS: sitemap.xml → ${totalLinks} URLs (${posts.length} posts + ${stories.length} stories + 3 static)`);

  } catch (err) {
    console.error("[Sitemap] Generation failed:", err.message);
    process.exit(1);
  }
}

generateSitemap();