export const metadata = { title: "ออฟไลน์" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#4F8BFF] to-[#0B2A6F] p-6 text-center text-white">
      <h1 className="text-2xl font-bold">ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h1>
      <p className="max-w-sm text-white/85">กรุณาตรวจสอบสัญญาณแล้วลองใหม่อีกครั้ง</p>
      <a href="/" className="flex min-h-12 items-center rounded-full bg-white px-8 font-semibold text-[#0B2A6F]">ลองใหม่</a>
    </main>
  );
}
