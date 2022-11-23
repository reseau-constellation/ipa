import isArray from "lodash/isArray";

import XLSX from "xlsx";
import path from "path";

import ImportateurFeuilleCalcul from "@/importateur/xlsx.js";

import { dirRessourcesTests } from "@/utilsTests/index.js";

describe("XLSX", function () {
  describe("Importateur XLSX", function () {
    let importateur: ImportateurFeuilleCalcul;

    beforeAll(async () => {
      // Données de https://covid.ourworldindata.org/data/owid-covid-dataon
      const doc = XLSX.readFile(
        path.join(dirRessourcesTests(), "donnéesTest.ods")
      );
      importateur = new ImportateurFeuilleCalcul(doc);
    });

    test("Noms tableaux", async () => {
      const noms = importateur.obtNomsTableaux();
      expect(isArray(noms)).toBe(true);
      expect(noms).toHaveLength(1);
      expect(noms).toEqual(expect.arrayContaining(["Feuille1"]));
    });
    test("Noms colonnes", async () => {
      const cols = importateur.obtColsTableau("Feuille1");
      expect(isArray(cols));
      expect(cols).toHaveLength(2);
      expect(cols).toEqual(
        expect.arrayContaining(["Numérique", "இது உரை ஆகும்"])
      );
    });
    test("Données importées", async () => {
      const données = importateur.obtDonnées("Feuille1", {
        num: "Numérique",
        உரை: "இது உரை ஆகும்",
      });
      expect(données).toEqual([
        { num: 1, உரை: "வணக்கம்" },
        { num: 2, உரை: "Ütz awäch" },
        { num: 3, உரை: "Salut !" },
      ]);
    });
  });
});
