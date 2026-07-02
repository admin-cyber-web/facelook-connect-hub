import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Share2,
  ThumbsUp,
  MessageSquare,
  Send,
  Calendar,
  ChevronDown,
  Reply,
} from "lucide-react";
import { toast } from "sonner";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

export default function SurveyEngine({ survey }) {
  const [voted, setVoted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(survey.initialComments || []);

  // Vote handle logic
  const handleVote = (optionId) => {
    setVoted(true);
    toast.success("Vote recorded!");
    // Yahan Supabase API call aayegi update karne ke liye
  };

  const postComment = (parentId = null) => {
    if (!comment.trim()) return;
    const newComment = { id: Date.now(), text: comment, parentId };
    setComments([...comments, newComment]);
    setComment("");
    toast.info("Comment posted!");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 my-6 max-w-md mx-auto"
    >
      {/* Date & Meta */}
      <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase mb-3">
        <Calendar size={12} /> Started:{" "}
        {new Date(survey.start_date).toLocaleDateString()}
      </div>

      {/* Image & Question */}
      {survey.image_url && (
        <img
          src={survey.image_url}
          className="w-full h-48 object-cover rounded-2xl mb-4 shadow-inner"
        />
      )}
      <h2 className="text-2xl font-black text-gray-900 leading-tight mb-6">
        {survey.question}
      </h2>

      {/* Options */}
      <div className="space-y-3">
        {survey.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleVote(opt.id)}
            className="w-full p-4 rounded-xl bg-gray-50 border-2 border-gray-100 hover:border-blue-500 font-bold text-sm flex justify-between transition-all"
          >
            {opt.text}
            {voted && <span className="text-blue-600">{opt.percentage}%</span>}
          </button>
        ))}
      </div>

      {/* Analytics Graph */}
      {voted && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="h-48 mt-6"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={survey.results}
                dataKey="value"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={5}
              >
                {survey.results.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Interaction Bar */}
      <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
        <button className="flex items-center gap-2 hover:text-blue-600">
          <ThumbsUp size={20} /> {survey.likes}
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 hover:text-blue-600"
        >
          <MessageSquare size={20} /> {comments.length}
        </button>
        <button
          onClick={() =>
            navigator.share({
              title: survey.question,
              url: window.location.href,
            })
          }
          className="text-blue-600"
        >
          <Share2 size={20} />
        </button>
      </div>

      {/* Nested Comments UI */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            className="mt-4 space-y-3 overflow-hidden"
          >
            {comments.map((c) => (
              <div
                key={c.id}
                className="bg-gray-50 p-3 rounded-lg text-xs font-bold text-gray-700 ml-4 border-l-2 border-blue-500"
              >
                {c.text}
                <button className="block text-[9px] text-gray-400 mt-1">
                  <Reply size={10} className="inline mr-1" /> Reply
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="flex-1 bg-gray-100 rounded-lg p-2 text-sm"
                placeholder="Write a comment..."
              />
              <button
                onClick={() => postComment()}
                className="bg-blue-600 text-white p-2 rounded-lg"
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
