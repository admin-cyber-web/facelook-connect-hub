import { Heart, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface MatchProfile {
  name: string;
  age: number;
  initials: string;
  gradient: string;
  interests: string[];
}

const profiles: [MatchProfile, MatchProfile] = [
  { name: "Hira", age: 24, initials: "HR", gradient: "bg-gradient-to-br from-accent to-secondary", interests: ["Travel", "Music", "Art"] },
  { name: "Farhan", age: 26, initials: "FH", gradient: "bg-gradient-to-br from-primary to-secondary", interests: ["Tech", "Music", "Books"] },
];

const MatchmakingSection = () => {
  const commonInterests = profiles[0].interests.filter(i => profiles[1].interests.includes(i));
  const score = Math.round((commonInterests.length / Math.max(profiles[0].interests.length, profiles[1].interests.length)) * 100);

  return (
    <div className="px-4 md:px-8">
      <div className="glass rounded-2xl p-5 md:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Heart size={18} className="text-accent" />
          <span className="text-xs font-bold uppercase tracking-widest text-accent">Matchmaking</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          {profiles.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: i === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              className="flex-1 flex flex-col items-center gap-3"
            >
              <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full ${p.gradient} flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg`}>
                {p.initials}
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.age} years</p>
              </div>
              <div className="flex flex-wrap gap-1 justify-center">
                {p.interests.map(int => (
                  <span
                    key={int}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      commonInterests.includes(int)
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {int}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Score */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-5 flex flex-col items-center gap-2"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <span className="text-sm font-bold text-foreground">{score}% Compatible</span>
            <Sparkles size={16} className="text-accent" />
          </div>
          <div className="w-full max-w-48 h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MatchmakingSection;
