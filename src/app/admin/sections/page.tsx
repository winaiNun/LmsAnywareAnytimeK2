import { plainText } from "@/lib/site-texts";
import { getHomeSections } from "@/lib/sections";
import { requireManagerPage } from "@/lib/permissions";
import { moveSection } from "./actions";
import { SectionAccordion, SectionCard } from "./section-accordion";
import SectionForm from "./section-form";

export const dynamic = "force-dynamic";

const BG_LABEL = { none: "", solid: "พื้นหลังสีเดียว", gradient: "พื้นหลังไล่สี", image: "พื้นหลังภาพ" } as const;

export default async function SectionsPage() {
  await requireManagerPage();
  const sections = await getHomeSections();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">เซกชันหน้าแรก</h1>
        <p className="text-sm text-neutral-500">
          จัดลำดับด้วยปุ่มขึ้น/ลง กดที่ชื่อเซกชันเพื่อขยายหรือย่อการตั้งค่า แบนเนอร์ชื่อระบบอยู่บนสุดเสมอ (ตั้งค่าที่ “ตั้งค่าเขตพื้นที่”)
        </p>
      </div>

      <SectionAccordion keys={sections.map((s) => s.key)}>
        <ol className="space-y-3">
          {sections.map((s, i) => (
            <SectionCard
              key={s.key}
              sectionKey={s.key}
              index={i + 1}
              kind={s.kind}
              title={plainText(s.title)}
              badges={[
                { label: s.visible ? "แสดงอยู่" : "ซ่อนอยู่", tone: s.visible ? "blue" : "amber" },
                ...(BG_LABEL[s.bgMode] ? [{ label: BG_LABEL[s.bgMode], tone: "gray" as const }] : []),
              ]}
              actions={
                <div className="flex shrink-0 gap-2">
                  <form action={moveSection.bind(null, s.key, "up")}>
                    <button disabled={i === 0} aria-label={`เลื่อน ${s.kind} ขึ้น`} className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-300 text-lg hover:bg-neutral-50 disabled:opacity-30">↑</button>
                  </form>
                  <form action={moveSection.bind(null, s.key, "down")}>
                    <button disabled={i === sections.length - 1} aria-label={`เลื่อน ${s.kind} ลง`} className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-300 text-lg hover:bg-neutral-50 disabled:opacity-30">↓</button>
                  </form>
                </div>
              }
            >
              <SectionForm section={s} />
            </SectionCard>
          ))}
        </ol>
      </SectionAccordion>
    </div>
  );
}
