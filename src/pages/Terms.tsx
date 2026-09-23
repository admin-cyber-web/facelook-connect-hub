import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

const sections = [
  {
    title: "Acceptance of Terms",
    body: "By creating an account on Flicks India, you agree to abide by these Terms & Conditions. If you do not agree, please do not use the app.",
  },
  {
    title: "Community Guidelines — Zero Tolerance",
    body: "No offensive content allowed. Users posting hate speech, harassment, nudity, violence, or any content that targets a person, religion, caste, gender, or community will be banned permanently from Flicks India. Reports are reviewed by our admin team and bans are enforced immediately.",
  },
  {
    title: "User Accounts",
    body: "You are responsible for the security of your Google account used to log in. One person, one account — duplicate or fake accounts will be removed without notice.",
  },
  {
    title: "Content Ownership",
    body: "You own the photos, videos, and posts you upload. By posting on Flicks India, you grant us a non-exclusive licence to display that content within the app to other users.",
  },
  {
    title: "Reporting & Moderation",
    body: "Every post and video has a Report button. Reports are sent to the Flicks India admin team and acted upon within 24 hours. Repeat offenders are banned permanently.",
  },
  {
    title: "Termination",
    body: "Flicks India reserves the right to suspend or permanently ban any account that violates these terms, with or without prior notice. Banned users will see a clear notice with the reason and may contact tiwarijhumki@gmail.com to appeal.",
  },
  {
    title: "Changes to Terms",
    body: "We may update these terms from time to time. Continued use of Flicks India after changes means you accept the updated terms.",
  },
];

const Terms = () => {
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
          <FileText size={18} className="text-amber-400" />
          <h1 className="font-black text-base tracking-tight">Terms &amp; Conditions</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3 pb-8 border-b border-white/10"
        >
          <div className="w-16 h-16 mx-auto rounded-[1.4rem] bg-gradient-to-br from-amber-500 via-orange-600 to-red-700 flex items-center justify-center shadow-xl shadow-orange-500/30 border border-white/10">
            <span className="text-3xl font-black text-white">F</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Flicks India</h2>
          <p className="text-sm text-white/40 font-medium">Terms &amp; Conditions · Last updated 2026</p>
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
              <h3 className="font-black text-sm text-amber-300">{s.title}</h3>
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

export default Terms;
