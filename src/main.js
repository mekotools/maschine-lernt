// Maschine lernt — Kernfunktion.
//
// Zwei Betriebsarten, ein Rezept:
//   "bild"    — ein fertig trainiertes Bildnetz (MobileNet) beschreibt das Motiv
//               als Zahlenvektor (1280 Merkmale).
//   "haltung" — ein Haltungsnetz erkennt 33 Koerperpunkte; die werden zu einem
//               Zahlenvektor aus 132 Werten (je Punkt Lage und Sichtbarkeit).
//
// In beiden Faellen merkt sich ein kNN-Klassifikator die Vektoren der Beispiele
// und ordnet neue Bilder der aehnlichsten Klasse zu. Lernen und Urteilen
// passieren vollstaendig im Browser; es gibt keine Gegenstelle.
//
// Jede Betriebsart fuehrt einen eigenen Lernstand. Die Vektoren der beiden Arten
// sind nicht vergleichbar, deshalb wird nie gemischt.

import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as knnClassifier from "@tensorflow-models/knn-classifier";
import * as haltung from "./haltung.js";

// Selbst mitgeliefertes Netz (siehe scripts/gewichte-holen.mjs). Absichtlich ein
// relativer Pfad: traegt an der Wurzel wie unter einem Unterpfad.
const MODELL_PFAD = "./modelle/mobilenet/model.json";
const BILDFORM = 224;
const EMPFEHLUNG = 10;   // Beispiele je Klasse, ab denen ein Urteil belastbar ist
const HOECHSTZAHL_KLASSEN = 8;
const TAKT_MS = 200;          // wie oft hoechstens geurteilt wird (Bildbetrieb)
const TAKT_MS_HALTUNG_GPU = 500;   // Haltungsnetz mit Grafikbeschleuniger
const TAKT_MS_HALTUNG_CPU = 900;   // ohne: die Rechnung dauert deutlich laenger

const els = {};
for (const kennung of ["modus-bild", "modus-haltung", "modus-hinweis", "kamera-knopf",
  "datei-wahl", "kamera", "bild", "bild-leer", "leinentuch", "ueberlagerung",
  "blick-hinweis", "klasse-name", "klasse-knopf", "klassen-hinweis", "klassen",
  "klassen-leer", "urteile", "urteil-gross", "urteil-fuss", "sichern-knopf",
  "laden-wahl", "sicherung-hinweis", "stand", "quellen-hinweis"]) {
  els[kennung.replace(/-([a-z])/g, (_, b) => b.toUpperCase())] = document.getElementById(kennung);
}

const zustand = {
  modus: "bild",
  betriebe: {
    bild: { klassifikator: null, klassen: [] },
    haltung: { klassifikator: null, klassen: [] },
  },
  netz: null,           // Bildnetz (nur Betriebsart "bild")
  haltungBereit: false, // Haltungsnetz geladen?
  quelle: null,         // "kamera" | "bild"
  strom: null,          // MediaStream
  rechnet: false,       // verhindert ueberlappende Urteile
  letztesUrteil: null,
  letzterHinweis: "",   // z. B. "Keine Person erkannt"
  urteilsPause: false,  // Abnahmehilfe: Rechnung anhalten, Blick trotzdem aktuell halten
};

function betrieb() {
  return zustand.betriebe[zustand.modus];
}

function bereit() {
  return zustand.modus === "bild" ? Boolean(zustand.netz) : zustand.haltungBereit;
}

// ---------------------------------------------------------------- Rueckmeldung

function stand(text, art) {
  els.stand.textContent = text;
  els.stand.classList.toggle("fehler", art === "fehler");
  console[art === "fehler" ? "error" : "log"](text);
}

function hinweisQuelle(text, art) {
  els.quellenHinweis.textContent = text;
  els.quellenHinweis.classList.toggle("fehler", art === "fehler");
}

// ---------------------------------------------------------------- Betriebsart

