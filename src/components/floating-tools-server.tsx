import { getFaqPublic } from "@/lib/faq/data";
import { getSiteTexts } from "@/lib/site-texts-server";
import FloatingTools from "./floating-tools";

const MAX_STARTERS = 6;

/** Server wrapper: reads the admin-editable texts and the chat on/off switch, hands plain data to the client buttons. */
export default async function FloatingToolsServer() {
  const [texts, faq] = await Promise.all([getSiteTexts(), getFaqPublic()]);
  // the chat needs something to answer from; with no Q&A yet the button stays hidden
  const on = faq.enabled && faq.items.length > 0;
  const pinned = faq.items.filter((i) => i.pinned);
  const starters = (pinned.length ? pinned : faq.items).slice(0, MAX_STARTERS).map((i) => ({ id: i.id, question: i.question }));

  return (
    <FloatingTools
      texts={{ backToTop: texts["ui.backToTop"] }}
      faq={
        on
          ? {
              starters,
              logoUrl: faq.logoUrl,
              texts: {
                button: texts["faq.button"],
                heading: texts["faq.heading"],
                subtitle: texts["faq.subtitle"],
                greeting: texts["faq.greeting"],
                placeholder: texts["faq.placeholder"],
                hint: texts["faq.hint"],
                suggest: texts["faq.suggest"],
                related: texts["faq.related"],
                fallback: texts["faq.fallback"],
                contact: texts["faq.contact"],
              },
            }
          : null
      }
    />
  );
}
