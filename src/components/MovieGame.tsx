import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import {
  seededQuestions,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type QuizQuestion,
} from "@/data/quizData";

// ── Sound CDN URLs ──────────────────────────────────────────────────────────
const SFX_CORRECT = "https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3";
const SFX_WRONG   = "https://assets.mixkit.co/sfx/preview/mixkit-wrong-buzzer-fail-2001.mp3";
const SFX_MATCH   = "https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3";
const SFX_BGM     = "https://assets.mixkit.co/sfx/preview/mixkit-game-show-suspense-waiting-667.mp3";

const TOTAL_ROUNDS   = 10;
const ROUND_SECS     = 30;
const FAST_THRESHOLD = 15;   // ≤15s → +18, >15s → +10
const FAST_PTS       = 18;
const SLOW_PTS       = 10;
const ENTRY_FEE      = 10;

type GamePhase = "lobby" | "waiting" | "matched" | "question" | "reveal" | "finished";

interface GameSession {
  id: string;
  host_id: string;
  guest_id: string | null;
  status: "waiting" | "playing" | "finished";
  host_score: number;
  guest_score: number;
  current_round: number;
  winner_id: string | null;
  round_start_time: string | null;
  current_question_id: string | null;
}

interface Props {
  userId: string;
  userProfile: { full_name: string; avatar_url: string; fame_points?: number };
}

// ── Circular Timer SVG ──────────────────────────────────────────────────────
function CircleTimer({ secs, total }: { secs: number; total: number }) {
  const r   = 36;
  const circ = 2 * Math.PI * r;
  const pct  = secs / total;
  const red  = secs <= 10;
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="96" height="96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#1a1a4e" strokeWidth="7" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={red ? "#ef4444" : "#a78bfa"}
          strokeWidth="7"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <span className={`text-2xl font-black z-10 ${red ? "text-red-400 animate-pulse" : "text-white"}`}>
        {secs}
      </span>
    </div>
  );
}

// ── Option Button ───────────────────────────────────────────────────────────
const OPT_LABELS = ["A", "B", "C", "D"] as const;
const OPT_COLORS = [
  "from-[#1a1a6e] to-[#2a2a8e]",   // A – navy
  "from-[#1a3a6e] to-[#2a5a9e]",   // B – blue
  "from-[#2a1a6e] to-[#4a2a9e]",   // C – indigo
  "from-[#3a1a6e] to-[#5a2a9e]",   // D – violet
];

