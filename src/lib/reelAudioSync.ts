export function getReelAudioTargetTime(
  video: HTMLVideoElement,
  audio: HTMLAudioElement,
): number {
  const duration = audio.duration;
  return Number.isFinite(duration) && duration > 0
    ? video.currentTime % duration
    : video.currentTime;
}

/**
 * Keeps a separate Reel music track aligned to its video without repeatedly
 * seeking for small clock differences. Small drift is corrected with a subtle
 * playback-rate adjustment; seeks are reserved for larger discontinuities.
 */
export function attachReelAudioSync(
  video: HTMLVideoElement,
  audio: HTMLAudioElement,
  playbackRate: number,
  shouldPlay: () => boolean = () => true,
): () => void {
  let frameId = 0;
  let disposed = false;

  const getDrift = () => {
    const duration = audio.duration;
    let drift = getReelAudioTargetTime(video, audio) - audio.currentTime;
    if (Number.isFinite(duration) && duration > 0) {
      if (drift > duration / 2) drift -= duration;
      else if (drift < -duration / 2) drift += duration;
    }
    return drift;
  };

  const syncPosition = () => {
    if (audio.readyState < HTMLMediaElement.HAVE_METADATA) return;
    try {
      if (Math.abs(getDrift()) > 0.12) {
        audio.currentTime = getReelAudioTargetTime(video, audio);
      }
      audio.playbackRate = playbackRate;
    } catch {
      // Media metadata/seekability can change while a source is loading.
    }
  };

  const syncPlayback = () => {
    if (disposed) return;
    if (video.paused || video.ended || !shouldPlay()) {
      audio.pause();
      stopSync();
      return;
    }

    syncPosition();
    audio.loop = true;
    audio.playbackRate = playbackRate;
    if (audio.paused) audio.play().catch(() => {});
    startSync();
  };

  const pauseAudio = () => {
    audio.pause();
    stopSync();
  };

  const handleAudioPlaying = () => {
    if (video.paused || video.ended || !shouldPlay()) {
      audio.pause();
      return;
    }
    startSync();
  };

  const syncAfterMetadata = () => {
    syncPosition();
    syncPlayback();
  };

  let lastCheckAt = 0;
  const tick = (now: number) => {
    frameId = 0;
    if (
      disposed ||
      video.paused ||
      audio.paused ||
      video.ended ||
      !shouldPlay()
    ) return;

    // Drift checks are throttled to ~4/s — keeps CPU cost flat on mobile
    // while still recovering quickly from seeks and stream discontinuities.
    if (now - lastCheckAt >= 250) {
      lastCheckAt = now;
      try {
        const drift = getDrift();
        // Snap only on real discontinuities. The old continuous ±3%
        // playback-rate wobble warped the decode buffer into audible
        // scratching/cracking, so the rate is now pinned to the exact value
        // and sub-threshold drift is tolerated silently.
        if (Math.abs(drift) >= 0.4) {
          audio.currentTime = getReelAudioTargetTime(video, audio);
          audio.playbackRate = playbackRate;
        }
      } catch {
        // Ignore transient seek/rate errors and keep the next frame attempt.
      }
    }

    frameId = window.requestAnimationFrame(tick);
  };

  const startSync = () => {
    if (
      disposed ||
      video.paused ||
      audio.paused ||
      video.ended ||
      !shouldPlay() ||
      frameId
    ) return;
    frameId = window.requestAnimationFrame(tick);
  };
  const stopSync = () => {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
  };

  video.addEventListener("playing", syncPlayback);
  video.addEventListener("pause", pauseAudio);
  video.addEventListener("ended", pauseAudio);
  audio.addEventListener("playing", handleAudioPlaying);
  audio.addEventListener("pause", stopSync);
  video.addEventListener("seeking", syncPosition);
  video.addEventListener("seeked", syncPlayback);
  video.addEventListener("ratechange", syncPosition);
  audio.addEventListener("loadedmetadata", syncAfterMetadata);
  audio.addEventListener("durationchange", syncPosition);

  syncPosition();
  syncPlayback();

  return () => {
    disposed = true;
    stopSync();
    video.removeEventListener("playing", syncPlayback);
    video.removeEventListener("pause", pauseAudio);
    video.removeEventListener("ended", pauseAudio);
    audio.removeEventListener("playing", handleAudioPlaying);
    audio.removeEventListener("pause", stopSync);
    video.removeEventListener("seeking", syncPosition);
    video.removeEventListener("seeked", syncPlayback);
    video.removeEventListener("ratechange", syncPosition);
    audio.removeEventListener("loadedmetadata", syncAfterMetadata);
    audio.removeEventListener("durationchange", syncPosition);
    audio.pause();
    try {
      audio.playbackRate = playbackRate;
    } catch {
      // The audio element may already have been detached.
    }
  };
}