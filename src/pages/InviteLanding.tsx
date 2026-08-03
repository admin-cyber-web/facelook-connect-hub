/**
 * InviteLanding — /invite?ref=USER_ID
 * Gorgeous full-screen referral landing page with OG meta tags.
 * Saves referrer to localStorage, then routes to app on "Join Now".
 */
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/lib/supabaseClient";
import InviteCard from "@/components/InviteCard";
import { ArrowRight, Loader2 } from "lucide-react";

export default function InviteLanding() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const refId      = params.get("ref") || "";

  const [inviterName,   setInviterName]   = useState<string>("");
  const [inviterAvatar, setInviterAvatar] = useState<string>("");
  const [loading,       setLoading]       = useState(!!refId);

  // Fetch inviter name/avatar for personalisation
  useEffect(() => {
    if (!refId) return;
    // Save referrer to localStorage so App.tsx can log it after signup
    localStorage.setItem("flicks_referrer", refId);

    supabase
      .from("profiles")
      .select("full_name, avatar_url, username")
      .eq("id", refId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setInviterName(data.full_name || data.username || "A friend");
          setInviterAvatar(data.avatar_url || "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [refId]);

  const handleJoin = () => {
    // Referrer already saved in localStorage — just navigate to root
    // LoginScreen will appear for unauthenticated users
    navigate("/");
  };

  const ogTitle       = inviterName
    ? `${inviterName} is inviting you to Flicks India! 🎬`
    : "Join Flicks India — India's Real Social App 🎬";
  const ogDescription = "No Fake News · Full Security · Real Connections. Join India's premium social platform today.";
  const ogImage       = "https://flicksindia.online/og-invite.png";

  return (
    <>
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="description"          content={ogDescription} />
        <meta property="og:type"          content="website" />
        <meta property="og:title"         content={ogTitle} />
        <meta property="og:description"   content={ogDescription} />
        <meta property="og:image"         content={ogImage} />
        <meta property="og:image:width"   content="1200" />
        <meta property="og:image:height"  content="630" />
        <meta property="og:image:alt"     content="Flicks India Invite" />
        <meta property="og:url"           content={`https://flicksindia.online/invite?ref=${refId}`} />
        <meta property="og:site_name"     content="Flicks India" />
        <meta property="og:locale"        content="en_IN" />
        <meta name="twitter:card"         content="summary_large_image" />
        <meta name="twitter:title"        content={ogTitle} />
        <meta name="twitter:description"  content={ogDescription} />
        <meta name="twitter:image"        content={ogImage} />
        <meta name="theme-color"          content="#1a0010" />
      </Helmet>

      <div style={{
        minHeight: "100dvh",
        background: "linear-gradient(145deg,#1c0014 0%,#0d0008 60%,#200018 100%)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "24px 20px",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        position: "relative", overflow: "hidden",
      }}>
        {/* Ambient blobs */}
        <div style={{ position:"fixed", top:-80, left:-80, width:280, height:280, borderRadius:"50%", background:"rgba(204,255,0,0.05)", filter:"blur(60px)", pointerEvents:"none" }} />
        <div style={{ position:"fixed", bottom:-60, right:-60, width:240, height:240, borderRadius:"50%", background:"rgba(233,30,99,0.06)", filter:"blur(50px)", pointerEvents:"none" }} />

        {loading ? (
          <Loader2 size={32} style={{ color:"#CCFF00", animation:"spin 1s linear infinite" }} />
        ) : (
          <motion.div
            initial={{ opacity:0, y:30 }}
            animate={{ opacity:1, y:0 }}
            transition={{ duration: 0.55, ease:[0.22,1,0.36,1] }}
            style={{ width:"100%", maxWidth:400 }}
          >
            {/* Personalised invite banner */}
            {inviterName && (
              <div style={{
                textAlign:"center", marginBottom:20,
                display:"flex", alignItems:"center", justifyContent:"center", gap:10,
              }}>
                {inviterAvatar && (
                  <img src={inviterAvatar} alt="" style={{
                    width:40, height:40, borderRadius:"50%",
                    border:"2px solid rgba(204,255,0,0.4)",
                    objectFit:"cover", flexShrink:0,
                  }} />
                )}
                <div style={{ textAlign:"left" }}>
                  <p style={{ margin:0, fontSize:14, fontWeight:900, color:"#fff" }}>
                    👋 {inviterName}
                  </p>
                  <p style={{ margin:0, fontSize:12, color:"rgba(255,255,255,0.4)", fontWeight:600 }}>
                    is inviting you to Flicks India
                  </p>
                </div>
              </div>
            )}

            {/* Main invite card */}
            <InviteCard userId={refId} username={inviterName || "flicks"} />

            {/* JOIN NOW CTA */}
            <motion.button
              className="invite-join-btn"
              whileTap={{ scale: 0.97 }}
              onClick={handleJoin}
              style={{
                width:"100%", marginTop:18, padding:"17px 0",
                borderRadius:18, border:"none", cursor:"pointer",
                background:"linear-gradient(135deg,#CCFF00 0%,#a3e635 100%)",
                color:"#1a0010", fontSize:17, fontWeight:900,
                display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                fontFamily:"Inter, sans-serif",
                boxShadow:"0 4px 24px rgba(204,255,0,0.45)",
              }}
            >
              Join Now — It's Free
              <ArrowRight size={20} strokeWidth={3} />
            </motion.button>

            <p style={{ textAlign:"center", fontSize:11, color:"rgba(255,255,255,0.25)", marginTop:14, fontWeight:600 }}>
              🔒 Secure · 🇮🇳 Made in India · 100% Free
            </p>
          </motion.div>
        )}

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse-lemon {
            0%,100% { box-shadow: 0 0 0 0 rgba(204,255,0,0.45), 0 4px 24px rgba(204,255,0,0.45); }
            50%      { box-shadow: 0 0 0 16px rgba(204,255,0,0), 0 4px 24px rgba(204,255,0,0.15); }
          }
          .invite-join-btn { animation: pulse-lemon 2s ease-in-out infinite; }
        `}</style>
      </div>
    </>
  );
}