const MODUS_TEXTE = {
  bild: {
    hinweis: "Bei \u201EBilder und Dinge\u201C beschreibt ein Bildnetz das Motiv. Es erkennt, was auf dem Bild zu sehen ist — Gegenstände, Tiere, Formen.",
    klassen: "Gute Beispielsammlung: dasselbe Objekt aus mehreren Winkeln, mit wechselndem Hintergrund und Licht. Zehn Beispiele je Klasse sind das Minimum — darunter rät die Maschine.",
  },
  haltung: {
    hinweis: "Bei \u201EHaltungen\u201C werden 33 Körperpunkte erkannt: Schultern, Ellbogen, Knie, Kopf. Die Maschine lernt die Zahlen, die diese Punkte beschreiben — nicht die Person.",
    klassen: "Gute Beispielsammlung: dieselbe Haltung mehrfach zeigen, dabei Abstand und Standort im Bild ruhig etwas variieren. Auch hier gilt: zehn Beispiele je Klasse.",
  },
};

function modusAnzeigen() {
  const istBild = zustand.modus === "bild";
  els.modusBild.classList.toggle("aktiv", istBild);
  els.modusHaltung.classList.toggle("aktiv", !istBild);
  els.modusBild.setAttribute("aria-pressed", String(istBild));
  els.modusHaltung.setAttribute("aria-pressed", String(!istBild));
  els.modusHinweis.textContent = MODUS_TEXTE[zustand.modus].hinweis;
  els.klassenHinweis.textContent = MODUS_TEXTE[zustand.modus].klassen;
  if (istBild) {
    const ctx = els.ueberlagerung.getContext("2d");
    ctx.clearRect(0, 0, BILDFORM, BILDFORM);
    els.blickHinweis.textContent = "Genau dieser quadratische Ausschnitt geht in die Rechnung — 224 × 224 Bildpunkte, immer der größte mögliche Quadrat in der Bildmitte. Was hier nicht zu sehen ist, kann die Maschine nicht unterscheiden.";
  } else {
    els.blickHinweis.textContent = "Der quadratische Ausschnitt, aus dem gerechnet wird — mit den erkannten Körperpunkten darüber. Blasse Punkte sind verdeckt oder außerhalb des Bildes; solche Zahlen sind unzuverlässig.";
  }
}

async function modusWechseln(neu) {
  if (neu === zustand.modus) return;
  zustand.modus = neu;
  modusAnzeigen();
  klassenAnzeigen();
  urteilAnzeigen(null, {});

  if (neu === "haltung" && !zustand.haltungBereit) {
    els.modusHaltung.disabled = true;
    stand("Haltungsnetz wird geladen — es liegt bei dieser Seite.");
    try {
      await haltung.haltungLaden();
      zustand.haltungBereit = true;
      zustand.haltungRechenweg = haltung.haltungRechenweg();
      stand(zustand.haltungRechenweg === "CPU"
        ? "Bereit — ohne Grafikbeschleuniger. Die Haltungsrechnung läuft auf dem Hauptprozessor und ist entsprechend langsamer."
        : "Bereit. Kamera einschalten oder Bilddateien wählen — dann Haltungen zeigen und aufnehmen.");
    } catch (fehler) {
      stand(`Das Haltungsnetz ließ sich nicht laden: ${fehler.message}`, "fehler");
      els.blickHinweis.textContent = "Ohne Haltungsnetz kann in dieser Betriebsart nicht gerechnet werden. Die Dateien unter ./modelle/pose/ und ./mediapipe/wasm/ fehlen oder sind unvollständig.";
      els.blickHinweis.classList.add("fehler");
    } finally {
      els.modusHaltung.disabled = false;
    }
  } else {
    stand(neu === "haltung"
      ? "Betriebsart Haltungen. Haltungen zeigen und Beispiele aufnehmen."
      : "Betriebsart Bilder und Dinge. Motive zeigen und Beispiele aufnehmen.");
  }
}

// ------------------------------------------------------------------ Bildquelle

