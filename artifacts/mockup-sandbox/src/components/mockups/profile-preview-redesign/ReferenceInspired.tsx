import { useState } from "react";
import {
  BriefcaseBusiness,
  ChevronRight,
  Clock3,
  GraduationCap,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Play,
  Shield,
  UserRound,
  UserRoundPlus,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import "./_group.css";
import "./ReferenceInspired.css";

type Relationship = "not-friends" | "friends" | "blocked";

const friendFaces = [
  { initials: "AR", tone: "rose" },
  { initials: "MK", tone: "sage" },
  { initials: "NS", tone: "lilac" },
  { initials: "JD", tone: "sand" },
];

const activity = [
  { icon: Play, title: "Shared a short video", detail: "A little weekend sunshine", time: "2h ago", tone: "mint" },
  { icon: Heart, title: "Liked Priya’s post", detail: "“The long way home”", time: "Yesterday", tone: "pink" },
  { icon: Video, title: "Added to Reels", detail: "Sunday market moments", time: "2 days ago", tone: "blue" },
  { icon: UsersRound, title: "Connected with Rohan", detail: "You have 12 friends in common", time: "4 days ago", tone: "lilac" },
];

export function ReferenceInspired() {
  const [relationship, setRelationship] = useState<Relationship>("not-friends");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const menuItems =
    relationship === "blocked"
      ? [{ label: "Unblock User", icon: Shield, action: () => setRelationship("not-friends") }]
      : relationship === "friends"
        ? [
            { label: "Direct Chat", icon: MessageCircle, action: () => showNotice("Direct chat preview opened") },
            { label: "Unfriend", icon: UserRound, action: () => setRelationship("not-friends") },
            { label: "Block User", icon: Shield, action: () => setRelationship("blocked"), danger: true },
            { label: "View Profile", icon: UserRound, action: () => showNotice("Full profile preview selected") },
          ]
        : [
            { label: "Add Friend", icon: UserRoundPlus, action: () => setRelationship("friends") },
            { label: "Block User", icon: Shield, action: () => setRelationship("blocked"), danger: true },
            { label: "View Profile", icon: UserRound, action: () => showNotice("Full profile preview selected") },
          ];

  return (
    <main className="rp-stage">
      <div className="rp-shape rp-shape-cyan" />
      <div className="rp-shape rp-shape-mint" />
      <div className="rp-shape rp-shape-lilac" />
      <div className="rp-frame">
        <div className="rp-statebar">
          <span className="rp-state-label">Preview relationship</span>
          <div className="rp-state-tabs" role="group" aria-label="Choose relationship state">
            {(["not-friends", "friends", "blocked"] as Relationship[]).map((state) => (
              <button
                className={relationship === state ? "rp-state-tab is-active" : "rp-state-tab"}
                key={state}
                type="button"
                onClick={() => {
                  setRelationship(state);
                  setMenuOpen(false);
                }}
                aria-pressed={relationship === state}
              >
                {state === "not-friends" ? "Not friends" : state === "friends" ? "Friends" : "Blocked"}
              </button>
            ))}
          </div>
        </div>

        <article className="rp-card" aria-label="Yami Goutham quick profile">
          <div className="rp-cover">
            <img src="/__mockup/images/yami-cover.jpg" alt="A family enjoying a walk in the park" />
            <div className="rp-cover-wash" />
            <button className="rp-close" type="button" aria-label="Close profile preview" onClick={() => showNotice("Profile preview closed")}>
              <X size={17} />
            </button>
            <span className="rp-cover-caption">A little more about Yami</span>
          </div>

          <div className="rp-identity">
            <div className="rp-quick-actions">
              <button
                type="button"
                className="rp-round-action rp-action-mint"
                aria-label={relationship === "friends" ? "Message Yami" : "Add Yami as a friend"}
                onClick={() => relationship === "friends" ? showNotice("Direct chat preview opened") : setRelationship("friends")}
              >
                {relationship === "friends" ? <MessageCircle size={18} /> : <UserRoundPlus size={19} />}
              </button>
              <button
                type="button"
                className="rp-round-action rp-action-teal"
                aria-label="Open Yami's profile"
                onClick={() => showNotice("Full profile preview selected")}
              >
                <UserRound size={19} />
              </button>
            </div>
            <div className="rp-avatar">
              <img src="/__mockup/images/yami-profile.jpg" alt="Yami Goutham" />
              <span className="rp-online-dot" aria-label="Online recently" />
            </div>
            <h1>Yami Goutham</h1>
            <p className="rp-handle">@yami_g <span>·</span> Hyderabad, India</p>
            <div className="rp-meta">
              <span><Clock3 size={13} /> Last seen Tue, 8:45 PM</span>
              <i />
              <span><UserRound size={13} /> 6,000 profile views</span>
              <div className="rp-menu-wrap">
                <button
                  className="rp-more-button"
                  type="button"
                  aria-label="Open profile actions"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <MoreHorizontal size={21} />
                </button>
                {menuOpen && (
                  <>
                    <button className="rp-menu-scrim" aria-label="Close menu" type="button" onClick={() => setMenuOpen(false)} />
                    <div className="rp-menu" role="menu" aria-label="Profile actions">
                      <div className="rp-menu-heading">{relationship === "blocked" ? "Blocked profile" : "Profile options"}</div>
                      {menuItems.map(({ label, icon: Icon, action, danger }) => (
                        <button
                          className={`rp-menu-item${danger ? " is-danger" : ""}${label === "View Profile" ? " is-view-profile" : ""}`}
                          type="button"
                          role="menuitem"
                          key={label}
                          onClick={() => {
                            action();
                            setMenuOpen(false);
                          }}
                        >
                          <Icon size={16} />
                          <span>{label}</span>
                          {label === "View Profile" && <ChevronRight size={15} className="rp-menu-chevron" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <p className="rp-bio">I’m doomed to live in Meshech, cursed with a home in, whole life lived camping among quarrelling neighbors.</p>
            <button className="rp-message" type="button" onClick={() => showNotice("Message composer preview opened")}>
              <MessageCircle size={15} /> Send Message
            </button>
          </div>

          <div className="rp-stats" aria-label="Profile statistics">
            <div><strong>3,505</strong><span>Posts</span></div>
            <div><strong>505</strong><span>Friends</span></div>
            <div><strong>123</strong><span>Following</span></div>
            <div><strong>1,284</strong><span>Followers</span></div>
          </div>

          <section className="rp-section rp-mutuals" aria-labelledby="rp-mutual-title">
            <div className="rp-section-heading">
              <div>
                <h2 id="rp-mutual-title">Friends in common</h2>
                <p>You and Yami share <strong>12 friends</strong></p>
              </div>
              <button type="button" className="rp-link" onClick={() => showNotice("Showing 12 mutual friends")}>+ More</button>
            </div>
            <div className="rp-friend-list">
              {friendFaces.map((friend) => (
                <button className="rp-friend" type="button" key={friend.initials} onClick={() => showNotice(`${friend.initials}’s profile preview`)}>
                  <span className={`rp-friend-avatar tone-${friend.tone}`}>{friend.initials}</span>
                </button>
              ))}
              <button className="rp-friend-more" type="button" onClick={() => showNotice("Showing all 12 mutual friends")}>+8</button>
              <span className="rp-mutual-copy">Priya, Arjun and 10 others</span>
            </div>
          </section>

          <section className="rp-section rp-about" aria-labelledby="rp-about-title">
            <div className="rp-section-heading rp-about-heading">
              <span className="rp-heading-icon"><UserRound size={17} /></span>
              <h2 id="rp-about-title">About Me</h2>
              <button type="button" aria-label="View more about Yami" className="rp-chevron" onClick={() => showNotice("About Yami selected")}><ChevronRight size={17} /></button>
            </div>
            <div className="rp-about-list">
              <div className="rp-about-row">
                <span className="rp-about-icon tone-work"><BriefcaseBusiness size={16} /></span>
                <div><strong>UI Designer at ALM Pvt Ltd.</strong><small>From 2015 to present</small></div>
                <ChevronRight size={15} />
              </div>
              <div className="rp-about-row">
                <span className="rp-about-icon tone-study"><GraduationCap size={16} /></span>
                <div><strong>Gems Arts &amp; Science College</strong><small>Studied from 2008 to 2009</small></div>
                <ChevronRight size={15} />
              </div>
              <div className="rp-about-row">
                <span className="rp-about-icon tone-city"><Home size={16} /></span>
                <div><strong>Lives in Hyderabad, India</strong><small>Current city</small></div>
                <ChevronRight size={15} />
              </div>
              <div className="rp-about-row">
                <span className="rp-about-icon tone-home"><MapPin size={16} /></span>
                <div><strong>From Malappuram, India</strong><small>Hometown</small></div>
                <ChevronRight size={15} />
              </div>
            </div>
          </section>

          <section className="rp-section rp-activity" aria-labelledby="rp-activity-title">
            <div className="rp-section-heading rp-activity-heading">
              <div><h2 id="rp-activity-title">Recent activity</h2><p>Little moments from Yami’s world</p></div>
              <button className="rp-link" type="button" onClick={() => showNotice("All activity selected")}>See all</button>
            </div>
            <div className="rp-activity-list">
              {activity.map(({ icon: Icon, title, detail, time, tone }) => (
                <button className="rp-activity-row" type="button" key={title} onClick={() => showNotice(`${title} selected`)}>
                  <span className={`rp-activity-icon tone-${tone}`}><Icon size={16} /></span>
                  <span className="rp-activity-copy"><strong>{title}</strong><small>{detail}</small></span>
                  <span className="rp-activity-time">{time}</span>
                  <ChevronRight size={15} className="rp-activity-chevron" />
                </button>
              ))}
            </div>
          </section>
          <footer className="rp-card-footer">A closer look at your Flicks community <span>·</span> <b>flicks india</b></footer>
        </article>
      </div>
      {notice && <div className="rp-toast" role="status">{notice}</div>}
    </main>
  );
}
