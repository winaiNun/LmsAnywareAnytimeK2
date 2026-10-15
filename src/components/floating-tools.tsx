"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import BackToTop from "./back-to-top";
import FaqWidget, { type FaqTexts, type Starter } from "./faq/faq-widget";
import { floatingHidden } from "./floating-gate";

// Same offset the install chip uses, so the buttons clear the phone tab bar; desktop has no tab bar.
const BOTTOM = "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4";
// the chat button is 3.5rem tall; leave a small gap above it
const ABOVE_CHAT = "bottom-[calc(4.75rem+4.25rem+env(safe-area-inset-bottom))] md:bottom-[5.5rem]";

export type FloatingTexts = { backToTop: string };
export type FaqConfig = { texts: FaqTexts; starters: Starter[]; logoUrl: string | null };

/** The round buttons at the bottom right: back to top, and (when the admin has it on) the FAQ chat. */
export default function FloatingTools({ texts, faq }: { texts: FloatingTexts; faq: FaqConfig | null }) {
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);
  if (floatingHidden(pathname)) return null;
  return (
    <>
      <BackToTop label={texts.backToTop} offsetClass={faq ? ABOVE_CHAT : BOTTOM} suppressed={chatOpen} />
      {faq && <FaqWidget texts={faq.texts} starters={faq.starters} logoUrl={faq.logoUrl} bottomClass={BOTTOM} open={chatOpen} onOpenChange={setChatOpen} />}
    </>
  );
}