function leinentuchFuellen() {
  const quelle = zustand.quelle === "kamera" ? els.kamera : els.bild;
  if (!quelle) return false;
  const breite = quelle.videoWidth || quelle.naturalWidth || 0;
  const hoehe = quelle.videoHeight || quelle.naturalHeight || 0;
  if (!breite || !hoehe) return false;
  const kante = Math.min(breite, hoehe);          // mittig quadratisch zuschneiden
  const ctx = els.leinentuch.getContext("2d");
  ctx.drawImage(quelle, (breite - kante) / 2, (hoehe - kante) / 2, kante, kante, 0, 0, BILDFORM, BILDFORM);
  return true;
}

async function kameraEinschalten() {
  if (zustand.strom) {
    zustand.strom.getTracks().forEach((s) => s.stop());
    zustand.strom = null;
    els.kamera.srcObject = null;
    els.kamera.hidden = true;
    els.kameraKnopf.textContent = "Kamera einschalten";
    zustand.quelle = null;
    els.bildLeer.hidden = false;
    hinweisQuelle("Kamera ausgeschaltet.");
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    hinweisQuelle("Dieser Browser gibt keine Kamera heraus — oder die Seite läuft nicht über HTTPS. Nimm die Bilddateien.", "fehler");
    return;
  }
  try {
    const strom = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    zustand.strom = strom;
    els.kamera.srcObject = strom;
    await els.kamera.play();
    els.kamera.hidden = false;
    els.bild.hidden = true;
    els.bildLeer.hidden = true;
    zustand.quelle = "kamera";
    els.kameraKnopf.textContent = "Kamera ausschalten";
    hinweisQuelle("Kamera läuft. Alles bleibt auf diesem Gerät.");
    klassenAnzeigen();
  } catch (fehler) {
    const gruende = {
      NotAllowedError: "Der Browser hat den Zugriff nicht erlaubt. Das lässt sich in den Seiteneinstellungen ändern.",
      NotFoundError: "Es wurde keine Kamera gefunden.",
      NotReadableError: "Die Kamera ist gerade von einem anderen Programm belegt.",
      OverconstrainedError: "Die Kamera kann die verlangte Bildgröße nicht liefern.",
    };
    hinweisQuelle(gruende[fehler.name] || `Kamera nicht verfügbar: ${fehler.name || fehler.message}`, "fehler");
  }
}

function bilderWaehlen(dateien) {
  const datei = dateien && dateien[0];
  if (!datei) return;
  const leser = new FileReader();
  leser.onload = () => {
    els.bild.onload = () => {
      els.bild.hidden = false;
      els.kamera.hidden = true;
      els.bildLeer.hidden = true;
      zustand.quelle = "bild";
      hinweisQuelle(`Bild gewählt: ${datei.name}${dateien.length > 1 ? ` (${dateien.length} Dateien gewählt, es gilt die erste)` : ""}`);
      klassenAnzeigen();
    };
    els.bild.onerror = () => hinweisQuelle("Diese Datei lässt sich nicht als Bild lesen.", "fehler");
    els.bild.src = leser.result;
  };
  leser.onerror = () => hinweisQuelle("Die Datei ließ sich nicht öffnen.", "fehler");
  leser.readAsDataURL(datei);
}

// --------------------------------------------------------------------- Merkmale

// Liefert einen Tensor [1, n] mit den Merkmalen des aktuellen Bildes — oder null,
// wenn es dafuer gerade keine Grundlage gibt. Der Aufrufer gibt den Tensor frei.
function merkmaleErmitteln() {
  if (zustand.modus === "haltung") {
    const ergebnis = haltung.haltungMerkmale(els.leinentuch);
    haltung.skelettZeichnen(els.ueberlagerung.getContext("2d"), ergebnis.punkte, BILDFORM, BILDFORM);
    if (!ergebnis.vektor) {
      zustand.letzterHinweis = ergebnis.grund || "";
      return null;
    }
    zustand.letzterHinweis = ergebnis.verdeckt
      ? `${ergebnis.verdeckt} von 33 Körperpunkten sind verdeckt — das Urteil steht auf wackligen Zahlen.`
      : "";
    return tf.tensor2d([Array.from(ergebnis.vektor)], [1, haltung.VEKTORLAENGE]);
  }
  if (!zustand.netz) return null;
  return tf.tidy(() => zustand.netz.infer(els.leinentuch, true));
}

