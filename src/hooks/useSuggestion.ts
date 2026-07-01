import { useState, useEffect, useRef, useCallback } from "react";
import { generateSuggestions, SuggestionPayload, SuggestionSet } from "@/lib/suggestionEngine";

// ═══════════════════════════════════════════════════════════════════════════
//  useSuggestion — Debounced smart suggestion hook
//  1.5s debounce after typing stops
//  0s immediate trigger on image/video/location change
// ═══════════════════════════════════════════════════════════════════════════

interface UseSuggestionOptions {
  text: string;
  mediaType?: "image" | "video" | "youtube" | "text";
  location?: string;
  language?: "en" | "hi" | "hinglish";
  enabled: boolean;
}

interface UseSuggestionReturn {
  suggestions: SuggestionSet | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const DEBOUNCE_MS = 1500;
const MIN_TEXT_LENGTH = 2;

export function useSuggestion(options: UseSuggestionOptions): UseSuggestionReturn {
  const { text, mediaType, location, language, enabled } = options;
  const [suggestions, setSuggestions] = useState<SuggestionSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<string>("");
  const mountedRef = useRef(true);
  const shownHistoryRef = useRef<Set<string>>(new Set());
  const bypassCacheRef = useRef(false);

  const fetchSuggestions = useCallback(
    async (immediate = false) => {
      if (!enabled || !mountedRef.current) return;
      const trimmed = text.trim();
      const hasContent = trimmed.length >= MIN_TEXT_LENGTH || mediaType || location;
      if (!hasContent) {
        setSuggestions(null);
        setLoading(false);
        return;
      }

      const payload: SuggestionPayload = {
        text: trimmed,
        mediaType,
        location,
        language,
      };
      const payloadKey = JSON.stringify(payload);
      if (payloadKey === lastPayloadRef.current && !immediate && !bypassCacheRef.current) return;
      lastPayloadRef.current = payloadKey;
      const bypass = bypassCacheRef.current;
      bypassCacheRef.current = false;

      setLoading(true);
      setError(null);
      try {
        const result = await generateSuggestions(payload, bypass);
        if (mountedRef.current) {
          // Filter out captions already shown in this session
          const filtered = {
            ...result,
            captions: result.captions.filter((c) => !shownHistoryRef.current.has(c)),
          };
          // Track all captions as shown
          result.captions.forEach((c) => shownHistoryRef.current.add(c));
          setSuggestions(filtered.captions.length > 0 ? filtered : result);
        }
      } catch (err: any) {
        if (mountedRef.current) {
          setError(err.message || "Failed to generate suggestions");
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [enabled, text, mediaType, location, language]
  );

  // Debounced text trigger
  useEffect(() => {
    mountedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!enabled) {
      setSuggestions(null);
      setLoading(false);
      return;
    }

    const trimmed = text.trim();
    const hasContent = trimmed.length >= MIN_TEXT_LENGTH || mediaType || location;
    if (!hasContent) {
      setSuggestions(null);
      setLoading(false);
      return;
    }

    // Immediate trigger for media/location changes; debounced for text-only
    if (mediaType || location) {
      fetchSuggestions(true);
    } else {
      timerRef.current = setTimeout(() => {
        fetchSuggestions();
      }, DEBOUNCE_MS);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, text, mediaType, location, language, fetchSuggestions]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    suggestions,
    loading,
    error,
    refresh: () => {
      bypassCacheRef.current = true;
      fetchSuggestions(true);
    },
  };
}
