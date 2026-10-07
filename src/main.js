// Maschine lernt — Kernfunktion.
//
// Aufbau: ein fertig trainiertes Bildnetz (MobileNet) liefert zu jedem Bild einen
// Zahlenvektor (Merkmale). Ein kNN-Klassifikator merkt sich die Vektoren der
// Beispiele und ordnet neue Bilder der aehnlichsten Klasse zu. Lernen und Urteilen
// passieren vollstaendig im Browser; es gibt keine Gegenstelle.

import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as knnClassifier from "@tensorflow-models/knn-classifier";

// Selbst mitgeliefertes Netz (siehe scripts/gewichte-holen.sh). Absichtlich ein
// relativer Pfad: traegt an der Wurzel wie unter einem Unterpfad.
const MODELL_PFAD = "./modelle/mobilenet/model.json";
const BILDFORM = 224;
const EMPFEHLUNG = 10;   // Beispiele je Klasse, ab denen ein Urteil belastbar ist
const HOECHSTZAHL_KLASSEN = 8;

const els = {};
for (const kennung of ["kamera-knopf", "datei-wahl", "kamera", "bild", "bild-leer",
  "klasse-name", "klasse-knopf", "klassen", "klassen-leer", "urteile", "urteil-gross",
  "urteil-fuss", "sichern-knopf", "laden-wahl", "sicherung-hinweis", "stand",
  "quellen-hinweis", "leinentuch"]) {
  els[kennung.replace(/-([a-z])/g, (_, b) => b.toUpperCase())] = document.getElementById(kennung);
}

const zustand = {
  netz: null,
  klassifikator: null,
  klassen: [],          // { name, anzahl }
  quelle: null,         // "kamera" | "bild"
  strom: null,          // MediaStream
  rechnet: false,       // verhindert ueberlappende Urteile
  letztesUrteil: null,
};

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

// --------------------------------------------------------------------- Klassen

