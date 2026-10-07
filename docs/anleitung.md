# Anleitung: Maschine lernt

Für Lehrkräfte, die das Werkzeug zum ersten Mal einsetzen. Rechnen Sie mit
fünf Minuten Vorbereitung und einer Unterrichtsstunde für einen sinnvollen
Durchlauf.

## Was Sie brauchen

- Einen Rechner oder ein Tablet mit **Kamera** und einem heutigen Browser
  (Chrome, Edge, Firefox, Safari).
- Die Kamera gibt der Browser nur über eine **verschlüsselte Verbindung**
  (https) heraus. Über unsere Adresse ist das der Fall. Ohne Kamera können Sie
  auch Bilddateien verwenden — dann brauchen Sie nichts weiter.
- Kein Konto, keine Kennwörter, keine Anmeldung. Es gibt auch nichts einzurichten.

## Zwei Betriebsarten

Ganz oben wählen Sie, **was** gelernt werden soll:

- **Bilder und Dinge** (Voreinstellung): Ein Bildnetz beschreibt das Motiv.
  Geeignet für Gegenstände, Tiere, Formen, Materialien.
- **Haltungen**: Ein Haltungsnetz erkennt 33 Körperpunkte und zeichnet sie ins
  Bild. Geeignet für Bewegungen, Sport, Tanz, „wer steht — wer sitzt".

Jede Betriebsart führt einen **eigenen Lernstand**; beim Umschalten geht nichts
verloren. Eine Sicherung vermerkt, zu welcher Betriebsart sie gehört. Die
Haltungsbetriebe braucht beim ersten Wechsel ein paar Sekunden zum Laden und läuft
auf Rechnern mit Grafikbeschleuniger deutlich flüssiger — die Standzeile nennt den
benutzten Rechenweg. Messwerte, Grenzen und Beispiele: [Haltungen](haltungen.md).

## In fünf Schritten

**1. Bildquelle wählen.** „Kamera einschalten" — der Browser fragt nach der
Erlaubnis, das muss man einmal bestätigen. Alternativ „Bilder wählen" und
Bilddateien vom Gerät auswählen (es gilt die zuletzt gewählte Datei).

**2. Eine Klasse anlegen.** Unter „Neue Klasse" einen Namen eingeben, der die
Sache trifft: „Apfel", „kein Apfel", „Hand", „hinter der Kamera". Die Maschine
kennt keine Wortbedeutung — der Name ist nur für Sie und Ihre Klasse da.

**3. Beispiele aufnehmen.** Objekt in die Kamera halten, „Beispiel aufnehmen"
klicken, die Lage ein wenig verändern, wieder aufnehmen. **Mindestens zehn
Beispiele je Klasse** — darunter warnt die Seite ausdrücklich, und sie hat recht.
Gute Beispiele: dasselbe Objekt aus mehreren Winkeln, mit wechselndem Hintergrund,
wechselndem Licht, aus verschiedener Entfernung.

**4. Urteil lesen.** Immer wenn ein Bild vorliegt, zeigt das Werkzeug Balken je
Klasse mit Prozentwerten und das Gesamturteil. In Klammern hinter jedem
Klassennamen steht, wie viele Beispiele dahinterstehen. Ein Balken ist keine
Wahrheit, sondern eine Ähnlichkeit — genau darum geht es im Unterricht.

**5. Modell sichern.** „Als Datei sichern" legt eine Datei ab (z. B.
`maschine-lernt-2026-10-06.json`). Dieselbe Datei lässt sich auf einem anderen
Gerät wieder laden — die Beispiele sind dann sofort wieder da.

## Was Sie im Blick behalten sollten

- **Unbalancierte Beispiele.** Zwanzig Beispiele für „Apfel", zwei für „kein
  Apfel" — die Maschine antwortet dann fast immer „Apfel". Das ist kein Fehler,
  sondern die Lektion.
- **Zu ähnliche Beispiele.** Zehnmal dasselbe Foto unter demselben Licht bringt
  fast nichts. Abwechslung ist wichtiger als Menge.
- **Der Hintergrund lernt mit.** Wenn links immer die Tafel zu sehen ist, kann
  die Maschine die Tafel gelernt haben statt das Objekt. Das ist der zweite
  wichtige Aha-Moment — prüfen Sie es mit einem anderen Hintergrund.

## Wenn etwas nicht geht

| Was Sie sehen | Was dahintersteckt |
|---|---|
| „Dieser Browser gibt keine Kamera heraus …" | Verbindung nicht verschlüsselt oder Zugriff abgelehnt. Adresse prüfen, Seiteneinstellungen öffnen. |
| „Es wurde keine Kamera gefunden." | Keine Kamera am Gerät oder vom Betriebssystem gesperrt. |
| „Die Kamera ist gerade von einem anderen Programm belegt." | Videokonferenz oder anderes Programm schließen. |
| „Das Bildnetz ließ sich nicht laden" | Schwerwiegend: bitte melden. Normalerweise liegt das Netz bei der Seite. |
| Urteil springt ständig hin und her | Zu wenige oder zu ähnliche Beispiele. Mehr aufnehmen. |
| „Die erkannten Punkte liegen zu schmal beieinander …" | Nur im Haltungsbetrieb: Das Netz hat etwas gefunden, das keine Person ist. Näher an die Kamera treten und den ganzen Körper ins Bild nehmen. |
| Haltungsbetrieb reagiert zäh | Rechner ohne Grafikbeschleuniger. Die Standzeile nennt den Rechenweg (GPU oder CPU). Auf einem Gerät mit Grafikbeschleuniger ist es flüssig. |

Alle Meldungen erscheinen sichtbar auf der Seite — es gibt keine stillen Fehler.
