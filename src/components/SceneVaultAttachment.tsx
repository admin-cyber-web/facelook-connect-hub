import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AtSign,
  Bell,
  Check,
  Clapperboard,
  CloudRain,
  Heart,
  ImagePlus,
  Loader2,
  Plane,
  Swords,
  X,
} from "lucide-react";

export type SceneMood = "love" | "angry" | "travel" | "sad" | "missing";

export interface SceneCompanion {
  id: string;
  name: string;
  username: string;
}

export interface SceneVaultDraft {
  mood: SceneMood;
  photos: [File | null, File | null];
  companionId: string;
}

interface SceneVaultAttachmentProps {
  isOpen: boolean;
  draft: SceneVaultDraft;
  companions: SceneCompanion[];
  isPublishing: boolean;
  onDraftChange: (draft: SceneVaultDraft) => void;
  onClose: () => void;
  onPublish: () => void;
}

const MOOD_OPTIONS: { mood: SceneMood; label: string; icon: typeof Heart; title: string }[] = [
  { mood: "love", label: "Love", icon: Heart, title: "Eternal vault" },
  { mood: "angry", label: "Fight mode", icon: Swords, title: "Confrontation" },
  { mood: "travel", label: "Travel", icon: Plane, title: "On the move" },
  { mood: "sad", label: "Sad", icon: CloudRain, title: "Rain scene" },
  { mood: "missing", label: "Missing", icon: AtSign, title: "Miles apart" },
];

const SceneVaultAttachment = ({
  isOpen,
  draft,
  companions,
  isPublishing,
  onDraftChange,
  onClose,
  onPublish,
}: SceneVaultAttachmentProps) => {
  const [previews, setPreviews] = useState<[string | null, string | null]>([null, null]);
  const [uploadError, setUploadError] = useState("");
  const previewUrlsRef = useRef<(string | null)[]>([null, null]);
  const selectedCompanion = companions.find(({ id }) => id === draft.companionId);
  const canPublish = draft.photos.every(Boolean) && !isPublishing;

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  }, []);

  const selectPhoto = (index: 0 | 1, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Choose an image file for each scene frame.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setUploadError("Each scene photo must be 12 MB or smaller.");
      return;
    }
    setUploadError("");
    const url = URL.createObjectURL(file);
    const oldUrl = previewUrlsRef.current[index];
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    previewUrlsRef.current[index] = url;
    setPreviews((current) => {
      const next: [string | null, string | null] = [...current];
      next[index] = url;
      return next;
    });
    const photos: [File | null, File | null] = [...draft.photos];
    photos[index] = file;
    onDraftChange({ ...draft, photos });
  };

  return (
    <AnimatePresence initial={false}>
      {isOpen && <motion.section
        key="scene-vault-attachment"
        initial={{ opacity: 0, height: 0, y: -6 }}
        animate={{ opacity: 1, height: "auto", y: 0 }}
        exit={{ opacity: 0, height: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        className="scene-vault-drawer overflow-hidden rounded-2xl border border-cyan-900/15"
        aria-label="Scene Vault attachment"
      >
        <div className="rounded-2xl bg-[#0c151b] p-4 text-white sm:p-5">
          <header className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-100/15 bg-cyan-100/[0.07] text-cyan-100"><Clapperboard size={19} /></span>
              <div>
                <h2 className="text-sm font-bold">Scene Vault</h2>
                <p className="mt-0.5 text-[11px] text-white/50">Build a two-frame scene for your post.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close Scene Vault" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"><X size={16} /></button>
          </header>

          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1" aria-label="Choose scene mood">
            {MOOD_OPTIONS.map(({ mood, label, icon: Icon }) => (
              <button
                key={mood}
                type="button"
                onClick={() => onDraftChange({ ...draft, mood })}
                aria-pressed={draft.mood === mood}
                className={`scene-vault-mood-pill ${draft.mood === mood ? "is-selected" : ""}`}
              >
                <Icon size={14} />{label}
              </button>
            ))}
          </div>

          <div className={`scene-vault-mini-preview scene-vault-mini-preview--${draft.mood} mb-4`}>
            {([0, 1] as const).map((index) => (
              <label key={index} className={`scene-vault-upload scene-vault-upload--${index === 0 ? "left" : "right"}`}>
                {previews[index] ? <img src={previews[index] || ""} alt={`Scene frame ${index + 1}`} /> : <span className="scene-vault-upload-empty"><ImagePlus size={19} /><span>Frame {index + 1}</span></span>}
                <span className="scene-vault-upload-label">{draft.photos[index] ? "Change photo" : `Add photo ${index + 1}`}</span>
                <input
                  type="file"
                  accept="image/*"
                  aria-label={`Upload scene photo ${index + 1}`}
                  className="sr-only"
                  onChange={(event) => {
                    selectPhoto(index, event.currentTarget.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            ))}
            <span className="scene-vault-mini-title">{MOOD_OPTIONS.find(({ mood }) => mood === draft.mood)?.title}</span>
          </div>
          <p className={`mb-4 text-[10px] leading-relaxed ${uploadError ? "text-rose-300" : "text-white/40"}`} role={uploadError ? "alert" : undefined}>{uploadError || "Choose two images, up to 12 MB each. They will be uploaded with this post."}</p>

          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-white/85"><AtSign size={14} className="text-cyan-100/70" />Tag a companion <span className="font-medium text-white/35">optional</span></div>
            <label className="sr-only" htmlFor="scene-vault-companion">Choose a friend to tag</label>
            <select
              id="scene-vault-companion"
              value={draft.companionId}
              onChange={(event) => onDraftChange({ ...draft, companionId: event.target.value })}
              className="h-10 w-full rounded-lg border border-white/10 bg-[#111d24] px-3 text-sm text-white outline-none focus:border-cyan-100/40"
            >
              <option value="">No companion</option>
              {companions.map((friend) => <option key={friend.id} value={friend.id}>{friend.name} · @{friend.username}</option>)}
            </select>
            <AnimatePresence>
              {selectedCompanion && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 flex items-start gap-2 rounded-lg border border-cyan-100/15 bg-cyan-100/[0.06] p-2.5" role="status">
                  <Bell size={14} className="mt-0.5 shrink-0 text-cyan-100/80" />
                  <span className="text-[11px] leading-relaxed text-white/75"><strong className="text-white">@{selectedCompanion.username}</strong> will receive an in-app scene tag. This is a preview; no notification is sent until you publish.</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button type="button" onClick={onPublish} disabled={!canPublish} className="scene-vault-publish mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45">
            {isPublishing ? <><Loader2 size={17} className="animate-spin" />Publishing scene…</> : <><Check size={17} />Attach &amp; Post to Feed</>}
          </button>
          {!draft.photos.every(Boolean) && <p className="mt-2 text-center text-[10px] text-white/40">Add both scene photos to publish.</p>}
        </div>
      </motion.section>}
    </AnimatePresence>
  );
};

export default SceneVaultAttachment;