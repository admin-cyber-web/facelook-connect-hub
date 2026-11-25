const BUNNY_OFFLINE_GIF_URL = "https://flicksindiacdn.b-cdn.net/Stickers/dog%20searching.gif";

type OfflineConnectionScreenProps = {
  reconnecting: boolean;
  retrySeconds: number;
  onRetry: () => void;
};

export default function OfflineConnectionScreen({
  reconnecting: _reconnecting,
  retrySeconds: _retrySeconds,
  onRetry: _onRetry,
}: OfflineConnectionScreenProps) {
  return (
    <main
      role="alert"
      aria-live="assertive"
      className="offline-screen fixed inset-0 z-[100000] flex min-h-[100dvh] flex-col items-center justify-center overflow-y-auto px-5 text-center"
    >
      <div className="relative z-10 w-full max-w-md px-4 py-8">
        <img
          src={BUNNY_OFFLINE_GIF_URL}
          alt="Searching for connection"
          className="mx-auto h-48 w-auto max-w-full"
        />
        <p className="mt-6 text-base font-medium text-white/90 leading-relaxed">
          Your network may be slow or unavailable on your phone; connecting to better connectivity.
        </p>
      </div>
    </main>
  );
}
