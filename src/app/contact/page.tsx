import InfoPage, { infoMetadata } from "@/components/info-page";

export const dynamic = "force-dynamic";
export const generateMetadata = () => infoMetadata("contact");

export default function Page() {
  return <InfoPage slug="contact" />;
}