// --------------------------------------------------------------------- Klassen

function klassenAnzeigen() {
  const b = betrieb();
  els.klassen.textContent = "";
  els.klassenLeer.hidden = b.klassen.length > 0;

  b.klassen.forEach((klasse, i) => {
    const kasten = document.createElement("div");
    kasten.className = "klasse";

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = klasse.name;

    const zahl = document.createElement("span");
    zahl.className = "zahl";
    zahl.textContent = `${klasse.anzahl} Beispiel${klasse.anzahl === 1 ? "" : "e"}`;

    const reihe = document.createElement("div");
    reihe.className = "reihe";

    const aufnehmen = document.createElement("button");
    aufnehmen.type = "button";
    aufnehmen.className = "klein";
    aufnehmen.textContent = "Beispiel aufnehmen";
    aufnehmen.disabled = !bereit() || !zustand.quelle;
    aufnehmen.addEventListener("click", () => beispielAufnehmen(i, aufnehmen));

    const leeren = document.createElement("button");
    leeren.type = "button";
    leeren.className = "klein";
    leeren.textContent = "Beispiele löschen";
    leeren.disabled = klasse.anzahl === 0;
    leeren.addEventListener("click", () => {
      b.klassifikator.clearClass(i);
      klasse.anzahl = 0;
      klassenAnzeigen();
      stand(`Beispiele der Klasse „${klasse.name}" gelöscht.`);
    });

    const weg = document.createElement("button");
    weg.type = "button";
    weg.className = "klein";
    weg.textContent = "Klasse entfernen";
    weg.addEventListener("click", () => klasseEntfernen(i));

    reihe.append(aufnehmen, leeren, weg);
    kasten.append(name, zahl, reihe);
    els.klassen.append(kasten);
  });

  els.sichernKnopf.disabled = b.klassen.length === 0;
}

function klasseEntfernen(index) {
  const b = betrieb();
  const daten = b.klassifikator.getClassifierDataset();
  const reihen = {};
  for (const [i, tensor] of Object.entries(daten)) reihen[i] = tensor.arraySync();
  Object.values(daten).forEach((t) => t.dispose && t.dispose());

  b.klassifikator.clearAllClasses();
  const rest = b.klassen.filter((_, i) => i !== index);
  rest.forEach((klasse, neu) => {
    const alt = reihen[neu >= index ? neu + 1 : neu];
    if (alt) b.klassifikator.setClassExample(alt, neu);
  });
  b.klassen = rest;
  klassenAnzeigen();
  stand(`Klasse entfernt. ${b.klassen.length} Klassen übrig.`);
}

function klasseHinzufuegen() {
  const b = betrieb();
  const name = els.klasseName.value.trim();
  if (!name) { stand("Bitte einen Namen für die Klasse eingeben.", "fehler"); return; }
  if (b.klassen.some((k) => k.name.toLowerCase() === name.toLowerCase())) {
    stand(`Die Klasse „${name}" gibt es schon.`, "fehler");
    return;
  }
  if (b.klassen.length >= HOECHSTZAHL_KLASSEN) {
    stand(`${HOECHSTZAHL_KLASSEN} Klassen sind genug für den Anfang.`, "fehler");
    return;
  }
  b.klassen.push({ name, anzahl: 0 });
  els.klasseName.value = "";
  klassenAnzeigen();
  stand(`Klasse „${name}" angelegt. Jetzt Beispiele aufnehmen.`);
}

