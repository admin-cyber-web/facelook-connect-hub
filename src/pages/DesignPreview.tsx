import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  AtSign,
  Bell,
  Bookmark,
  Camera,
  Check,
  ChevronDown,
  Clapperboard,
  Compass,
  Heart,
  ImagePlus,
  MapPin,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Music2,
  Paperclip,
  Search,
  Send,
  Settings2,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";

type View = "home" | "messages";
type SceneMood = "love" | "angry" | "travel" | "sad" | "missing";

const people = [
  { id: "maya", name: "Maya Kapoor", handle: "maya.k", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80", online: true, preview: "Sent you a scene ✨", time: "now", unread: 2 },
  { id: "dev", name: "Dev Malhotra", handle: "devm", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&h=120&q=80", online: true, preview: "That track is perfect", time: "8m", unread: 0 },
  { id: "isha", name: "Isha Rao", handle: "isharao", avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&h=120&q=80", online: false, preview: "Photo · Goa, last summer", time: "1h", unread: 0 },
  { id: "arjun", name: "Arjun Mehta", handle: "arjun.m", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80", online: true, preview: "Voice note · 0:18", time: "2h", unread: 0 },
];

const stories = [
  { name: "Your scene", image: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=140&h=180&q=80", add: true },
  { name: "Maya", image: people[0].avatar },
  { name: "Dev", image: people[1].avatar },
  { name: "Isha", image: people[2].avatar },
  { name: "Arjun", image: people[3].avatar },
];

const moods: { id: SceneMood; label: string }[] = [
  { id: "love", label: "Love" },
  { id: "angry", label: "Fight" },
  { id: "travel", label: "Travel" },
  { id: "sad", label: "Sad" },
  { id: "missing", label: "Missing" },
];

function Avatar({ src, name, online, size = "h-10 w-10" }: { src: string; name: string; online?: boolean; size?: string }) {
  return (
    <span className={`relative block shrink-0 ${size}`}>
      <img src={src} alt={name} className="h-full w-full rounded-full object-cover" />
      {online && <i className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#110a0e] bg-[#b6ec57]" />}
    </span>
  );
}

function ActionIcon({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-white/[0.08] bg-white/[0.035] text-white/60 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white">{children}</button>;
}

function SceneVaultDrawer({ onClose }: { onClose: () => void }) {
  const [mood, setMood] = useState<SceneMood>("love");
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 overflow-hidden rounded-[7px] border border-[#b6ec57]/20 bg-[#110d10]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-white"><Clapperboard size={15} className="text-[#b6ec57]" /> Scene Vault <span className="text-[10px] font-medium text-white/35">private preview</span></div>
        <button onClick={onClose} aria-label="Close Scene Vault" className="text-white/40 hover:text-white"><X size={15} /></button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto px-3 pt-3">
        {moods.map((item) => <button key={item.id} onClick={() => setMood(item.id)} aria-pressed={mood === item.id} className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${mood === item.id ? "border-[#b6ec57]/50 bg-[#b6ec57]/10 text-[#d8ff8d]" : "border-white/10 text-white/50 hover:text-white"}`}>{item.label}</button>)}
      </div>
      <div className={`scene-pair scene-pair--${mood} mx-3 my-3 grid grid-cols-2 gap-2 overflow-hidden rounded-[5px] border border-white/10 p-2`}>
        <div className="relative h-24 overflow-hidden rounded-[3px]"><img src={people[0].avatar} className="h-full w-full object-cover" alt="First scene frame" /><span className="absolute bottom-1.5 left-2 text-[9px] font-bold text-white">Frame one</span></div>
        <div className="relative h-24 overflow-hidden rounded-[3px]"><img src={people[1].avatar} className="h-full w-full object-cover" alt="Second scene frame" /><span className="absolute bottom-1.5 left-2 text-[9px] font-bold text-white">Frame two</span></div>
      </div>
      <div className="flex items-center gap-2 px-3 pb-3">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.06] text-[#d8ff8d]"><AtSign size={13} /></span>
        <span className="flex-1 text-[10px] text-white/55">Maya Kapoor tagged as companion</span>
        <button onClick={onClose} className="rounded-[5px] bg-[#b6ec57] px-3 py-2 text-[10px] font-black text-[#11120b]">Attach scene <ArrowLeft size={12} className="ml-1 inline rotate-180" /></button>
      </div>
    </motion.div>
  );
}

function HomePreview({ openMessages }: { openMessages: () => void }) {
  const [sceneOpen, setSceneOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [songOn, setSongOn] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-6 px-3 pb-20 pt-4 sm:px-6 lg:grid-cols-[220px_minmax(0,650px)_270px] lg:px-8">
      <aside className="hidden lg:block">
        <div className="sticky top-[82px] space-y-7">
          <div className="flex items-center gap-3 px-2"><span className="grid h-10 w-10 place-items-center rounded-[7px] bg-[#b6ec57] text-[#14130c]"><Sparkles size={21} /></span><div><p className="text-[15px] font-black tracking-tight">flicks<span className="text-[#b6ec57]">.india</span></p><p className="text-[9px] uppercase tracking-[.16em] text-white/35">Real stories, close up</p></div></div>
          <nav className="space-y-1">
            {[{ icon: Compass, label: "For you", active: true }, { icon: MessageCircle, label: "Messages", click: openMessages }, { icon: Clapperboard, label: "Scene Vault" }, { icon: Bookmark, label: "Saved" }].map(({ icon: Icon, label, active, click }) => <button key={label} onClick={click} className={`flex w-full items-center gap-3 rounded-[6px] px-3 py-2.5 text-left text-xs font-bold transition ${active ? "bg-white/[0.07] text-[#d8ff8d]" : "text-white/50 hover:bg-white/[0.04] hover:text-white"}`}><Icon size={16} />{label}</button>)}
          </nav>
          <div className="border-t border-white/[0.08] pt-5"><p className="mb-3 px-2 text-[9px] font-bold uppercase tracking-[.18em] text-white/30">Your circles</p><p className="px-2 text-xs text-white/55">After Hours Film Club</p><p className="mt-2 px-2 text-xs text-white/55">Weekend Frames</p></div>
        </div>
      </aside>

      <main className="min-w-0">
        <div className="mb-4 flex items-center justify-between lg:hidden"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-[6px] bg-[#b6ec57] text-[#14130c]"><Sparkles size={17} /></span><span className="text-sm font-black">flicks<span className="text-[#b6ec57]">.india</span></span></div><button onClick={openMessages} className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70" aria-label="Open messages"><MessageCircle size={17} /><i className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#b6ec57]" /></button></div>

        <section className="mb-4 overflow-hidden rounded-[7px] border border-white/[0.08] bg-[#160e12]/90">
          <div className="flex items-center justify-between px-4 pb-2 pt-3"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-white/40">Recent scenes</p><button className="text-[10px] font-bold text-[#d8ff8d]">See all</button></div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-3">
            {stories.map((story) => <button key={story.name} className="w-[58px] shrink-0 text-center"><span className={`mx-auto grid h-[54px] w-[54px] place-items-center rounded-full p-[2px] ${story.add ? "border border-dashed border-[#b6ec57]/70" : "bg-gradient-to-br from-[#b6ec57] via-[#ed9b72] to-[#843e53]"}`}><span className="h-full w-full overflow-hidden rounded-full border-2 border-[#160e12]">{story.add ? <span className="grid h-full w-full place-items-center bg-[#21151a] text-[#b6ec57]"><Camera size={18} /></span> : <img src={story.image} alt="" className="h-full w-full object-cover" />}</span></span><span className="mt-1.5 block truncate text-[9px] font-semibold text-white/60">{story.name}</span></button>)}
          </div>
        </section>

        <section className="mb-5 rounded-[7px] border border-white/[0.09] bg-[#1a1116]/90 p-3.5 shadow-[0_14px_40px_rgba(0,0,0,.2)]">
          <div className="flex items-center gap-3"><Avatar src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80" name="You" size="h-9 w-9" /><button className="flex h-10 min-w-0 flex-1 items-center rounded-full border border-white/[0.08] bg-black/20 px-4 text-left text-xs text-white/38">Share a scene, a thought, a song…</button><ActionIcon label="Add photo"><ImagePlus size={16} /></ActionIcon></div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/[0.07] pt-3">
            <button onClick={() => setSceneOpen((open) => !open)} className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[10px] font-bold transition ${sceneOpen ? "border-[#b6ec57]/45 bg-[#b6ec57]/10 text-[#d8ff8d]" : "border-white/10 text-white/55 hover:text-white"}`}><Clapperboard size={13} />Scene Vault</button>
            <button className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 px-3 text-[10px] font-bold text-white/55"><MapPin size={13} />Location</button>
            <button className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 px-3 text-[10px] font-bold text-white/55"><Music2 size={13} />Audio</button>
            <span className="ml-auto text-[9px] text-white/30">Public <ChevronDown size={11} className="inline" /></span>
          </div>
          {sceneOpen && <SceneVaultDrawer onClose={() => setSceneOpen(false)} />}
        </section>

        <article className="mb-5 border-b border-white/[0.09] pb-5">
          <div className="mb-3 flex items-center gap-2.5 px-0.5"><Avatar src={people[0].avatar} name="Maya Kapoor" online /><div className="min-w-0 flex-1"><p className="text-xs font-bold text-white">Maya Kapoor <span className="font-normal text-white/35">· 18 min</span></p><p className="mt-0.5 flex items-center gap-1 text-[9px] text-white/38"><MapPin size={10} />Old Goa · friends</p></div><ActionIcon label="More"><MoreHorizontal size={17} /></ActionIcon></div>
          <p className="mb-3 text-[13px] leading-relaxed text-white/85">Somewhere between the rain and the road, I remembered how good it feels to be nowhere in a hurry.</p>
          <div className="relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1b1114]">
            <img src="https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1100&q=85" alt="Quiet evening sea beneath a muted sky" className="aspect-[4/3] w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-3 pt-12"><div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#d8ff8d]">Wanderlust · scene 02</p><p className="mt-1 font-serif text-xl text-white">The long way home</p></div><button onClick={() => setSongOn((value) => !value)} aria-label={songOn ? "Mute scene audio" : "Play scene audio"} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border backdrop-blur-md ${songOn ? "border-[#b6ec57]/60 bg-[#b6ec57]/15 text-[#d8ff8d]" : "border-white/20 bg-black/35 text-white"}`}><Volume2 size={16} /></button></div></div>
          </div>
          <div className="mt-3 flex items-center gap-4"><button onClick={() => setLiked((value) => !value)} className={`flex items-center gap-1.5 text-[10px] font-bold ${liked ? "text-[#ef8c9d]" : "text-white/50"}`}><Heart size={15} fill={liked ? "currentColor" : "none"} />{liked ? "129" : "128"}</button><button className="flex items-center gap-1.5 text-[10px] font-bold text-white/50"><MessageCircle size={15} />18</button><button className="ml-auto" onClick={() => setSaved((value) => !value)} aria-label={saved ? "Unsave post" : "Save post"}><Bookmark size={15} className={saved ? "fill-[#d8ff8d] text-[#d8ff8d]" : "text-white/45"} /></button></div>
        </article>

        <article className="border-b border-white/[0.09] pb-5"><div className="mb-3 flex items-center gap-2.5"><Avatar src={people[1].avatar} name="Dev Malhotra" /><div><p className="text-xs font-bold text-white">Dev Malhotra <span className="font-normal text-white/35">· 42 min</span></p><p className="mt-0.5 text-[9px] text-white/38">Scene Vault · Love</p></div></div><div className="grid grid-cols-2 gap-1 overflow-hidden rounded-[6px]"><img src={people[0].avatar} className="aspect-[4/3] w-full object-cover" alt="Love scene frame one" /><img src={people[1].avatar} className="aspect-[4/3] w-full object-cover" alt="Love scene frame two" /></div><div className="mt-2 flex items-center gap-2 text-[10px] text-[#d8ff8d]"><Music2 size={12} />Soft Focus <span className="text-white/30">· original mix</span></div></article>
      </main>

      <aside className="hidden lg:block"><div className="sticky top-[82px] space-y-5"><section className="border-b border-white/[0.08] pb-5"><div className="mb-3 flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-white/40">In your orbit</p><button className="text-[10px] font-bold text-[#d8ff8d]">See all</button></div>{people.slice(0, 3).map((person) => <button key={person.id} className="flex w-full items-center gap-2.5 py-2 text-left"><Avatar src={person.avatar} name={person.name} online={person.online} size="h-8 w-8" /><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-bold text-white/80">{person.name}</span><span className="block text-[9px] text-white/35">{person.online ? "Around now" : "Recently active"}</span></span><span className="text-[9px] text-[#d8ff8d]">Follow</span></button>)}</section><section className="rounded-[7px] border border-[#b6ec57]/15 bg-[#181911]/70 p-3"><p className="text-[9px] font-bold uppercase tracking-[.17em] text-[#d8ff8d]/70">On repeat</p><div className="mt-3 flex items-center gap-2.5"><img src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=100&h=100&q=80" alt="" className="h-10 w-10 rounded-[4px] object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-bold text-white">Soft Focus</span><span className="text-[9px] text-white/40">Mira Sol · scene mix</span></span><Music2 size={14} className="text-[#d8ff8d]" /></div></section></div></aside>
    </div>
  );
}

function MessagesPreview() {
  const [activeId, setActiveId] = useState("maya");
  const active = people.find((person) => person.id === activeId) || people[0];
  return (
    <div className="mx-auto grid h-[calc(100dvh-110px)] min-h-[540px] w-full max-w-[1440px] overflow-hidden rounded-[8px] border border-white/[0.08] bg-[#110a0e] lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_260px]">
      <aside className={`${activeId ? "hidden" : "flex"} min-h-0 flex-col border-r border-white/[0.08] lg:flex`}><div className="flex items-center justify-between px-4 py-4"><div><h2 className="text-base font-black">Messages</h2><p className="mt-0.5 text-[9px] text-white/38">4 conversations · 3 online</p></div><ActionIcon label="Settings"><Settings2 size={16} /></ActionIcon></div><label className="relative mx-3 mb-3 block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" /><input placeholder="Search conversations" className="h-9 w-full rounded-[5px] border border-white/[0.08] bg-white/[0.035] pl-9 pr-3 text-xs outline-none placeholder:text-white/32 focus:border-[#b6ec57]/35" /></label><p className="px-4 pb-2 text-[9px] font-bold uppercase tracking-[.16em] text-white/32">Recent</p><div className="min-h-0 flex-1 overflow-y-auto">{people.map((person) => <button key={person.id} onClick={() => setActiveId(person.id)} className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-3 text-left transition ${person.id === activeId ? "border-[#b6ec57] bg-white/[0.055]" : "border-transparent hover:bg-white/[0.03]"}`}><Avatar src={person.avatar} name={person.name} online={person.online} size="h-10 w-10" /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-bold text-white/85">{person.name}</span><span className="text-[9px] text-white/32">{person.time}</span></span><span className="mt-1 block truncate text-[10px] text-white/42">{person.preview}</span></span>{person.unread > 0 && <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#b6ec57] px-1 text-[9px] font-black text-[#14130c]">{person.unread}</span>}</button>)}</div></aside>

      <main className={`${activeId ? "flex" : "hidden"} min-h-0 flex-col lg:flex`}>
        <header className="flex min-h-[62px] items-center gap-2.5 border-b border-white/[0.08] px-3 sm:px-4"><button onClick={() => setActiveId("")} className="grid h-8 w-8 place-items-center rounded-full text-white/55 hover:bg-white/10 lg:hidden" aria-label="Back to conversations"><ArrowLeft size={17} /></button><Avatar src={active.avatar} name={active.name} online={active.online} size="h-9 w-9" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{active.name}</p><p className="mt-0.5 text-[9px] text-[#b6ec57]/80">{active.online ? "Active now" : "Last seen recently"}</p></div><span className="hidden items-center gap-1.5 rounded-full border border-[#b6ec57]/20 bg-[#b6ec57]/[0.07] px-2.5 py-1.5 text-[9px] font-bold text-[#d8ff8d] sm:inline-flex"><Music2 size={12} />Listening to Soft Focus</span><ActionIcon label="Search"><Search size={16} /></ActionIcon><ActionIcon label="More"><MoreHorizontal size={17} /></ActionIcon></header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 sm:px-6">
          <p className="my-1 text-center text-[9px] font-semibold uppercase tracking-[.16em] text-white/30">Today · 8:42 PM</p>
          <div className="flex items-end gap-2"><Avatar src={active.avatar} name={active.name} size="h-6 w-6" /><div className="max-w-[82%] rounded-[12px] rounded-bl-[3px] border border-white/[0.08] bg-white/[0.055] px-3 py-2.5 text-[11px] leading-relaxed text-white/85 sm:max-w-[68%]">Found this little coast road just before sunset. This feels like your kind of place.</div></div>
          <div className="flex justify-end"><div className="max-w-[82%] rounded-[12px] rounded-br-[3px] border border-[#b6ec57]/20 bg-[#4c572a]/45 px-3 py-2.5 text-[11px] leading-relaxed text-white sm:max-w-[68%]">I’m saving this for our next trip. <span className="ml-1 text-[9px] text-[#d8ff8d]">seen 8:44</span></div></div>
          <div className="ml-8 max-w-[85%] overflow-hidden rounded-[6px] border border-white/10 sm:max-w-[66%]"><img src="https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=900&q=80" alt="Evening coast photo shared in chat" className="aspect-[16/9] w-full object-cover" /><div className="flex items-center gap-2 bg-[#181116] px-3 py-2"><MapPin size={12} className="text-[#d8ff8d]" /><span className="text-[9px] text-white/65">Old Goa · scene from Maya</span></div></div>
          <div className="flex justify-end"><div className="rounded-[12px] rounded-br-[3px] border border-[#b6ec57]/20 bg-[#4c572a]/45 px-3 py-2.5 text-[11px] text-white">@maya this is perfect <span className="ml-1 text-[9px] text-[#d8ff8d]">seen</span></div></div>
          <div className="flex justify-end"><button className="flex max-w-[85%] items-center gap-3 rounded-[7px] border border-[#b6ec57]/20 bg-[#17180f] px-3 py-2.5 text-left sm:max-w-[66%]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#b6ec57] text-[#13140c]"><Volume2 size={14} /></span><span className="min-w-0"><span className="block truncate text-[10px] font-bold text-white">Soft Focus · Maya Sol</span><span className="block text-[9px] text-white/40">Shared scene soundtrack · 0:24</span></span><span className="flex items-end gap-[2px]">{[7, 13, 9, 16, 11, 6, 12].map((height, index) => <i key={index} className="w-[2px] rounded-full bg-[#b6ec57]/80" style={{ height }} />)}</span></button></div>
          <p className="my-1 text-center text-[9px] text-white/30">Maya is typing <span className="ml-1 inline-flex gap-1 align-middle"><i className="h-1 w-1 animate-pulse rounded-full bg-[#b6ec57]" /><i className="h-1 w-1 animate-pulse rounded-full bg-[#b6ec57] [animation-delay:180ms]" /><i className="h-1 w-1 animate-pulse rounded-full bg-[#b6ec57] [animation-delay:360ms]" /></span></p>
        </div>

        <form onSubmit={(event) => event.preventDefault()} className="flex items-center gap-2 border-t border-white/[0.08] bg-[#140c10]/95 px-3 py-3 sm:px-4"><ActionIcon label="Attach photo"><Paperclip size={16} /></ActionIcon><ActionIcon label="Tag companion"><AtSign size={15} /></ActionIcon><input placeholder="Message Maya…" className="h-10 min-w-0 flex-1 rounded-full border border-white/[0.09] bg-white/[0.035] px-4 text-xs text-white outline-none placeholder:text-white/35 focus:border-[#b6ec57]/30" /><ActionIcon label="Voice message"><Mic size={16} /></ActionIcon><button aria-label="Send message" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#b6ec57] text-[#14130c] transition hover:brightness-110"><Send size={16} /></button></form>
      </main>

      <aside className="hidden border-l border-white/[0.08] p-4 xl:block"><p className="text-[9px] font-bold uppercase tracking-[.17em] text-white/35">Companion</p><div className="mt-4 flex flex-col items-center text-center"><Avatar src={active.avatar} name={active.name} online={active.online} size="h-16 w-16" /><p className="mt-3 text-xs font-bold">{active.name}</p><p className="mt-1 text-[9px] text-white/38">@{active.handle}</p><span className="mt-3 rounded-full border border-[#ed9b72]/25 bg-[#ed9b72]/[0.08] px-2.5 py-1 text-[9px] font-bold text-[#f1b69a]">Close companion</span></div><div className="mt-6 border-t border-white/[0.08] pt-4"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-white/35">Shared scenes</p><div className="mt-3 grid grid-cols-2 gap-1.5"><img src={people[0].avatar} alt="Shared scene" className="aspect-square w-full rounded-[4px] object-cover" /><img src="https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=180&q=70" alt="Shared coast scene" className="aspect-square w-full rounded-[4px] object-cover" /></div></div></aside>
    </div>
  );
}

export default function DesignPreview() {
  const [view, setView] = useState<View>("home");
  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0e080c] text-white" style={{ backgroundImage: "radial-gradient(ellipse at 48% -18%, rgba(103,35,56,.32), transparent 55%), radial-gradient(rgba(255,255,255,.025) .6px, transparent .6px)", backgroundSize: "auto, 7px 7px" }}>
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#10090d]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] max-w-[1440px] items-center gap-3 px-3 sm:px-6 lg:px-8"><div className="flex items-center gap-2 lg:hidden"><span className="grid h-8 w-8 place-items-center rounded-[6px] bg-[#b6ec57] text-[#14130c]"><Sparkles size={16} /></span><span className="text-xs font-black">flicks<span className="text-[#b6ec57]">.india</span></span></div><div className="relative hidden max-w-[420px] flex-1 sm:block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" /><input placeholder="Search stories, people, songs…" className="h-9 w-full rounded-full border border-white/[0.08] bg-white/[0.035] pl-9 pr-4 text-[11px] text-white outline-none placeholder:text-white/35 focus:border-[#b6ec57]/30" /></div><div className="ml-auto flex items-center gap-2"><span className="hidden rounded-full border border-[#b6ec57]/20 bg-[#b6ec57]/[0.06] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#d8ff8d] sm:inline-flex">Design preview · sample data</span><button onClick={() => setView(view === "home" ? "messages" : "home")} className="flex h-9 items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 text-[10px] font-bold text-white/75 transition hover:border-[#b6ec57]/30 hover:text-white"><span className={`h-1.5 w-1.5 rounded-full ${view === "home" ? "bg-white/35" : "bg-[#b6ec57]"}`} />{view === "home" ? "Open Messages" : "Back to Home"}</button><Avatar src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80" name="Your profile" size="h-8 w-8" /></div></div>
      </header>
      {view === "home" ? <HomePreview openMessages={() => setView("messages")} /> : <div className="px-2 pb-6 pt-3 sm:px-5 lg:px-8"><MessagesPreview /></div>}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-white/[0.08] bg-[#10090d]/95 px-3 py-2 backdrop-blur-xl lg:hidden"><button onClick={() => setView("home")} className={`grid justify-items-center gap-1 text-[9px] font-bold ${view === "home" ? "text-[#d8ff8d]" : "text-white/40"}`}><Compass size={17} />Home</button><button onClick={() => setView("messages")} className={`grid justify-items-center gap-1 text-[9px] font-bold ${view === "messages" ? "text-[#d8ff8d]" : "text-white/40"}`}><MessageCircle size={17} />Messages</button><button className="grid justify-items-center gap-1 text-[9px] font-bold text-white/40"><Bell size={17} />Alerts</button><button className="grid justify-items-center gap-1 text-[9px] font-bold text-white/40"><Settings2 size={17} />Settings</button></div>
    </div>
  );
}
