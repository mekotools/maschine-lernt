#!/usr/bin/env node
// Holt alle Netzgewichte ins eigene Verzeichnis und prueft sie gegen die
// festgeschriebenen Fingerabdruecke.
//
// Bewusst mit Node statt curl: im schlanken Node-Abbild der Baustufe gibt es kein
// curl (gemessen: "curl: command not found", exit 127). Node ist dort ohnehin da.
//
// Bewusst zwei Modelle: das Bildnetz liefert Merkmale fuer Bilddateien, das
// Haltungsnetz die 33 Koerperpunkte. Beide liegen danach im Abbild, damit die
// Seite zur Laufzeit nichts nachlaedt.
//
// Aufruf: npm run gewichte

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));

const MODELLE = [
  {
    name: "Bildnetz (MobileNet v2 100/224, Klassifikation)",
    ziel: join("public", "modelle", "mobilenet"),
    liste: "gewichte.sha256",
    quelle:
      process.env.QUELLE ??
      "https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/classification/2",
    anhang: "?tfjs-format=file",
    dateien: [
      "model.json",
      "group1-shard1of4.bin",
      "group1-shard2of4.bin",
      "group1-shard3of4.bin",
      "group1-shard4of4.bin",
    ],
  },
  {
    name: "Haltungsnetz (Pose Landmarker lite)",
    ziel: join("public", "modelle", "pose"),
    liste: "pose.sha256",
    quelle:
      process.env.QUELLE_POSE ??
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1",
    anhang: "",
    dateien: ["pose_landmarker_lite.task"],
  },
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

async function holen(modell) {
  const ziel = join(HIER, "..", modell.ziel);
  await mkdir(ziel, { recursive: true });
  console.log(modell.name);
  console.log(`  Quelle: ${modell.quelle}`);
  for (const name of modell.dateien) {
    const pfad = join(ziel, name);
    if (await vorhanden(pfad)) {
      console.log(`    vorhanden: ${name}`);
      continue;
    }
    const adresse = `${modell.quelle}/${name}${modell.anhang}`;
    const antwort = await fetch(adresse);
    if (!antwort.ok) {
      console.error(`ABBRUCH: ${adresse} antwortet mit HTTP ${antwort.status}.`);
      process.exit(1);
    }
    const daten = Buffer.from(await antwort.arrayBuffer());
    if (daten.length === 0) {
      console.error(`ABBRUCH: ${adresse} lieferte keine Daten.`);
      process.exit(1);
    }
    await writeFile(pfad, daten);
    console.log(`    geholt:    ${name} (${(daten.length / 1024 / 1024).toFixed(2)} MB)`);
  }
  return ziel;
}

async function pruefen(ziel, modell) {
  const sollDatei = join(HIER, modell.liste);
  let abweichungen = 0;
  let geprueft = 0;
  for (const zeile of (await readFile(sollDatei, "utf8")).split("\n")) {
    const [soll, name] = zeile.trim().split(/\s+/);
    if (!soll || !name || soll.startsWith("#")) continue;
    const pfad = join(ziel, name);
    if (!(await vorhanden(pfad))) {
      console.error(`    FEHLT: ${name}`);
      abweichungen += 1;
      continue;
    }
    const ist = await fingerabdruck(pfad);
    if (ist === soll) {
      console.log(`    stimmt: ${name}`);
    } else {
      console.error(`    ABWEICHUNG: ${name}\n      erwartet ${soll}\n      gefunden ${ist}`);
      abweichungen += 1;
    }
    geprueft += 1;
  }
  console.log(`  ${geprueft} Dateien gegen ${modell.liste} geprueft, ${abweichungen} Abweichungen`);
  return abweichungen;
}

let gesamt = 0;
for (const modell of MODELLE) {
  const ziel = await holen(modell);
  gesamt += await pruefen(ziel, modell);
}

if (gesamt > 0) {
  console.error(
    `ABBRUCH: ${gesamt} Datei(en) stimmen nicht mit den festgeschriebenen ` +
      `Fingerabdruecken ueberein. Lieber kein Abbild als ein falsches.`,
  );
  process.exit(1);
}

console.log("Alle Gewichte stimmen. Fertig.");
