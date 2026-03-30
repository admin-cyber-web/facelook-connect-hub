import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

const sections = [
  {
    title: "1. Information We Collect",
    body: "Facelook Connect Hub collects information you provide directly, such as your name, username, profile photo, school, location, mobile number, and bio. We also collect usage data including posts, comments, likes, and interactions on the platform. When you sign in via Google, we receive your email address and public profile data from Google.",
  },
  {
    title: "2. How We Use Your Information",
    body: "We use your data to operate and improve the Facelook platform, personalize your experience, enable connections with other users, send service-related communications, and ensure platform safety. We do not sell your personal information to third parties.",
  },
  {
    title: "3. Data Storage & Security",
    body: "All data is securely stored using Supabase, which is powered by PostgreSQL with Row-Level Security (RLS) policies. Authentication is handled via Supabase Auth with end-to-end encryption. We implement industry-standard safeguards to protect your information from unauthorized access.",
  },
  {
    title: "4. Sharing of Information",
    body: "Your public profile (name, username, avatar, bio) is visible to other Facelook users. Your school, mobile number, and location are only shared if you choose to display them. Private messages are encrypted in transit and accessible only to the sender and recipient.",
  },
  {
    title: "5. Cookies & Local Storage",
    body: "Facelook uses browser localStorage to store your theme preferences and language settings. We do not use third-party tracking cookies. Your session token is managed securely by Supabase Auth.",
  },
  {
    title: "6. Profile Controls",
    body: "You can lock your profile, hide it from discovery, or delete your account at any time through the Settings panel. Blocked users will not be able to view your profile, posts, or contact you. You may request complete data deletion by contacting support.",
  },
  {
    title: "7. Children's Privacy",
    body: "Facelook is not intended for users under the age of 13. We do not knowingly collect data from children. If you believe a child has provided us with personal information, please contact us immediately.",
  },
  {
    title: "8. Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. We will notify users of significant changes via an in-app notification. Continued use of the platform after changes constitutes your acceptance of the updated policy.",
  },
  {
    title: "9. Contact Us",
    body: "For privacy-related inquiries, data removal requests, or concerns, please contact us at: support@facelook.app — Powered by VKT, Secure by Supabase.",
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

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3 pb-6 border-b border-white/10"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/20">
            <span className="text-3xl font-black text-white">F</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            Facelook Connect Hub
          </h2>
          <p className="text-sm text-white/40 font-medium">
            Privacy Policy · Last updated March 2025
          </p>
          <p className="text-xs text-white/30 leading-relaxed max-w-md mx-auto">
            At Facelook, your privacy is our priority. This policy explains how
            we collect, use, and protect your data when you use our platform.
          </p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2"
            >
              <h3 className="font-black text-sm text-blue-300">{s.title}</h3>
              <p className="text-xs text-white/50 leading-relaxed font-medium">
                {s.body}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center pt-6 border-t border-white/10 space-y-1">
          <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">
            Powered by VKT · Secure by Supabase
          </p>
          <p className="text-[9px] text-white/10">
            © 2025 Facelook Connect Hub. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
