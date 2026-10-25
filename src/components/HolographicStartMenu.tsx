import "./HolographicStartMenu.css";

export type StartDestination = {
  feature: string;
  label: string;
};

export type HolographicId = string | number;

export interface HolographicStartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeFeature?: string;
  isAdmin?: boolean;
  onFeatureChange: (feature: string) => void;
  circles: Array<{
    id: HolographicId;
    name: string;
    coverUrl?: string;
    description?: string;
    memberCount?: number;
    ownerName?: string;
    joined?: boolean;
  }>;
  pages: Array<{
    id: HolographicId;
    name: string;
    coverUrl?: string;
    category?: string;
    followerCount?: number;
    hookCount?: number;
    ownerName?: string;
    hooked?: boolean;
  }>;
  flicks: Array<{
    id: HolographicId;
    author: string;
    avatarUrl?: string;
    mediaUrl?: string;
    isVideo?: boolean;
    likesCount?: number;
    caption?: string;
  }>;
  members: Array<{
    id: HolographicId;
    name: string;
    avatarUrl?: string;
  }>;
  hotTag: string | null;
  onNavigateToCircles: () => void;
  onNavigateToPages: () => void;
  onNavigateToFlicks: () => void;
  onOpenProfile: (id: HolographicId) => void;
  onJoinCircle: (id: HolographicId) => void;
  onToggleHookPage: (id: HolographicId) => void;
  onOpenFlick: (id: HolographicId) => void;
  startDestinations?: StartDestination[];
}

const ORIGINAL_DESTINATIONS: StartDestination[] = [
  { label: "Fame Feed", feature: "Fame" },
  { label: "Circles", feature: "Circle" },
  { label: "Hook Pages", feature: "Hooks" },
  { label: "Flicks", feature: "Flicks" },
  { label: "Surveys", feature: "Task" },
  { label: "Quotes Maker", feature: "QuotesMaker" },
  { label: "Studio", feature: "Studio" },
];

const formatCount = (count: number) =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(count);

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

