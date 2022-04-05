import { expect } from "chai";
import { step } from "mocha-steps";
import XLSX from "xlsx";
import path from "path";

import ImportateurFeuilleCalcul from "@/importateur/xlsx";

describe("XLSX", function () {
  describe("Importateur XLSX", function () {
    let importateur: ImportateurFeuilleCalcul;

    before(async () => {
      // Données de https://covid.ourworldindata.org/data/owid-covid-data.json
      const doc = XLSX.readFile(
        path.resolve(__dirname, "../_ressources/donnéesTest.ods")
      );
      importateur = new ImportateurFeuilleCalcul(doc);
    });

    step("Noms tableaux", async () => {
      const noms = importateur.obtNomsTableaux();
      expect(noms).to.be.an("array").with.length(1).and.members(["Feuille1"]);
    });
    step("Noms colonnes", async () => {
      const cols = importateur.obtColsTableau("Feuille1");
      expect(cols)
        .to.be.an("array")
        .with.length(2)
        .and.members(["Numérique", "இது உரை ஆகும்"]);
    });
    step("Données importées", async () => {
      const données = importateur.obtDonnées("Feuille1", {
        Numérique: "num",
        உரை: "இது உரை ஆகும்",
      });
      expect(données).to.have.deep.members([
        { num: 1, உரை: "வணக்கம்" },
        { num: 2, உரை: "Ütz awäch" },
        { num: 3, உரை: "Salut !" },
      ]);
    });
  });
});
