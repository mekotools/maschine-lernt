import { defineConfig } from "vite";

// base: "./" ist Absicht.
// Statische Werkzeuge, die unter einem Unterpfad ausgeliefert werden, laden ihre
// eigenen Dateien sonst unter "/" und laufen ins Leere. Relative Pfade tragen
// sowohl an der Wurzel als auch unter /lernkamera/.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
  },
});
