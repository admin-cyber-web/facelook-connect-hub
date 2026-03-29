import { useState } from "react";
import Header from "@/components/Header";
import GolSlider from "@/components/GolSlider";
import ConnectionPanel from "@/components/ConnectionPanel";
import MatchmakingSection from "@/components/MatchmakingSection";
import FameFeed from "@/components/FameFeed";
import FlicksFeed from "@/components/FlicksFeed";
import { motion, AnimatePresence } from "framer-motion";

const Index = () => {
  const [activeFeature, setActiveFeature] = useState("Fame");

  return (
    <div className="min-h-screen w-full bg-slate-50 overflow-x-hidden">
      {/* --- Fixed Header --- */}
      <Header />

      {/* --- Main Content Area --- */}
      <main className="pt-24 pb-40 max-w-2xl mx-auto px-4 min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFeature}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full space-y-8"
          >
            {/* 🌟 FAME FEED (THE MAIN SOCIAL WALL) 🌟 */}
            {activeFeature === "Fame" && (
              <div className="flex flex-col gap-8">
                {/* Upper Connections Panel */}
                <ConnectionPanel />

                {/* Real-time Fame Feed Section */}
                <div className="relative z-10">
                  <FameFeed />
                </div>
              </div>
            )}

            {/* 👤 PROFILE SECTION 👤 */}
            {activeFeature === "Face" && (
              <div className="px-2">
                <div className="glass rounded-[3rem] p-10 flex flex-col items-center gap-6 border-white/40 shadow-xl">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-4xl shadow-2xl ring-8 ring-white">
                    U
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl font-black text-slate-800">
                      Your Identity
                    </h2>
                    <p className="text-sm text-slate-400 mt-1 font-medium italic">
                      "Living the fame life"
                    </p>
                  </div>
                  <div className="flex gap-8 mt-4 text-center">
                    <div className="bg-white/50 px-4 py-2 rounded-2xl shadow-sm border border-white">
                      <p className="text-xl font-black text-blue-600">248</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        Buddies
                      </p>
                    </div>
                    <div className="bg-white/50 px-4 py-2 rounded-2xl shadow-sm border border-white">
                      <p className="text-xl font-black text-blue-600">52</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        Vibes
                      </p>
                    </div>
                    <div className="bg-white/50 px-4 py-2 rounded-2xl shadow-sm border border-white">
                      <p className="text-xl font-black text-blue-600">1.2k</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        Fame
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 🔥 GROUPS & COLLAB 🔥 */}
            {activeFeature === "Flame" && (
              <div className="space-y-6 px-2">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600/60 flex items-center gap-3 ml-4">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  Active Hubs
                </h2>
                {["#ReactDevs", "#DesignDaily", "#StartupPK"].map((group) => (
                  <div
                    key={group}
                    className="bg-white rounded-[2.5rem] p-6 flex items-center justify-between shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-600 text-lg font-black">
                        {group[1]}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">
                          {group}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                          12 Active · 5 New
                        </p>
                      </div>
                    </div>
                    <button className="px-5 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 🎬 VIDEO FEED 🎬 */}
            {activeFeature === "Flicks" && <FlicksFeed />}

            {/* 📖 STORIES AREA 📖 */}
            {activeFeature === "Film" && (
              <div className="space-y-6 px-2">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3 ml-4">
                  <span className="w-2 h-2 rounded-full bg-slate-200" />
                  Recent Stories
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                  {["You", "Ayesha", "Zain", "Sara", "Ali", "Hira"].map(
                    (name, i) => (
                      <div
                        key={name}
                        className="flex flex-col items-center gap-3 min-w-[85px]"
                      >
                        <div
                          className={`w-20 h-20 rounded-[2rem] p-1 ${i === 0 ? "bg-slate-100 border-2 border-dashed border-slate-300" : "bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500"}`}
                        >
                          <div className="w-full h-full rounded-[1.8rem] bg-white flex items-center justify-center text-slate-800 font-black text-xl border-2 border-white">
                            {name[0]}
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                          {name}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* 😂 MEME HUB 😂 */}
            {activeFeature === "Fun" && (
              <div className="space-y-6 px-2">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500/70 flex items-center gap-3 ml-4">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Daily Dose
                </h2>
                {[
                  "😂 When bugs become features",
                  "🎭 Logic vs Reality",
                  "🔥 Client: Just one small change",
                ].map((meme, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-[3rem] p-6 shadow-sm border border-slate-50"
                  >
                    <div className="w-full aspect-square rounded-[2rem] bg-slate-50 flex items-center justify-center mb-4 overflow-hidden border border-slate-50">
                      <span className="text-6xl grayscale opacity-40">
                        Meme {i + 1}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-600 text-center px-4">
                      {meme}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 🛠️ MATCHMAKING / TASKS / OTHERS 🛠️ */}
            {(activeFeature === "Post" ||
              activeFeature === "Task" ||
              activeFeature === "Groups" ||
              activeFeature === "Snapy" ||
              activeFeature === "Profile") && <MatchmakingSection />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --- Footer Floating Navigation --- */}
      <div className="fixed bottom-0 left-0 w-full z-50 pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto">
          <GolSlider onFeatureChange={setActiveFeature} />
        </div>
      </div>
    </div>
  );
};

export default Index;
