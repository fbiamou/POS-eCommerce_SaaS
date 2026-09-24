import Image from "next/image";

// The shop's own logo, or its initial on the brand indigo when it has none.
// Shared by the desktop Sidebar and the mobile top bar.
export function ShopAvatar({
  logoUrl,
  name,
  size = 32,
  className = "",
}: {
  logoUrl?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-lg object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-lg bg-violet-500 font-display font-extrabold text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {name.trim()[0]?.toUpperCase() ?? "W"}
    </span>
  );
}

export function getInitials(fullName?: string | null): string {
  if (!fullName?.trim()) return "U";
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  return initials.toUpperCase();
}
