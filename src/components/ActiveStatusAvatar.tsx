interface ActiveStatusAvatarProps {
  src?: string | null;
  name?: string | null;
  size: number;
  online: boolean;
  className?: string;
  imageTestId?: string;
}

export default function ActiveStatusAvatar({
  src,
  name,
  size,
  online,
  className = "",
  imageTestId,
}: ActiveStatusAvatarProps) {
  return (
    <span
      className={`active-status-avatar ${className}`}
      style={{ width: size, height: size }}
      title={online ? `${name || "User"} is live` : undefined}
    >
      <span className={`active-status-avatar__ring${online ? " is-live" : ""}`}>
        {src ? (
          <img
            src={src}
            alt=""
            className="active-status-avatar__image"
            loading="lazy"
            decoding="async"
            data-testid={imageTestId}
          />
        ) : (
          <span className="active-status-avatar__fallback">
            {(name || "?")[0].toUpperCase()}
          </span>
        )}
      </span>
      {online && <span className="active-status-avatar__badge">LIVE</span>}
    </span>
  );
}
