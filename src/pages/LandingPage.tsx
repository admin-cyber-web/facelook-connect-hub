import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  Camera,
  ChevronRight,
  Globe2,
  Heart,
  MessageCircle,
  Play,
  Quote,
  Radio,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

const features = [
  {
    icon: Camera,
    title: "Flicks Feed",
    copy: "Share cinematic posts, reels, and the little moments that make life feel real.",
    color: "#ff2f7d",
    tint: "rgba(255,47,125,.12)",
  },
  {
    icon: Quote,
    title: "Quotes Maker",
    copy: "Turn your thoughts into beautiful quote cards with a studio made for expression.",
    color: "#d9f51b",
    tint: "rgba(217,245,27,.10)",
  },
  {
    icon: Radio,
    title: "Live Stories",
    copy: "Keep your people close with visual stories that capture your day as it happens.",
    color: "#b168ff",
    tint: "rgba(177,104,255,.13)",
  },
  {
    icon: Zap,
    title: "Magnet Connect",
    copy: "Find like-minded souls and send a spark when the vibe feels right.",
    color: "#28d7ef",
    tint: "rgba(40,215,239,.10)",
  },
  {
    icon: TrendingUp,
    title: "Pulse Surveys",
    copy: "Ask the community, share your take, and discover what India is thinking.",
    color: "#ffb52e",
    tint: "rgba(255,181,46,.11)",
  },
  {
    icon: MessageCircle,
    title: "Chat Rooms",
    copy: "Have richer conversations with reactions, stickers, and rooms built around interests.",
    color: "#40e0a0",
    tint: "rgba(64,224,160,.10)",
  },
];

const stats = [
  { value: "50K+", label: "Active members", icon: Users, color: "#b168ff" },
  { value: "2M+", label: "Moments shared", icon: Camera, color: "#ff2f7d" },
  { value: "500K+", label: "Quotes created", icon: Quote, color: "#d9f51b" },
  { value: "100+", label: "Cities connected", icon: Globe2, color: "#28d7ef" },
];

const stories = [
  { name: "Riya", letter: "R", color: "#ff2f7d" },
  { name: "Arjun", letter: "A", color: "#b168ff" },
  { name: "Kavya", letter: "K", color: "#d9f51b" },
  { name: "Mia", letter: "M", color: "#28d7ef" },
  { name: "Sam", letter: "S", color: "#ffb52e" },
];

const posts = [
  { name: "Riya", letter: "R", color: "#ff2f7d", text: "Golden hour in Jaipur ✨", emoji: "🌅", likes: "1.2K" },
  { name: "Arjun", letter: "A", color: "#d9f51b", text: "Jo sach hai, woh dil se nikalta hai 🔥", emoji: "✦", likes: "890" },
  { name: "Kavya", letter: "K", color: "#b168ff", text: "Mumbai chai & rooftop conversations ☕", emoji: "☕", likes: "2.3K" },
];

const testimonials = [
  {
    quote: "कुछ रिश्ते दिल से होते हैं — Flicks पर मिले। यहाँ सिर्फ असली बातें हैं।",
    name: "Priya Sharma",
    place: "Mumbai",
    letter: "P",
    color: "#ff2f7d",
  },
  {
    quote: "Real connections start with real moments. This is the social space I was searching for.",
    name: "Rahul Kapoor",
    place: "Delhi",
    letter: "R",
    color: "#b168ff",
  },
  {
    quote: "Jo dil mein hai, woh yahan share karo. No filters, just genuine vibes.",
    name: "Aarav Mehta",
    place: "Bangalore",
    letter: "A",
    color: "#d9f51b",
  },
];

function Orb({ className }: { className: string }) {
  return <div aria-hidden="true" className={`landing-orb ${className}`} />;
}

