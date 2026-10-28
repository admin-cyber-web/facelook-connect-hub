import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ClipboardList,
  Film,
  Home,
  Quote,
  Shield,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import "./NavigationDrawerMenu.css";

type Destination = {
  feature: string;
  label: string;
  color: string;
  Icon: typeof Home;
};

const DESTINATIONS: Destination[] = [
  { feature: "Fame", label: "Fame Feed", color: "#2674c8", Icon: Home },
  { feature: "Circle", label: "Circles", color: "#268a5b", Icon: Users },
  { feature: "Hooks", label: "Hook Pages", color: "#dc8528", Icon: Zap },
  { feature: "Flicks", label: "Flicks", color: "#7045c5", Icon: Film },
  { feature: "Task", label: "Surveys", color: "#c74a50", Icon: ClipboardList },
  { feature: "QuotesMaker", label: "Quotes Maker", color: "#657387", Icon: Quote },
  { feature: "Studio", label: "Studio", color: "#1b8792", Icon: Sparkles },
  { feature: "Admin", label: "Admin", color: "#994b78", Icon: Shield },
];

const BACK_LABELS: Record<string, string> = {
  Fame: "Fame Feed",
  Circle: "Circles",
  Hooks: "Hook Pages",
  Flicks: "Flicks",
  Task: "Surveys",
  QuotesMaker: "Quotes Maker",
  Studio: "Flicks Studio",
  Admin: "Admin",
  Settings: "Settings",
  Face: "Profile",
};

interface NavigationDrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeFeature?: string;
  backFeature?: string;
  isAdmin?: boolean;
  onFeatureChange: (feature: string) => void;
  onGoBack: () => void;
}

export function NavigationDrawerMenu({
  isOpen,
  onClose,
  activeFeature,
  backFeature,
  isAdmin = false,
  onFeatureChange,
  onGoBack,
}: NavigationDrawerMenuProps) {
  if (!isOpen) return null;

  const backSection = backFeature ?? activeFeature ?? "Fame";
  const backLabel = BACK_LABELS[backSection] ?? backSection;

  return (
    <div
      id="gol-start-menu"
      className="navigation-drawer-overlay"
      data-testid="overlay-start-menu"
      data-global-isolation="active"
      data-no-media-playback-retry="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="navigation-drawer-title"
        data-testid="dialog-start-menu"
      >
        <header className="navigation-drawer__header">
          <div>
            <p className="navigation-drawer__eyebrow">Flicks India</p>
            <h1 id="navigation-drawer-title">Where to?</h1>
          </div>
          <button
            className="navigation-drawer__close"
            type="button"
            aria-label="Close navigation menu"
            onClick={onClose}
            data-testid="button-close-start-menu"
          >
            <X size={21} aria-hidden="true" />
          </button>
        </header>

        <nav className="navigation-drawer__grid" aria-label="Main navigation">
          {DESTINATIONS.map(({ feature, label, color, Icon }) => {
            const isActive = activeFeature === feature;
            const isUnavailable = feature === "Admin" && !isAdmin;
            const style = { "--destination-color": color } as CSSProperties;

            return (
              <button
                key={feature}
                className={`navigation-drawer__item${isActive ? " is-active" : ""}`}
                type="button"
                style={style}
                data-feature={feature}
                aria-current={isActive ? "page" : undefined}
                aria-disabled={isUnavailable || undefined}
                disabled={isUnavailable}
                onClick={() => onFeatureChange(feature)}
                data-testid={`button-feature-${feature}`}
              >
                <span className="navigation-drawer__icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={2.2} />
                </span>
                <span className="navigation-drawer__label">{label}</span>
                <span className="navigation-drawer__arrow" aria-hidden="true">↗</span>
              </button>
            );
          })}
        </nav>

        <footer className="navigation-drawer__footer">
          <button
            className="navigation-drawer__back"
            type="button"
            onClick={onGoBack}
            aria-label={`Go back to ${backLabel}`}
            data-testid="button-navigation-back"
          >
            <span className="navigation-drawer__back-icon" aria-hidden="true">
              <ArrowLeft size={19} strokeWidth={2.2} />
            </span>
            <span>Back to {backLabel}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}

export default NavigationDrawerMenu;
