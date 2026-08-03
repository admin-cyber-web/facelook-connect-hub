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

async function generateSitemap() {
  console.log("[Sitemap] Generating sitemap.xml via Supabase...");

  try {
    // Fetch public posts + active stories (last 24 h) in parallel
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [postsResult, storiesResult] = await Promise.allSettled([
      supabase.from('posts').select('id, created_at').eq('visibility', 'public'),
      supabase.from('stories').select('id, created_at').gte('created_at', since24h),
    ]);

    const posts   = postsResult.status   === 'fulfilled' ? (postsResult.value.data   || []) : [];
    const stories = storiesResult.status === 'fulfilled' ? (storiesResult.value.data || []) : [];

    if (postsResult.status === 'rejected')   console.warn("[Sitemap] ⚠️  Posts fetch error:", postsResult.reason?.message);
    if (storiesResult.status === 'rejected') console.warn("[Sitemap] ⚠️  Stories fetch error:", storiesResult.reason?.message);

    let xmlItems = [];

    // 1. Home Page
    xmlItems.push(`  <url>\n    <loc>${SITE_URL}/</loc>\n    <priority>1.0</priority>\n    <changefreq>hourly</changefreq>\n  </url>`);

    // 2. Static Pages
    xmlItems.push(`  <url>\n    <loc>${SITE_URL}/privacy</loc>\n    <priority>0.3</priority>\n    <changefreq>yearly</changefreq>\n  </url>`);
    xmlItems.push(`  <url>\n    <loc>${SITE_URL}/terms</loc>\n    <priority>0.3</priority>\n    <changefreq>yearly</changefreq>\n  </url>`);

    // 3. Dynamic Post Pages
    posts.forEach(post => {
      const lastmod = post.created_at ? post.created_at.slice(0, 10) : '';
      xmlItems.push(`  <url>\n    <loc>${SITE_URL}/post/${post.id}</loc>\n    <priority>0.8</priority>\n    <changefreq>weekly</changefreq>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`);
    });

    // 4. Active Story Pages (ephemeral — high crawl priority while live)
    stories.forEach(story => {
      const lastmod = story.created_at ? story.created_at.slice(0, 10) : '';
      xmlItems.push(`  <url>\n    <loc>${SITE_URL}/story/${story.id}</loc>\n    <priority>0.6</priority>\n    <changefreq>daily</changefreq>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`);
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
    process.exit(0);
  }
}

generateSitemap();