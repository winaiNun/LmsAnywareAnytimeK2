import SiteNavbar from "@/components/site-navbar";

// every signed-in page keeps the same top bar / bottom tabs as the public site (the bar is fixed, so leave room for it)
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNavbar />
      <div className="min-h-[70vh] pt-16">{children}</div>
    </>
  );
}
