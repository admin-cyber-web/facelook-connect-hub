import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Database } from "lucide-react";

const sections = [
  {
    title: "What we collect",
    body: "When you sign in with Google, we receive your name, email address, and profile picture. That's it — we do not request access to your contacts, calendar, photos, or any other personal data on your device.",
  },
  {
    title: "Why we collect it",
    body: "Your name and email are used purely for authentication — so we know it's really you, can show your profile to friends, and can send you in-app notifications (likes, comments, friend requests).",
  },
  {
    title: "How we use it",
    body: "Your data is used to personalize the social experience: showing your name on posts, matching you with friends, displaying your profile photo, and powering features like Stories, Reels, Hooks and Circles.",
  },
  {
    title: "What we DON'T do",
    body: "We do NOT sell your data to advertisers or third parties. We do NOT share your email with other users. We do NOT scan your messages for ad targeting. We do NOT use third-party trackers.",
  },
  {
    title: "Where it's stored",
    body: "Your data is stored securely in our Supabase backend (hosted on AWS), protected with industry-standard encryption.",
  },
  {
    title: "Your rights",
    body: "You can lock your profile, hide posts, block users, or delete your account from the Settings menu at any time. Account deletion permanently removes your profile and all your posts from our servers.",
  },
];

const DataInfo = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-2xl border-b border-white/10 px-4 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Database size={18} className="text-emerald-400" />
          <h1 className="font-black text-base tracking-tight">Data Collection Info</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3 pb-8 border-b border-white/10"
        >
          <div className="w-16 h-16 mx-auto rounded-[1.4rem] bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 flex items-center justify-center shadow-xl shadow-emerald-500/30 border border-white/10">
            <span className="text-3xl font-black text-white">F</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Flicks India</h2>
          <p className="text-sm text-white/40 font-medium">Data Collection Info · Last updated 2026</p>
        </motion.div>

        <div className="space-y-4">
          {sections.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2"
            >
              <h3 className="font-black text-sm text-emerald-300">{s.title}</h3>
              <p className="text-xs text-white/55 leading-relaxed font-medium whitespace-pre-line">
                {s.body}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="text-center pt-8 border-t border-white/10">
          <p className="text-[10px] text-white/25 font-medium">
            © 2026 Flicks India. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataInfo;
