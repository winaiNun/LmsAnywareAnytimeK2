import { avatarBox, driveAvatarSrc, type AvatarData } from "@/lib/avatar";

/** Always a perfect circle (square box + rounded-full). Falls back to the first letter of the name. */
export default function Avatar({ avatar, name, size = 40, className = "" }: { avatar: AvatarData | null; name: string; size?: number; className?: string }) {
  const box = { width: size, height: size };
  const base = `relative inline-block shrink-0 overflow-hidden rounded-full bg-brand-soft ${className}`;

  if (avatar?.driveId) {
    return (
      <span className={base} style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={driveAvatarSrc(avatar.driveId)} alt={name} referrerPolicy="no-referrer" loading="lazy" draggable={false} className="absolute max-w-none" style={avatarBox(avatar)} />
      </span>
    );
  }
  if (avatar?.url) {
    return (
      <span className={base} style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar.url} alt={name} loading="lazy" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className={`${base} flex items-center justify-center bg-gradient-to-br from-[#4F8BFF] to-[#0B2A6F] font-semibold text-white`} style={{ ...box, fontSize: size * 0.42 }} aria-label={name}>
      {Array.from(name.trim())[0] ?? "?"}
    </span>
  );
}