function OptionBtn({
  idx, text, state, onSelect,
}: {
  idx: 0 | 1 | 2 | 3;
  text: string;
  state: "idle" | "selected" | "correct" | "wrong" | "reveal-correct";
  onSelect: () => void;
}) {
  const base = "relative flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all duration-300 w-full";
  const styles: Record<string, string> = {
    idle:           `bg-gradient-to-r ${OPT_COLORS[idx]} border-[#3d3d9e]/60 text-white active:scale-95`,
    selected:       `bg-gradient-to-r ${OPT_COLORS[idx]} border-violet-400 ring-2 ring-violet-400/50 text-white`,
    correct:        "bg-gradient-to-r from-green-600 to-green-500 border-green-400 ring-2 ring-green-400/50 text-white",
    wrong:          "bg-gradient-to-r from-red-700 to-red-600 border-red-400 ring-2 ring-red-400/50 text-white opacity-80",
    "reveal-correct":"bg-gradient-to-r from-green-600 to-green-500 border-green-400 text-white",
  };
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className={`${base} ${styles[state] || styles.idle}`}
      onClick={state === "idle" ? onSelect : undefined}
      disabled={state !== "idle"}
    >
      <span className="text-xs font-black w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
        {OPT_LABELS[idx]}
      </span>
      <span className="text-sm font-semibold leading-tight">{text}</span>
    </motion.button>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function MovieGame({ userId, userProfile }: Props) {
  // ── UI State ──────────────────────────────────────────────────────────────
  const [phase, setPhase]               = useState<GamePhase>("lobby");
  const [timer, setTimer]               = useState(ROUND_SECS);
  const [roundNum, setRoundNum]         = useState(1);
  const [question, setQuestion]         = useState<QuizQuestion | null>(null);
  const [selected, setSelected]         = useState<number | null>(null);
  const [myScore, setMyScore]           = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentName, setOpponentName] = useState("Opponent");
  const [resultMsg, setResultMsg]       = useState("");
  const [famePoints, setFamePoints]     = useState(userProfile.fame_points ?? 0);
  const [error, setError]               = useState<string | null>(null);
  const [isWinner, setIsWinner]         = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const sessionRef     = useRef<GameSession | null>(null);
  const isHostRef      = useRef(false);
  const questionsRef   = useRef<QuizQuestion[]>([]);
  const roundNumRef    = useRef(1);
  const myScoreRef     = useRef(0);
  const answeredRef    = useRef(false);
  const deductedRef    = useRef(false);
  const phaseRef       = useRef<GamePhase>("lobby");
  const timerIntRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef     = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio refs (preloaded once)
  const sfxCorrect     = useRef<HTMLAudioElement | null>(null);
  const sfxWrong       = useRef<HTMLAudioElement | null>(null);
  const sfxMatch       = useRef<HTMLAudioElement | null>(null);
  const sfxBgm         = useRef<HTMLAudioElement | null>(null);

  const setPhaseSync = (p: GamePhase) => { phaseRef.current = p; setPhase(p); };

  // ── Preload Audio ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = (url: string, loop = false) => {
      const a = new Audio(url);
      a.preload = "auto";
      a.loop    = loop;
      a.volume  = loop ? 0.12 : 0.7;
      a.load();
      return a;
    };
    sfxCorrect.current = load(SFX_CORRECT);
    sfxWrong.current   = load(SFX_WRONG);
    sfxMatch.current   = load(SFX_MATCH);
    sfxBgm.current     = load(SFX_BGM, true);
    return () => {
      sfxBgm.current?.pause();
    };
  }, []);

  const play = (ref: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (!ref.current) return;
    ref.current.currentTime = 0;
    ref.current.play().catch(() => {});
  };
  const stopBgm = () => { sfxBgm.current?.pause(); };

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (timerIntRef.current) clearInterval(timerIntRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    stopBgm();
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Fetch initial fame points ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles").select("fame_points").eq("id", userId).maybeSingle();
        if (data) setFamePoints(data.fame_points ?? 0);
      } catch (_) {}
    })();
  }, [userId]);

  // ── Matchmaking: insert-then-reconcile ────────────────────────────────────
  const startSearch = async () => {
    setPhaseSync("waiting");
    setError(null);

    // Deduct entry fee once
    if (!deductedRef.current) {
      deductedRef.current = true;
      try {
        const { data: prof } = await supabase
          .from("profiles").select("fame_points").eq("id", userId).single();
        const cur = prof?.fame_points ?? 0;
        await supabase.from("profiles").update({ fame_points: Math.max(0, cur - ENTRY_FEE) }).eq("id", userId);
        setFamePoints(Math.max(0, cur - ENTRY_FEE));
      } catch (_) {}
    }

    // Insert my room
    let myRoom: GameSession | null = null;
    try {
      const { data } = await supabase
        .from("game_sessions")
        .insert({
          host_id: userId, guest_id: null, status: "waiting",
          host_score: 0, guest_score: 0, current_round: 0,
          winner_id: null, round_start_time: null, current_question_id: null,
        })
        .select().single();
      myRoom = data as GameSession;
    } catch (_) {
      setError("Could not create room. Check DB setup.");
      setPhaseSync("lobby");
      return;
    }
    if (!myRoom) { setPhaseSync("lobby"); return; }
    sessionRef.current = myRoom;

    // Wait 400ms then reconcile
    await new Promise(r => setTimeout(r, 400));

    const { data: older } = await supabase
      .from("game_sessions")
      .select()
      .eq("status", "waiting")
      .lt("created_at", myRoom.created_at)
      .neq("host_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (older) {
      // Join older room as guest
      const { data: updated } = await supabase
        .from("game_sessions")
        .update({ guest_id: userId, status: "playing" })
        .eq("id", older.id)
        .eq("status", "waiting")
        .select().maybeSingle();

      if (updated) {
        // Self-destruct my room
        await supabase.from("game_sessions").delete().eq("id", myRoom.id);
        sessionRef.current = updated as GameSession;
        isHostRef.current  = false;
        questionsRef.current = seededQuestions(updated.id);
        await fetchOpponentName(updated.host_id);
        setPhaseSync("matched");
        setTimeout(() => subscribeToSession(), 200);
        return;
      }
    }

    // I am host — wait for guest via Realtime + polling
    isHostRef.current = true;
    questionsRef.current = []; // Will be set once session ID is final
    subscribeToWaiting(myRoom.id);
  };

  // ── Waiting subscription (host waiting for guest) ─────────────────────────
  const subscribeToWaiting = (sessionId: string) => {
    channelRef.current = supabase
      .channel(`wait-${sessionId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "game_sessions",
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        const s = payload.new as GameSession;
        if (s.guest_id && s.status === "playing") {
          channelRef.current?.unsubscribe();
          sessionRef.current = s;
          questionsRef.current = seededQuestions(s.id);
          fetchOpponentName(s.guest_id);
          setPhaseSync("matched");
          setTimeout(() => {
            startRound(s, 1);
          }, 1500);
        }
      })
      .subscribe();

    // Polling fallback
    pollRef.current = setInterval(async () => {
      if (phaseRef.current !== "waiting") { clearInterval(pollRef.current!); return; }
      try {
        const { data } = await supabase
          .from("game_sessions").select().eq("id", sessionId).maybeSingle();
        if (data?.guest_id && data.status === "playing") {
          clearInterval(pollRef.current!);
          sessionRef.current = data as GameSession;
          questionsRef.current = seededQuestions(data.id);
          fetchOpponentName(data.guest_id);
          setPhaseSync("matched");
          setTimeout(() => {
            startRound(data as GameSession, 1);
          }, 1500);
        }
      } catch (_) {}
    }, 2000);
  };

  // ── Subscribe to game state updates (guest) ───────────────────────────────
  const subscribeToSession = () => {
    const s = sessionRef.current;
    if (!s) return;
    channelRef.current = supabase
      .channel(`game-${s.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "game_sessions",
        filter: `id=eq.${s.id}`,
      }, (payload) => {
        const updated = payload.new as GameSession;
        sessionRef.current = updated;
        setOpponentScore(updated.host_score);

        if (updated.status === "finished") {
          endGame(updated);
          return;
        }
        if (
          updated.current_round > 0 &&
          updated.round_start_time &&
          updated.current_round !== roundNumRef.current
        ) {
          // Host advanced the round — sync guest
          const qIdx = updated.current_round - 1;
          const q    = questionsRef.current[qIdx];
          if (!q) return;
          roundNumRef.current = updated.current_round;
          answeredRef.current = false;
          setSelected(null);
          setRoundNum(updated.current_round);
          setQuestion(q);
          setPhaseSync("question");
          const elapsed = (Date.now() - new Date(updated.round_start_time!).getTime()) / 1000;
          const left    = Math.max(0, ROUND_SECS - Math.floor(elapsed));
          setTimer(left);
          startTimer(left, updated.current_round, updated.round_start_time!);
          play(sfxBgm);
        }
      })
      .subscribe();

    // Guest polling fallback
    pollRef.current = setInterval(async () => {
      if (phaseRef.current === "finished" || phaseRef.current === "lobby") {
        clearInterval(pollRef.current!); return;
      }
      try {
        const { data } = await supabase
          .from("game_sessions").select().eq("id", s.id).maybeSingle();
        if (!data) return;
        sessionRef.current = data as GameSession;
        setOpponentScore(data.host_score);

        if (data.status === "finished") {
          clearInterval(pollRef.current!);
          endGame(data as GameSession);
        }
      } catch (_) {}
    }, 3000);
  };

  // ── Fetch opponent name ───────────────────────────────────────────────────
  const fetchOpponentName = async (opponentId: string) => {
    try {
      const { data } = await supabase
        .from("profiles").select("full_name").eq("id", opponentId).maybeSingle();
      if (data?.full_name) setOpponentName(data.full_name.split(" ")[0]);
    } catch (_) {}
  };

  // ── Host: start a round ───────────────────────────────────────────────────
  const startRound = async (session: GameSession, round: number) => {
    const q = questionsRef.current[round - 1];
    if (!q) return;

    roundNumRef.current = round;
    answeredRef.current = false;
    setSelected(null);
    setRoundNum(round);
    setQuestion(q);
    setPhaseSync("question");
    setTimer(ROUND_SECS);
    play(sfxBgm);

    if (isHostRef.current) {
      const now = new Date().toISOString();
      try {
        await supabase.from("game_sessions").update({
          current_round: round,
          round_start_time: now,
          current_question_id: q.id,
        }).eq("id", session.id);
      } catch (_) {}
      startTimer(ROUND_SECS, round, now);
    }
  };

  // ── Countdown timer ───────────────────────────────────────────────────────
  const startTimer = (initialSecs: number, forRound: number, startTime: string) => {
    if (timerIntRef.current) clearInterval(timerIntRef.current);
    timerIntRef.current = setInterval(() => {
      const elapsed = (Date.now() - new Date(startTime).getTime()) / 1000;
      const left    = Math.max(0, ROUND_SECS - Math.floor(elapsed));
      setTimer(left);

      if (left <= 0) {
        clearInterval(timerIntRef.current!);
        if (!answeredRef.current) {
          // Time up — treat as wrong
          handleAnswer(-1, forRound, startTime);
        }
      }
    }, 500);
  };

  // ── Process answer ────────────────────────────────────────────────────────
  const handleAnswer = async (optionIdx: number, forRound: number, roundStartTime: string) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    if (timerIntRef.current) clearInterval(timerIntRef.current);
    stopBgm();

    const q       = questionsRef.current[forRound - 1];
    if (!q) return;
    const correct = optionIdx === q.correct;
    const elapsed = (Date.now() - new Date(roundStartTime).getTime()) / 1000;
    const pts     = correct ? (elapsed <= FAST_THRESHOLD ? FAST_PTS : SLOW_PTS) : 0;

    if (optionIdx >= 0) setSelected(optionIdx);

    if (correct) {
      setResultMsg(elapsed <= FAST_THRESHOLD ? `⚡ Fast! +${FAST_PTS}` : `✓ Correct! +${SLOW_PTS}`);
      play(sfxCorrect);
    } else {
      setResultMsg("✗ Wrong — 0 points");
      play(sfxWrong);
    }

    const newScore = myScoreRef.current + pts;
    myScoreRef.current = newScore;
    setMyScore(newScore);

    // Push score to DB
    const s = sessionRef.current;
    if (s) {
      try {
        const field = isHostRef.current ? "host_score" : "guest_score";
        await supabase.from("game_sessions").update({ [field]: newScore }).eq("id", s.id);
      } catch (_) {}
    }

    setPhaseSync("reveal");
    await new Promise(r => setTimeout(r, 2800));

    // Advance round
    if (forRound >= TOTAL_ROUNDS) {
      await finishGame();
    } else if (isHostRef.current) {
      await startRound(s!, forRound + 1);
    } else {
      // Guest waits for host to advance (Realtime will trigger)
      setPhaseSync("question");
    }
  };

  // ── User taps an option ───────────────────────────────────────────────────
  const onSelectOption = (idx: number) => {
    if (answeredRef.current || phaseRef.current !== "question") return;
    const s = sessionRef.current;
    if (!s?.round_start_time) return;
    handleAnswer(idx, roundNumRef.current, s.round_start_time);
  };

  // ── Finish game ───────────────────────────────────────────────────────────
  const finishGame = async () => {
    const s = sessionRef.current;
    if (!s) return;

    try {
      // Refresh final scores
      const { data } = await supabase
        .from("game_sessions").select().eq("id", s.id).maybeSingle();
      if (!data) return;

      const hostFinal  = isHostRef.current ? myScoreRef.current : data.host_score;
      const guestFinal = isHostRef.current ? data.guest_score   : myScoreRef.current;
      const winnerId   = hostFinal >= guestFinal ? data.host_id : (data.guest_id ?? data.host_id);

      await supabase.from("game_sessions").update({
        status: "finished", winner_id: winnerId,
        host_score: hostFinal, guest_score: guestFinal,
      }).eq("id", s.id);

      // Award winner
      const { data: wProf } = await supabase
        .from("profiles").select("fame_points").eq("id", winnerId).single();
      await supabase.from("profiles")
        .update({ fame_points: (wProf?.fame_points ?? 0) + 18 })
        .eq("id", winnerId);

      try {
        await supabase.from("admin_earnings").insert({
          session_id: s.id, amount: 2, reason: "quiz_commission",
          created_at: new Date().toISOString(),
        });
      } catch (_) {}

      endGame({ ...data, winner_id: winnerId });
    } catch (_) {
      endGame(s);
    }
  };

  const endGame = (s: GameSession) => {
    cleanup();
    setPhaseSync("finished");
    const won = s.winner_id === userId;
    setIsWinner(won);
    if (won) play(sfxMatch);
  };

  // ── Option display state ──────────────────────────────────────────────────
  const optionState = (idx: number): "idle" | "selected" | "correct" | "wrong" | "reveal-correct" => {
    if (phaseRef.current !== "reveal" && phaseRef.current !== "question") return "idle";
    if (phaseRef.current === "reveal" || selected !== null) {
      if (idx === question?.correct) return selected === idx ? "correct" : "reveal-correct";
      if (idx === selected && selected !== question?.correct) return "wrong";
    }
    if (idx === selected) return "selected";
    return "idle";
  };

  // ═════════════════════════════════════════════════════════════════════════
  // ── Render ────────────────────────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#07001a] via-[#0d0035] to-[#07001a] flex flex-col items-center justify-center px-4 pt-4 pb-8 overflow-hidden">

      {/* ── LOBBY ── */}
      <AnimatePresence mode="wait">
        {phase === "lobby" && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center gap-6 text-center max-w-sm w-full"
          >
            <div className="text-7xl">🎮</div>
            <h1 className="text-3xl font-black text-white">KBC Quiz Battle</h1>
            <p className="text-violet-300 text-sm leading-relaxed">
              10 rounds · Bollywood · Math · Birds · Songs<br/>
              Fast answer = <span className="text-yellow-400 font-bold">+18</span> · Slow = <span className="text-blue-300 font-bold">+10</span> · Wrong = <span className="text-red-400 font-bold">0</span>
            </p>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-sm text-violet-300">
              Entry Fee: <span className="text-white font-bold">10 Fame Points</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-2 text-sm text-violet-300">
              Your Balance: <span className="text-yellow-400 font-bold">{famePoints} pts</span>
            </div>
            {error && (
              <div className="bg-red-900/40 border border-red-500/40 rounded-xl px-4 py-2 text-red-300 text-xs">
                {error}
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-black text-lg shadow-xl shadow-purple-900/50"
              onClick={startSearch}
            >
              Find Opponent 🔍
            </motion.button>
          </motion.div>
        )}

        {/* ── WAITING ── */}
        {phase === "waiting" && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="w-16 h-16 rounded-full border-4 border-violet-400 border-t-transparent animate-spin" />
            <p className="text-violet-300 font-semibold text-lg">Looking for opponent…</p>
            <p className="text-white/30 text-xs">Share Facelook with a friend to play together!</p>
          </motion.div>
        )}

        {/* ── MATCHED ── */}
        {phase === "matched" && (
          <motion.div
            key="matched"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <div className="text-6xl">🤝</div>
            <h2 className="text-2xl font-black text-white">Opponent Found!</h2>
            <p className="text-violet-300">vs <span className="text-yellow-400 font-bold">{opponentName}</span></p>
            {isHostRef.current && (
              <p className="text-white/40 text-xs animate-pulse">Starting game…</p>
            )}
          </motion.div>
        )}

        {/* ── QUESTION / REVEAL ── */}
        {(phase === "question" || phase === "reveal") && question && (
          <motion.div
            key={`q-${roundNum}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="flex flex-col gap-4 w-full max-w-md"
          >
            {/* Score bar */}
            <div className="flex items-center justify-between px-1">
              <div className="text-center">
                <p className="text-white/40 text-[10px] uppercase tracking-widest">You</p>
                <p className="text-yellow-400 font-black text-xl">{myScore}</p>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-violet-300 text-xs font-bold">Round {roundNum}/{TOTAL_ROUNDS}</p>
                <div className="flex gap-1 mt-1">
                  {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${i < roundNum ? "bg-violet-500" : "bg-white/10"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="text-center">
                <p className="text-white/40 text-[10px] uppercase tracking-widest">{opponentName}</p>
                <p className="text-blue-300 font-black text-xl">{opponentScore}</p>
              </div>
            </div>

            {/* Timer */}
            <div className="flex justify-center">
              <CircleTimer secs={timer} total={ROUND_SECS} />
            </div>

            {/* Category badge */}
            <div className={`self-start px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${CATEGORY_COLORS[question.category]} text-white`}>
              {CATEGORY_LABELS[question.category]}
            </div>

            {/* Question card */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur">
              <p className="text-white font-bold text-base leading-snug">{question.question}</p>
            </div>

            {/* Reveal message */}
            <AnimatePresence>
              {phase === "reveal" && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`text-center font-black text-lg ${resultMsg.startsWith("✗") ? "text-red-400" : "text-green-400"}`}
                >
                  {resultMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Options grid */}
            <div className="grid grid-cols-2 gap-3">
              {question.options.map((opt, i) => (
                <OptionBtn
                  key={i}
                  idx={i as 0 | 1 | 2 | 3}
                  text={opt}
                  state={optionState(i)}
                  onSelect={() => onSelectOption(i)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── FINISHED ── */}
        {phase === "finished" && (
          <motion.div
            key="finished"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-6 text-center max-w-sm w-full"
          >
            <div className="text-7xl">{isWinner ? "🏆" : "😔"}</div>
            <h2 className="text-3xl font-black text-white">
              {isWinner ? "You Won!" : "Better Luck!"}
            </h2>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-8 py-4 w-full">
              <p className="text-white/50 text-xs mb-3 uppercase tracking-widest">Final Scores</p>
              <div className="flex justify-around">
                <div>
                  <p className="text-white/40 text-xs">You</p>
                  <p className="text-yellow-400 font-black text-3xl">{myScore}</p>
                </div>
                <div className="w-px bg-white/10" />
                <div>
                  <p className="text-white/40 text-xs">{opponentName}</p>
                  <p className="text-blue-300 font-black text-3xl">{opponentScore}</p>
                </div>
              </div>
            </div>
            {isWinner && (
              <div className="text-sm text-violet-300">
                +18 Fame Points awarded! 🌟
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-black text-lg"
              onClick={() => {
                deductedRef.current = false;
                myScoreRef.current  = 0;
                roundNumRef.current = 1;
                setMyScore(0);
                setOpponentScore(0);
                setRoundNum(1);
                setQuestion(null);
                setSelected(null);
                setPhaseSync("lobby");
              }}
            >
              Play Again
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
