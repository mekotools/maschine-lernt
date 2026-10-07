// Haltung: erkennt 33 Koerperpunkte auf dem Bild und macht daraus einen
// Zahlenvektor, aus dem die Maschine lernen kann.
//
// Der Rechenweg liegt vollstaendig bei dieser Seite: die Rechenkerne kommen aus
// ./mediapipe/wasm, das Modell aus ./modelle/pose. Beide liegen im Abbild, es
// wird nichts nachgeladen und nichts gesendet.
//
// Was der Vektor bedeutet: zu jedem der 33 Punkte vier Zahlen — x, y, Tiefe und
// Sichtbarkeit (0 bis 1). Das sind 132 Zahlen. Sie beschreiben die Haltung als
// Lage im Bild, nicht als Person: wer weiter weg steht, liefert andere Zahlen.

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const RECHENKERNE = "./mediapipe/wasm";
const MODELL = "./modelle/pose/pose_landmarker_lite.task";

const PUNKTE = 33;
const WERTE_JE_PUNKT = 4; // x, y, z, Sichtbarkeit
export const VEKTORLAENGE = PUNKTE * WERTE_JE_PUNKT;

// Unter dieser Sichtbarkeit ist ein Punkt unzuverlaessig (verdeckt, ausserhalb
// des Bildes). Ein Urteil daraus waere geraten, deshalb sagen wir es an.
const SICHTBAR_AB = 0.5;

// Mindestbreite der erkannten Punkte, gemessen am Bild (1,00 = volle Breite).
// Ein Koerper ist breit: bei fuenf echten Aufnahmen lag die Breite zwischen 0,81
// und 1,11. Auf Bildern ohne Person passt das Netz trotzdem ein Skelett an —
// gemessen an drei Zugbildern: Breite 0,155 bis 0,157, ein flacher senkrechter
// Streifen. Das ist keine Haltung, das ist eine Erfindung. Deshalb wird sie
// verworfen und benannt, statt still mitgelernt zu werden.
const MINDESTBREITE = 0.25;

let erkennung = null;
let unterbau = null;
let rechenweg = null; // "GPU" oder "CPU" — was tatsaechlich genommen wurde

export function haltungRechenweg() {
  return rechenweg;
}

export async function haltungLaden() {
  if (erkennung) return erkennung;
  if (!unterbau) unterbau = await FilesetResolver.forVisionTasks(RECHENKERNE);
  const einstellungen = {
    baseOptions: { modelAssetPath: MODELL, delegate: "GPU" },
    runningMode: "IMAGE",
    numPoses: 1,
  };
  try {
    erkennung = await PoseLandmarker.createFromOptions(unterbau, einstellungen);
    rechenweg = "GPU";
  } catch (fehler) {
    // Nicht jede Karte gibt den Grafikbeschleuniger heraus; dann eben auf dem
    // Hauptprozessor. Langsamer, aber dasselbe Ergebnis.
    console.warn("Grafikbeschleuniger nicht verfuegbar, rechne auf dem Hauptprozessor:", fehler?.message || fehler);
    erkennung = await PoseLandmarker.createFromOptions(unterbau, {
      ...einstellungen,
      baseOptions: { modelAssetPath: MODELL, delegate: "CPU" },
    });
    rechenweg = "CPU";
  }
  return erkennung;
}

// Liefert { vektor, punkte } fuer das Leinentuch. Ohne erkennbare Person kommt
// null zurueck — dann gibt es nichts zu lernen und nichts zu urteilen.
export function haltungMerkmale(bild) {
  if (!erkennung) return { vektor: null, punkte: null, grund: "Das Haltungsnetz ist noch nicht bereit." };
  const ergebnis = erkennung.detect(bild);
  const person = ergebnis?.landmarks?.[0];
  if (!person || person.length === 0) {
    return { vektor: null, punkte: null, grund: "Keine Person erkannt. Stell dich ganz ins Bild." };
  }
  const zahlen = new Float32Array(VEKTORLAENGE);
  let verdeckt = 0;
  person.forEach((punkt, i) => {
    zahlen[i * WERTE_JE_PUNKT + 0] = punkt.x ?? 0;
    zahlen[i * WERTE_JE_PUNKT + 1] = punkt.y ?? 0;
    zahlen[i * WERTE_JE_PUNKT + 2] = punkt.z ?? 0;
    const sichtbar = punkt.visibility ?? 1;
    zahlen[i * WERTE_JE_PUNKT + 3] = sichtbar;
    if (sichtbar < SICHTBAR_AB) verdeckt += 1;
  });

  const xs = person.map((p) => p.x ?? 0);
  const breite = Math.max(...xs) - Math.min(...xs);
  if (breite < MINDESTBREITE) {
    return {
      vektor: null,
      punkte: person,
      grund: `Die erkannten Punkte liegen zu schmal beieinander (Breite ${breite.toFixed(2)} von 1,00) — das ist keine erkennbare Person. Stell dich größer ins Bild.`,
      breite,
    };
  }

  return {
    vektor: zahlen,
    punkte: person,
    grund: null,
    verdeckt,
    breite,
  };
}

// Zeichnet das Skelett auf die Ueberlagerung, damit sichtbar ist, was die
// Maschine gerade sieht. Die Verbindungen kommen aus dem Paket, nicht aus einer
// eigenen Liste.
export function skelettZeichnen(ctx, punkte, breite, hoehe) {
  if (!punkte) return;
  ctx.clearRect(0, 0, breite, hoehe);
  const verbindungen = PoseLandmarker.POSE_CONNECTIONS || [];
  ctx.lineWidth = Math.max(2, breite / 140);
  ctx.lineCap = "round";

  const sichtbar = (punkt) => (punkt.visibility ?? 1) >= SICHTBAR_AB;

  // Erst die Knochen in einer ruhigen Farbe ...
  ctx.strokeStyle = "rgba(46, 160, 67, 0.9)";
  ctx.beginPath();
  for (const band of verbindungen) {
    const a = punkte[band.start ?? band[0]];
    const b = punkte[band.end ?? band[1]];
    if (!a || !b || !sichtbar(a) || !sichtbar(b)) continue;
    ctx.moveTo(a.x * breite, a.y * hoehe);
    ctx.lineTo(b.x * breite, b.y * hoehe);
  }
  ctx.stroke();

  // ... dann die Punkte. Verdeckte Punkte bleiben blass, damit niemand sie fuer
  // gemessen haelt.
  for (const punkt of punkte) {
    ctx.beginPath();
    ctx.arc(punkt.x * breite, punkt.y * hoehe, Math.max(1.6, breite / 110), 0, Math.PI * 2);
    ctx.fillStyle = sichtbar(punkt) ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.35)";
    ctx.fill();
  }
}
