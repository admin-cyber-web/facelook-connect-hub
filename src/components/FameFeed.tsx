import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Share2, Flower2, Frown, Angry, ThumbsUp } from "lucide-react";

interface Post {
  id: number;
  author: string;
  initials: string;
  gradient: string;
  time: string;
  content: string;
  likes: number;
  comments: number;
}

const REACTIONS = [
  { icon: ThumbsUp, label: "Like", color: "text-primary" },
  { icon: Heart, label: "Love", color: "text-accent" },
  { icon: Frown, label: "Cry", color: "text-secondary" },
  { icon: Flower2, label: "Flowers", color: "text-primary" },
  { icon: Angry, label: "Angry", color: "text-destructive" },
];

const posts: Post[] = [
  { id: 1, author: "Amna Khan", initials: "AK", gradient: "bg-gradient-to-br from-primary to-secondary", time: "2h ago", content: "Just finished building my first React app with Facelook! The glassmorphism vibes are unreal 🔥✨", likes: 42, comments: 8 },
  { id: 2, author: "Bilal Ahmed", initials: "BA", gradient: "bg-gradient-to-br from-secondary to-accent", time: "5h ago", content: "Exploring new group features on Flame 🔥 Who wants to join our dev community?", likes: 128, comments: 23 },
  { id: 3, author: "Sana Mirza", initials: "SM", gradient: "bg-gradient-to-br from-accent to-primary", time: "8h ago", content: "Morning vibes with coffee and code ☕💻 What's everyone working on today?", likes: 67, comments: 15 },
];

const PostCard = ({ post }: { post: Post }) => {
  const [showReactions, setShowReactions] = useState(false);
  const [liked, setLiked] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5"
    >
      {/* Author */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full ${post.gradient} flex items-center justify-center text-primary-foreground font-semibold text-sm`}>
          {post.initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{post.author}</p>
          <p className="text-[11px] text-muted-foreground">{post.time}</p>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-foreground/90 leading-relaxed mb-4">{post.content}</p>

      {/* Reactions popup */}
      {showReactions && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="glass-strong rounded-full px-3 py-2 mb-3 flex items-center gap-3 w-fit"
        >
          {REACTIONS.map((r) => (
            <button
              key={r.label}
              onClick={() => { setLiked(true); setShowReactions(false); }}
              className={`${r.color} hover:scale-125 transition-transform`}
              title={r.label}
            >
              <r.icon size={20} />
            </button>
          ))}
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 text-muted-foreground">
        <button
          onMouseEnter={() => setShowReactions(true)}
          onMouseLeave={() => setTimeout(() => setShowReactions(false), 1500)}
          onClick={() => setLiked(!liked)}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${liked ? 'text-accent' : 'hover:text-primary'}`}
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
          {post.likes + (liked ? 1 : 0)}
        </button>
        <button className="flex items-center gap-1.5 text-xs font-medium hover:text-primary transition-colors">
          <MessageCircle size={16} />
          {post.comments}
        </button>
        <button className="flex items-center gap-1.5 text-xs font-medium hover:text-primary transition-colors ml-auto">
          <Share2 size={16} />
          Share
        </button>
      </div>
    </motion.div>
  );
};

const FameFeed = () => (
  <div className="px-4 md:px-8 space-y-4">
    <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/60 flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
      Fame Feed
    </h2>
    {posts.map((post, i) => (
      <PostCard key={post.id} post={post} />
    ))}
  </div>
);

export default FameFeed;
