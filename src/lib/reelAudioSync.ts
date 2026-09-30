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

  const tick = () => {
    frameId = 0;
    if (disposed || video.paused || audio.paused || video.ended) return;

    try {
      const drift = getDrift();
      if (Math.abs(drift) >= 0.75) {
        audio.currentTime = getReelAudioTargetTime(video, audio);
        audio.playbackRate = playbackRate;
      } else {
        const adjustment = Math.max(
          -playbackRate * 0.03,
          Math.min(playbackRate * 0.03, drift * 0.2),
        );
        const correctedRate = playbackRate + adjustment;
        if (Math.abs(audio.playbackRate - correctedRate) >= 0.005) {
          audio.playbackRate = correctedRate;
        }
      }
    } catch {
      // Ignore transient seek/rate errors and keep the next frame attempt.
    }

    frameId = window.requestAnimationFrame(tick);
  };

  const startSync = () => {
    if (disposed || video.paused || audio.paused || frameId) return;
    frameId = window.requestAnimationFrame(tick);
  };
  const stopSync = () => {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
  };

  video.addEventListener("playing", startSync);
  audio.addEventListener("playing", startSync);
  video.addEventListener("pause", stopSync);
  audio.addEventListener("pause", stopSync);
  video.addEventListener("seeking", syncPosition);
  audio.addEventListener("loadedmetadata", syncPosition);
  audio.addEventListener("durationchange", syncPosition);

  syncPosition();
  startSync();

  return () => {
    disposed = true;
    stopSync();
    video.removeEventListener("playing", startSync);
    audio.removeEventListener("playing", startSync);
    video.removeEventListener("pause", stopSync);
    audio.removeEventListener("pause", stopSync);
    video.removeEventListener("seeking", syncPosition);
    audio.removeEventListener("loadedmetadata", syncPosition);
    audio.removeEventListener("durationchange", syncPosition);
    try {
      audio.playbackRate = playbackRate;
    } catch {
      // The audio element may already have been detached.
    }
  };
}