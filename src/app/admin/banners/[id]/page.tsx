import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { bannerImageUrl } from "@/lib/banners";
import BannerForm from "../banner-form";

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(d: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditBannerPage({ params }: { params: { id: string } }) {
  const b = await db.banner.findUnique({ where: { id: params.id } });
  if (!b) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">แก้ไขแบนเนอร์</h1>
      <BannerForm
        initial={{
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          linkUrl: b.linkUrl,
          buttonText: b.buttonText,
          bgColor: b.bgColor,
          active: b.active,
          showText: b.showText,
          sortOrder: b.sortOrder,
          startAt: toLocalInput(b.startAt),
          endAt: toLocalInput(b.endAt),
          imageUrl: bannerImageUrl(b.imageKey),
        }}
      />
    </div>
  );
}
