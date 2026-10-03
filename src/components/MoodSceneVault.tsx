import { useEffect, useState } from "react";
import {
  ArrowLeft,
  AtSign,
  Bell,
  Camera,
  Check,
  CloudRain,
  Heart,
  ImagePlus,
  Plane,
  Sparkles,
  Swords,
  X,
} from "lucide-react";

type Mood = "love" | "angry" | "travel" | "sad" | "missing";

interface MoodSceneVaultProps {
  onClose: () => void;
  userName: string;
}

const MOODS: { id: Mood; label: string; title: string; description: string; icon: typeof Heart }[] = [
  { id: "love", label: "Love", title: "The eternal vault", description: "A moment worth keeping close.", icon: Heart },
  { id: "angry", label: "Fight mode", title: "Face the moment", description: "Two sides. One honest frame.", icon: Swords },
  { id: "travel", label: "Travel", title: "Somewhere new", description: "Let the horizon do the talking.", icon: Plane },
  { id: "sad", label: "Sad", title: "Let it rain", description: "Some days need a softer frame.", icon: CloudRain },
  { id: "missing", label: "Missing", title: "Miles between us", description: "Keep someone close, even from afar.", icon: AtSign },
];

const DEFAULT_PHOTOS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1000&q=85",
];

const MoodSceneVault = ({ onClose, userName }: MoodSceneVaultProps) => {
  const [mood, setMood] = useState<Mood>("love");
  const [photos, setPhotos] = useState(DEFAULT_PHOTOS);
  const [companion, setCompanion] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const activeMood = MOODS.find((item) => item.id === mood) ?? MOODS[0];

  useEffect(() => () => {
    photos.forEach((photo) => {
      if (photo.startsWith("blob:")) URL.revokeObjectURL(photo);
    });
  }, [photos]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 5200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const handlePhotoChange = (index: number, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Choose an image file to update this frame.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setNotice("Images must be 12 MB or smaller.");
      return;
    }
    const nextPhoto = URL.createObjectURL(file);
    setPhotos((current) => {
      const next = [...current];
      if (next[index].startsWith("blob:")) URL.revokeObjectURL(next[index]);
      next[index] = nextPhoto;
      return next;
    });
  };

  const tagCompanion = () => {
    const name = companion.trim().replace(/^@/, "");
    if (!name) return;
    setCompanion(name);
    setNotificationOpen(true);
  };

  return (
    <main className="mood-vault min-h-screen text-white">
      <div className="mood-vault-grain" aria-hidden="true" />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 pt-5 sm:px-7 sm:pt-8">
        <header className="mb-7 flex items-center justify-between">
          <button onClick={onClose} className="mood-vault-back" type="button">
            <ArrowLeft size={17} aria-hidden="true" />
            <span>Back to feed</span>
          </button>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.75)]" />
            Private scene studio
          </div>
        </header>

        <div className="mb-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100/55">
              <Sparkles size={13} /> Mood &amp; Scene Vault
            </p>
            <h1 className="font-serif text-3xl font-medium leading-tight sm:text-4xl">Frame the feeling.</h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/50">Choose a mood, make the scene yours, and keep the people who matter in frame.</p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60 sm:self-auto">
            <span className="h-6 w-6 overflow-hidden rounded-full bg-white/10">
              <img src={photos[0]} alt="" className="h-full w-full object-cover" />
            </span>
            Creating as <span className="max-w-28 truncate font-semibold text-white">{userName || "You"}</span>
          </div>
        </div>

        <nav className="mood-vault-pills mb-5 flex gap-2 overflow-x-auto pb-2" aria-label="Choose a scene mood">
          {MOODS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMood(id)}
              aria-pressed={mood === id}
              className={`mood-vault-pill ${mood === id ? "is-active" : ""}`}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        <section className={`mood-scene mood-scene--${mood} relative isolate overflow-hidden rounded-[7px] border border-white/10 bg-[#10161d]`} aria-label={`${activeMood.label} scene preview`}>
          <div className="mood-scene-backdrop" aria-hidden="true" />
          <div className="mood-scene-lines" aria-hidden="true" />
          <div className="mood-scene-rain" aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--drop-index": index } as React.CSSProperties} />)}
          </div>
          <div className="mood-scene-flash" aria-hidden="true" />
          <div className="mood-scene-images" key={mood}>
            <figure className="mood-scene-photo mood-scene-photo--one">
              <img src={photos[0]} alt="First portrait in the scene" />
            </figure>
            <figure className="mood-scene-photo mood-scene-photo--two">
              <img src={photos[1]} alt="Second portrait in the scene" />
            </figure>
          </div>
          <div className="mood-scene-vignette" aria-hidden="true" />
          <div className="mood-scene-copy">
            <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-white/60">Scene 01 <span className="mx-1.5 text-white/25">/</span> {activeMood.label}</p>
            <h2 className="mt-2 font-serif text-3xl font-medium sm:text-5xl">{activeMood.title}</h2>
            <p className="mt-1.5 text-xs text-white/65 sm:text-sm">{activeMood.description}</p>
          </div>
          {mood === "love" && (
            <div className="mood-scene-heart-mark" aria-hidden="true"><Heart size={19} fill="currentColor" /></div>
          )}
          <div className="absolute right-3 top-3 z-20 rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.13em] text-white/65 backdrop-blur-md sm:right-5 sm:top-5">
            Live preview
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="mood-vault-panel p-4 sm:p-5" aria-labelledby="photos-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 id="photos-heading" className="text-sm font-semibold text-white/90">Your two frames</h3>
                <p className="mt-1 text-[11px] text-white/42">Replace either portrait with your own photo.</p>
              </div>
              <Camera size={17} className="text-white/45" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo, index) => (
                <label key={index} className="mood-photo-upload">
                  <img src={photo} alt={`Frame ${index + 1} preview`} />
                  <span><ImagePlus size={14} /> Frame {index + 1}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label={`Upload photo for frame ${index + 1}`}
                    onChange={(event) => {
                      handlePhotoChange(index, event.currentTarget.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="mood-vault-panel p-4 sm:p-5" aria-labelledby="companion-heading">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-100/15 bg-cyan-100/[0.07] text-cyan-100/80"><AtSign size={15} /></div>
              <div>
                <h3 id="companion-heading" className="text-sm font-semibold text-white/90">Bring someone in</h3>
                <p className="mt-0.5 text-[11px] text-white/42">Preview a companion notification.</p>
              </div>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); tagCompanion(); }}>
              <label htmlFor="vault-companion" className="sr-only">Friend's name or username</label>
              <div className="flex gap-2">
                <div className="flex min-w-0 flex-1 items-center rounded-[5px] border border-white/10 bg-black/20 px-3 focus-within:border-cyan-100/40">
                  <span className="mr-1 text-sm text-white/35">@</span>
                  <input
                    id="vault-companion"
                    value={companion}
                    onChange={(event) => setCompanion(event.target.value.replace(/^@/, ""))}
                    placeholder="friend's name"
                    maxLength={40}
                    className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                  />
                </div>
                <button type="submit" disabled={!companion.trim()} className="mood-tag-button">
                  <Bell size={14} /> Tag
                </button>
              </div>
            </form>
            {notificationOpen && (
              <div className="mt-3 flex items-start gap-2 rounded-[5px] border border-cyan-100/15 bg-cyan-50/[0.06] p-3" role="status">
                <Bell size={14} className="mt-0.5 shrink-0 text-cyan-100/75" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100/60">Notification preview</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/75"><span className="font-semibold text-white">@{companion}</span>, {userName || "Someone"} tagged you in a {activeMood.label.toLowerCase()} scene.</p>
                  <p className="mt-1 text-[10px] text-white/35">This is a local preview, not a sent notification.</p>
                </div>
                <button type="button" onClick={() => setNotificationOpen(false)} aria-label="Dismiss notification preview" className="text-white/40 hover:text-white"><X size={14} /></button>
              </div>
            )}
            {!notificationOpen && (
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-white/35"><Check size={12} /> Companion preview stays on this device.</p>
            )}
          </section>
        </div>
      </div>
      {notice && (
        <div className="mood-vault-toast" role="status" aria-live="polite">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15} /></button>
        </div>
      )}
    </main>
  );
};

export default MoodSceneVault;