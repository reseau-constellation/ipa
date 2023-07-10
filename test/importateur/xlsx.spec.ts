import XLSX from "xlsx";

import ImportateurFeuilleCalcul from "@/importateur/xlsx.js";

import { dossierRessourcesTests } from "@/utilsTests/dossiers.js";

import {expect} from "aegir/chai"

describe("XLSX", function () {
  describe("Importateur XLSX", function () {
    let importateur: ImportateurFeuilleCalcul;

    before(async () => {
      const path = await import("path");
      const fs = await import("fs");

      // Données de https://covid.ourworldindata.org/data/owid-covid-dataon
      const données = fs.readFileSync(
        path.join(await dossierRessourcesTests(), "donnéesTest.ods")
      );
      const doc = XLSX.read(données);
      importateur = new ImportateurFeuilleCalcul(doc);
    });

    it("Noms tableaux", async () => {
      const noms = importateur.obtNomsTableaux();
      expect(Array.isArray(noms)).to.be.true();
      expect(noms.length).to.equal(1);
      expect(noms).to.have.members(["Feuille1"]);
    });
    it("Noms colonnes", async () => {
      const cols = importateur.obtColsTableau("Feuille1");
      expect(Array.isArray(cols));
      expect(cols.length).to.equal(2);
      expect(cols).to.have.members(["Numérique", "இது உரை ஆகும்"]);
    });
    it("Données importées", async () => {
      const données = importateur.obtDonnées("Feuille1", {
        num: "Numérique",
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