function AppPreview() {
  return (
    <div className="preview-cluster" aria-label="Preview of the Flicks India social feed">
      <Orb className="preview-orb" />
      <motion.div
        className="phone-frame"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="phone-status"><span>9:41</span><span>● ● ●</span></div>
        <div className="phone-bar">
          <div className="phone-brand">
            <img src="/logo.png" alt="" />
            <strong>Flicks</strong>
          </div>
          <span className="phone-bell">♢</span>
        </div>
        <div className="story-row">
          {stories.map((story) => (
            <div className="story-item" key={story.name}>
              <div className="story-avatar" style={{ background: `linear-gradient(135deg, ${story.color}, #6132c7)` }}>
                {story.letter}
              </div>
              <span>{story.name}</span>
            </div>
          ))}
        </div>
        <div className="phone-divider" />
        <div className="phone-feed">
          {posts.map((post) => (
            <div className="mini-post" key={post.name}>
              <div className="mini-post-head">
                <div className="mini-avatar" style={{ background: `linear-gradient(135deg, ${post.color}, #662bba)` }}>{post.letter}</div>
                <div><b>{post.name}</b><small>just now</small></div>
                <i style={{ background: post.color }} />
              </div>
              <p>{post.text}</p>
              <div className="mini-photo" style={{ background: `linear-gradient(135deg, ${post.color}32, rgba(255,255,255,.02))` }}>{post.emoji}</div>
              <div className="mini-actions"><span style={{ color: "#ff2f7d" }}>♥ {post.likes}</span><span>♧ Reply</span><span>↗ Share</span></div>
            </div>
          ))}
        </div>
        <div className="phone-nav"><span className="active">⊞</span><span>✦</span><strong>⊕</strong><span>☆</span><span>◉</span></div>
      </motion.div>

      <motion.div
        className="quote-preview"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      >
        <div className="quote-preview-mark">“</div>
        <p>Real connections don&apos;t need filters. Just truth and two open hearts.</p>
        <div className="quote-author"><span>F</span><small>Flicks Quotes Studio</small></div>
        <div className="quote-share">✦ Share <span>♡</span><span>⌁</span></div>
        <div className="quote-tags"><b>#quotes</b><b>#flicks</b><b>#real</b></div>
      </motion.div>

      <motion.div
        className="magnet-preview"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      >
        <small>⚡ MAGNET CONNECTION</small>
        <div className="magnet-person"><span>S</span><div><b>Sneha R.</b><small>Mumbai · 2 mutual vibes</small></div></div>
        <p>“Into sunsets, poetry, and good chai ☕”</p>
        <div className="magnet-button">⚡ Connect <i>×</i></div>
      </motion.div>
    </div>
  );
}

