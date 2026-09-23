import React, { useState, useMemo, Fragment } from "react";
import { MENTION_REGEX } from "@/lib/mentions";
import { maskProfanity } from "@/lib/profanityFilter";

class RichCaptionErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: string },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any) { console.error("[RichCaption] Boundary caught error:", error); }
  render() {
    if (this.state.hasError) {
      return (
        <span className="text-[15px] font-semibold text-white leading-relaxed whitespace-pre-wrap break-words">
          {this.props.fallback}
        </span>
      );
    }
    return this.props.children;
  }
}

interface Props {
  content: string;
  clampThreshold?: number;
  knownUsernames?: Set<string>;
}

const CLAMP_DEFAULT = 90;

const HASHTAG_RE = /#(\w+)/g;
const URL_RE = /https?:\/\/\S+/g;

function splitTextIntoSubTokens(
  text: string
): Array<{ text: string; kind: "plain" | "hashtag" | "url" }> {
  const out: Array<{ text: string; kind: "plain" | "hashtag" | "url" }> = [];
  const matches: Array<{ index: number; end: number; text: string; kind: "hashtag" | "url" }> = [];
  let m: RegExpExecArray | null;
  const hr = new RegExp(HASHTAG_RE.source, "g");
  const ur = new RegExp(URL_RE.source, "g");
  while ((m = hr.exec(text)) !== null)
    matches.push({ index: m.index, end: m.index + m[0].length, text: m[0], kind: "hashtag" });
  while ((m = ur.exec(text)) !== null)
    matches.push({ index: m.index, end: m.index + m[0].length, text: m[0], kind: "url" });
  matches.sort((a, b) => a.index - b.index);
  let last = 0;
  for (const match of matches) {
    if (match.index < last) continue;
    if (match.index > last) out.push({ text: text.slice(last, match.index), kind: "plain" });
    out.push({ text: match.text, kind: match.kind });
    last = match.end;
  }
  if (last < text.length) out.push({ text: text.slice(last), kind: "plain" });
  return out;
}

export const RichCaption = ({ content, clampThreshold = CLAMP_DEFAULT, knownUsernames }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = (content?.length ?? 0) > clampThreshold;

  let safeContent: string;
  try {
    safeContent = maskProfanity(content);
  } catch (err) {
    console.error("[RichCaption] maskProfanity crashed:", err);
    safeContent = content;
  }

  const tokens = useMemo(() => {
    if (!safeContent) return [] as Array<{ text: string; type: "text" | "pin" | "team" | "mention" | "unknown" }>;
    const out: Array<{ text: string; type: "text" | "pin" | "team" | "mention" | "unknown" }> = [];
    const re = new RegExp(MENTION_REGEX.source, "g");
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(safeContent)) !== null) {
      if (m.index > last) out.push({ text: safeContent.slice(last, m.index), type: "text" });
      const lower = m[1].toLowerCase();
      if (lower === "pin") out.push({ text: "@pin", type: "pin" });
      else if (lower === "team") out.push({ text: "@team", type: "team" });
      else if (!knownUsernames || knownUsernames.has(lower)) out.push({ text: m[0], type: "mention" });
      else out.push({ text: m[0], type: "unknown" });
      last = m.index + m[0].length;
    }
    if (last < safeContent.length) out.push({ text: safeContent.slice(last), type: "text" });
    return out;
  }, [safeContent, knownUsernames]);

  if (!safeContent) return null;

  return (
    <RichCaptionErrorBoundary fallback={content}>
      <div className="px-4 pb-2">
        <p
          className={`text-[15px] font-semibold text-white leading-relaxed whitespace-pre-wrap break-words ${
            !expanded && isLong ? "line-clamp-2" : ""
          }`}
        >
          {tokens.map((t, i) => {
            if (t.type === "pin") {
              return (
                <span key={i} className="font-black text-red-400">
                  📌 {t.text}
                </span>
              );
            }
            if (t.type === "team") {
              return (
                <span key={i} className="font-black text-blue-400">
                  {t.text}
                </span>
              );
            }
            if (t.type === "mention") {
              return (
                <span key={i} className="font-bold text-blue-400">
                  {t.text}
                </span>
              );
            }
            if (t.type === "unknown") {
              return <Fragment key={i}>{t.text}</Fragment>;
            }
            return (
              <Fragment key={i}>
                {splitTextIntoSubTokens(t.text).map((sub, j) => {
                  if (sub.kind === "hashtag")
                    return (
                      <span key={j} className="font-bold text-green-400">
                        {sub.text}
                      </span>
                    );
                  if (sub.kind === "url")
                    return (
                      <span key={j} className="text-blue-400 underline underline-offset-2">
                        {sub.text}
                      </span>
                    );
                  return <Fragment key={j}>{sub.text}</Fragment>;
                })}
              </Fragment>
            );
          })}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-blue-400 text-[12px] font-semibold mt-0.5"
          >
            {expanded ? "...less" : "...more"}
          </button>
        )}
      </div>
    </RichCaptionErrorBoundary>
  );
};

export default RichCaption;
