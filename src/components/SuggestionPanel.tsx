import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Copy,
  Check,
  Loader2,
  Zap,
  Hash,
  MessageCircle,
  RefreshCw,
  Star,
  Plus,
  X,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from "lucide-react";
import { SuggestionSet } from "@/lib/suggestionEngine";
import { trackAnalytics } from "@/lib/suggestionEngine";

interface SuggestionPanelProps {
  suggestions: SuggestionSet | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onUseCaption: (caption: string) => void;
  onAddHashtags: (hashtags: string[]) => void;
  onReplaceContent: (text: string) => void;
  existingText: string;
  onCollapse?: () => void;
}

export default function SuggestionPanel({
  suggestions,
  loading,
  error,
  onRefresh,
  onUseCaption,
  onAddHashtags,
  onReplaceContent,
  existingText,
  onCollapse,
}: SuggestionPanelProps) {
  const [activeTab, setActiveTab] = useState<"captions" | "hashtags" | "hooks" | "improved">("captions");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [selectedHashtags, setSelectedHashtags] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const appliedSet = useRef<Set<string>>(new Set());

  const autoCaption = useMemo(() => {
    if (!suggestions || suggestions.captions.length === 0) return null;
    return suggestions.captions[suggestions.autoSelected] || suggestions.captions[0];
  }, [suggestions]);

  const collapse = useCallback(() => {
    setPanelExpanded(false);
    onCollapse?.();
  }, [onCollapse]);

  const handleCopy = useCallback(
    (text: string, idx: number) => {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
      trackAnalytics("copied");
    },
    []
  );

  const handleUse = useCallback(
    (text: string) => {
      if (appliedSet.current.has("use:" + text)) return;
      appliedSet.current.add("use:" + text);
      onUseCaption(text);
      trackAnalytics("selected");
      collapse();
    },
    [onUseCaption, collapse]
  );

  const handleReplace = useCallback(
    (text: string) => {
      if (appliedSet.current.has("replace:" + text)) return;
      appliedSet.current.add("replace:" + text);
      onReplaceContent(text);
      trackAnalytics("selected");
      collapse();
    },
    [onReplaceContent, collapse]
  );

  const handleAddHashtagsCb = useCallback(
    (tags: string[]) => {
      if (appliedSet.current.has("hashtags:" + tags.join("|"))) return;
      appliedSet.current.add("hashtags:" + tags.join("|"));
      onAddHashtags(tags);
      trackAnalytics("selected");
      collapse();
    },
    [onAddHashtags, collapse]
  );

  const toggleHashtag = useCallback((tag: string) => {
    setSelectedHashtags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const addSelectedHashtags = useCallback(() => {
    if (selectedHashtags.size === 0) return;
    handleAddHashtagsCb(Array.from(selectedHashtags));
    setSelectedHashtags(new Set());
  }, [selectedHashtags, handleAddHashtagsCb]);

  const addAllHashtags = useCallback(() => {
    if (!suggestions) return;
    handleAddHashtagsCb(suggestions.hashtags);
    setSelectedHashtags(new Set(suggestions.hashtags));
  }, [suggestions, handleAddHashtagsCb]);

  // Track when suggestions are shown
  const hasSuggestions = !!suggestions && suggestions.captions.length > 0;
  const [trackedShown, setTrackedShown] = useState(false);
  if (hasSuggestions && !trackedShown) {
    setTrackedShown(true);
    trackAnalytics("shown");
  }
  if (!hasSuggestions && trackedShown) {
    setTrackedShown(false);
  }

  const tabs = [
    { key: "captions" as const, label: "Captions", icon: Zap, count: suggestions?.captions.length || 0 },
    { key: "hashtags" as const, label: "Hashtags", icon: Hash, count: suggestions?.hashtags.length || 0 },
    { key: "hooks" as const, label: "Hooks", icon: MessageCircle, count: suggestions?.engagementHooks.length || 0 },
    { key: "improved" as const, label: "Improve", icon: Lightbulb, count: suggestions?.improvedVersions.length || 0 },
  ];

  const itemsToShow = showAll ? 5 : 3;

  const styleLabels = [
    "Emotional",
    "Funny",
    "Travel Blogger",
    "Short Viral",
    "Storytelling",
  ];

  return (
    <div className="w-full">
      {/* Header */}
      <button
        onClick={() => setPanelExpanded((p) => !p)}
        className="w-full flex items-center justify-between py-2 px-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100/60 hover:from-indigo-100 hover:to-purple-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-600" />
          <span className="text-sm font-bold text-indigo-800">
            Flicks Suggested For You
          </span>
          {suggestions && (
            <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
              {suggestions.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {loading && (
            <Loader2 size={14} className="text-indigo-500 animate-spin" />
          )}
          {panelExpanded ? (
            <ChevronUp size={16} className="text-indigo-400" />
          ) : (
            <ChevronDown size={16} className="text-indigo-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {panelExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {/* Top bar: Back to Editor + More Suggestions */}
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                onClick={collapse}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-slate-50"
              >
                <ArrowLeft size={12} /> Back to Editor
              </button>
              <button
                onClick={() => {
                  onRefresh();
                }}
                disabled={loading}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                More Suggestions
              </button>
            </div>

            {/* Auto-selected banner */}
            {autoCaption && (
              <div className="mt-2 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-1.5 mb-1">
                  <Star size={13} className="text-amber-500 fill-amber-500" />
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                    Recommended For You
                  </span>
                </div>
                <p className="text-sm text-slate-700 font-medium leading-relaxed">
                  {autoCaption}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handleUse(autoCaption)}
                    className="text-[11px] font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 active:scale-95 transition-all"
                  >
                    Use
                  </button>
                  <button
                    onClick={() => handleReplace(autoCaption)}
                    className="text-[11px] font-bold bg-white text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 active:scale-95 transition-all"
                  >
                    Replace
                  </button>
                  <button
                    onClick={() => handleCopy(autoCaption, -1)}
                    className="text-[11px] font-bold bg-white text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 active:scale-95 transition-all"
                  >
                    {copiedIdx === -1 ? (
                      <span className="flex items-center gap-1">
                        <Check size={10} /> Copied
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Copy size={10} /> Copy
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                <p className="text-xs text-red-600 font-semibold">{error}</p>
                <button
                  onClick={onRefresh}
                  className="mt-1 text-[11px] font-bold text-red-700 hover:text-red-800"
                >
                  <RefreshCw size={12} className="inline mr-1" /> Retry
                </button>
              </div>
            )}

            {/* Tabs */}
            {!error && suggestions && (
              <div className="mt-2">
                <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Icon size={12} />
                        {tab.label}
                        {tab.count > 0 && (
                          <span
                            className={`ml-0.5 text-[10px] px-1.5 py-0 rounded-full ${
                              isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tab Content — scrollable on mobile, max height */}
                <div className="mt-2 space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {/* Captions Tab */}
                  {activeTab === "captions" && (
                    <>
                      {suggestions.captions.slice(0, itemsToShow).map((caption, i) => (
                        <div
                          key={i}
                          className="p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 transition-colors group"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                              {styleLabels[i] || "Style"}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 font-medium leading-relaxed">
                            {caption}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleUse(caption)}
                              className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-100"
                            >
                              Use
                            </button>
                            <button
                              onClick={() => handleReplace(caption)}
                              className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded-md hover:bg-slate-100"
                            >
                              Replace
                            </button>
                            <button
                              onClick={() => handleCopy(caption, i)}
                              className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded-md hover:bg-slate-100"
                            >
                              {copiedIdx === i ? (
                                <span className="flex items-center gap-0.5">
                                  <Check size={10} /> Copied
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5">
                                  <Copy size={10} /> Copy
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                      {suggestions.captions.length > 3 && (
                        <button
                          onClick={() => setShowAll((p) => !p)}
                          className="w-full text-[11px] font-bold text-indigo-500 py-1 hover:text-indigo-600 transition-colors"
                        >
                          {showAll ? "Show less" : `Show all ${suggestions.captions.length} captions`}
                        </button>
                      )}
                    </>
                  )}

                  {/* Hashtags Tab */}
                  {activeTab === "hashtags" && (
                    <div className="p-3 bg-white border border-slate-100 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-500">
                          Selected: {selectedHashtags.size}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={addSelectedHashtags}
                            disabled={selectedHashtags.size === 0}
                            className="text-[10px] font-bold bg-indigo-600 text-white px-2.5 py-1 rounded-md hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                          >
                            <Plus size={10} className="inline mr-0.5" /> Add Selected
                          </button>
                          <button
                            onClick={addAllHashtags}
                            className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md hover:bg-slate-200"
                          >
                            Add All
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.hashtags.map((tag, i) => {
                          const isSelected = selectedHashtags.has(tag);
                          return (
                            <button
                              key={i}
                              onClick={() => toggleHashtag(tag)}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-all ${
                                isSelected
                                  ? "bg-indigo-600 text-white shadow-sm"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {isSelected && <Check size={10} className="inline mr-0.5" />}
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Hooks Tab */}
                  {activeTab === "hooks" && (
                    <>
                      {suggestions.engagementHooks.map((hook, i) => (
                        <div
                          key={i}
                          className="p-3 bg-white border border-slate-100 rounded-xl hover:border-purple-200 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <MessageCircle size={16} className="text-purple-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-slate-700 font-medium leading-relaxed">
                              {hook}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 pl-6">
                            <button
                              onClick={() => handleUse(hook)}
                              className="text-[10px] font-bold bg-purple-50 text-purple-600 px-2 py-1 rounded-md hover:bg-purple-100"
                            >
                              Add to Post
                            </button>
                            <button
                              onClick={() => handleCopy(hook, i + 100)}
                              className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded-md hover:bg-slate-100"
                            >
                              {copiedIdx === i + 100 ? (
                                <span className="flex items-center gap-0.5">
                                  <Check size={10} /> Copied
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5">
                                  <Copy size={10} /> Copy
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Improved Tab */}
                  {activeTab === "improved" && (
                    <>
                      {suggestions.improvedVersions.map((version, i) => (
                        <div
                          key={i}
                          className="p-3 bg-white border border-slate-100 rounded-xl hover:border-emerald-200 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <Lightbulb size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-slate-700 font-medium leading-relaxed">
                              {version}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 pl-6">
                            <button
                              onClick={() => handleReplace(version)}
                              className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md hover:bg-emerald-100"
                            >
                              Replace Post
                            </button>
                            <button
                              onClick={() => handleCopy(version, i + 200)}
                              className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded-md hover:bg-slate-100"
                            >
                              {copiedIdx === i + 200 ? (
                                <span className="flex items-center gap-0.5">
                                  <Check size={10} /> Copied
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5">
                                  <Copy size={10} /> Copy
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && !suggestions && (
              <div className="mt-2 space-y-2">
                <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
              </div>
            )}

            {/* No suggestions yet */}
            {!loading && !suggestions && !error && (
              <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <p className="text-[11px] text-slate-400 font-medium">
                  Start typing or upload media to get smart suggestions
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