function LandingPage() {
  return (
    <main className="landing-page">
      <Helmet>
        <title>Flicks India — Real Connections. Real Stories.</title>
        <meta name="description" content="Flicks India is a community-driven social media platform for authentic connections, sharing moments, quotes, and real updates." />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Flicks India" />
        <meta property="og:title" content="Flicks India — Real Connections. Real Stories." />
        <meta property="og:description" content="A premium social space for authentic connections, cinematic posts, quotes, and real community vibes." />
        <meta property="og:image" content="https://flicksindia.online/logo.png" />
        <meta property="og:url" content="https://flicksindia.online/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Flicks India — Real Connections. Real Stories." />
        <meta name="twitter:description" content="Connect authentically. Share beautifully. Find your real community." />
        <meta name="twitter:image" content="https://flicksindia.online/logo.png" />
      </Helmet>

      <style>{`
        .landing-page { --midnight:#020617; --maroon:#1e0010; background:var(--midnight); color:#fff; font-family:'DM Sans',sans-serif; min-height:100vh; overflow:hidden; }
        .landing-page * { box-sizing:border-box; }
        .landing-page a { color:inherit; text-decoration:none; }
        .landing-nav { position:fixed; z-index:20; inset:0 0 auto; height:70px; background:rgba(2,6,23,.72); border-bottom:1px solid rgba(255,255,255,.065); backdrop-filter:blur(22px); }
        .nav-inner { max-width:1180px; height:100%; padding:0 24px; margin:auto; display:flex; align-items:center; justify-content:space-between; }
        .brand { display:flex; align-items:center; gap:10px; font-size:19px; font-weight:900; letter-spacing:-.03em; }
        .brand img { width:36px; height:36px; border-radius:10px; box-shadow:0 0 22px rgba(255,47,125,.35); }
        .gradient-text { background:linear-gradient(90deg,#ff2f7d,#b168ff,#6971ff); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .nav-links { display:flex; align-items:center; gap:24px; }
        .nav-links .quiet { color:rgba(255,255,255,.45); font-size:13px; }
        .nav-cta { border-radius:24px; padding:10px 21px; font-size:13px; font-weight:800; background:linear-gradient(135deg,#ff2f7d,#8f44e9); box-shadow:0 0 20px rgba(255,47,125,.3); }
        .hero { position:relative; min-height:760px; padding:150px 24px 100px; display:flex; align-items:center; justify-content:center; text-align:center; }
        .hero-grid { position:absolute; inset:0; opacity:.6; background-image:linear-gradient(rgba(255,255,255,.026) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.026) 1px,transparent 1px); background-size:68px 68px; mask-image:radial-gradient(ellipse 72% 80% at 50% 48%,#000 10%,transparent 85%); }
        .landing-orb { position:absolute; border-radius:50%; pointer-events:none; filter:blur(78px); }
        .hero-orb-a { width:580px; height:580px; left:-230px; top:-140px; background:radial-gradient(circle,#80002788,transparent 68%); }
        .hero-orb-b { width:560px; height:560px; right:-200px; top:-90px; background:radial-gradient(circle,#3037a855,transparent 68%); }
        .hero-orb-c { width:460px; height:460px; left:13%; bottom:-250px; background:radial-gradient(circle,#68001e55,transparent 68%); }
        .hero-content { position:relative; z-index:1; max-width:930px; display:flex; flex-direction:column; align-items:center; }
        .eyebrow { display:inline-flex; align-items:center; gap:8px; padding:8px 17px; border:1px solid rgba(177,104,255,.35); border-radius:30px; color:#c693ff; background:rgba(177,104,255,.1); font-size:12px; font-weight:800; margin-bottom:31px; }
        .hero-logo { width:106px; height:106px; border-radius:29px; margin-bottom:35px; box-shadow:0 0 40px rgba(255,47,125,.42),0 0 90px rgba(177,104,255,.2); }
        .hero h1 { font-size:clamp(42px,7.2vw,84px); line-height:1.04; letter-spacing:-.055em; margin:0 0 24px; font-weight:900; }
        .hero h1 .line-two { background:linear-gradient(90deg,#ff2f7d,#b168ff 43%,#6971ff 72%,#28d7ef); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .hero-copy { max-width:610px; color:rgba(255,255,255,.55); font-size:clamp(15px,2vw,19px); line-height:1.7; margin:0 0 42px; }
        .cta-row { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; margin-bottom:47px; }
        .cta { display:inline-flex; align-items:center; gap:10px; border-radius:36px; padding:15px 29px; font-size:15px; font-weight:900; cursor:pointer; }
        .cta-primary { background:linear-gradient(135deg,#ff2f7d,#a34ce8,#5d65e8); box-shadow:0 0 30px rgba(255,47,125,.42),0 0 70px rgba(115,69,231,.18); }
        .cta-secondary { border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.055); color:rgba(255,255,255,.9); backdrop-filter:blur(12px); }
        .pill-row { display:flex; justify-content:center; flex-wrap:wrap; gap:9px; }
        .feature-pill { padding:7px 15px; border-radius:22px; font-size:11px; font-weight:800; border:1px solid; }
        .stats-strip { position:relative; z-index:2; border-top:1px solid rgba(255,255,255,.06); border-bottom:1px solid rgba(255,255,255,.06); padding:39px 24px; background:linear-gradient(90deg,rgba(255,47,125,.04),rgba(177,104,255,.08),rgba(40,215,239,.03)); }
        .stats-inner { max-width:930px; margin:auto; display:grid; grid-template-columns:repeat(4,1fr); gap:24px; }
        .stat { text-align:center; display:flex; flex-direction:column; align-items:center; gap:6px; }
        .stat-icon { margin-bottom:5px; filter:drop-shadow(0 0 7px currentColor); }
        .stat-value { font-size:32px; line-height:1; font-weight:900; }
        .stat-label { color:rgba(255,255,255,.4); font-size:12px; font-weight:700; }
        .section { max-width:1200px; margin:auto; padding:132px 24px; }
        .showcase { display:flex; align-items:center; justify-content:center; gap:85px; }
        .preview-cluster { position:relative; width:530px; min-height:510px; flex:none; }
        .preview-orb { inset:45px 20px 25px; background:radial-gradient(circle,rgba(177,104,255,.22),rgba(255,47,125,.07) 47%,transparent 72%); filter:blur(45px); }
        .phone-frame { position:absolute; left:22px; top:36px; width:224px; height:452px; overflow:hidden; display:flex; flex-direction:column; border:1px solid rgba(255,255,255,.14); border-radius:34px; background:linear-gradient(180deg,#111a35,#020617); box-shadow:0 0 0 5px rgba(255,255,255,.018),0 0 55px rgba(177,104,255,.3),0 0 100px rgba(255,47,125,.12); }
        .phone-status { display:flex; justify-content:space-between; padding:11px 16px 4px; color:rgba(255,255,255,.4); font-size:8px; font-weight:800; }
        .phone-bar { display:flex; align-items:center; justify-content:space-between; padding:5px 13px 8px; }
        .phone-brand { display:flex; align-items:center; gap:6px; font-size:12px; }
        .phone-brand img { width:21px; height:21px; border-radius:6px; }
        .phone-brand strong { background:linear-gradient(90deg,#ff2f7d,#b168ff); -webkit-background-clip:text; color:transparent; }
        .phone-bell { width:23px; height:23px; display:grid; place-items:center; border-radius:50%; color:#b168ff; background:rgba(177,104,255,.14); }
        .story-row { display:flex; gap:9px; padding:2px 10px 9px; }
        .story-item { display:flex; flex-direction:column; align-items:center; gap:3px; color:rgba(255,255,255,.38); font-size:6px; }
        .story-avatar { width:33px; height:33px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.16); border-radius:50%; color:#fff; font-size:10px; font-weight:900; box-shadow:0 0 8px rgba(177,104,255,.35); }
        .phone-divider { height:1px; background:rgba(255,255,255,.06); }
        .phone-feed { flex:1; overflow:hidden; padding:8px 9px; display:flex; flex-direction:column; gap:7px; }
        .mini-post { padding:8px; border:1px solid rgba(255,255,255,.07); border-radius:12px; background:rgba(255,255,255,.035); }
        .mini-post-head { display:flex; align-items:center; gap:6px; }
        .mini-avatar { display:grid; place-items:center; width:21px; height:21px; border-radius:50%; color:#fff; font-size:9px; font-weight:900; }
        .mini-post-head b,.mini-post-head small { display:block; }
        .mini-post-head b { color:#fff; font-size:8px; }
        .mini-post-head small { color:rgba(255,255,255,.3); font-size:6px; margin-top:2px; }
        .mini-post-head i { width:5px; height:5px; border-radius:50%; margin-left:auto; box-shadow:0 0 6px currentColor; }
        .mini-post p { color:rgba(255,255,255,.72); font-size:8px; line-height:1.45; margin:6px 0; }
        .mini-photo { height:44px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.06); border-radius:8px; font-size:16px; margin-bottom:6px; }
        .mini-actions { display:flex; gap:9px; font-size:6.5px; color:rgba(255,255,255,.3); }
        .phone-nav { display:flex; height:45px; align-items:center; justify-content:space-around; border-top:1px solid rgba(255,255,255,.06); color:rgba(255,255,255,.25); font-size:14px; }
        .phone-nav .active { color:#ff2f7d; padding:5px 9px; border-radius:10px; background:rgba(255,47,125,.13); }
        .phone-nav strong { display:grid; place-items:center; width:31px; height:31px; border-radius:10px; color:#fff; background:linear-gradient(135deg,#b168ff,#5667ef); box-shadow:0 0 15px rgba(177,104,255,.55); }
        .quote-preview,.magnet-preview { position:absolute; right:0; border-radius:20px; }
        .quote-preview { top:4px; width:214px; padding:21px 18px 15px; border:1px solid rgba(177,104,255,.35); background:linear-gradient(135deg,#270044,#15001f 60%,#30000f); box-shadow:0 0 42px rgba(177,104,255,.22); }
        .quote-preview:before { content:""; position:absolute; left:0; right:0; top:0; height:2px; background:linear-gradient(90deg,transparent,#b168ff,#ff2f7d,transparent); }
        .quote-preview-mark { color:#b168ff; opacity:.55; font-family:Georgia,serif; font-size:54px; font-weight:900; line-height:.7; }
        .quote-preview p { color:rgba(255,255,255,.86); font:italic 500 13px/1.55 Georgia,serif; margin:15px 0 16px; }
        .quote-author { display:flex; align-items:center; gap:8px; color:rgba(255,255,255,.4); font-size:9px; }
        .quote-author span { display:grid; place-items:center; width:26px; height:26px; border-radius:50%; background:linear-gradient(135deg,#ff2f7d,#b168ff); color:#fff; font-weight:900; }
        .quote-share { display:flex; align-items:center; gap:10px; margin-top:15px; padding:7px 9px; border-radius:10px; background:linear-gradient(135deg,#ff2f7d,#a44ce8); color:#fff; font-size:9px; font-weight:900; }
        .quote-share span { margin-left:auto; opacity:.8; }
        .quote-share span+span { margin-left:0; }
        .quote-tags { display:flex; gap:5px; margin-top:10px; }
        .quote-tags b { color:#b168ff; font-size:7px; font-weight:600; padding:3px 6px; border:1px solid rgba(177,104,255,.2); border-radius:10px; }
        .magnet-preview { right:25px; top:315px; width:202px; padding:15px; border:1px solid rgba(40,215,239,.3); background:linear-gradient(135deg,#002029,#001016); box-shadow:0 0 30px rgba(40,215,239,.16); }
        .magnet-preview>small { color:#28d7ef; font-size:8px; letter-spacing:.08em; font-weight:900; }
        .magnet-person { display:flex; align-items:center; gap:9px; margin:12px 0; }
        .magnet-person>span { display:grid; place-items:center; width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,#ff2f7d,#b168ff); box-shadow:0 0 10px rgba(255,47,125,.4); font-size:13px; font-weight:900; }
        .magnet-person b,.magnet-person small { display:block; }
        .magnet-person b { font-size:10px; }
        .magnet-person small { color:rgba(255,255,255,.35); font-size:8px; margin-top:3px; }
        .magnet-preview p { margin:0 0 12px; color:rgba(255,255,255,.53); font-size:9px; line-height:1.5; }
        .magnet-button { display:flex; justify-content:space-between; align-items:center; border-radius:9px; padding:7px 9px; color:#fff; background:linear-gradient(135deg,#20cfe7,#5365e9); font-size:9px; font-weight:900; box-shadow:0 0 12px rgba(40,215,239,.3); }
        .magnet-button i { display:grid; place-items:center; width:21px; height:21px; border-radius:7px; background:rgba(255,255,255,.1); font-style:normal; }
        .showcase-copy { max-width:455px; }
        .section-label { display:inline-flex; align-items:center; gap:7px; padding:6px 13px; border:1px solid rgba(255,47,125,.28); border-radius:20px; color:#ff5a96; background:rgba(255,47,125,.09); font-size:11px; font-weight:900; }
        .showcase-copy h2,.section-heading h2 { font-size:clamp(30px,4.4vw,54px); line-height:1.08; letter-spacing:-.045em; margin:20px 0; font-weight:900; }
        .showcase-copy h2 span { background:linear-gradient(90deg,#ff2f7d,#b168ff); -webkit-background-clip:text; color:transparent; }
        .showcase-copy>p { color:rgba(255,255,255,.48); font-size:15px; line-height:1.8; margin-bottom:28px; }
        .benefit { display:flex; gap:12px; align-items:flex-start; margin:14px 0; color:rgba(255,255,255,.65); font-size:13px; line-height:1.55; }
        .benefit-icon { flex:none; display:grid; place-items:center; width:31px; height:31px; border-radius:9px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.07); }
        .text-link { display:inline-flex; align-items:center; gap:7px; margin-top:22px; color:#ff70a4; font-size:14px; font-weight:900; }
        .section-heading { text-align:center; max-width:650px; margin:0 auto 62px; }
        .section-heading h2 { margin:18px 0; }
        .section-heading h2 span { background:linear-gradient(90deg,#b168ff,#6971ff,#28d7ef); -webkit-background-clip:text; color:transparent; }
        .section-heading p { color:rgba(255,255,255,.4); font-size:15px; line-height:1.65; }
        .feature-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
        .feature-card { position:relative; min-height:220px; overflow:hidden; padding:27px 25px; border:1px solid rgba(255,255,255,.08); border-radius:21px; background:linear-gradient(140deg,rgba(255,255,255,.055),rgba(255,255,255,.013)); }
        .feature-card:after { content:""; position:absolute; inset:auto 0 0; height:1px; background:linear-gradient(90deg,transparent,var(--card-color),transparent); opacity:.45; }
        .feature-card:before { content:""; position:absolute; width:125px; height:125px; right:-45px; top:-45px; border-radius:50%; background:radial-gradient(circle,var(--card-color),transparent 68%); opacity:.13; filter:blur(8px); }
        .feature-icon { position:relative; display:grid; place-items:center; width:49px; height:49px; border:1px solid; border-radius:14px; margin-bottom:20px; }
        .feature-card h3 { margin:0 0 10px; font-size:17px; font-weight:900; }
        .feature-card p { max-width:270px; color:rgba(255,255,255,.43); font-size:13px; line-height:1.65; margin:0; }
        .feature-card small { display:inline-block; margin-top:17px; color:var(--card-color); font-size:10px; font-weight:900; }
        .voices { background:linear-gradient(180deg,transparent,rgba(255,47,125,.025),transparent); }
        .quote-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; }
        .voice-card { position:relative; overflow:hidden; padding:28px 25px; border:1px solid rgba(255,255,255,.09); border-radius:21px; background:rgba(255,255,255,.035); }
        .voice-card:before { content:""; position:absolute; left:0; right:0; top:0; height:2px; background:linear-gradient(90deg,transparent,var(--voice-color),transparent); }
        .big-quote { color:var(--voice-color); opacity:.35; font:900 54px/ .8 Georgia,serif; }
        .voice-card blockquote { min-height:80px; margin:15px 0 22px; color:rgba(255,255,255,.78); font:italic 500 14px/1.7 Georgia,serif; }
        .voice-person { display:flex; align-items:center; gap:10px; }
        .voice-avatar { display:grid; place-items:center; width:37px; height:37px; border-radius:50%; color:#fff; font-size:14px; font-weight:900; box-shadow:0 0 13px var(--voice-color); }
        .voice-person b,.voice-person small { display:block; }
        .voice-person b { font-size:12px; }
        .voice-person small { margin-top:3px; color:rgba(255,255,255,.3); font-size:10px; }
        .stars { display:flex; gap:2px; margin-left:auto; color:var(--voice-color); }
        .trust-row { display:flex; justify-content:center; flex-wrap:wrap; gap:14px; padding:0 24px 115px; }
        .trust-item { display:flex; align-items:center; gap:11px; min-width:205px; padding:14px 17px; border:1px solid rgba(255,255,255,.075); border-radius:15px; background:rgba(255,255,255,.028); }
        .trust-item>span { display:grid; place-items:center; width:32px; height:32px; border-radius:9px; background:rgba(255,255,255,.05); }
        .trust-item b,.trust-item small { display:block; }
        .trust-item b { font-size:11px; }
        .trust-item small { color:rgba(255,255,255,.3); font-size:9px; margin-top:3px; }
        .final-cta { position:relative; overflow:hidden; padding:125px 24px 115px; text-align:center; border-top:1px solid rgba(255,255,255,.05); background:linear-gradient(135deg,rgba(104,0,30,.23),rgba(38,0,55,.32)); }
        .final-cta:before { content:""; position:absolute; width:650px; height:450px; left:50%; top:50%; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle,rgba(177,104,255,.18),transparent 68%); filter:blur(65px); }
        .final-cta-content { position:relative; max-width:700px; margin:auto; }
        .sparkle-mark { display:inline-block; color:#ffb52e; font-size:43px; margin-bottom:22px; filter:drop-shadow(0 0 12px #ffb52e); }
        .final-cta h2 { margin:0 0 20px; font-size:clamp(31px,5.2vw,60px); line-height:1.08; letter-spacing:-.05em; font-weight:900; }
        .final-cta h2 span { background:linear-gradient(90deg,#ff2f7d,#b168ff,#28d7ef); -webkit-background-clip:text; color:transparent; }
        .final-cta p { max-width:540px; margin:0 auto 40px; color:rgba(255,255,255,.42); font-size:16px; line-height:1.7; }
        .final-note { margin-top:22px; color:rgba(255,255,255,.25); font-size:11px; }
        .landing-footer { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:20px; padding:34px 24px; border-top:1px solid rgba(255,255,255,.06); background:rgba(0,0,0,.22); }
        .footer-brand { display:flex; align-items:center; gap:9px; }
        .footer-brand img { width:30px; height:30px; border-radius:8px; }
        .footer-brand b,.footer-brand small { display:block; }
        .footer-brand b { font-size:14px; }
        .footer-brand small { color:rgba(255,255,255,.25); font-size:9px; margin-top:2px; }
        .footer-links { display:flex; gap:22px; }
        .footer-links a { color:rgba(255,255,255,.34); font-size:11px; }
        .copyright { color:rgba(255,255,255,.22); font-size:10px; }
        @media (max-width:900px) { .showcase { gap:45px; } .preview-cluster { transform:scale(.9); margin:-25px -25px; } .feature-grid { grid-template-columns:repeat(2,1fr); } .quote-grid { grid-template-columns:1fr; max-width:560px; margin:auto; } .voice-card blockquote { min-height:auto; } }
        @media (max-width:650px) { .landing-nav { height:62px; } .nav-inner { padding:0 16px; } .brand { font-size:16px; } .brand img { width:31px; height:31px; } .nav-links .quiet { display:none; } .nav-links { gap:9px; } .nav-cta { padding:8px 14px; font-size:11px; } .hero { min-height:690px; padding:125px 18px 70px; } .hero-logo { width:80px; height:80px; border-radius:22px; margin-bottom:28px; } .hero h1 { font-size:clamp(38px,12vw,62px); } .hero-copy { font-size:14px; margin-bottom:32px; } .cta { padding:13px 20px; font-size:13px; } .stats-inner { grid-template-columns:repeat(2,1fr); gap:30px 10px; } .stat-value { font-size:28px; } .section { padding:88px 18px; } .showcase { flex-direction:column; gap:62px; } .preview-cluster { transform:scale(.73); transform-origin:top center; width:530px; height:425px; margin:0 0 -35px; } .showcase-copy { width:100%; } .showcase-copy h2 { font-size:36px; } .feature-grid { grid-template-columns:1fr; } .section-heading { margin-bottom:40px; } .trust-row { padding-bottom:80px; } .trust-item { min-width:min(100%,280px); } .final-cta { padding:92px 18px 85px; } .landing-footer { align-items:flex-start; flex-direction:column; padding:28px 18px; } .footer-links { flex-wrap:wrap; gap:14px 20px; } }
      `}</style>

      <motion.nav className="landing-nav" initial={{ y: -70, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: .7, ease }}>
        <div className="nav-inner">
          <Link to="/" className="brand"><img src="/logo.png" alt="Flicks India logo" /><span className="gradient-text">Flicks India</span></Link>
          <div className="nav-links"><Link className="quiet" to="/privacy">Privacy</Link><Link className="quiet" to="/terms">Terms</Link><Link className="nav-cta" to="/login">Get Started</Link></div>
        </div>
      </motion.nav>

      <section className="hero">
        <div className="hero-grid" />
        <Orb className="hero-orb-a" /><Orb className="hero-orb-b" /><Orb className="hero-orb-c" />
        <motion.div className="hero-content" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: .09 } } }}>
          <motion.div className="eyebrow" variants={{ hidden: { opacity: 0, scale: .85 }, show: { opacity: 1, scale: 1, transition: { duration: .6, ease } } }}><Sparkles size={14} /> India&apos;s realest social platform</motion.div>
          <motion.img className="hero-logo" src="/logo.png" alt="Flicks India" variants={{ hidden: { opacity: 0, scale: .55 }, show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 200, damping: 20 } } }} />
          <motion.h1 variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: .8, ease } } }}>Where India<br /><span className="line-two">Connects Authentically ✦</span></motion.h1>
          <motion.p className="hero-copy" variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: .7, ease } } }}>A community-driven social media platform for authentic connections, sharing moments, beautiful quotes, and real updates — built for India, by India.</motion.p>
          <motion.div className="cta-row" variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: .65, ease } } }}>
            <Link to="/login" className="cta cta-primary"><Sparkles size={17} /> Explore Flicks <ArrowRight size={16} /></Link>
            <Link to="/login" className="cta cta-secondary"><Play size={15} fill="currentColor" /> Login / Sign Up</Link>
          </motion.div>
          <motion.div className="pill-row" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: .7 } } }}>
            {[
              ["Cinematic Feed", "#ff2f7d"], ["Quotes Maker", "#d9f51b"], ["Live Stories", "#b168ff"],
              ["Magnet Connect", "#28d7ef"], ["Pulse Surveys", "#ffb52e"], ["Chat Rooms", "#40e0a0"],
            ].map(([label, color]) => <span className="feature-pill" key={label} style={{ color, borderColor: `${color}55`, background: `${color}12` }}>{label}</span>)}
          </motion.div>
        </motion.div>
      </section>

      <section className="stats-strip">
        <div className="stats-inner">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return <motion.div className="stat" key={stat.label} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .08 }}>
              <Icon className="stat-icon" size={20} style={{ color: stat.color }} />
              <strong className="stat-value" style={{ background: `linear-gradient(90deg,#fff,${stat.color})`, WebkitBackgroundClip: "text", color: "transparent" }}>{stat.value}</strong>
              <span className="stat-label">{stat.label}</span>
            </motion.div>;
          })}
        </div>
      </section>

      <section className="section">
        <div className="showcase">
          <motion.div initial={{ opacity: 0, x: -45 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: .85, ease }}><AppPreview /></motion.div>
          <motion.div className="showcase-copy" initial={{ opacity: 0, x: 45 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: .85, ease }}>
            <span className="section-label"><Star size={12} fill="currentColor" /> Designed for India</span>
            <h2>Your world.<br /><span>Beautifully captured.</span></h2>
            <p>From chai-time thoughts to midnight musings, Flicks India is your space to share what&apos;s real. No curated perfection — just you, your people, and genuine moments that matter.</p>
            {[
              [Heart, "#ff2f7d", "Express yourself with cinematic posts, reels, and stories"],
              [Quote, "#d9f51b", "Create stunning quote cards with our powerful Quotes Maker"],
              [Zap, "#b168ff", "Connect magnetically with like-minded souls"],
              [ShieldCheck, "#28d7ef", "A safe, community-first platform built for authentic India"],
            ].map(([Icon, color, text]) => <div className="benefit" key={String(text)}><span className="benefit-icon"><Icon size={15} style={{ color: String(color) }} /></span><span>{String(text)}</span></div>)}
            <Link to="/login" className="text-link">Start exploring <ChevronRight size={16} /></Link>
          </motion.div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 42 }}>
        <div className="section-heading">
          <span className="section-label" style={{ color: "#b168ff", borderColor: "rgba(177,104,255,.3)", background: "rgba(177,104,255,.09)" }}><Sparkles size={12} /> Everything you need</span>
          <h2>A universe of features,<br /><span>built for real people</span></h2>
          <p>Every feature is crafted to make your social experience cinematic, authentic, and deeply personal.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return <motion.article className="feature-card" key={feature.title} style={{ "--card-color": feature.color } as React.CSSProperties} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (index % 3) * .1, duration: .65 }} whileHover={{ y: -7, boxShadow: `0 18px 45px ${feature.color}18` }}>
              <div className="feature-icon" style={{ color: feature.color, borderColor: `${feature.color}4d`, background: feature.tint }}><Icon size={24} /></div>
              <h3>{feature.title}</h3><p>{feature.copy}</p><small>Explore →</small>
            </motion.article>;
          })}
        </div>
      </section>

      <section className="section voices">
        <div className="section-heading"><h2>Real voices. <span>Real stories.</span></h2><p>What our community is saying about finding a more authentic way to connect.</p></div>
        <div className="quote-grid">
          {testimonials.map((voice, index) => <motion.article className="voice-card" key={voice.name} style={{ "--voice-color": voice.color } as React.CSSProperties} initial={{ opacity: 0, scale: .94 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: index * .1, duration: .6 }}>
            <div className="big-quote">“</div><blockquote>{voice.quote}</blockquote>
            <div className="voice-person"><span className="voice-avatar" style={{ background: `linear-gradient(135deg,${voice.color},#6b31bf)` }}>{voice.letter}</span><div><b>{voice.name}</b><small>{voice.place}</small></div><div className="stars">{[1, 2, 3, 4, 5].map((star) => <Star size={10} fill="currentColor" key={star} />)}</div></div>
          </motion.article>)}
        </div>
      </section>

      <div className="trust-row">
        {[
          [ShieldCheck, "#28d7ef", "Safe & Secure", "Your data stays yours"],
          [Heart, "#ff2f7d", "Community First", "Only good vibes"],
          [Globe2, "#b168ff", "Made in India", "For Indians, by Indians 🇮🇳"],
          [Star, "#d9f51b", "Premium Experience", "Zero clutter"],
        ].map(([Icon, color, title, copy]) => <div className="trust-item" key={String(title)}><span><Icon size={17} style={{ color: String(color) }} /></span><div><b>{String(title)}</b><small>{String(copy)}</small></div></div>)}
      </div>

      <section className="final-cta">
        <div className="final-cta-content">
          <motion.span className="sparkle-mark" animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>✦</motion.span>
          <h2>Ready to find your<br /><span>real community?</span></h2>
          <p>Join thousands of Indians sharing real moments, creating beautiful quotes, and building authentic connections every day.</p>
          <Link to="/login" className="cta cta-primary"><Sparkles size={20} /> Join Flicks India <ArrowRight size={18} /></Link>
          <div className="final-note">Free to join · No credit card required · 🇮🇳 Made in India</div>
        </div>
      </section>

      <footer className="landing-footer">
        <Link to="/" className="footer-brand"><img src="/logo.png" alt="" /><div><b className="gradient-text">Flicks India</b><small>Real Connections · Real Stories</small></div></Link>
        <div className="footer-links"><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Service</Link><Link to="/data-info">Data Information</Link></div>
        <span className="copyright">© 2025 Flicks India · Made with ♥ in India</span>
      </footer>
    </main>
  );
}

export default LandingPage;