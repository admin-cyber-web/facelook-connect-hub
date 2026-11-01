import React, { useCallback, useState } from "react";

interface ResponsiveImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  width?: number | string;
  height?: number | string;
  fallback?: React.ReactNode;
  onError?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Renders an image with a graceful fallback if the src fails to load.
 */
export default function ResponsiveImage({
  src,
  alt = "",
  className = "",
  loading = "lazy",
  decoding = "async",
  width,
  height,
  fallback,
  onError,
}: ResponsiveImageProps) {
  const [broken, setBroken] = useState(false);

  const handleError = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      setBroken(true);
      onError?.(event);
    },
    [onError],
  );

  if (broken) {
    return <>{fallback ?? null}</>;
  }

  if (!src) {
    return <>{fallback ?? null}</>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      width={width}
      height={height}
      onError={handleError}
    />
  );
}
