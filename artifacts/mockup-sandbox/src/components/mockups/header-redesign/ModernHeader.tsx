import "./_group.css";
import { useState } from "react";
import {
  Bell,
  Home,
  MessageCircle,
  Search,
  Settings,
} from "lucide-react";

type NavAction = "Home" | "Search" | "Notifications" | "Chat" | "Settings" | "Profile";

const actions: {
  label: NavAction;
  Icon?: typeof Home;
  count?: string;
}[] = [
  { label: "Home", Icon: Home },
  { label: "Search", Icon: Search },
  { label: "Notifications", Icon: Bell, count: "4" },
  { label: "Chat", Icon: MessageCircle, count: "2" },
  { label: "Settings", Icon: Settings },
  { label: "Profile" },
];

export function ModernHeader() {
  const [activeAction, setActiveAction] = useState<NavAction>("Home");

  return (
    <div className="flicks-modern-stage">
      <style>{`
        .flicks-modern-stage {
          --fm-ink: #f5f6fa;
          --fm-muted: rgba(245, 246, 250, .5);
          --fm-paper: #0a0a14;
          --fm-line: rgba(255, 255, 255, .1);
          --fm-lime: #a3e635;
          --fm-yellow: #facc15;
          --fm-coral: #ef4444;
          min-height: 114px;
          padding-block-start: env(safe-area-inset-top, 0px);
          color: var(--fm-ink);
          background: #07080d;
          font-family: "DM Sans", "Avenir Next", sans-serif;
        }
        .flicks-modern-header {
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          width: 100%;
          min-height: 60px;
          padding: 0 11px;
          background: rgba(10, 10, 20, .96);
          border-bottom: 1px solid var(--fm-line);
          box-shadow: 0 5px 18px rgba(0, 0, 0, .2);
        }
        .flicks-modern-brand {
          display: flex;
          align-items: center;
          flex: 0 0 auto;
          gap: 7px;
          min-width: 0;
          color: var(--fm-ink);
          text-decoration: none;
        }
        .flicks-modern-mark {
          display: grid;
          width: 27px;
          height: 27px;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 9px;
          color: #f8fbff;
          background: linear-gradient(145deg, #3b82f6, #1d4ed8);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 3px 8px rgba(37, 99, 235, .25);
          font-size: 15px;
          font-weight: 900;
          font-style: italic;
          line-height: 1;
        }
        .flicks-modern-wordmark {
          font-family: "Outfit", "DM Sans", sans-serif;
          color: #f7f8fb;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -.045em;
          text-transform: uppercase;
          line-height: 1;
        }
        .flicks-modern-origin {
          align-self: center;
          margin: 2px 0 0 1px;
          color: rgba(245, 246, 250, .4);
          font-size: 7px;
          font-weight: 800;
          letter-spacing: .1em;
          line-height: 1;
        }
        .flicks-modern-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex: 0 0 auto;
          gap: 3px;
          min-width: 0;
        }
        .flicks-modern-action {
          position: relative;
          display: grid;
          width: 32px;
          height: 36px;
          flex: 0 0 auto;
          place-items: center;
          padding: 0;
          border: 1px solid transparent;
          border-radius: 11px;
          color: rgba(245, 246, 250, .66);
          background: transparent;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: color 160ms ease, background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
        }
        .flicks-modern-action:hover {
          color: #f7f9fc;
          background: rgba(255, 255, 255, .07);
        }
        .flicks-modern-action:active {
          transform: scale(.92);
        }
        .flicks-modern-action.is-active {
          color: var(--fm-lime);
          border-color: rgba(163, 230, 53, .25);
          background: rgba(163, 230, 53, .09);
        }
        .flicks-modern-action:focus-visible {
          outline: 2px solid var(--fm-lime);
          outline-offset: 2px;
        }
        .flicks-modern-action svg {
          width: 17px;
          height: 17px;
          stroke-width: 1.9;
        }
        .flicks-modern-badge {
          position: absolute;
          top: 1px;
          right: 0;
          display: grid;
          min-width: 15px;
          height: 15px;
          box-sizing: border-box;
          place-items: center;
          padding: 0 3px;
          border: 2px solid var(--fm-paper);
          border-radius: 999px;
          color: #fff;
          background: var(--fm-coral);
          font-size: 8px;
          font-weight: 800;
          line-height: 1;
        }
        .flicks-modern-avatar {
          display: grid;
          width: 25px;
          height: 25px;
          place-items: center;
          border: 1.5px solid var(--fm-yellow);
          border-radius: 9px;
          color: #fff;
          background: linear-gradient(145deg, #2563eb, #1d4ed8);
          font-family: "Outfit", "DM Sans", sans-serif;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: -.04em;
        }
        .flicks-modern-caption {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 11px 14px 0;
          color: var(--fm-muted);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .015em;
        }
        .flicks-modern-caption-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--fm-lime);
          box-shadow: 0 0 0 3px rgba(163, 230, 53, .12);
        }
        @media (max-width: 360px) {
          .flicks-modern-header { gap: 4px; padding-inline: 8px; }
          .flicks-modern-brand { gap: 5px; }
          .flicks-modern-mark { width: 25px; height: 25px; }
          .flicks-modern-wordmark { font-size: 14px; }
          .flicks-modern-origin { font-size: 6px; }
          .flicks-modern-actions { gap: 1px; }
          .flicks-modern-action { width: 30px; height: 35px; }
          .flicks-modern-action svg { width: 16px; height: 16px; }
        }
        @media (max-width: 340px) {
          .flicks-modern-origin { display: none; }
          .flicks-modern-header { gap: 3px; padding-inline: 7px; }
          .flicks-modern-action { width: 29px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .flicks-modern-action { transition: none; }
        }
      `}</style>
      <header className="flicks-modern-header" aria-label="Flicks India navigation">
        <a
          className="flicks-modern-brand"
          href="#home"
          aria-label="Flicks India home"
          onClick={(event) => {
            event.preventDefault();
            setActiveAction("Home");
          }}
        >
          <span className="flicks-modern-mark" aria-hidden="true">F</span>
          <span className="flicks-modern-wordmark">FLICKS</span>
          <span className="flicks-modern-origin">MADE IN INDIA</span>
        </a>
        <nav className="flicks-modern-actions" aria-label="Primary">
          {actions.map(({ label, Icon, count }) => (
            <button
              key={label}
              type="button"
              className={`flicks-modern-action${activeAction === label ? " is-active" : ""}`}
              aria-label={label}
              aria-current={activeAction === label ? "page" : undefined}
              onClick={() => setActiveAction(label)}
            >
              {Icon ? (
                <Icon aria-hidden="true" />
              ) : (
                <span className="flicks-modern-avatar" aria-hidden="true">A</span>
              )}
              {count && (
                <span className="flicks-modern-badge" aria-label={`${count} unread`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>
      <div className="flicks-modern-caption" aria-live="polite">
        <span className="flicks-modern-caption-dot" aria-hidden="true" />
        <span>
          {activeAction === "Home"
            ? "Stories, posts, and your people — all close."
            : `${activeAction} · Flicks India`}
        </span>
      </div>
    </div>
  );
}
