import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, ArrowLeft } from "lucide-react";
import { sharePost } from "@/lib/sharePost";

const BASE_URL     = "https://flicksindia.online";
const DEFAULT_IMAGE = "https://i.ibb.co/HT7RvFxs/flicksindia.png";

const PostDetail = () => {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const [post, setPost]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error: fetchErr } = await supabase
        .from("posts")
        .select("id, author, author_id, content, media_url, cover_url, type, created_at, meta_title, meta_description, seo_keywords")
        .eq("id", id)
        .single();

      if (fetchErr || !data) {
        setError("Post not found.");
      } else {
        // Always pull the author's CURRENT name from profiles so renamed users
        // are reflected here too (post.author may be stale).
        let merged = data as any;
        if (data.author_id) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, is_verified")
            .eq("id", data.author_id)
            .maybeSingle();
          if (prof?.full_name) {
            merged = { ...merged, author: prof.full_name, is_verified: prof.is_verified };
          }
        }
        setPost(merged);
      }
      setLoading(false);
    })();
  }, [id]);

  // Use AI-generated SEO fields when available; fall back to raw content slices
  // for older posts that predate the meta columns. No extra queries needed —
  // all three columns are already in the initial .select() payload.
  const ogTitle = post
    ? (post.meta_title?.trim()       || (post.content || "").slice(0, 60).trim()  || "Flicks India Post")
    : "Flicks India";

  const ogDescription = post
    ? (post.meta_description?.trim() || (post.content || "").slice(0, 160).trim() || "Check out this post on Flicks India.")
    : "No Fake News | New India Social App | Full Protected Security | 24 Hours Help Desk";

  const ogKeywords = post?.seo_keywords?.trim() || "flicks india, social post, trending";
  const ogImage    = post?.media_url || post?.cover_url || DEFAULT_IMAGE;
  const ogUrl      = `${BASE_URL}/post/${id}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Helmet>
          <title>Loading… | Flicks India</title>
        </Helmet>
        <Loader2 size={36} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4 text-white px-6">
        <Helmet>
          <title>Post Not Found | Flicks India</title>
        </Helmet>
        <p className="text-lg font-bold text-white/70">Post not found.</p>
        <button
          onClick={() => navigate("/")}
          className="px-5 py-2 bg-blue-600 rounded-xl text-sm font-bold hover:bg-blue-700 transition"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center px-4 py-8">
      <Helmet>
        <title>{ogTitle} | Flicks India</title>
        <meta name="description" content={ogDescription} />
        <meta name="keywords"    content={ogKeywords} />

        {/* Open Graph — values sourced from AI-generated SEO columns, static after load */}
        <meta property="og:title"       content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:image"       content={ogImage} />
        <meta property="og:image:alt"   content={ogTitle} />
        <meta property="og:url"         content={ogUrl} />
        <meta property="og:type"        content="article" />
        <meta property="og:site_name"   content="Flicks India" />

        {/* Twitter Card */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        <meta name="twitter:image"       content={ogImage} />
        <meta name="twitter:image:alt"   content={ogTitle} />

        {/* Crawl directives — tell Google to index this post and follow its links */}
        <meta name="robots"   content="index, follow" />
        <link rel="canonical" href={ogUrl} />

        {/* NewsArticle JSON-LD — Google Rich Snippets (large image preview in search) */}
        <script type="application/ld+json">{JSON.stringify({
          "@context":  "https://schema.org",
          "@type":     "NewsArticle",
          "headline":    ogTitle,
          "description": ogDescription,
          "image":       ogImage !== DEFAULT_IMAGE ? [ogImage] : [DEFAULT_IMAGE],
          "url":         ogUrl,
          "datePublished": post?.created_at ?? new Date().toISOString(),
          "dateModified":  post?.created_at ?? new Date().toISOString(),
          "author": [{
            "@type": "Person",
            "name":  post?.author || "Flicks India Team",
            "url":   "https://flicksindia.online",
          }],
          "publisher": {
            "@type": "Organization",
            "name":  "Flicks India",
            "url":   "https://flicksindia.online",
            "logo": {
              "@type":  "ImageObject",
              "url":    DEFAULT_IMAGE,
              "width":  600,
              "height": 60,
            },
          },
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id":   ogUrl,
          },
          "articleSection": "India News",
          "inLanguage": "hi-IN",
          "keywords": ogKeywords,
          "isAccessibleForFree": true,
        })}</script>
      </Helmet>

      <div className="w-full max-w-sm">
        {/* Back */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-white/60 hover:text-white transition mb-6 text-sm font-semibold"
        >
          <ArrowLeft size={18} />
          Back to Flicks
        </button>

        {/* Post card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {ogImage !== DEFAULT_IMAGE && (
            <img
              src={ogImage}
              alt="Post media"
              className="w-full object-cover max-h-72"
             decoding="async"/>
          )}
          <div className="p-5 space-y-3">
            <p className="text-white font-semibold text-sm leading-relaxed">
              {post.content}
            </p>
            <p className="text-white/40 text-xs">
              Posted by {post.author || "Anonymous"}
            </p>

            {/* Share again */}
            <button
              onClick={() => {
                sharePost({
                  postId:          post.id,
                  caption:         post.content,
                  mediaUrl:        post.media_url,
                  mediaType:       post.type || (post.media_url ? "image" : null),
                  authorName:      post.author,
                  metaTitle:       post.meta_title,
                  metaDescription: post.meta_description,
                });
              }}
              className="w-full mt-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition"
            >
              Share this Post
            </button>
          </div>
        </div>

        {/* Branding */}
        <p className="text-center text-white/25 text-[10px] mt-6 font-medium tracking-widest uppercase">
          Flicks India · flicksindia.online
        </p>
      </div>
    </div>
  );
};

export default PostDetail;
