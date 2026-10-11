import Glyph from "@/components/glyph";
import { avatarBox, driveAvatarSrc, type AvatarData } from "@/lib/avatar";

/**
 * The icon of an outside source: the admin's own picture (uploaded square, or Drive picture with its crop window) in a
 * rounded square, otherwise the line icon on a tinted tile. Same size and shape either way, so cards stay equal.
 */
export default function ResourceIcon({ image, icon, color, size = 52 }: { image: AvatarData | null; icon: string; color: string; size?: number }) {
  const box = { width: size, height: size };
  const base = "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl";
  if (image?.driveId) {
    return (
      <span className={`${base} bg-neutral-100`} style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={driveAvatarSrc(image.driveId, size)} alt="" referrerPolicy="no-referrer" loading="lazy" draggable={false} className="absolute max-w-none" style={avatarBox(image)} />
      </span>
    );
  }
  if (image?.url) {
    return (
      <span className={`${base} bg-neutral-100`} style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className={base} style={{ ...box, backgroundColor: `${color}1F`, color }} aria-hidden>
      <Glyph name={icon} size={Math.round(size * 0.52)} strokeWidth={1.6} />
    </span>
  );
}
