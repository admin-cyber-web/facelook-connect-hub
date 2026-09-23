import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Pin, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { nameToUsername } from "@/lib/mentions";

export interface MentionCandidate {
  kind: "friend" | "pin" | "team";
  id: string;
  username: string;
  name: string;
  avatar_url?: string | null;
  circle_id?: string;
  circle_name?: string;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  /** Resolved candidates user is allowed to tag (friends + circle members). */
  candidates: MentionCandidate[];
  /** Whether to show the @pin special token. */
  enablePin?: boolean;
  /** Whether to show the @team special token (user must be in a circle). */
  enableTeam?: boolean;
}

const MAX_RESULTS = 8;

export const MentionInput = ({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  candidates,
  enablePin = true,
  enableTeam = true,
}: Props) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [anchorOffset, setAnchorOffset] = useState<number>(-1);

  // Debounce typing so big friend lists don't lag.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 90);
    return () => clearTimeout(t);
  }, [query]);

  // Memoized base list — friends + special tokens.
  const baseList = useMemo<MentionCandidate[]>(() => {
    const specials: MentionCandidate[] = [];
    if (enablePin) {
      specials.push({
        kind: "pin",
        id: "__pin__",
        username: "pin",
        name: "Pin · Priority post",
      });
    }
    if (enableTeam) {
      const teamMarker = candidates.find(c => c.kind === "team" && c.circle_id);
      if (teamMarker) {
        specials.push({
          kind: "team",
          id: "__team__",
          username: "team",
          name: teamMarker.circle_name
            ? `Team · all members of "${teamMarker.circle_name}"`
            : "Team · everyone in your circle",
          circle_id: teamMarker.circle_id,
          circle_name: teamMarker.circle_name,
        });
      }
    }
    // Friends only — dedupe by id.
    const seen = new Set<string>();
    const friends: MentionCandidate[] = [];
    for (const c of candidates) {
      if (c.kind !== "friend" || !c.id || seen.has(c.id)) continue;
      seen.add(c.id);
      friends.push(c);
    }
    return [...specials, ...friends];
  }, [candidates, enablePin, enableTeam]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return baseList.slice(0, MAX_RESULTS);
    return baseList
      .filter(c =>
        c.username.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
      )
      .slice(0, MAX_RESULTS);
  }, [baseList, debouncedQuery]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setAnchorOffset(-1);
    setActiveIdx(0);
  }, []);

  const detect = useCallback((nextValue: string, caretPos: number) => {
    // Walk back from caret to find the nearest @ that isn't preceded by a word char.
    let i = caretPos - 1;
    while (i >= 0) {
      const ch = nextValue[i];
      if (ch === "@") {
        const prev = nextValue[i - 1];
        if (i === 0 || prev === " " || prev === "\n" || prev === "\t") {
          // Token between i+1 and caretPos.
          const token = nextValue.slice(i + 1, caretPos);
          if (/^[a-zA-Z0-9_]*$/.test(token)) {
            setOpen(true);
            setQuery(token);
            setAnchorOffset(i);
            setActiveIdx(0);
            return;
          }
        }
        break;
      }
      if (/\s/.test(ch)) break;
      i--;
    }
    if (open) closeMenu();
  }, [open, closeMenu]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    detect(next, e.target.selectionStart ?? next.length);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = taRef.current;
    if (!ta) return;
    detect(ta.value, ta.selectionStart ?? ta.value.length);
  };

  const insertMention = useCallback((c: MentionCandidate) => {
    const ta = taRef.current;
    if (!ta || anchorOffset < 0) { closeMenu(); return; }
    const tokenEnd = (ta.selectionStart ?? value.length);
    const before = value.slice(0, anchorOffset);
    const after = value.slice(tokenEnd);
    const inserted = `@${c.username} `;
    const next = before + inserted + after;
    onChange(next);
    closeMenu();
    // Restore caret after insertion.
    requestAnimationFrame(() => {
      const newPos = (before + inserted).length;
      ta.focus();
      try { ta.setSelectionRange(newPos, newPos); } catch { /* noop */ }
    });
  }, [anchorOffset, value, onChange, closeMenu]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filtered[activeIdx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
    }
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={taRef}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyUp={handleKeyUp}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(closeMenu, 120)}
        className={className}
      />

      <AnimatePresence>
        {open && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 -top-2 -translate-y-full z-[1100] max-h-72 overflow-y-auto rounded-2xl bg-white border border-slate-100 shadow-2xl pointer-events-auto"
            onMouseDown={e => e.preventDefault()}
          >
            {filtered.map((c, i) => {
              const isPin = c.kind === "pin";
              const isTeam = c.kind === "team";
              const active = i === activeIdx;
              return (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); insertMention(c); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    active ? "bg-slate-100" : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                    isPin ? "bg-red-50" : isTeam ? "bg-blue-50" : "bg-violet-50"
                  }`}>
                    {isPin ? (
                      <Pin size={16} className="text-red-600" />
                    ) : isTeam ? (
                      <Users size={16} className="text-blue-600" />
                    ) : c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="w-full h-full object-cover"  decoding="async"/>
                    ) : (
                      <span className="text-violet-600 font-black text-xs">
                        {(c.name?.[0] || c.username?.[0] || "?").toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold truncate ${
                      isPin ? "text-red-600" : isTeam ? "text-blue-600" : "text-slate-800"
                    }`}>
                      {isPin ? "📌 @pin" : isTeam ? "👥 @team" : `@${c.username}`}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{c.name}</p>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MentionInput;
export { nameToUsername };
