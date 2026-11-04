export function requestVideoPlay(video: HTMLVideoElement): Promise<void> {
  try {
    const result = video.play();
    return result ? Promise.resolve(result) : Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}

export function playVideoWithMutedFallback(
  video: HTMLVideoElement,
  onMutedFallback?: (error: unknown) => boolean | void,
): void {
  const retryMuted = (error: unknown) => {
    if (!video.isConnected) return;
    if (onMutedFallback?.(error) === false) return;
    video.muted = true;
    void requestVideoPlay(video).catch((fallbackError: unknown) => {
      if (fallbackError instanceof Error && fallbackError.name !== "NotAllowedError") {
        console.warn("[Video] Muted playback failed:", fallbackError);
      }
    });
  };

  void requestVideoPlay(video).catch(retryMuted);
}