async function beispielAufnehmen(index, knopf) {
  const b = betrieb();
  if (!bereit()) { stand("Das Netz ist noch nicht bereit.", "fehler"); return; }
  if (!leinentuchFuellen()) { stand("Es ist noch kein Bild da, aus dem gelernt werden könnte.", "fehler"); return; }
  knopf.disabled = true;
  try {
    const merkmale = merkmaleErmitteln();
    if (!merkmale) {
      stand(zustand.letzterHinweis || "Aus diesem Bild lassen sich gerade keine Merkmale gewinnen.", "fehler");
      return;
    }
    b.klassifikator.addExample(merkmale, index);
    merkmale.dispose();
    b.klassen[index].anzahl += 1;
    klassenAnzeigen();
    const k = b.klassen[index];
    const fehlen = EMPFEHLUNG - k.anzahl;
    stand(`Beispiel ${k.anzahl} für „${k.name}" aufgenommen${fehlen > 0 ? ` — noch ${fehlen} bis zur belastbaren Menge` : " — Menge reicht für ein belastbares Urteil"}.`);
  } catch (fehler) {
    stand(`Aufnahme fehlgeschlagen: ${fehler.message}`, "fehler");
  } finally {
    knopf.disabled = false;
  }
}

// ---------------------------------------------------------------------- Urteil

let urteilLaeuft = false;

async function urteilBerechnen() {
  const b = betrieb();
  if (!leinentuchFuellen()) return;
  const merkmale = merkmaleErmitteln();
  if (!merkmale) {
    if (b.klassifikator && b.klassifikator.getNumClasses() === 0) urteilAnzeigen(null, {});
    if (zustand.modus === "haltung" && zustand.klassifikator !== null) { /* Platzhalter, nie benutzt */ }
    return;
  }
  try {
    if (b.klassifikator.getNumClasses() === 0) { urteilAnzeigen(null, {}); return; }
    const ergebnis = await b.klassifikator.predictClass(merkmale, 3);
    urteilAnzeigen(ergebnis, ergebnis.confidences || {});
  } catch (fehler) {
    stand(`Urteil nicht möglich: ${fehler.message}`, "fehler");
  } finally {
    merkmale.dispose();
  }
}

function urteilAnzeigen(ergebnis, staerken) {
  const b = betrieb();
  els.urteile.textContent = "";
  const gesamt = b.klassen.reduce((s, k) => s + k.anzahl, 0);
  zustand.letztesUrteil = ergebnis && b.klassen[ergebnis.classIndex]
    ? {
        klasse: b.klassen[ergebnis.classIndex].name,
        sicherheit: Math.round((staerken[ergebnis.classIndex] ?? 0) * 100),
        staerken,
        beispiele: gesamt,
      }
    : null;

  b.klassen.forEach((klasse, i) => {
    const anteil = Math.round((staerken[i] ?? staerken[String(i)] ?? 0) * 100);
    const zeile = document.createElement("div");
    zeile.className = "urteil";

    const wer = document.createElement("span");
    wer.className = "wer";
    wer.textContent = `${klasse.name} (${klasse.anzahl})`;

    const balken = document.createElement("div");
    balken.className = "balken";
    const fuellung = document.createElement("span");
    fuellung.style.width = `${anteil}%`;
    balken.append(fuellung);

    const prozent = document.createElement("span");
    prozent.className = "prozent";
    prozent.textContent = `${anteil} %`;

    zeile.append(wer, balken, prozent);
    els.urteile.append(zeile);
  });

  if (!ergebnis || gesamt === 0) {
    els.urteilGross.textContent = "– noch keine Beispiele –";
    els.urteilFuss.textContent = zustand.letzterHinweis
      ? zustand.letzterHinweis
      : "Ohne Beispiele gibt es nichts zu urteilen.";
    return;
  }

  const gewaehlt = b.klassen[ergebnis.classIndex];
  const sicherheit = Math.round((staerken[ergebnis.classIndex] ?? 0) * 100);
  els.urteilGross.textContent = gewaehlt ? `„${gewaehlt.name}" — ${sicherheit} %` : "– unsicher –";

  const wenig = b.klassen.filter((k) => k.anzahl < EMPFEHLUNG).map((k) => k.name);
  const teile = [];
  if (wenig.length) {
    teile.push(`Achtung: für ${wenig.join(", ")} liegen weniger als ${EMPFEHLUNG} Beispiele vor. Das Urteil kann kippen, sobald du mehr aufnimmst.`);
  } else {
    teile.push(`Das Urteil stützt sich auf ${gesamt} Beispiele. Ein Balken ist keine Wahrheit, sondern eine Ähnlichkeit.`);
  }
  if (zustand.letzterHinweis) teile.push(zustand.letzterHinweis);
  els.urteilFuss.textContent = teile.join(" ");
}

