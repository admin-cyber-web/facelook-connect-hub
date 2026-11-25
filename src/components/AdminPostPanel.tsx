import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { uploadBunnyVideo, uploadBunnyImage } from "@/lib/bunny";
import { isAdminEmail } from "../lib/adminConfig";
import {
  Send,
  Link,
  Image as ImageIcon,
  Video,
  X,
  CheckCircle,
  Loader2,
  FileVideo,
  FileImage,
  ExternalLink,
  Trash2,
  AlertCircle,
} from "lucide-react";

type PostType = "text" | "image" | "video" | "link";

interface ExternalLinkInfo {
  url: string;
  type: "video" | "image" | "youtube" | "unknown";
  embedUrl?: string;
}

interface UserSession {
  user?: {
    id: string;
    email: string;
  };
}

interface PostCreatedCallback {
  (post: { id: string; [key: string]: unknown }): void;
}

export default function AdminPostPanel({ 
  onClose, 
  session,
  onPostCreated 
}: { 
  onClose: () => void; 
  session?: UserSession;
  onPostCreated?: PostCreatedCallback;
}) {
  const [postType, setPostType] = useState<PostType>("text");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [externalLinkInfo, setExternalLinkInfo] = useState<ExternalLinkInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Validate and parse external URL
  const parseExternalUrl = (url: string): ExternalLinkInfo | null => {
    if (!url.trim()) return null;
    
    const trimmedUrl = url.trim();
    
    // YouTube URL detection
    const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]*).*/;
    const ytMatch = trimmedUrl.match(ytRegExp);
    if (ytMatch && ytMatch[2].length === 11) {
      return {
        url: trimmedUrl,
        type: "youtube",
        embedUrl: `https://www.youtube.com/embed/${ytMatch[2]}`,
      };
    }

    // Direct video file extensions
    const isDirectVideo = /\.(mp4|webm|ogg|mov|m4v|m3u8)/i.test(trimmedUrl.split("?")[0]) ||
      trimmedUrl.includes("rapidcdn.app") ||
      trimmedUrl.includes("raw=1");
    
    if (isDirectVideo) {
      return { url: trimmedUrl, type: "video" };
    }

    // Direct image file extensions
    const isDirectImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)/i.test(trimmedUrl.split("?")[0]);
    if (isDirectImage) {
      return { url: trimmedUrl, type: "image" };
    }

    return { url: trimmedUrl, type: "unknown" };
  };

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMediaUrl(value);
    const parsed = parseExternalUrl(value);
    setExternalLinkInfo(parsed);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type based on postType
    if (postType === "image" && !file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    if (postType === "video" && !file.type.startsWith("video/")) {
      setError("Please select a video file");
      return;
    }

    // Validate file size (50MB for videos, 10MB for images)
    const maxSize = postType === "video" ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File too large. Max ${postType === "video" ? "50MB" : "10MB"}`);
      return;
    }

    setError(null);
    setSelectedFile(file);
    
    // Create local preview
    const previewUrl = URL.createObjectURL(file);
    setFilePreview(previewUrl);
  };

  const removeFile = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFilePreview(null);
    setUploadProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setUploadProgress(0);

    try {
      let finalMediaUrl = "";
      let finalType = postType;
      let bunnyVideoId: string | null = null;
      let bunnyLibraryId: string | null = null;
      let isYoutube = false;

      // Handle file upload
      if (selectedFile) {
        setUploadProgress(10);
        if (postType === "video") {
          const videoResult = await uploadBunnyVideo(selectedFile, (progress) => {
            setUploadProgress(10 + Math.round(progress * 0.8));
          });
          finalMediaUrl = videoResult.hlsUrl;
          bunnyVideoId = videoResult.videoId;
          bunnyLibraryId = videoResult.libraryId;
          finalType = "video";
        } else if (postType === "image") {
          const imageResult = await uploadBunnyImage(selectedFile);
          finalMediaUrl = imageResult.url;
          finalType = "image";
        }
        setUploadProgress(95);
      }
      // Handle external link
      else if (mediaUrl.trim() && externalLinkInfo) {
        if (externalLinkInfo.type === "youtube" && externalLinkInfo.embedUrl) {
          finalMediaUrl = externalLinkInfo.embedUrl;
          finalType = "video";
          isYoutube = true;
        } else if (externalLinkInfo.type === "video") {
          finalMediaUrl = externalLinkInfo.url;
          finalType = "video";
        } else if (externalLinkInfo.type === "image") {
          finalMediaUrl = externalLinkInfo.url;
          finalType = "image";
        } else {
          throw new Error("Unsupported link type. Please use YouTube, direct video (.mp4, .webm, .m3u8), or direct image links.");
        }
      }
      // Text-only post
      else if (postType === "text") {
        finalMediaUrl = "";
        finalType = "text";
      } else {
        throw new Error("Please add content or media");
      }

      // Prepare post payload with Notice Board identity
      const authorId = session?.user?.id;
      const authorEmail = session?.user?.email;
      
      const postPayload = {
        author_id: authorId,
        content: content.trim(),
        media_url: finalMediaUrl,
        type: finalType,
        author: "Notice Board",
        is_admin_post: true,
        created_at: new Date().toISOString(),
        likes_count: 0,
        metadata: {
          is_youtube: isYoutube,
          ...(bunnyVideoId ? { bunny_video_id: bunnyVideoId, bunny_library_id: bunnyLibraryId } : {}),
          admin_email: authorEmail,
        },
      };

      const { data: inserted, error: insertError } = await supabase
        .from("posts")
        .insert([postPayload])
        .select("*")
        .maybeSingle();

      if (insertError) throw insertError;

      setSuccess(true);
      setLoading(false);
      setUploadProgress(100);

      // Notify feed to refresh
      if (onPostCreated && inserted) {
        onPostCreated(inserted);
      }

      // Dispatch custom event for feed to pick up
      window.dispatchEvent(new CustomEvent("flicks:post-created", { detail: inserted }));

      // Reset form after short delay to show success
      setTimeout(() => {
        resetForm();
        onClose();
      }, 800);
    } catch (err) {
      console.error("[AdminPostPanel] Publish error:", err);
      setError(err instanceof Error ? err.message : "Failed to publish post");
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const resetForm = () => {
    setPostType("text");
    setContent("");
    setMediaUrl("");
    setSelectedFile(null);
    setFilePreview(null);
    setExternalLinkInfo(null);
    setError(null);
    setSuccess(false);
    setUploadProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (linkInputRef.current) {
      linkInputRef.current.value = "";
    }
  };

  // Cleanup preview on unmount
  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  const isAdmin = session?.user?.email && isAdminEmail(session.user.email);

  if (!isAdmin) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="w-full max-w-md bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 px-6 pt-6 border-b border-white/10">
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <span className="relative">
              <span className="relative z-10">Create Notice</span>
              <span className="absolute -bottom-1 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
            </span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-zinc-500 transition-colors"
            aria-label="Close panel"
          >
            <X size={20} />
          </button>
        </div>

        {/* Post Type Selector */}
        <div className="flex gap-2 mb-6 px-6 bg-black/40 p-1 rounded-xl">
          {(["text", "image", "video", "link"] as PostType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                setPostType(type);
                setError(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                postType === type
                  ? "bg-white text-black"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {type === "link" ? (
                <>
                  <ExternalLink size={12} className="inline-block mr-1" /> Link
                </>
              ) : (
                type.charAt(0).toUpperCase() + type.slice(1)
              )}
            </button>
          ))}
        </div>

        <form onSubmit={handlePublish} className="px-6 pb-6 space-y-4">
          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* File Upload Section */}
          {(postType === "image" || postType === "video") && !selectedFile && (
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept={postType === "image" ? "image/*" : "video/*"}
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label={`Upload ${postType}`}
              />
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-blue-500/50 transition-colors">
                {postType === "video" ? <FileVideo size={32} className="text-zinc-500 mb-2" /> : <FileImage size={32} className="text-zinc-500 mb-2" />}
                <span className="text-zinc-400 text-sm font-medium">Click or drag to upload {postType}</span>
                <span className="text-zinc-600 text-xs mt-1">
                  {postType === "video" ? "MP4, WebM, MOV (max 50MB)" : "JPG, PNG, WebP, GIF (max 10MB)"}
                </span>
              </label>
            </div>
          )}

          {/* File Preview with Upload Progress */}
          {selectedFile && (
            <div className="relative bg-black/50 border border-white/10 rounded-xl overflow-hidden">
              {postType === "video" ? (
                <video
                  src={filePreview!}
                  className="w-full h-48 object-cover"
                  muted
                  preload="metadata"
                />
              ) : (
                <img
                  src={filePreview!}
                  className="w-full h-48 object-cover"
                  alt="Preview"
                />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={removeFile}
                  className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-full transition-colors"
                  aria-label="Remove file"
                >
                  <Trash2 size={20} />
                </button>
                {uploadProgress !== null && (
                  <div className="flex items-center gap-3 text-white">
                    <Loader2 size={20} className="animate-spin text-blue-400" />
                    <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      />
                    </div>
                    <span className="text-sm font-mono">{uploadProgress}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* External Link Input */}
          {postType === "link" && (
            <div className="relative">
              <ExternalLink
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                size={16}
              />
              <input
                ref={linkInputRef}
                type="url"
                placeholder="Paste YouTube, direct video (.mp4/.webm/.m3u8), or image link"
                value={mediaUrl}
                onChange={handleLinkChange}
                className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-blue-500 outline-none"
                autoFocus
              />
              {externalLinkInfo && (
                <div className="mt-2 p-3 bg-black/50 border border-white/10 rounded-lg flex items-center gap-3 text-sm">
                  {externalLinkInfo.type === "youtube" && (
                    <>
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-bold">YouTube</span>
                      <span className="text-zinc-400">Will embed as video</span>
                    </>
                  )}
                  {externalLinkInfo.type === "video" && (
                    <>
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-bold">Video</span>
                      <span className="text-zinc-400">Direct video link detected</span>
                    </>
                  )}
                  {externalLinkInfo.type === "image" && (
                    <>
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-bold">Image</span>
                      <span className="text-zinc-400">Direct image link detected</span>
                    </>
                  )}
                  {externalLinkInfo.type === "unknown" && (
                    <>
                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-bold">Unknown</span>
                      <span className="text-zinc-400">May not render as media</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Caption/Content */}
          <textarea
            placeholder="What's on your mind, Admin? (Optional for media posts)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-sm text-white min-h-[100px] focus:border-blue-500 outline-none resize-none"
            rows={4}
          />

          {/* Publish Button */}
          <button
            type="submit"
            disabled={loading || (postType !== "text" && !selectedFile && !mediaUrl.trim())}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Publishing...
              </>
            ) : success ? (
              <>
                <CheckCircle size={20} />
                <span>Posted to Notice Board</span>
              </>
            ) : (
              <>
                <Send size={18} />
                Post to Notice Board
              </>
            )}
          </button>

          {/* Helper Text */}
          <p className="text-center text-zinc-600 text-xs">
            Posts appear as <span className="font-bold text-white">"Notice Board"</span> • Pinned at top of feed
          </p>
        </form>
      </motion.div>
    </motion.div>
  );
}