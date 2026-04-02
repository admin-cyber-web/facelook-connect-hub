import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { MOVIES, getMissingLetters, getRandomMovies, type MovieEntry } from "@/data/gameData";
import { Timer, Trophy, Zap, Users, Loader2, CheckCircle2, XCircle, Star, Shuffle } from "lucide-react";

const CORRECT_SFX = "https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3";
const WRONG_SFX = "https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3";
const MATCH_SFX = "https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3";

function playSound(url: string) {
  try {
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (_) {}
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
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [session, setSession] = useState<GameSession | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [currentMovies, setCurrentMovies] = useState<MovieEntry[]>([]);
  const [round, setRound] = useState<Round>(1);
  const [movieIdx, setMovieIdx] = useState(0);
  const [timer, setTimer] = useState(10);
  const [answer, setAnswer] = useState("");
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [famePoints, setFamePoints] = useState<number>(0);
  const [answers, setAnswers] = useState<{ movie: MovieEntry; myAnswer: string; correct: boolean }[]>([]);
  const [opponentName, setOpponentName] = useState("Opponent");
  const [posterError, setPosterError] = useState(false);
  const [deducted, setDeducted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentMovie = currentMovies[movieIdx];

  useEffect(() => {
    fetchFamePoints();
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      channelRef.current?.unsubscribe();
    };
  }, []);

  const fetchFamePoints = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("fame_points")
      .eq("id", userId)
      .single();
    if (data) setFamePoints(data.fame_points ?? 0);
  };

  const deductEntryFee = async () => {
    if (deducted) return;
    setDeducted(true);
    await supabase.rpc("decrement_fame_points", { user_id: userId, amount: 10 }).catch(() =>
      supabase
        .from("profiles")
        .update({ fame_points: Math.max(0, famePoints - 10) })
        .eq("id", userId)
    );
    setFamePoints((p) => Math.max(0, p - 10));
  };

  const awardWinner = async (winnerId: string, sessionId: string) => {
    await supabase
      .from("profiles")
      .update({ fame_points: supabase.rpc ? undefined : famePoints + 18 })
      .eq("id", winnerId);
    await supabase.rpc("increment_fame_points", { user_id: winnerId, amount: 18 }).catch(() =>
      supabase
        .from("profiles")
        .update({ fame_points: famePoints + 18 })
        .eq("id", winnerId)
    );
    await supabase.from("admin_earnings").insert({
      session_id: sessionId,
      amount: 2,
      reason: "movie_game_commission",
      created_at: new Date().toISOString(),
    }).catch(() => {});
    if (winnerId === userId) {
      setFamePoints((p) => p + 18);
    }
  };

  const startTimer = useCallback(() => {
    timerRef.current && clearInterval(timerRef.current);
    setTimer(10);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [round, movieIdx]);

  const handleTimeout = () => {
    processAnswer("");
  };

  const processAnswer = useCallback(
    (userAnswer: string) => {
      if (!currentMovie) return;
      timerRef.current && clearInterval(timerRef.current);
      const correct = userAnswer.trim().toUpperCase() === currentMovie.title.toUpperCase();
      if (correct) {
        playSound(CORRECT_SFX);
        setMyScore((s) => s + 1);
      } else {
        playSound(WRONG_SFX);
      }
      setLastResult(correct ? "correct" : "wrong");
      setShowResult(true);
      setAnswers((prev) => [
        ...prev,
        { movie: currentMovie, myAnswer: userAnswer || "(No Answer)", correct },
      ]);
      setTimeout(() => {
        setShowResult(false);
        setAnswer("");
        setPosterError(false);
        advanceGame(correct);
      }, 1500);
    },
    [currentMovie, round, movieIdx]
  );

  const advanceGame = (wasCorrect: boolean) => {
    const isLastMovie = movieIdx >= currentMovies.length - 1;
    const isLastRound = round >= 5;

    if (isLastRound || isLastMovie) {
      endGame();
      return;
    }

    if (round < 5) {
      setRound((r) => (r + 1) as Round);
    }
    setMovieIdx((i) => i + 1);
    setTimeout(() => startTimer(), 100);
  };

  const endGame = async () => {
    timerRef.current && clearInterval(timerRef.current);
    if (session) {
      const myFinalScore = myScore;
      const field = isHost ? "host_score" : "guest_score";
      await supabase
        .from("game_sessions")
        .update({ [field]: myFinalScore, status: "finished" })
        .eq("id", session.id);

      if (isHost) {
        const winnerId = myFinalScore >= opponentScore ? userId : session.guest_id || userId;
        await awardWinner(winnerId, session.id);
        await supabase
          .from("game_sessions")
          .update({ winner_id: winnerId })
          .eq("id", session.id);
      }
    }
    setPhase("finished");
  };

  const joinOrCreateSession = async () => {
    if (famePoints < 10) {
      setError("You need at least 10 Fame Points to enter! Earn points by posting.");
      return;
    }
    setError(null);
    setPhase("waiting");

    const { data: waiting } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("status", "waiting")
      .is("guest_id", null)
      .neq("host_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (waiting) {
      const movies = getRandomMovies(5);
      setCurrentMovies(movies);
      const movieIndices = movies.map((m) => MOVIES.indexOf(m));
      await supabase
        .from("game_sessions")
        .update({
          guest_id: userId,
          status: "playing",
          movie_indices: movieIndices,
        })
        .eq("id", waiting.id);
      setSession({ ...waiting, guest_id: userId, status: "playing", movie_indices: movieIndices });
      setIsHost(false);
      await deductEntryFee();
      subscribeToSession(waiting.id, false);
      setPhase("matched");
      playSound(MATCH_SFX);
      setTimeout(() => {
        setPhase("game");
        startTimer();
      }, 2000);
    } else {
      const movies = getRandomMovies(5);
      setCurrentMovies(movies);
      const movieIndices = movies.map((m) => MOVIES.indexOf(m));
      const { data: created, error: err } = await supabase
        .from("game_sessions")
        .insert({
          host_id: userId,
          guest_id: null,
          status: "waiting",
          host_score: 0,
          guest_score: 0,
          current_round: 1,
          movie_indices: movieIndices,
          winner_id: null,
        })
        .select()
        .single();

      if (err || !created) {
        setError("Could not create game session. Ask admin to create the game_sessions table.");
        setPhase("lobby");
        return;
      }
      setSession(created);
      setIsHost(true);
      await deductEntryFee();
      subscribeToSession(created.id, true);
    }
  };

  const subscribeToSession = (sessionId: string, hosting: boolean) => {
    channelRef.current?.unsubscribe();
    const ch = supabase
      .channel(`game:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          const updated = payload.new as GameSession;
          setSession(updated);
          if (hosting && updated.status === "playing" && updated.guest_id) {
            fetchOpponentName(updated.guest_id);
            setPhase("matched");
            playSound(MATCH_SFX);
            setTimeout(() => {
              setPhase("game");
              startTimer();
            }, 2000);
          }
          if (!hosting) {
            fetchOpponentName(updated.host_id);
          }
          if (hosting) {
            setOpponentScore(updated.guest_score ?? 0);
          } else {
            setOpponentScore(updated.host_score ?? 0);
          }
        }
      )
      .subscribe();
    channelRef.current = ch;
    if (!hosting && session) fetchOpponentName(session.host_id);
  };

  const fetchOpponentName = async (opponentId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", opponentId)
      .single();
    if (data?.full_name) setOpponentName(data.full_name);
  };

  const submitAnswer = () => {
    processAnswer(answer);
  };

  const resetGame = () => {
    timerRef.current && clearInterval(timerRef.current);
    channelRef.current?.unsubscribe();
    setPhase("lobby");
    setSession(null);
    setIsHost(false);
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
    setDeducted(false);
    setError(null);
    setPosterError(false);
    fetchFamePoints();
  };

  const renderRoundChallenge = () => {
    if (!currentMovie) return null;
    switch (round) {
      case 1:
        return (
          <div className="relative w-full aspect-[2/3] max-w-[200px] mx-auto rounded-2xl overflow-hidden">
            {!posterError ? (
              <img
                src={currentMovie.poster}
                alt="movie poster"
                className="w-full h-full object-cover"
                style={{ filter: "blur(14px)", transform: "scale(1.15)" }}
                onError={() => setPosterError(true)}
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${ROUND_COLORS[round]} flex items-center justify-center`}>
                <span className="text-5xl">{currentMovie.emojis.split("")[0]}</span>
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
          <div className="text-center space-y-3">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Fill in the blanks</p>
            <p className="text-2xl font-black text-white tracking-[0.3em]">
              {getMissingLetters(currentMovie.title)}
            </p>
            <p className="text-xs text-white/50 italic">{currentMovie.hint}</p>
          </div>
        );
      case 3:
        return (
          <div className="relative w-full aspect-square max-w-[180px] mx-auto rounded-2xl overflow-hidden">
            {!posterError ? (
              <img
                src={currentMovie.poster}
                alt="eyes crop"
                className="w-full h-full object-cover object-top"
                style={{ transform: "scale(2.2) translateY(10%)" }}
                onError={() => setPosterError(true)}
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${ROUND_COLORS[round]} flex items-center justify-center text-4xl`}>
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
                  className={`w-9 h-9 rounded-xl bg-gradient-to-br ${ROUND_COLORS[round]} flex items-center justify-center text-white font-black text-sm shadow-lg`}
                >
                  {letter}
                </span>
              ))}
            </div>
          </div>
        );
    }
  };

  if (phase === "lobby") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white/10 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="text-4xl mb-2">🎬</div>
              <h1 className="text-2xl font-black text-white">Movie Mania</h1>
              <p className="text-xs text-white/50 font-medium">
                1v1 Indian Movie Quiz — 5 Rounds
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Entry", value: "-10 pts", color: "text-red-400", icon: "💸" },
                { label: "Win", value: "+18 pts", color: "text-green-400", icon: "🏆" },
                { label: "Admin", value: "+2 pts", color: "text-yellow-400", icon: "⚙️" },
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
              {Object.entries(ROUND_LABELS).map(([r, label]) => (
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
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mx-auto">
            <Loader2 size={40} className="text-blue-400 animate-spin" />
          </div>
          <h2 className="text-xl font-black text-white">Finding Opponent...</h2>
          <p className="text-xs text-white/40">Share the app with a friend to play!</p>
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

        <div className="relative">
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

        <div className="bg-white/10 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-5 space-y-4 min-h-[220px] flex flex-col items-center justify-center relative overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${ROUND_COLORS[round]} opacity-5`} />
          <div className="relative z-10 w-full">
            {renderRoundChallenge()}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] text-white/30 font-black uppercase tracking-widest px-1">
            🎯 Hint: {currentMovie.hint}
          </p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
              placeholder="Type movie name..."
              autoComplete="off"
              className="flex-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 text-sm font-bold text-white placeholder:text-white/20 outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <button
              onClick={submitAnswer}
              className={`px-4 py-3 rounded-2xl bg-gradient-to-r ${ROUND_COLORS[round]} text-white font-black text-sm active:scale-95 transition-all`}
            >
              Go
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className={`fixed inset-x-4 bottom-32 rounded-3xl p-4 flex items-center gap-3 shadow-2xl z-[500] ${
                lastResult === "correct"
                  ? "bg-green-500/90 border border-green-400"
                  : "bg-red-500/90 border border-red-400"
              } backdrop-blur-xl`}
            >
              {lastResult === "correct" ? (
                <CheckCircle2 size={28} className="text-white shrink-0" />
              ) : (
                <XCircle size={28} className="text-white shrink-0" />
              )}
              <div>
                <p className="text-white font-black text-sm">
                  {lastResult === "correct" ? "🎉 Sahi Jawab!" : "❌ Galat!"}
                </p>
                <p className="text-white/80 text-xs">Answer: {currentMovie?.title}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (phase === "finished") {
    const iWon = myScore > opponentScore;
    const isDraw = myScore === opponentScore;
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-sm mx-auto px-4 py-4 space-y-4"
      >
        <div className={`rounded-[2.5rem] p-6 text-center space-y-3 bg-gradient-to-br ${iWon ? "from-yellow-500/20 to-orange-500/20 border-yellow-500/30" : isDraw ? "from-blue-500/20 to-purple-500/20 border-blue-500/30" : "from-slate-500/20 to-slate-700/20 border-white/10"} border backdrop-blur-xl`}>
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
                  <p className="text-[10px] text-white/30 truncate">Your: {entry.myAnswer}</p>
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