function urteilStarten() {
  if (urteilLaeuft) return;
  urteilLaeuft = true;
  let letzterLauf = 0;
  const schleife = async (zeit) => {
    if (zustand.quelle) {
      // Der Blick der Maschine wird immer aktualisiert, auch ohne Beispiele.
      if (!zustand.rechnet) {
        const takt = zustand.modus === "haltung"
          ? (zustand.haltungRechenweg === "CPU" ? TAKT_MS_HALTUNG_CPU : TAKT_MS_HALTUNG_GPU)
          : TAKT_MS;
        if (!zustand.urteilsPause && zeit - letzterLauf > takt) {
          zustand.rechnet = true;
          try {
            await urteilBerechnen();
          } finally {
            zustand.rechnet = false;
            // Die Pause ab dem ENDE der Rechnung messen, nicht ab dem Anfang:
            // sonst reihen sich die Rechnungen lueckenlos aneinander und die
            // Seite kommt nicht mehr zum Atmen.
            letzterLauf = performance.now();
          }
        } else if (zustand.modus === "bild" || zustand.urteilsPause) {
          // Ohne Rechnung wenigstens den Blick der Maschine aktuell halten.
          leinentuchFuellen();
        }
      }
    }
    requestAnimationFrame(schleife);
  };
  requestAnimationFrame(schleife);
}

// ------------------------------------------------------------------ Sicherung

