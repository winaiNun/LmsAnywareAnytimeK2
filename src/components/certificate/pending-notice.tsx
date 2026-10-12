import type { CertRender } from "@/lib/certificate/cert-render-data";
import { plainText, type SiteTexts } from "@/lib/site-texts";
import ConfirmCertificate from "./confirm-certificate";

/**
 * What a learner sees under a certificate that has no number yet. Automatic series: "check your name and take your number";
 * otherwise: "waiting for the district to issue the number". Only the holder gets the confirm button.
 */
export default function PendingNotice({ c, texts, isHolder }: { c: CertRender; texts: SiteTexts; isHolder: boolean }) {
  if (c.numberMode === "AUTO" && isHolder) {
    return <ConfirmCertificate courseId={c.courseId} name={c.holderName} title={plainText(texts["cert.auto.title"])} note={plainText(texts["cert.auto.note"])} button={plainText(texts["cert.auto.button"])} />;
  }
  return (
    <div className="space-y-2">
      <p className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">{plainText(texts["cert.pending.label"])}</p>
      <p className="text-sm text-neutral-600">{plainText(texts["cert.pending.note"])}</p>
    </div>
  );
}
