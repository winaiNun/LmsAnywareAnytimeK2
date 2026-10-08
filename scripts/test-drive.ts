/* Run with: npm run test:drive */
import assert from "node:assert/strict";
import { driveThumbnailUrl, driveViewUrl, parseDriveFileId } from "../src/lib/drive";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz_-012";
let passed = 0;
const t = (name: string, fn: () => void) => { try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${(e as Error).message}`); process.exitCode = 1; } };

t("accepts the usual Drive file links", () => {
  for (const link of [
    `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
    `https://drive.google.com/file/d/${ID}/view`,
    `https://drive.google.com/file/d/${ID}/preview`,
    `https://drive.google.com/file/u/0/d/${ID}/view`,
    `https://drive.google.com/open?id=${ID}`,
    `https://drive.google.com/uc?export=view&id=${ID}`,
    `https://drive.google.com/thumbnail?id=${ID}&sz=w800`,
    `  https://drive.google.com/file/d/${ID}/view  `,
  ]) assert.equal(parseDriveFileId(link), ID, link);
});

t("rejects everything else (other hosts, look-alikes, folders, junk)", () => {
  for (const bad of [
    "", null, undefined, "not a url", ID,
    `http://drive.google.com/file/d/${ID}/view`, // not https
    `https://evil.com/file/d/${ID}/view`,
    `https://drive.google.com.evil.com/file/d/${ID}/view`,
    `https://evildrive.google.com/file/d/${ID}/view`,
    `https://docs.google.com/document/d/${ID}/edit`,
    `https://drive.google.com/drive/folders/${ID}`,
    `https://drive.google.com/file/d/short/view`,
    `https://drive.google.com/open?id=../../etc/passwd`,
    `https://drive.google.com/open?id=${ID}%0d%0aHost:evil`,
    "https://drive.google.com/",
    "javascript:alert(1)",
  ]) assert.equal(parseDriveFileId(bad as string), null, String(bad));
});

t("urls are rebuilt from the id only", () => {
  assert.equal(driveThumbnailUrl(ID, 1800), `https://drive.google.com/thumbnail?id=${ID}&sz=w1800`);
  assert.equal(driveViewUrl(ID), `https://drive.google.com/file/d/${ID}/view`);
});

console.log(process.exitCode ? "\nDrive tests FAILED" : `All ${passed} drive test groups passed`);