async function sichern() {
  const b = betrieb();
  try {
    const daten = b.klassifikator.getClassifierDataset();
    const inhalt = {
      werkzeug: "maschine-lernt",
      fassung: 2,
      betrieb: zustand.modus,
      gesichert: new Date().toISOString(),
      klassen: b.klassen.map((k) => k.name),
      beispiele: {},
    };
    for (const [index, tensor] of Object.entries(daten)) {
      inhalt.beispiele[index] = { form: tensor.shape, werte: Array.from(await tensor.data()) };
    }
    const blob = new Blob([JSON.stringify(inhalt)], { type: "application/json" });
    const adresse = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = adresse;
    a.download = `maschine-lernt-${zustand.modus}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(adresse);
    els.sicherungHinweis.classList.remove("fehler");
    els.sicherungHinweis.textContent = `Gesichert: ${b.klassen.length} Klassen, ${b.klassen.reduce((s, k) => s + k.anzahl, 0)} Beispiele, Betriebsart ${zustand.modus === "bild" ? "Bilder und Dinge" : "Haltungen"}.`;
    stand("Modell als Datei gesichert.");
  } catch (fehler) {
    els.sicherungHinweis.classList.add("fehler");
    els.sicherungHinweis.textContent = `Sichern fehlgeschlagen: ${fehler.message}`;
    stand(`Sichern fehlgeschlagen: ${fehler.message}`, "fehler");
  }
}

async function laden(datei) {
  if (!datei) return;
  const text = await datei.text();
  try {
    const inhalt = JSON.parse(text);
    if (inhalt.werkzeug !== "maschine-lernt" || !inhalt.beispiele) {
      throw new Error("Das ist keine Sicherung dieses Werkzeugs.");
    }
    const art = inhalt.betrieb === "haltung" ? "haltung" : "bild";
    const ausAlterFassung = !inhalt.betrieb;
    if (art !== zustand.modus) {
      await modusWechseln(art);
      if (!bereit()) throw new Error("Die Betriebsart dieser Sicherung ist auf diesem Gerät nicht verfügbar.");
    }
    const b = betrieb();
    const daten = {};
    for (const [index, block] of Object.entries(inhalt.beispiele)) {
      daten[index] = tf.tensor2d(block.werte, block.form);
    }
    b.klassifikator.clearAllClasses();
    b.klassifikator.setClassifierDataset(daten);
    b.klassen = (inhalt.klassen || []).map((name, i) => ({
      name,
      anzahl: inhalt.beispiele[String(i)]?.form?.[0] ?? 0,
    }));
    klassenAnzeigen();
    els.sicherungHinweis.classList.remove("fehler");
    els.sicherungHinweis.textContent =
      `Geladen: ${b.klassen.length} Klassen, gesichert am ${new Date(inhalt.gesichert).toLocaleString("de-DE")}` +
      `, Betriebsart ${art === "bild" ? "Bilder und Dinge" : "Haltungen"}` +
      `${ausAlterFassung ? " (Datei aus einer älteren Fassung)" : ""}.`;
    stand("Gesichertes Modell geladen.");
  } catch (fehler) {
    els.sicherungHinweis.classList.add("fehler");
    els.sicherungHinweis.textContent = `Laden fehlgeschlagen: ${fehler.message}`;
    stand(`Laden fehlgeschlagen: ${fehler.message}`, "fehler");
  }
}

// ---------------------------------------------------------------------- Start

async function starten() {
  els.kamera.hidden = true;
  modusAnzeigen();
  klassenAnzeigen();
  urteilStarten();
  stand(`TensorFlow.js ${tf.version.tfjs} geladen. Rechenweg: ${tf.getBackend()}.`);
  try {
    stand("Bildnetz wird geladen — es liegt bei dieser Seite.");
    zustand.netz = await mobilenet.load({ version: 2, alpha: 1.0, modelUrl: MODELL_PFAD });
    zustand.betriebe.bild.klassifikator = knnClassifier.create();
    zustand.betriebe.haltung.klassifikator = knnClassifier.create();
    klassenAnzeigen();
    stand("Bereit. Kamera einschalten oder Bilddateien wählen.");
  } catch (fehler) {
    stand(`Das Bildnetz ließ sich nicht laden: ${fehler.message}`, "fehler");
    hinweisQuelle("Ohne Bildnetz kann in der Betriebsart \u201EBilder und Dinge\u201C nicht gelernt werden. Die Dateien unter ./modelle/ fehlen oder sind unvollständig.", "fehler");
  }
}

els.kameraKnopf.addEventListener("click", kameraEinschalten);
els.klasseKnopf.addEventListener("click", klasseHinzufuegen);
els.klasseName.addEventListener("keydown", (e) => { if (e.key === "Enter") klasseHinzufuegen(); });
els.dateiWahl.addEventListener("change", (e) => bilderWaehlen(e.target.files));
els.sichernKnopf.addEventListener("click", sichern);
els.ladenWahl.addEventListener("change", (e) => laden(e.target.files[0]));
els.modusBild.addEventListener("click", () => modusWechseln("bild"));
els.modusHaltung.addEventListener("click", () => modusWechseln("haltung"));

// Fuer die Abnahme von aussen lesbar: Zustand, letztes Urteil, Betriebsartwechsel
// und die Sicherungsfunktionen. Damit laesst sich ohne Handgriffe pruefen, ob
// Lernen, Sichern und Laden wirklich zusammenpassen.
window.maschineLernt = zustand;
zustand.sichern = sichern;
zustand.laden = laden;
zustand.modusWechseln = modusWechseln;
zustand.klasseHinzufuegen = klasseHinzufuegen;
zustand.beispielAufnehmen = beispielAufnehmen;
zustand.merkmaleErmitteln = merkmaleErmitteln;
zustand.urteilJetzt = urteilBerechnen;
zustand.haltung = haltung;   // fuer die Abnahme: Merkmale und Rechenweg einsehbar

starten();
