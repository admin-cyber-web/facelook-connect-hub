/**
 * InviteCard — Viral Referral Card for Flicks India
 * Design: Deep Midnight Maroon + Electric Lemon Yellow
 * Usage: <InviteCard userId="..." username="..." />
 *        <InviteCard userId="..." username="..." compact />
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Share2, MessageCircle } from "lucide-react";

interface Props {
  userId: string;
  username: string;
  compact?: boolean;
}

const BASE_URL = "https://flicksindia.online";

export default function InviteCard({ userId, username, compact = false }: Props) {
  const [copied, setCopied] = useState(false);

  const refSlug  = username || userId;
  const inviteUrl = `${BASE_URL}/invite?ref=${encodeURIComponent(userId)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = inviteUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `🎬 Yaar, Flicks India join kar — India ka real social app!\n✅ No Fake News  ✅ Real Connections  ✅ Full Privacy\n👉 ${inviteUrl}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Flicks India! 🎬",
          text: `${username ? `${username} is inviting you to ` : ""}Flicks India — India's real social app. No fake news, real connections!`,
          url: inviteUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      handleWhatsApp();
    }
  };

  // ── COMPACT version (inside MagnetSystem / small panels) ──────────────────
  if (compact) {
    return (
      <div style={{
        borderRadius: 18,
        background: "linear-gradient(135deg,#1a0010 0%,#2d0022 60%,#1a000e 100%)",
        border: "1.5px solid rgba(204,255,0,0.2)",
        padding: "16px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Glow blobs */}
        <div style={{ position:"absolute", top:-20, right:-20, width:100, height:100, borderRadius:"50%", background:"rgba(204,255,0,0.07)", filter:"blur(24px)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:-20, left:-10, width:80, height:80, borderRadius:"50%", background:"rgba(233,30,99,0.08)", filter:"blur(20px)", pointerEvents:"none" }} />

        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <div style={{
            width:36, height:36, borderRadius:10, flexShrink:0,
            background:"linear-gradient(135deg,#CCFF00,#a3e635)",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <span style={{ fontSize:18 }}>🎬</span>
          </div>
          <div>
            <p style={{ margin:0, fontSize:13, fontWeight:900, color:"#CCFF00", lineHeight:1.1 }}>Invite Friends</p>
            <p style={{ margin:0, fontSize:11, color:"rgba(255,255,255,0.45)" }}>Earn fame points for every referral</p>
          </div>
        </div>

        {/* Link row */}
        <div style={{
          display:"flex", gap:6, alignItems:"center",
          background:"rgba(255,255,255,0.05)", borderRadius:10,
          padding:"8px 10px", marginBottom:10,
          border:"1px solid rgba(204,255,0,0.12)",
        }}>
          <span style={{ flex:1, fontSize:10, color:"rgba(255,255,255,0.5)", fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            flicksindia.online/invite?ref={refSlug}
          </span>
          <button onClick={handleCopy} style={{
            background: copied ? "rgba(204,255,0,0.15)" : "rgba(204,255,0,0.08)",
            border: "1px solid rgba(204,255,0,0.25)", borderRadius:6,
            padding:"4px 8px", cursor:"pointer",
            display:"flex", alignItems:"center", gap:4,
            color:"#CCFF00", fontSize:10, fontWeight:800,
          }}>
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Buttons */}
        <div style={{ display:"flex", gap:6 }}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleWhatsApp}
            style={{
              flex:1, padding:"9px 0", borderRadius:10,
              background:"linear-gradient(135deg,#25D366,#128C7E)",
              border:"none", cursor:"pointer",
              color:"#fff", fontSize:11, fontWeight:800,
              display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            }}
          >
            <MessageCircle size={12} /> WhatsApp
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleNativeShare}
            style={{
              flex:1, padding:"9px 0", borderRadius:10,
              background:"rgba(204,255,0,0.1)", border:"1.5px solid rgba(204,255,0,0.3)",
              cursor:"pointer", color:"#CCFF00", fontSize:11, fontWeight:800,
              display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            }}
          >
            <Share2 size={12} /> Share
          </motion.button>
        </div>

        <style>{`
          @keyframes pulse-lemon {
            0%,100% { box-shadow: 0 0 0 0 rgba(204,255,0,0.25); }
            50% { box-shadow: 0 0 0 8px rgba(204,255,0,0); }
          }
        `}</style>
      </div>
    );
  }

  // ── FULL version (Profile sidebar / InviteLanding) ────────────────────────
  return (
    <div style={{
      borderRadius: 24,
      background: "linear-gradient(145deg,#1c0014 0%,#2d0022 45%,#180010 100%)",
      border: "2px solid rgba(204,255,0,0.18)",
      overflow: "hidden",
      position: "relative",
      boxShadow: "0 12px 60px rgba(204,255,0,0.08), 0 4px 24px rgba(0,0,0,0.6)",
    }}>
      {/* Ambient glows */}
      <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160, borderRadius:"50%", background:"rgba(204,255,0,0.06)", filter:"blur(40px)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:-30, left:-20, width:120, height:120, borderRadius:"50%", background:"rgba(233,30,99,0.08)", filter:"blur(30px)", pointerEvents:"none" }} />

      {/* Top branding strip */}
      <div style={{
        padding: "16px 18px 0",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width:40, height:40, borderRadius:12,
          background:"linear-gradient(135deg,#CCFF00,#99cc00)",
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:"0 4px 14px rgba(204,255,0,0.35)",
        }}>
          <span style={{ fontSize:22 }}>🎬</span>
        </div>
        <div>
          <p style={{ margin:0, fontSize:15, fontWeight:900, color:"#CCFF00", lineHeight:1.1, fontFamily:"Inter, sans-serif" }}>
            Flicks India
          </p>
          <p style={{ margin:0, fontSize:10, color:"rgba(255,255,255,0.4)", fontWeight:700, letterSpacing:1 }}>
            INVITE A FRIEND
          </p>
        </div>
      </div>

      {/* Phone mockup */}
      <div style={{ display:"flex", justifyContent:"center", padding:"14px 0 8px", position:"relative" }}>
        {/* Floating badges */}
        <motion.div
          animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.8, ease:"easeInOut" }}
          style={{
            position:"absolute", left:14, top:10,
            background:"rgba(204,255,0,0.12)", border:"1px solid rgba(204,255,0,0.3)",
            borderRadius:20, padding:"5px 10px",
            display:"flex", alignItems:"center", gap:5,
          }}
        >
          <span style={{ fontSize:11 }}>🛡️</span>
          <span style={{ fontSize:9, color:"#CCFF00", fontWeight:800 }}>100% Safe</span>
        </motion.div>

        <motion.div
          animate={{ y: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 3.2, ease:"easeInOut" }}
          style={{
            position:"absolute", right:14, top:6,
            background:"rgba(233,30,99,0.12)", border:"1px solid rgba(233,30,99,0.3)",
            borderRadius:20, padding:"5px 10px",
            display:"flex", alignItems:"center", gap:5,
          }}
        >
          <span style={{ fontSize:11 }}>✅</span>
          <span style={{ fontSize:9, color:"#ff6eb4", fontWeight:800 }}>No Fake News</span>
        </motion.div>

        <motion.div
          animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease:"easeInOut" }}
          style={{
            position:"absolute", left:18, bottom:16,
            background:"rgba(99,102,241,0.14)", border:"1px solid rgba(99,102,241,0.3)",
            borderRadius:20, padding:"5px 10px",
            display:"flex", alignItems:"center", gap:5,
          }}
        >
          <span style={{ fontSize:11 }}>💙</span>
          <span style={{ fontSize:9, color:"#a5b4fc", fontWeight:800 }}>Real Connections</span>
        </motion.div>

        {/* Phone frame */}
        <div style={{
          width:110, height:200,
          borderRadius:22,
          background:"linear-gradient(160deg,#2a0020,#1a000e)",
          border:"2.5px solid rgba(204,255,0,0.35)",
          overflow:"hidden", position:"relative",
          boxShadow:"0 8px 32px rgba(204,255,0,0.2), 0 0 0 1px rgba(0,0,0,0.8)",
        }}>
          {/* Status bar */}
          <div style={{ height:22, background:"rgba(204,255,0,0.08)", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 10px" }}>
            <div style={{ width:28, height:4, borderRadius:2, background:"rgba(204,255,0,0.4)" }} />
            <div style={{ width:6, height:6, borderRadius:"50%", background:"rgba(204,255,0,0.6)" }} />
          </div>
          {/* Mini feed cards */}
          {["#E91E63","#7c3aed","#FF5722","#0EA5E9","#22c55e"].map((col, i) => (
            <div key={i} style={{
              margin:"5px 6px", height:28, borderRadius:8,
              background:`linear-gradient(90deg,${col}22,${col}11)`,
              border:`1px solid ${col}33`,
              display:"flex", alignItems:"center", gap:6, padding:"0 8px",
            }}>
              <div style={{ width:16, height:16, borderRadius:"50%", background:col, opacity:0.85, flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ height:4, borderRadius:2, background:`${col}66`, width:"70%" }} />
                <div style={{ height:3, borderRadius:2, background:`${col}33`, width:"50%", marginTop:3 }} />
              </div>
            </div>
          ))}
          {/* Home indicator */}
          <div style={{ position:"absolute", bottom:6, left:"50%", transform:"translateX(-50%)", width:36, height:4, borderRadius:2, background:"rgba(204,255,0,0.3)" }} />
        </div>
      </div>

      {/* Tagline */}
      <div style={{ textAlign:"center", padding:"4px 16px 14px" }}>
        <p style={{
          margin:0, fontSize:16, fontWeight:900, color:"#fff", lineHeight:1.2,
          fontFamily:"Inter, sans-serif",
        }}>
          Join Flicks India
        </p>
        <p style={{
          margin:"3px 0 0", fontSize:10, fontWeight:700, letterSpacing:0.5,
          color:"rgba(255,255,255,0.38)",
        }}>
          UPDATE EVERYWHERE, EVERY TIME
        </p>
      </div>

      {/* Referral link */}
      <div style={{ padding:"0 14px 12px" }}>
        <div style={{
          background:"rgba(255,255,255,0.04)",
          border:"1px solid rgba(204,255,0,0.14)",
          borderRadius:12, padding:"8px 12px",
          display:"flex", alignItems:"center", gap:8,
        }}>
          <span style={{ flex:1, fontSize:10, color:"rgba(255,255,255,0.45)", fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            flicksindia.online/invite?ref={refSlug}
          </span>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleCopy}
            style={{
              background: copied ? "rgba(204,255,0,0.18)" : "rgba(204,255,0,0.1)",
              border:"1.5px solid rgba(204,255,0,0.3)", borderRadius:8,
              padding:"5px 10px", cursor:"pointer",
              display:"flex", alignItems:"center", gap:5,
              color:"#CCFF00", fontSize:11, fontWeight:800,
              transition:"all 0.2s", flexShrink:0,
            }}
          >
            {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
          </motion.button>
        </div>
      </div>

      {/* Share buttons */}
      <div style={{ padding:"0 14px 16px", display:"flex", gap:8 }}>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleWhatsApp}
          style={{
            flex:1, padding:"11px 0", borderRadius:14,
            background:"linear-gradient(135deg,#25D366,#128C7E)",
            border:"none", cursor:"pointer",
            color:"#fff", fontSize:13, fontWeight:800,
            display:"flex", alignItems:"center", justifyContent:"center", gap:7,
            boxShadow:"0 4px 16px rgba(37,211,102,0.3)",
          }}
        >
          <MessageCircle size={14} /> WhatsApp
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleNativeShare}
          style={{
            flex:1, padding:"11px 0", borderRadius:14,
            background:"rgba(204,255,0,0.08)",
            border:"2px solid rgba(204,255,0,0.3)",
            cursor:"pointer", color:"#CCFF00", fontSize:13, fontWeight:800,
            display:"flex", alignItems:"center", justifyContent:"center", gap:7,
          }}
        >
          <Share2 size={14} /> Share
        </motion.button>
      </div>

      <style>{`
        @keyframes pulse-lemon {
          0%,100% { box-shadow: 0 0 0 0 rgba(204,255,0,0.35), 0 4px 24px rgba(204,255,0,0.3); }
          50%      { box-shadow: 0 0 0 12px rgba(204,255,0,0), 0 4px 24px rgba(204,255,0,0.1); }
        }
        .invite-join-btn { animation: pulse-lemon 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
