import "./_group.css";
import { motion } from "framer-motion";
import { Bell, Home, MessageCircle, Search, Settings } from "lucide-react";

function FlicksWordmark() {
  return (
    <span className="text-[18px] font-black tracking-tight leading-none text-white sm:text-[20px]">
      FLICKS
    </span>
  );
}

function IndiaMark() {
  return (
    <span
      aria-label="India"
      className="flex h-4 w-4 flex-col overflow-hidden rounded-[2px] shadow-sm"
    >
      <span className="h-1/3 w-full bg-[#ff9933]" />
      <span className="h-1/3 w-full bg-white" />
      <span className="h-1/3 w-full bg-[#138808]" />
    </span>
  );
}

export function CurrentHeader() {
  return (
    <div className="bg-[#07080d] text-white">
      <header
        className="relative flex min-h-[52px] w-full items-center gap-1.5 border-b border-white/10 px-3 pb-2 pt-2 backdrop-blur-2xl sm:gap-3 sm:px-5"
        style={{ background: "rgba(10,10,20,0.95)" }}
      >
        <div className="flex min-w-0 flex-shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-[12px] font-black italic text-white shadow-lg shadow-blue-500/30">
            F
          </span>
          <FlicksWordmark />
          <IndiaMark />
        </div>
        <div className="flex-1" />
        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
          <motion.button
            whileTap={{ scale: 0.88 }}
            aria-label="Home"
            className="flex-shrink-0 rounded-xl border border-lime-400/25 p-1.5 transition-all hover:bg-lime-400/10 sm:p-2"
            style={{ background: "rgba(163,230,53,0.08)" }}
          >
            <Home size={17} className="text-lime-400" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            aria-label="Search"
            className="flex-shrink-0 rounded-xl border border-lime-400/25 p-2 transition-all hover:bg-lime-400/15"
            style={{ background: "rgba(163,230,53,0.08)" }}
          >
            <Search size={17} className="text-lime-400" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            aria-label="Notifications"
            className="relative flex-shrink-0 rounded-2xl border border-lime-400/25 p-2.5 transition-all hover:bg-lime-400/15"
            style={{ background: "rgba(163,230,53,0.08)" }}
          >
            <Bell size={18} className="text-lime-400 drop-shadow-md" />
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#0a0a14] bg-red-500 px-0.5 text-[9px] font-black text-white">
              4
            </span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            aria-label="Chat"
            className="relative flex-shrink-0 rounded-xl border border-lime-400/25 p-2 transition-all hover:bg-lime-400/10"
            style={{ background: "rgba(163,230,53,0.08)" }}
          >
            <MessageCircle size={17} className="text-lime-400" />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-[#0a0a14] bg-red-500 px-0.5 text-[9px] font-black text-white">
              2
            </span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            aria-label="Settings"
            className="flex-shrink-0 rounded-xl border border-lime-400/25 p-2 transition-all hover:bg-lime-400/10"
            style={{ background: "rgba(163,230,53,0.08)" }}
          >
            <Settings size={17} className="text-lime-400" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            aria-label="Profile"
            className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-xl border-2 border-yellow-400/60 shadow-lg"
            style={{ boxShadow: "0 0 12px rgba(250,204,21,0.35)" }}
          >
            <span className="flex h-full w-full items-center justify-center bg-blue-600 text-xs font-black text-white">
              A
            </span>
          </motion.button>
        </div>
      </header>
    </div>
  );
}
