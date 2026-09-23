import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

const sections = [
  {
    title: "Welcome to Flicks!",
    body: "We value your privacy. This policy explains how Flicks collects, uses, and protects your information.",
  },
  {
    title: "Data Collection",
    body: "We only collect your name, email, and profile picture via Google Auth to provide a personalized experience. We do not collect any additional personal data beyond what is needed to operate the platform.",
  },
  {
    title: "Security",
    body: "Your data is securely handled by Supabase. We do not sell your personal information to third parties. All authentication is managed with industry-standard encryption.",
  },
  {
    title: "Cookies & Local Storage",
    body: "We use local storage to save your theme and language preferences. No third-party tracking cookies are used on Flicks.",
  },
  {
    title: "User Control",
    body: "You can lock or hide your profile at any time through the Settings menu. You are always in control of your visibility and privacy on Flicks.",
  },
];

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-2xl border-b border-white/10 px-4 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-blue-400" />
          <h1 className="font-black text-base tracking-tight">Privacy Policy</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3 pb-8 border-b border-white/10"
        >
          {/* 3D F logo (static here) */}
          <div className="w-16 h-16 mx-auto rounded-[1.4rem] bg-gradient-to-br from-blue-500 via-blue-600 to-purple-700 flex items-center justify-center shadow-xl shadow-blue-500/30 border border-white/10">
            <span className="text-3xl font-black text-white">F</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Flicks</h2>
          <p className="text-sm text-white/40 font-medium">Privacy Policy · Last updated 2025</p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2"
            >
              <h3 className="font-black text-sm text-blue-300">{s.title}</h3>
              <p className="text-xs text-white/55 leading-relaxed font-medium">{s.body}</p>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center pt-8 border-t border-white/10 space-y-2"
        >
          <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-6 py-3">
            <span className="text-xs font-black text-white/70 uppercase tracking-widest">
              Flicks
            </span>
            <span className="w-px h-4 bg-white/20" />
            <span className="text-xs font-black text-white/70 uppercase tracking-widest">
              Powered by VKT
            </span>
          </div>
          <p className="text-[10px] text-white/25 font-medium">
            © 2025 Flicks. All rights reserved.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Privacy;