function klassenAnzeigen() {
  els.klassen.textContent = "";
  els.klassenLeer.hidden = zustand.klassen.length > 0;

  zustand.klassen.forEach((klasse, i) => {
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
    aufnehmen.disabled = !zustand.netz || !zustand.quelle;
    aufnehmen.addEventListener("click", () => beispielAufnehmen(i, aufnehmen));

    const leeren = document.createElement("button");
    leeren.type = "button";
    leeren.className = "klein";
    leeren.textContent = "Beispiele löschen";
    leeren.disabled = klasse.anzahl === 0;
    leeren.addEventListener("click", () => {
      zustand.klassifikator.clearClass(i);
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

  els.sichernKnopf.disabled = zustand.klassen.length === 0;
}

function klasseEntfernen(index) {
  const daten = zustand.klassifikator.getClassifierDataset();
  const reihen = {};
  for (const [i, tensor] of Object.entries(daten)) reihen[i] = tensor.arraySync();
  Object.values(daten).forEach((t) => t.dispose && t.dispose());

  zustand.klassifikator.clearAllClasses();
  const rest = zustand.klassen.filter((_, i) => i !== index);
  rest.forEach((klasse, neu) => {
    const alt = reihen[neu >= index ? neu + 1 : neu];
    if (alt) zustand.klassifikator.setClassExample(alt, neu);
  });
  zustand.klassen = rest;
  klassenAnzeigen();
  stand(`Klasse entfernt. ${zustand.klassen.length} Klassen übrig.`);
}

function klasseHinzufuegen() {
  const name = els.klasseName.value.trim();
  if (!name) { stand("Bitte einen Namen für die Klasse eingeben.", "fehler"); return; }
  if (zustand.klassen.some((k) => k.name.toLowerCase() === name.toLowerCase())) {
    stand(`Die Klasse „${name}" gibt es schon.`, "fehler");
    return;
  }
  if (zustand.klassen.length >= HOECHSTZAHL_KLASSEN) {
    stand(`${HOECHSTZAHL_KLASSEN} Klassen sind genug für den Anfang.`, "fehler");
    return;
  }
  zustand.klassen.push({ name, anzahl: 0 });
  els.klasseName.value = "";
  klassenAnzeigen();
  stand(`Klasse „${name}" angelegt. Jetzt Beispiele aufnehmen.`);
}

async function beispielAufnehmen(index, knopf) {
  if (!zustand.netz) { stand("Das Bildnetz ist noch nicht bereit.", "fehler"); return; }
  if (!leinentuchFuellen()) { stand("Es ist noch kein Bild da, aus dem gelernt werden könnte.", "fehler"); return; }
  knopf.disabled = true;
  try {
    const merkmale = tf.tidy(() => zustand.netz.infer(els.leinentuch, true));
    zustand.klassifikator.addExample(merkmale, index);
    merkmale.dispose();
    zustand.klassen[index].anzahl += 1;
    klassenAnzeigen();
    const k = zustand.klassen[index];
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
  if (!leinentuchFuellen()) return;
  if (zustand.klassifikator.getNumClasses() === 0) { urteilAnzeigen(null, {}); return; }
  const merkmale = tf.tidy(() => zustand.netz.infer(els.leinentuch, true));
  try {
    const ergebnis = await zustand.klassifikator.predictClass(merkmale, 3);
    urteilAnzeigen(ergebnis, ergebnis.confidences || {});
  } catch (fehler) {
    stand(`Urteil nicht möglich: ${fehler.message}`, "fehler");
  } finally {
    merkmale.dispose();
  }
}

function urteilAnzeigen(ergebnis, staerken) {
  els.urteile.textContent = "";
  const gesamt = zustand.klassen.reduce((s, k) => s + k.anzahl, 0);
  zustand.letztesUrteil = ergebnis && zustand.klassen[ergebnis.classIndex]
    ? {
        klasse: zustand.klassen[ergebnis.classIndex].name,
        sicherheit: Math.round((staerken[ergebnis.classIndex] ?? 0) * 100),
        staerken,
        beispiele: gesamt,
      }
    : null;

  zustand.klassen.forEach((klasse, i) => {
    const anteil = Math.round(((staerken[i] ?? staerken[String(i)] ?? 0) * 100));
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
    els.urteilFuss.textContent = "Ohne Beispiele gibt es nichts zu urteilen.";
    return;
  }

  const gewaehlt = zustand.klassen[ergebnis.classIndex];
  const sicherheit = Math.round((staerken[ergebnis.classIndex] ?? 0) * 100);
  els.urteilGross.textContent = gewaehlt ? `„${gewaehlt.name}" — ${sicherheit} %` : "– unsicher –";

  const wenig = zustand.klassen.filter((k) => k.anzahl < EMPFEHLUNG).map((k) => k.name);
  els.urteilFuss.textContent = wenig.length
    ? `Achtung: für ${wenig.join(", ")} liegen weniger als ${EMPFEHLUNG} Beispiele vor. Das Urteil kann kippen, sobald du mehr aufnimmst.`
    : `Das Urteil stützt sich auf ${gesamt} Beispiele. Ein Balken ist keine Wahrheit, sondern eine Ähnlichkeit.`;
}

function urteilStarten() {
  if (urteilLaeuft) return;
  urteilLaeuft = true;
  let letzterLauf = 0;
  const schleife = async (zeit) => {
    if (zeit - letzterLauf > 200 && zustand.quelle && zustand.netz && !zustand.rechnet) {
      letzterLauf = zeit;
      zustand.rechnet = true;
      try { await urteilBerechnen(); } finally { zustand.rechnet = false; }
    }
    requestAnimationFrame(schleife);
  };
  requestAnimationFrame(schleife);
}

// ------------------------------------------------------------------ Sicherung

async function sichern() {
  try {
    const daten = zustand.klassifikator.getClassifierDataset();
    const inhalt = {
      werkzeug: "maschine-lernt",
      fassung: 1,
      gesichert: new Date().toISOString(),
      klassen: zustand.klassen.map((k) => k.name),
      beispiele: {},
    };
    for (const [index, tensor] of Object.entries(daten)) {
      inhalt.beispiele[index] = { form: tensor.shape, werte: Array.from(await tensor.data()) };
    }
    const blob = new Blob([JSON.stringify(inhalt)], { type: "application/json" });
    const adresse = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = adresse;
    a.download = `maschine-lernt-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(adresse);
    els.sicherungHinweis.classList.remove("fehler");
    els.sicherungHinweis.textContent = `Gesichert: ${zustand.klassen.length} Klassen, ${zustand.klassen.reduce((s, k) => s + k.anzahl, 0)} Beispiele.`;
    stand("Modell als Datei gesichert.");
  } catch (fehler) {
    els.sicherungHinweis.classList.add("fehler");
    els.sicherungHinweis.textContent = `Sichern fehlgeschlagen: ${fehler.message}`;
    stand(`Sichern fehlgeschlagen: ${fehler.message}`, "fehler");
  }
}

function laden(datei) {
  if (!datei) return;
  const leser = new FileReader();
  leser.onload = () => {
    try {
      const inhalt = JSON.parse(leser.result);
      if (inhalt.werkzeug !== "maschine-lernt" || !inhalt.beispiele) {
        throw new Error("Das ist keine Sicherung dieses Werkzeugs.");
      }
      const daten = {};
      for (const [index, block] of Object.entries(inhalt.beispiele)) {
        daten[index] = tf.tensor2d(block.werte, block.form);
      }
      zustand.klassifikator.clearAllClasses();
      zustand.klassifikator.setClassifierDataset(daten);
      zustand.klassen = (inhalt.klassen || []).map((name, i) => ({
        name,
        anzahl: inhalt.beispiele[String(i)]?.form?.[0] ?? 0,
      }));
      klassenAnzeigen();
      els.sicherungHinweis.classList.remove("fehler");
      els.sicherungHinweis.textContent = `Geladen: ${zustand.klassen.length} Klassen, gesichert am ${new Date(inhalt.gesichert).toLocaleString("de-DE")}.`;
      stand("Gesichertes Modell geladen.");
    } catch (fehler) {
      els.sicherungHinweis.classList.add("fehler");
      els.sicherungHinweis.textContent = `Laden fehlgeschlagen: ${fehler.message}`;
      stand(`Laden fehlgeschlagen: ${fehler.message}`, "fehler");
    }
  };
  leser.readAsText(datei);
}

// ---------------------------------------------------------------------- Start

async function starten() {
  els.kamera.hidden = true;
  klassenAnzeigen();
  urteilStarten();
  stand(`TensorFlow.js ${tf.version.tfjs} geladen. Rechenweg: ${tf.getBackend()}.`);
  try {
    stand("Bildnetz wird geladen — es liegt bei dieser Seite.");
    zustand.netz = await mobilenet.load({ version: 2, alpha: 1.0, modelUrl: MODELL_PFAD });
    zustand.klassifikator = knnClassifier.create();
    klassenAnzeigen();
    stand("Bereit. Kamera einschalten oder Bilddateien wählen.");
  } catch (fehler) {
    stand(`Das Bildnetz ließ sich nicht laden: ${fehler.message}`, "fehler");
    hinweisQuelle("Ohne Bildnetz kann nicht gelernt werden. Die Dateien unter ./modelle/ fehlen oder sind unvollständig.", "fehler");
  }
}

els.kameraKnopf.addEventListener("click", kameraEinschalten);
els.klasseKnopf.addEventListener("click", klasseHinzufuegen);
els.klasseName.addEventListener("keydown", (e) => { if (e.key === "Enter") klasseHinzufuegen(); });
els.dateiWahl.addEventListener("change", (e) => bilderWaehlen(e.target.files));
els.sichernKnopf.addEventListener("click", sichern);
els.ladenWahl.addEventListener("change", (e) => laden(e.target.files[0]));

// Fuer die Abnahme von aussen lesbar: Zustand, letztes Urteil und die
// Sicherungsfunktionen. Damit laesst sich ohne Handgriffe pruefen, ob Sichern und
// Laden wirklich zusammenpassen.
window.maschineLernt = zustand;
zustand.sichern = sichern;
zustand.laden = laden;
zustand.klasseHinzufuegen = klasseHinzufuegen;
zustand.beispielAufnehmen = beispielAufnehmen;

starten();
