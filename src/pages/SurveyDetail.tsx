import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/lib/supabaseClient";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { Loader2, BarChart2, Vote, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const BASE_URL = "https://flicksindia.online";
const PALETTE = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#06b6d4"];

interface SurveyOption { id: string; text: string; vote_count?: number; }
interface Survey {
  id: string; question: string; image_url: string | null;
  user_id: string; created_at: string;
  profiles?: { full_name: string; avatar_url: string };
  options?: SurveyOption[];
  total_votes?: number;
}

const SurveyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: s } = await supabase
        .from("surveys")
        .select("id, question, image_url, user_id, created_at, profiles(full_name, avatar_url), survey_options(id, text)")
        .eq("id", id)
        .single();

      if (!s) { setLoading(false); return; }

      const { data: votes } = await supabase
        .from("votes")
        .select("option_id")
        .eq("survey_id", id);

      const voteMap: Record<string, number> = {};
      (votes || []).forEach(v => { voteMap[v.option_id] = (voteMap[v.option_id] || 0) + 1; });
      const total = (votes || []).length;

      setSurvey({
        ...s,
        options: (s.survey_options || []).map((o: SurveyOption) => ({
          ...o, vote_count: voteMap[o.id] || 0,
        })),
        total_votes: total,
      });
      setLoading(false);
    })();
  }, [id]);

  if (session === undefined || loading) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <Loader2 size={28} className="text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex flex-col items-center justify-center gap-4">
        <BarChart2 size={40} className="text-white/20" />
        <p className="text-white/50 font-bold">Survey not found</p>
        <button onClick={() => navigate("/")} className="text-indigo-400 text-sm">← Go Home</button>
      </div>
    );
  }

  const total = survey.total_votes || 0;
  const ogImage = survey.image_url
    ? resolveMediaUrl(survey.image_url, "surveys")
    : `${BASE_URL}/og-fallback.png`;
  const ogTitle = `Survey: ${survey.question}`;
  const ogDescription = total > 0
    ? `${total} votes · Join the debate on FlicksIndia`
    : "Join the debate on FlicksIndia";
  const canonicalUrl = `${BASE_URL}/survey/${survey.id}`;

  const openInApp = () => {
    if (session) {
      navigate(`/?survey=${survey.id}`);
    } else {
      navigate("/");
    }
  };

  return (
    <>
      <Helmet>
        <title>{ogTitle} | FlicksIndia</title>
        <meta name="description" content={ogDescription} />
        <link rel="canonical" href={canonicalUrl} />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="FlicksIndia" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={survey.question} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:locale" content="en_IN" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@FlicksIndia" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>

      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
        style={{ background: "linear-gradient(180deg,#0d0d1a,#0a0a14)" }}>

        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="flex items-center gap-2 mb-6 justify-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <BarChart2 size={18} className="text-white" />
            </div>
            <span className="text-white font-black text-lg">FlicksIndia</span>
          </div>

          {/* Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl overflow-hidden"
            style={{ background: "linear-gradient(145deg,rgba(30,30,50,0.95),rgba(20,20,40,0.98))", border: "1.5px solid rgba(99,102,241,0.4)", boxShadow: "0 0 0 3px rgba(99,102,241,0.1),0 12px 40px rgba(0,0,0,0.5)" }}>

            {/* Author */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-3">
              {survey.profiles?.avatar_url
                ? <img src={resolveMediaUrl(survey.profiles.avatar_url, "avatars")} className="w-9 h-9 rounded-full object-cover" crossOrigin="anonymous" />
                : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm">
                    {(survey.profiles?.full_name || "?")[0].toUpperCase()}
                  </div>
              }
              <div>
                <p className="text-white font-bold text-[13px]">{survey.profiles?.full_name || "Anonymous"}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Vote size={10} className="text-indigo-400" />
                  <span className="text-indigo-300 text-[10px] font-bold">Live Survey</span>
                </div>
              </div>
            </div>

            {/* Question */}
            <div className="px-5 pb-4">
              <p className="text-white font-black text-[18px] leading-snug">{survey.question}</p>
            </div>

            {/* Image */}
            {survey.image_url && (
              <div className="mx-5 mb-4 rounded-2xl overflow-hidden">
                <img src={resolveMediaUrl(survey.image_url, "surveys")}
                  className="w-full object-cover max-h-48" loading="lazy" decoding="async" crossOrigin="anonymous" />
              </div>
            )}

            {/* Options (read-only preview) */}
            <div className="px-5 space-y-2.5 pb-4">
              {(survey.options || []).map((opt, i) => {
                const pct = total > 0 ? Math.round(((opt.vote_count || 0) / total) * 100) : 0;
                return (
                  <div key={opt.id} className="relative rounded-2xl overflow-hidden"
                    style={{ border: `1.5px solid rgba(255,255,255,0.1)` }}>
                    <div className="absolute inset-y-0 left-0 rounded-2xl"
                      style={{ width: `${pct}%`, background: `${PALETTE[i % PALETTE.length]}22` }} />
                    <div className="relative flex items-center justify-between px-4 py-3">
                      <span className="text-white/80 text-[13px] font-semibold">{opt.text}</span>
                      <span className="text-[12px] font-black" style={{ color: PALETTE[i % PALETTE.length] }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vote count */}
            <div className="mx-5 mb-5 flex items-center gap-2 px-4 py-2.5 rounded-2xl"
              style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <Vote size={13} className="text-indigo-400" />
              <span className="text-indigo-300 text-[12px] font-bold">{total} votes so far</span>
              <span className="text-white/20 text-[11px] ml-auto">Live results</span>
            </div>

            {/* CTA */}
            <div className="px-5 pb-6">
              <motion.button whileTap={{ scale: 0.97 }} onClick={openInApp}
                className="w-full py-4 rounded-2xl font-black text-[15px] text-white flex items-center justify-center gap-2.5"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}>
                {session ? "Vote Now on FlicksIndia" : "Open in FlicksIndia"}
                <ArrowRight size={18} />
              </motion.button>
              {!session && (
                <p className="text-center text-white/30 text-[11px] mt-2.5">
                  Sign in to cast your vote and join the debate
                </p>
              )}
            </div>
          </motion.div>

          <p className="text-center text-white/20 text-[11px] mt-6">
            FlicksIndia | Survey · flicksindia.online
          </p>
        </div>
      </div>
    </>
  );
};

export default SurveyDetail;
