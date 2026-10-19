export function FeedPreview() {
  return (
    <main className="min-h-screen bg-[#10090d] px-4 pb-24 pt-5 text-white">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
            Flicks India
          </p>
          <h1 className="mt-1 text-xl font-black tracking-tight">FameFeed</h1>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-lg">
          ✨
        </div>
      </header>

      <div className="mt-5 flex gap-2 border-b border-white/10 pb-3 text-xs font-bold">
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-white">
          For you
        </span>
        <span className="px-3 py-1.5 text-white/45">Following</span>
        <span className="px-3 py-1.5 text-white/45">Nearby</span>
      </div>

      <article className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-[#17131c]">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-pink-400 to-violet-600 text-sm font-black">
            AS
          </div>
          <div>
            <p className="text-sm font-black">Aarav Sharma</p>
            <p className="mt-0.5 text-[10px] text-white/45">Mumbai · 12 min ago</p>
          </div>
          <span className="ml-auto text-white/40">•••</span>
        </div>
        <div className="relative mx-3 h-64 overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_72%_22%,rgba(244,114,182,0.5),transparent_33%),radial-gradient(ellipse_at_25%_72%,rgba(34,211,238,0.38),transparent_34%),linear-gradient(135deg,#31213a,#172334_55%,#261927)]">
          <div className="absolute inset-0 opacity-50">
            <div className="absolute -right-8 top-8 h-36 w-36 rounded-full border border-white/20" />
            <div className="absolute bottom-6 left-8 h-28 w-28 rounded-full border border-white/15" />
          </div>
          <div className="absolute bottom-5 left-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/60">
              Today’s moment
            </p>
            <p className="mt-1 text-lg font-black">Chasing the last light</p>
          </div>
        </div>
        <p className="px-4 pt-3 text-sm text-white/85">
          A little color makes an ordinary evening feel special.
        </p>
        <div className="flex items-center gap-5 px-4 py-4 text-xs font-bold text-white/55">
          <span>♡ 128</span>
          <span>◯ 18 comments</span>
          <span className="ml-auto">Save</span>
        </div>
      </article>

      <article className="mt-4 rounded-3xl border border-white/10 bg-[#17131c] p-4">
        <p className="text-xs font-black text-white/80">Neha Kapoor</p>
        <p className="mt-2 text-sm text-white/60">
          Good people, good conversations, good energy.
        </p>
      </article>
    </main>
  );
}
