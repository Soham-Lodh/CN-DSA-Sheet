/**
 * Shared avatar with the CODING NINJAS default: users without a Google profile
 * picture get /account.webp on an orange background — everywhere in the app.
 */
const FALLBACK_AVATAR = "/account.webp";

interface UserAvatarProps {
  avatarUrl?: string | null;
  name: string;
  /** Tailwind size classes, e.g. "w-8 h-8" or "w-24 h-24". */
  sizeClasses: string;
  /** Extra classes for the img/wrapper (borders, shadows, shape). */
  className?: string;
}

export function UserAvatar({
  avatarUrl,
  name,
  sizeClasses,
  className = "",
}: UserAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClasses} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      title={name}
      className={`${sizeClasses} rounded-full bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center ${className}`}
    >
      <img
        src={FALLBACK_AVATAR}
        alt={name}
        className="w-[70%] h-[70%] object-contain"
      />
    </div>
  );
}
