import InfoPage, { infoMetadata } from "@/components/info-page";

export const dynamic = "force-dynamic";
export const generateMetadata = () => infoMetadata("privacy");

export default function Page() {
  return <InfoPage slug="privacy" />;
}
