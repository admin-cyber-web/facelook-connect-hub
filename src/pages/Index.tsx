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
    <div className="min-h-screen w-full">
      <Header />

      {/* Main content */}
      <main className="pt-20 pb-40 max-w-2xl mx-auto space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFeature}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {activeFeature === "Fame" && (
              <>
                <ConnectionPanel />
                <FameFeed />
              </>
            )}

            {activeFeature === "Face" && (
              <div className="px-4 md:px-8">
                <div className="glass rounded-2xl p-8 flex flex-col items-center gap-4">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-3xl shadow-xl">
                    U
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Your Profile</h2>
                  <p className="text-sm text-muted-foreground text-center max-w-xs">Manage your DP, cover photo, gallery, and friend connections.</p>
                  <div className="flex gap-6 mt-2 text-center">
                    <div><p className="text-lg font-bold text-foreground">248</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Friends</p></div>
                    <div><p className="text-lg font-bold text-foreground">52</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Posts</p></div>
                    <div><p className="text-lg font-bold text-foreground">1.2k</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Likes</p></div>
                  </div>
                </div>
              </div>
            )}

            {activeFeature === "Flame" && (
              <div className="px-4 md:px-8 space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/60 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Groups & Collaboration
                </h2>
                {["#ReactDevs", "#DesignDaily", "#StartupPK"].map((group) => (
                  <div key={group} className="glass rounded-2xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-secondary flex items-center justify-center text-primary-foreground text-sm font-bold">
                        {group[1]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{group}</p>
                        <p className="text-[11px] text-muted-foreground">12 members · 5 posts today</p>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeFeature === "Flicks" && <FlicksFeed />}

            {activeFeature === "Film" && (
              <div className="px-4 md:px-8 space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/60 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  Stories · 24h
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {["You", "Ayesha", "Zain", "Sara", "Ali", "Hira"].map((name, i) => (
                    <div key={name} className="flex flex-col items-center gap-2 min-w-[72px]">
                      <div className={`w-16 h-16 rounded-full ${i === 0 ? 'border-2 border-dashed border-primary/40' : 'ring-2 ring-primary/50'} bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-foreground font-semibold text-sm`}>
                        {name[0]}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeFeature === "Fun" && (
              <div className="px-4 md:px-8 space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/60 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Fun & Entertainment
                </h2>
                {["😂 When your code works on the first try", "🎭 Developer life in one picture", "🔥 This meme hits different at 3 AM"].map((meme, i) => (
                  <div key={i} className="glass rounded-2xl p-5">
                    <div className="w-full aspect-video rounded-xl bg-gradient-to-br from-accent/10 via-primary/10 to-secondary/10 flex items-center justify-center mb-3">
                      <span className="text-4xl">{meme.split(" ")[0]}</span>
                    </div>
                    <p className="text-sm text-foreground/80">{meme}</p>
                  </div>
                ))}
              </div>
            )}

            {(activeFeature === "Post" || activeFeature === "Task" || activeFeature === "Groups" || activeFeature === "Snapy" || activeFeature === "Profile") && (
              <MatchmakingSection />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <GolSlider onFeatureChange={setActiveFeature} />
    </div>
  );
};

export default Index;
