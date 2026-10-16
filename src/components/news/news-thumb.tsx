"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The picture a feed entry came with. Loaded by the visitor's browser straight from the source; hidden for good when it fails.
 * A picture can fail before this component is hydrated (the error event is already gone), so it is also checked once on mount.
 */
export default function NewsThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={img}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-[4.5rem] w-24 shrink-0 self-center rounded-xl bg-neutral-100 object-cover sm:h-20 sm:w-28"
    />
  );
}
