import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { getMissingLetters, getRandomMovies, type MovieEntry } from "@/data/gameData";
import { Users, Loader2, CheckCircle2, XCircle, Star, Shuffle } from "lucide-react";

const CORRECT_SFX = "https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3";
const WRONG_SFX   = "https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3";
const MATCH_SFX   = "https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3";

function playSound(url: string) {
  try { new Audio(url).play().catch(() => {}); } catch (_) {}
}

type GamePhase = "lobby" | "waiting" | "matched" | "game" | "finished";
type Round = 1 | 2 | 3 | 4 | 5;

interface GameSession {
  id: string;
  host_id: string;
  guest_id: string | null;
  status: "waiting" | "playing" | "finished";
  host_score: number;
  guest_score: number;
  current_round: number;
  movie_indices: number[];
  winner_id: string | null;
}

const ROUND_LABELS: Record<Round, string> = {
  1: "Blur Poster",
  2: "Missing Letters",
  3: "Actor's Eyes",
  4: "Emoji Guess",
  5: "Jumbled Name",
};

const ROUND_COLORS: Record<Round, string> = {
  1: "from-purple-600 to-blue-600",
  2: "from-blue-600 to-cyan-500",
  3: "from-cyan-500 to-green-500",
  4: "from-yellow-500 to-orange-500",
  5: "from-orange-500 to-red-600",
};

interface Props {
  userId: string;
  userProfile: { full_name: string; avatar_url: string; fame_points?: number };
}

