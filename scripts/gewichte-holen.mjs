#!/usr/bin/env node
// Holt die Gewichte des Bildnetzes ins eigene Verzeichnis und prueft sie gegen
// die festgeschriebenen Fingerabdruecke.
//
// Bewusst mit Node statt curl: im schlanken Node-Abbild der Baustufe gibt es kein
// curl (gemessen: "curl: command not found", exit 127). Node ist dort ohnehin da.
//
// Aufruf: npm run gewichte

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = join(HIER, "..", "public", "modelle", "mobilenet");
const SOLL_DATEI = join(HIER, "gewichte.sha256");
const QUELLE =
  process.env.QUELLE ??
  "https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/classification/2";

const DATEIEN = [
  "model.json",
  "group1-shard1of4.bin",
  "group1-shard2of4.bin",
  "group1-shard3of4.bin",
  "group1-shard4of4.bin",
];

async function vorhanden(pfad) {
  try {
    const s = await stat(pfad);
    return s.size > 0;
  } catch {
    return false;
  }
}

function fingerabdruck(pfad) {
  return new Promise((fertig, schief) => {
    const h = createHash("sha256");
    createReadStream(pfad)
      .on("data", (stueck) => h.update(stueck))
      .on("end", () => fertig(h.digest("hex")))
      .on("error", schief);
  });
}

console.log(`Quelle: ${QUELLE}`);
console.log(`Ziel:   ${ZIEL}`);
await mkdir(ZIEL, { recursive: true });

for (const name of DATEIEN) {
  const pfad = join(ZIEL, name);
  if (await vorhanden(pfad)) {
    console.log(`  vorhanden: ${name}`);
    continue;
  }
  const adresse = `${QUELLE}/${name}?tfjs-format=file`;
  console.log(`  hole:      ${name}`);
  const antwort = await fetch(adresse);
  if (!antwort.ok) {
    console.error(`ABBRUCH: ${adresse} antwortet mit HTTP ${antwort.status}.`);
    process.exit(1);
  }
  await writeFile(pfad, Buffer.from(await antwort.arrayBuffer()));
}

let abweichungen = 0;
console.log(`Pruefe Fingerabdruecke gegen ${SOLL_DATEI.split("/").pop()} ...`);
for (const zeile of (await readFile(SOLL_DATEI, "utf8")).split("\n")) {
  const [soll, name] = zeile.trim().split(/\s+/);
  if (!soll || !name || soll.startsWith("#")) continue;
  const ist = await fingerabdruck(join(ZIEL, name));
  const stimmt = ist === soll;
  console.log(`  ${name}: ${stimmt ? "OK" : "ABWEICHUNG"}`);
  if (!stimmt) {
    console.error(`    erwartet ${soll}`);
    console.error(`    gefunden ${ist}`);
    abweichungen += 1;
  }
}

if (abweichungen > 0) {
  console.error(
    `ABBRUCH: ${abweichungen} Datei(en) stimmen nicht mit den festgeschriebenen ` +
      `Fingerabdruecken ueberein. Lieber kein Abbild als ein falsches.`,
  );
  process.exit(1);
}

console.log("Alle Gewichte stimmen. Fertig.");
