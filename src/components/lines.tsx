import { Fragment } from "react";
import { lineParts } from "@/lib/site-texts";

/** Text with the admin's own line breaks: "A | B" is shown as two lines. */
export default function Lines({ text }: { text: string }) {
  const parts = lineParts(text);
  if (parts.length < 2) return <>{text.trim()}</>;
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {part}
        </Fragment>
      ))}
    </>
  );
}