export default function MovieGame({ userId, userProfile }: Props) {
  // ── UI State ──────────────────────────────────────────────────────────────
  const [phase, setPhase]               = useState<GamePhase>("lobby");
  const [currentMovies, setCurrentMovies] = useState<MovieEntry[]>([]);
  const [round, setRound]               = useState<Round>(1);
  const [movieIdx, setMovieIdx]         = useState(0);
  const [timer, setTimer]               = useState(10);
  const [answer, setAnswer]             = useState("");
  const [myScore, setMyScore]           = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [lastResult, setLastResult]     = useState<"correct" | "wrong" | null>(null);
  const [showResult, setShowResult]     = useState(false);
  const [famePoints, setFamePoints]     = useState(0);
  const [answers, setAnswers]           = useState<{ movie: MovieEntry; myAnswer: string; correct: boolean }[]>([]);
  const [opponentName, setOpponentName] = useState("Opponent");
  const [posterError, setPosterError]   = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // ── Refs (safe inside async callbacks & Realtime handlers) ────────────────
  const sessionRef      = useRef<GameSession | null>(null);
  const isHostRef       = useRef(false);
  const moviesRef       = useRef<MovieEntry[]>([]);
  const roundRef        = useRef<Round>(1);
  const movieIdxRef     = useRef(0);
  const myScoreRef      = useRef(0);
  const opponentScoreRef = useRef(0);
  const deductedRef     = useRef(false);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef      = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef        = useRef<GamePhase>("lobby");
  const inputRef        = useRef<HTMLInputElement>(null);

  // Keep refs in sync with state
  const setPhaseSync = (p: GamePhase) => { phaseRef.current = p; setPhase(p); };
  const setRoundSync = (r: Round)     => { roundRef.current = r; setRound(r); };
  const setMovieIdxSync = (i: number) => { movieIdxRef.current = i; setMovieIdx(i); };

  useEffect(() => {
    fetchFamePoints();
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      pollRef.current  && clearInterval(pollRef.current);
      channelRef.current?.unsubscribe();
    };
  }, []);

  // ── DB helpers ─────────────────────────────────────────────────────────────
  const fetchFamePoints = async () => {
    const { data } = await supabase
      .from("profiles").select("fame_points").eq("id", userId).single();
    if (data) setFamePoints(data.fame_points ?? 0);
  };

  /** Deduct -10 by reading current DB value first — avoids stale state */
  const deductEntryFee = async () => {
    if (deductedRef.current) return;
    deductedRef.current = true;
    const { data } = await supabase
      .from("profiles").select("fame_points").eq("id", userId).single();
    const current = data?.fame_points ?? 0;
    const next = Math.max(0, current - 10);
    await supabase.from("profiles").update({ fame_points: next }).eq("id", userId);
    setFamePoints(next);
  };

  /** Award winner +18, record admin commission +2 */
  const awardWinner = async (winnerId: string, sessionId: string) => {
    const { data } = await supabase
      .from("profiles").select("fame_points").eq("id", winnerId).single();
    const current = data?.fame_points ?? 0;
    await supabase.from("profiles").update({ fame_points: current + 18 }).eq("id", winnerId);
    await supabase.from("admin_earnings").insert({
      session_id: sessionId, amount: 2, reason: "movie_game_commission",
      created_at: new Date().toISOString(),
    }).catch(() => {});
    if (winnerId === userId) setFamePoints(current + 18);
  };

  const fetchOpponentName = async (opponentId: string) => {
    const { data } = await supabase
      .from("profiles").select("full_name").eq("id", opponentId).single();
    if (data?.full_name) setOpponentName(data.full_name);
  };

  // ── Timer ─────────────────────────────────────────────────────────────────
  /** Uses refs so it's always fresh even inside Realtime callbacks */
  const startTimer = useCallback(() => {
    timerRef.current && clearInterval(timerRef.current);
    setTimer(10);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          // Use refs to get current game state — avoids stale closure
          processAnswerRef.current("");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  // ── Game logic ─────────────────────────────────────────────────────────────
  const processAnswer = useCallback((userAnswer: string) => {
    const movie = moviesRef.current[movieIdxRef.current];
    if (!movie) return;
    timerRef.current && clearInterval(timerRef.current);

    const correct = userAnswer.trim().toUpperCase() === movie.title.toUpperCase();
    if (correct) { playSound(CORRECT_SFX); myScoreRef.current += 1; setMyScore(myScoreRef.current); }
    else         { playSound(WRONG_SFX); }

    setLastResult(correct ? "correct" : "wrong");
    setShowResult(true);
    setAnswers((prev) => [...prev, { movie, myAnswer: userAnswer || "(No Answer)", correct }]);

    setTimeout(() => {
      setShowResult(false);
      setAnswer("");
      setPosterError(false);

      // Advance
      const nextRound = (roundRef.current + 1) as Round;
      const nextIdx   = movieIdxRef.current + 1;
      const isLastRound = roundRef.current >= 5;
      const isLastMovie = movieIdxRef.current >= moviesRef.current.length - 1;

      if (isLastRound || isLastMovie) {
        endGame();
      } else {
        setRoundSync(nextRound);
        setMovieIdxSync(nextIdx);
        setTimeout(startTimer, 80);
      }
    }, 1500);
  }, [startTimer]);

  // Store processAnswer in a ref so the timer closure can call the latest version
  const processAnswerRef = useRef(processAnswer);
  useEffect(() => { processAnswerRef.current = processAnswer; }, [processAnswer]);

  const endGame = async () => {
    timerRef.current && clearInterval(timerRef.current);
    pollRef.current  && clearInterval(pollRef.current);
    const sess = sessionRef.current;
    if (sess) {
      const field = isHostRef.current ? "host_score" : "guest_score";
      await supabase.from("game_sessions")
        .update({ [field]: myScoreRef.current, status: "finished" })
        .eq("id", sess.id);

      if (isHostRef.current) {
        const winnerId = myScoreRef.current >= opponentScoreRef.current
          ? userId
          : (sess.guest_id || userId);
        await awardWinner(winnerId, sess.id);
        await supabase.from("game_sessions")
          .update({ winner_id: winnerId }).eq("id", sess.id);
      }
    }
    setPhaseSync("finished");
  };

  // ── Matchmaking ───────────────────────────────────────────────────────────
  /**
   * 1. Search for a 'waiting' room (not created by self)
   * 2a. If found → join it, deduct fee, subscribe, go to matched
   * 2b. If not  → create room, deduct fee, subscribe, poll for opponent
   */
  const joinOrCreateSession = async () => {
    if (famePoints < 10) {
      setError("You need at least 10 Fame Points to enter! Earn points by posting.");
      return;
    }
    setError(null);
    setPhaseSync("waiting");

    // Step 1: look for an open room
    const { data: waiting, error: findErr } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("status", "waiting")
      .is("guest_id", null)
      .neq("host_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (findErr) {
      setError("DB error — make sure game_sessions table exists.");
      setPhaseSync("lobby");
      return;
    }

    if (waiting) {
      // ── GUEST PATH ──────────────────────────────────────────────────────
      const movies = getRandomMovies(5);
      moviesRef.current = movies;
      setCurrentMovies(movies);

      // Update the row — this triggers host's Realtime listener
      const { error: joinErr } = await supabase
        .from("game_sessions")
        .update({ guest_id: userId, status: "playing" })
        .eq("id", waiting.id)
        .eq("status", "waiting");   // guard: only join if still waiting

      if (joinErr) {
        // Room was taken between select & update — retry
        return joinOrCreateSession();
      }

      const joined: GameSession = { ...waiting, guest_id: userId, status: "playing" };
      sessionRef.current = joined;
      isHostRef.current  = false;

      // Deduct AFTER successful join
      await deductEntryFee();
      fetchOpponentName(waiting.host_id);
      subscribeToSession(joined.id, false);

      setPhaseSync("matched");
      playSound(MATCH_SFX);
      setTimeout(() => { setPhaseSync("game"); startTimer(); }, 2000);

    } else {
      // ── HOST PATH ───────────────────────────────────────────────────────
      const movies = getRandomMovies(5);
      moviesRef.current = movies;
      setCurrentMovies(movies);

      const { data: created, error: createErr } = await supabase
        .from("game_sessions")
        .insert({
          host_id: userId, guest_id: null, status: "waiting",
          host_score: 0, guest_score: 0, current_round: 1,
          movie_indices: [], winner_id: null,
        })
        .select()
        .single();

      if (createErr || !created) {
        setError("Could not create game session. Ensure the game_sessions table exists in Supabase.");
        setPhaseSync("lobby");
        return;
      }

      sessionRef.current = created;
      isHostRef.current  = true;

      // Deduct AFTER successful session creation
      await deductEntryFee();
      subscribeToSession(created.id, true);
      startPollingForOpponent(created.id);  // backup in case Realtime is slow
    }
  };

  // ── Realtime Subscription ─────────────────────────────────────────────────
  /**
   * Listen for UPDATE on the session row.
   * When guest joins (guest_id filled), host transitions to matched → game.
   * When scores update, opponent score refreshes.
   */
  const subscribeToSession = (sessionId: string, hosting: boolean) => {
    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`game-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "game_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const updated = payload.new as GameSession;
          sessionRef.current = updated;

          // Host: detect when guest has joined
          if (hosting && updated.status === "playing" && updated.guest_id) {
            if (phaseRef.current === "waiting") {
              pollRef.current && clearInterval(pollRef.current);
              fetchOpponentName(updated.guest_id);
              setPhaseSync("matched");
              playSound(MATCH_SFX);
              setTimeout(() => {
                setPhaseSync("game");
                startTimer();          // startTimer is stable (useCallback [])
              }, 2000);
            }
          }

          // Sync opponent score
          if (hosting) {
            opponentScoreRef.current = updated.guest_score ?? 0;
            setOpponentScore(updated.guest_score ?? 0);
          } else {
            opponentScoreRef.current = updated.host_score ?? 0;
            setOpponentScore(updated.host_score ?? 0);
          }
        }
      )
      .subscribe();
  };

  /**
   * Polling fallback — host polls every 2 s in case Realtime event is missed.
   * Stops once opponent is found or phase changes.
   */
  const startPollingForOpponent = (sessionId: string) => {
    pollRef.current && clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (phaseRef.current !== "waiting") {
        clearInterval(pollRef.current!);
        return;
      }
      const { data } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (data && data.guest_id && data.status === "playing") {
        clearInterval(pollRef.current!);
        sessionRef.current = data;
        fetchOpponentName(data.guest_id);
        setPhaseSync("matched");
        playSound(MATCH_SFX);
        setTimeout(() => {
          setPhaseSync("game");
          startTimer();
        }, 2000);
      }
    }, 2000);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetGame = async () => {
    timerRef.current && clearInterval(timerRef.current);
    pollRef.current  && clearInterval(pollRef.current);
    channelRef.current?.unsubscribe();

    // Clean up any stale waiting room this user created
    if (sessionRef.current && isHostRef.current && sessionRef.current.status === "waiting") {
      await supabase.from("game_sessions")
        .delete().eq("id", sessionRef.current.id).eq("status", "waiting");
    }

    sessionRef.current       = null;
    isHostRef.current        = false;
    moviesRef.current        = [];
    roundRef.current         = 1;
    movieIdxRef.current      = 0;
    myScoreRef.current       = 0;
    opponentScoreRef.current = 0;
    deductedRef.current      = false;
    phaseRef.current         = "lobby";

    setPhase("lobby");
    setCurrentMovies([]);
    setRound(1);
    setMovieIdx(0);
    setTimer(10);
    setAnswer("");
    setMyScore(0);
    setOpponentScore(0);
    setLastResult(null);
    setShowResult(false);
    setAnswers([]);
    setOpponentName("Opponent");
    setPosterError(false);
    setError(null);
    fetchFamePoints();
  };

  // ── Round UI ──────────────────────────────────────────────────────────────
  const currentMovie = moviesRef.current[movieIdxRef.current] ?? currentMovies[movieIdx];

  const renderRoundChallenge = () => {
    if (!currentMovie) return null;
    const r = round;
    switch (r) {
      case 1:
        return (
          <div className="relative w-full aspect-[2/3] max-w-[190px] mx-auto rounded-2xl overflow-hidden">
            {!posterError ? (
              <img
                src={currentMovie.poster}
                alt="poster"
                className="w-full h-full object-cover"
                style={{ filter: "blur(14px)", transform: "scale(1.15)" }}
                onError={() => setPosterError(true)}
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${ROUND_COLORS[r]} flex items-center justify-center text-5xl`}>
                🎬
              </div>
            )}
            <div className="absolute inset-0 flex items-end justify-center pb-3">
              <span className="text-[10px] font-black text-white/80 uppercase tracking-widest bg-black/40 px-2 py-1 rounded-full">
                🎬 Blur Poster
              </span>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="text-center space-y-3 w-full">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Fill in the blanks</p>
            <p className="text-xl font-black text-white tracking-[0.25em] break-all">
              {getMissingLetters(currentMovie.title)}
            </p>
            <p className="text-xs text-white/50 italic">{currentMovie.hint}</p>
          </div>
        );
      case 3:
        return (
          <div className="relative w-full aspect-square max-w-[170px] mx-auto rounded-2xl overflow-hidden">
            {!posterError ? (
              <img
                src={currentMovie.poster}
                alt="eyes"
                className="w-full h-full object-cover object-top"
                style={{ transform: "scale(2.4) translateY(12%)" }}
                onError={() => setPosterError(true)}
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${ROUND_COLORS[r]} flex items-center justify-center text-4xl`}>
                👁️
              </div>
            )}
            <div className="absolute inset-0 flex items-end justify-center pb-3">
              <span className="text-[10px] font-black text-white/80 uppercase tracking-widest bg-black/40 px-2 py-1 rounded-full">
                👁️ Actor's Eyes
              </span>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="text-center space-y-4">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Guess the movie</p>
            <p className="text-5xl tracking-widest">{currentMovie.emojis}</p>
          </div>
        );
      case 5:
        return (
          <div className="text-center space-y-3">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Unscramble the title</p>
            <div className="flex flex-wrap justify-center gap-2">
              {currentMovie.jumbled.split("-").map((letter, i) => (
                <span
                  key={i}
                  className={`w-9 h-9 rounded-xl bg-gradient-to-br ${ROUND_COLORS[r]} flex items-center justify-center text-white font-black text-sm shadow-lg`}
                >
                  {letter}
                </span>
              ))}
            </div>
          </div>
        );
    }
  };

  // ── Phases ────────────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 space-y-6 shadow-2xl">
            <div className="text-center space-y-1">
              <div className="text-4xl mb-2">🎬</div>
              <h1 className="text-2xl font-black text-white">Movie Mania</h1>
              <p className="text-xs text-white/50 font-medium">1v1 Indian Movie Quiz — 5 Rounds</p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Entry", value: "-10 pts", color: "text-red-400",    icon: "💸" },
                { label: "Win",   value: "+18 pts", color: "text-green-400",  icon: "🏆" },
                { label: "Admin", value: "+2 pts",  color: "text-yellow-400", icon: "⚙️" },
              ].map((item) => (
                <div key={item.label} className="bg-white/5 rounded-2xl p-3 border border-white/10">
                  <div className="text-lg">{item.icon}</div>
                  <p className={`text-sm font-black ${item.color}`}>{item.value}</p>
                  <p className="text-[9px] text-white/30 font-bold uppercase">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white/5 rounded-2xl p-3 border border-white/10 text-center">
              <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">Your Fame Points</p>
              <p className="text-2xl font-black text-yellow-400 flex items-center justify-center gap-1">
                <Star size={18} fill="currentColor" /> {famePoints}
              </p>
            </div>

            <div className="space-y-2 text-[10px] text-white/30 font-bold">
              {(Object.entries(ROUND_LABELS) as [string, string][]).map(([r, label]) => (
                <div key={r} className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${ROUND_COLORS[Number(r) as Round]} flex items-center justify-center text-white font-black text-[9px]`}>{r}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 text-xs text-red-300 text-center">
                {error}
              </div>
            )}

            <button
              onClick={joinOrCreateSession}
              disabled={famePoints < 10}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Users size={18} /> Find Opponent
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 space-y-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mx-auto">
            <Loader2 size={40} className="text-blue-400 animate-spin" />
          </div>
          <h2 className="text-xl font-black text-white">Finding Opponent...</h2>
          <p className="text-xs text-white/40">Share the app with a friend to play!</p>
          <p className="text-[10px] text-white/20">Checking every 2 seconds...</p>
          <button
            onClick={resetGame}
            className="px-6 py-2 rounded-full bg-white/10 border border-white/20 text-white/60 text-xs font-black uppercase"
          >
            Cancel
          </button>
        </motion.div>
      </div>
    );
  }

  if (phase === "matched") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="text-center space-y-4"
        >
          <div className="text-6xl">⚡</div>
          <h2 className="text-2xl font-black text-white">Match Found!</h2>
          <p className="text-white/60 text-sm">VS <span className="text-yellow-400 font-black">{opponentName}</span></p>
          <p className="text-xs text-white/30">Game starts in a moment...</p>
        </motion.div>
      </div>
    );
  }

  if (phase === "game" && currentMovie) {
    return (
      <div className="w-full max-w-sm mx-auto px-4 py-4 space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${ROUND_COLORS[round]} flex items-center justify-center text-white font-black text-xs`}>
              {round}
            </div>
            <div>
              <p className="text-[9px] text-white/40 font-black uppercase tracking-widest">Round {round}/5</p>
              <p className="text-xs text-white font-black">{ROUND_LABELS[round]}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-black">
            <span className="text-green-400">{myScore}pts</span>
            <span className="text-white/30">vs</span>
            <span className="text-orange-400">{opponentScore}pts</span>
          </div>
        </div>

        {/* Timer bar */}
        <div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${ROUND_COLORS[round]} rounded-full`}
              animate={{ width: `${(timer / 10) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-white/30 font-black">TIMER</span>
            <span className={`text-[9px] font-black ${timer <= 3 ? "text-red-400 animate-pulse" : "text-white/60"}`}>
              {timer}s
            </span>
          </div>
        </div>

        {/* Challenge area */}
        <div className="bg-white/10 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-5 min-h-[220px] flex flex-col items-center justify-center relative overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${ROUND_COLORS[round]} opacity-5`} />
          <div className="relative z-10 w-full">{renderRoundChallenge()}</div>
        </div>

        {/* Answer input */}
        <div className="space-y-2">
          <p className="text-[10px] text-white/30 font-black uppercase tracking-widest px-1">
            🎯 {currentMovie.hint}
          </p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && processAnswerRef.current(answer)}
              placeholder="Type movie name..."
              autoComplete="off"
              className="flex-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 text-sm font-bold text-white placeholder:text-white/20 outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <button
              onClick={() => processAnswerRef.current(answer)}
              className={`px-4 py-3 rounded-2xl bg-gradient-to-r ${ROUND_COLORS[round]} text-white font-black text-sm active:scale-95 transition-all`}
            >
              Go
            </button>
          </div>
        </div>

        {/* Result flash */}
        <AnimatePresence>
          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className={`fixed inset-x-4 bottom-32 rounded-3xl p-4 flex items-center gap-3 shadow-2xl z-[500] backdrop-blur-xl ${
                lastResult === "correct"
                  ? "bg-green-500/90 border border-green-400"
                  : "bg-red-500/90 border border-red-400"
              }`}
            >
              {lastResult === "correct"
                ? <CheckCircle2 size={28} className="text-white shrink-0" />
                : <XCircle     size={28} className="text-white shrink-0" />}
              <div>
                <p className="text-white font-black text-sm">
                  {lastResult === "correct" ? "🎉 Sahi Jawab!" : "❌ Galat!"}
                </p>
                <p className="text-white/80 text-xs">Answer: {currentMovie.title}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (phase === "finished") {
    const iWon  = myScore > opponentScore;
    const isDraw = myScore === opponentScore;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-sm mx-auto px-4 py-4 space-y-4">
        {/* Result card */}
        <div className={`rounded-[2.5rem] p-6 text-center space-y-3 border backdrop-blur-xl ${
          iWon  ? "bg-yellow-500/10 border-yellow-500/30" :
          isDraw ? "bg-blue-500/10 border-blue-500/30"   :
                   "bg-slate-500/10 border-white/10"
        }`}>
          <div className="text-5xl">{iWon ? "🏆" : isDraw ? "🤝" : "😔"}</div>
          <h2 className="text-2xl font-black text-white">
            {iWon ? "Tu Jeet Gaya!" : isDraw ? "Draw!" : "Haar Gaya!"}
          </h2>
          <div className="flex justify-center gap-8 text-center">
            <div>
              <p className="text-3xl font-black text-green-400">{myScore}</p>
              <p className="text-[9px] text-white/40 font-black uppercase">You</p>
            </div>
            <div className="text-white/20 font-black text-xl pt-1">vs</div>
            <div>
              <p className="text-3xl font-black text-orange-400">{opponentScore}</p>
              <p className="text-[9px] text-white/40 font-black uppercase">{opponentName}</p>
            </div>
          </div>
          {iWon && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-2">
              <p className="text-green-400 font-black text-sm">+18 Fame Points Added! 🌟</p>
            </div>
          )}
        </div>

        {/* Answer sheet */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-black text-white/40 uppercase tracking-widest">📋 Answer Sheet</p>
          </div>
          <div className="divide-y divide-white/5">
            {answers.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="text-lg">{entry.correct ? "✅" : "❌"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-white truncate">{entry.movie.title}</p>
                  <p className="text-[10px] text-white/30 truncate">You: {entry.myAnswer}</p>
                </div>
                <span className="text-lg shrink-0">{entry.movie.emojis.split("")[0]}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={resetGame}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Shuffle size={18} /> Play Again
        </button>
      </motion.div>
    );
  }

  return null;
}