const isVideoUrl = (url: string) => /\.(mp4|webm|ogg|mov|m4v)(?:$|[?#])/i.test(url);

function SectionHeading({
  eyebrow,
  title,
  actionLabel,
  onAction,
  testId,
}: {
  eyebrow: string;
  title: string;
  actionLabel: string;
  onAction: () => void;
  testId: string;
}) {
  return (
    <div className="hsm-section-heading">
      <div>
        <p className="hsm-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <button className="hsm-text-action" type="button" onClick={onAction} data-testid={testId}>
        {actionLabel}
        <span aria-hidden="true">↗</span>
      </button>
    </div>
  );
}

function EmptyState({ children, testId }: { children: string; testId: string }) {
  return (
    <p className="hsm-empty" role="status" data-testid={testId}>
      <span className="hsm-empty-mark" aria-hidden="true" />
      {children}
    </p>
  );
}

function Avatar({
  name,
  url,
  testId,
}: {
  name: string;
  url?: string;
  testId: string;
}) {
  return (
    <span className="hsm-avatar" data-testid={testId}>
      {url ? <img src={url} alt="" loading="lazy" /> : <span aria-hidden="true">{initials(name)}</span>}
    </span>
  );
}

export function HolographicStartMenu({
  isOpen,
  onClose,
  activeFeature,
  isAdmin = false,
  onFeatureChange,
  circles,
  pages,
  flicks,
  members,
  hotTag,
  onNavigateToCircles,
  onNavigateToPages,
  onNavigateToFlicks,
  onOpenProfile,
  onJoinCircle,
  onToggleHookPage,
  onOpenFlick,
  startDestinations,
}: HolographicStartMenuProps) {
  if (!isOpen) return null;

  const destinations = startDestinations ?? ORIGINAL_DESTINATIONS;
  const visibleDestinations = isAdmin
    ? [...destinations.filter((item) => item.feature !== "Admin"), { label: "Admin", feature: "Admin" }]
    : destinations.filter((item) => item.feature !== "Admin");

  return (
    <div
      id="gol-start-menu"
      className="hsm-void"
      data-testid="overlay-start-menu"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="hsm-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hsm-title"
        data-testid="dialog-start-menu"
      >
        <div className="hsm-window__texture" aria-hidden="true" />
        <header className="hsm-header">
          <div className="hsm-brand">
            <span className="hsm-brand__sigil" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <div>
              <p className="hsm-eyebrow">FlicksIndia / community system</p>
              <h1 id="hsm-title">Start <span>somewhere.</span></h1>
            </div>
          </div>
          <div className="hsm-header__right">
            {hotTag && (
              <div className="hsm-hot-tag" data-testid="text-hot-tag" aria-label={`Live topic: ${hotTag}`}>
                <span className="hsm-hot-tag__pulse" aria-hidden="true" />
                <span>HOT NOW</span>
                <strong>{hotTag}</strong>
              </div>
            )}
            <button
              className="hsm-close"
              type="button"
              aria-label="Close Start menu"
              onClick={onClose}
              data-testid="button-close-start-menu"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        <div className="hsm-content">
          <section className="hsm-destinations" aria-labelledby="hsm-destinations-title">
            <div className="hsm-section-heading hsm-section-heading--destinations">
              <div>
                <p className="hsm-eyebrow">Your launch points</p>
                <h2 id="hsm-destinations-title">Pick a frequency</h2>
              </div>
              <span className="hsm-section-note">FlicksIndia / 01</span>
            </div>
            <div className="hsm-destination-grid" role="list" aria-label="Start destinations">
              {visibleDestinations.map(({ feature, label }, index) => {
                const isActive = activeFeature === feature;
                return (
                  <button
                    key={feature}
                    className={`hsm-destination${isActive ? " is-active" : ""}`}
                    type="button"
                    role="listitem"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => onFeatureChange(feature)}
                    data-testid={`button-feature-${feature}`}
                  >
                    <span className="hsm-destination__index" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="hsm-destination__label">{label}</span>
                    <span className="hsm-destination__arrow" aria-hidden="true">↗</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="hsm-discovery">
            <section className="hsm-panel hsm-panel--circles" aria-labelledby="hsm-circles-title">
              <SectionHeading
                eyebrow="Find your people"
                title="Trending Circles"
                actionLabel="Explore circles"
                onAction={onNavigateToCircles}
                testId="button-explore-circles"
              />
              {circles.length === 0 ? (
                <EmptyState testId="status-empty-circles">No circles to show right now.</EmptyState>
              ) : (
                <div className="hsm-circle-list" aria-live="polite">
                  {circles.map((circle) => (
                    <article className="hsm-circle-card" key={circle.id} data-testid={`card-circle-${circle.id}`}>
                      <div className="hsm-circle-card__cover">
                        {circle.coverUrl ? (
                          <img src={circle.coverUrl} alt="" loading="lazy" />
                        ) : (
                          <div className="hsm-circle-card__cover--empty" aria-hidden="true">
                            <span>C</span>
                          </div>
                        )}
                        <span className="hsm-card-index" aria-hidden="true">CIRCLE</span>
                      </div>
                      <div className="hsm-card-copy">
                        <h3 data-testid={`text-circle-name-${circle.id}`}>{circle.name}</h3>
                        {circle.description && <p>{circle.description}</p>}
                        <div className="hsm-card-meta">
                          {circle.memberCount !== undefined && (
                            <span data-testid={`text-circle-members-${circle.id}`}>
                              {formatCount(circle.memberCount)} members
                            </span>
                          )}
                          {circle.ownerName && <span>by {circle.ownerName}</span>}
                        </div>
                        <button
                          className={`hsm-pill-action${circle.joined === true ? " is-complete" : ""}`}
                          type="button"
                          onClick={() => {
                            if (circle.joined !== true) onJoinCircle(circle.id);
                          }}
                          disabled={circle.joined === true}
                          data-testid={`button-join-circle-${circle.id}`}
                        >
                          {circle.joined === true ? "Joined" : "Join Circle"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="hsm-panel hsm-panel--pages" aria-labelledby="hsm-pages-title">
              <SectionHeading
                eyebrow="Follow the signal"
                title="Hook Pages India"
                actionLabel="Explore pages"
                onAction={onNavigateToPages}
                testId="button-explore-pages"
              />
              {pages.length === 0 ? (
                <EmptyState testId="status-empty-pages">No pages to show right now.</EmptyState>
              ) : (
                <div className="hsm-page-list" aria-live="polite">
                  {pages.map((page) => (
                    <article className="hsm-page-card" key={page.id} data-testid={`card-page-${page.id}`}>
                      {page.coverUrl ? (
                        <img className="hsm-page-card__cover" src={page.coverUrl} alt="" loading="lazy" />
                      ) : (
                        <div className="hsm-page-card__cover hsm-page-card__cover--empty" aria-hidden="true">
                          <span>H</span>
                        </div>
                      )}
                      <div className="hsm-page-card__body">
                        <h3 data-testid={`text-page-name-${page.id}`}>{page.name}</h3>
                        {page.category && <p className="hsm-page-card__category">{page.category}</p>}
                        {page.ownerName && <p className="hsm-page-card__owner">by {page.ownerName}</p>}
                        {page.hookCount !== undefined && (
                          <p className="hsm-page-card__count" data-testid={`text-page-hooks-${page.id}`}>
                            {formatCount(page.hookCount)} hooks
                          </p>
                        )}
                        {page.followerCount !== undefined && (
                          <p className="hsm-page-card__count" data-testid={`text-page-followers-${page.id}`}>
                            {formatCount(page.followerCount)} followers
                          </p>
                        )}
                        <button
                          className={`hsm-pill-action${page.hooked === true ? " is-complete" : ""}`}
                          type="button"
                          onClick={() => {
                            if (page.hooked !== true) onToggleHookPage(page.id);
                          }}
                          disabled={page.hooked === true}
                          data-testid={`button-toggle-hook-page-${page.id}`}
                        >
                          {page.hooked === true ? "Hooked" : "Hook in"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="hsm-panel hsm-panel--flicks" aria-labelledby="hsm-flicks-title">
            <SectionHeading
              eyebrow="Made by the community"
              title="Trending Flicks"
              actionLabel="See all flicks"
              onAction={onNavigateToFlicks}
              testId="button-explore-flicks"
            />
            {flicks.length === 0 ? (
              <EmptyState testId="status-empty-flicks">No flicks to show right now.</EmptyState>
            ) : (
              <div className="hsm-flick-list" aria-live="polite">
                {flicks.map((flick) => (
                  <button
                    className="hsm-flick-card"
                    type="button"
                    key={flick.id}
                    onClick={() => onOpenFlick(flick.id)}
                    data-testid={`button-open-flick-${flick.id}`}
                    aria-label={`Open flick by ${flick.author}`}
                  >
                    <span className="hsm-flick-card__media">
                      {flick.mediaUrl ? (
                        flick.isVideo || isVideoUrl(flick.mediaUrl) ? (
                          <video src={flick.mediaUrl} muted playsInline preload="metadata" />
                        ) : (
                          <img src={flick.mediaUrl} alt="" loading="lazy" />
                        )
                      ) : (
                        <span className="hsm-media-empty" aria-hidden="true" />
                      )}
                      <span className="hsm-play-mark" aria-hidden="true">↗</span>
                    </span>
                    <span className="hsm-flick-card__details">
                      <span className="hsm-flick-card__creator">
                        <Avatar name={flick.author} url={flick.avatarUrl} testId={`img-flick-avatar-${flick.id}`} />
                        <span data-testid={`text-flick-author-${flick.id}`}>{flick.author}</span>
                      </span>
                      {flick.caption && <span className="hsm-flick-card__caption">{flick.caption}</span>}
                      {flick.likesCount !== undefined && (
                        <span className="hsm-flick-card__likes" data-testid={`text-flick-likes-${flick.id}`}>
                          {formatCount(flick.likesCount)} likes
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="hsm-panel hsm-panel--members" aria-labelledby="hsm-members-title">
            <div className="hsm-section-heading">
              <div>
                <p className="hsm-eyebrow">People of FlicksIndia</p>
                <h2 id="hsm-members-title">Creators</h2>
              </div>
              <span className="hsm-section-note">Community / live</span>
            </div>
            {members.length === 0 ? (
              <EmptyState testId="status-empty-members">No creators to show right now.</EmptyState>
            ) : (
              <div className="hsm-member-list" aria-live="polite">
                {members.map((member) => (
                  <button
                    className="hsm-member"
                    type="button"
                    key={member.id}
                    onClick={() => onOpenProfile(member.id)}
                    data-testid={`button-open-profile-${member.id}`}
                  >
                    <Avatar name={member.name} url={member.avatarUrl} testId={`img-member-avatar-${member.id}`} />
                    <span className="hsm-member__name" data-testid={`text-member-name-${member.id}`}>{member.name}</span>
                    <span className="hsm-member__arrow" aria-hidden="true">↗</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="hsm-footer">
          <span>FlicksIndia</span>
          <span className="hsm-footer__divider" aria-hidden="true" />
          <span>Discover your next circle.</span>
          <span className="hsm-footer__coordinates" aria-hidden="true">FI / START / 01</span>
        </footer>
      </section>
    </div>
  );
}

export default HolographicStartMenu;
