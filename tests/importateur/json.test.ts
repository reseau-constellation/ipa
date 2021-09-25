import { expect } from "chai";
import { step } from "mocha-steps";
import fs from "fs";
import path from "path";

import ImportateurDonnéesJSON, {
  extraireDonnées,
  aplatirDonnées,
  élément,
} from "@/importateur/json";

describe("JSON", function () {
  describe("Extraire données", function () {
    it("Extraire d'objet", () => {
      const donnéesJSON = { a: 1 };
      const données = extraireDonnées(donnéesJSON, ["a"]);
      expect(données).to.equal(1);
    });
    it("Extraire de liste", () => {
      const donnéesJSON = [1, 2, 3];
      const données = extraireDonnées(donnéesJSON, [0]);
      expect(données).to.equal(1);
    });
    it("Extraire récursif", () => {
      const donnéesJSON = [{ a: 1 }, 2, 3];
      const données = extraireDonnées(donnéesJSON, [0, "a"]);
      expect(données).to.equal(1);
    });
    it("Erreur indexe chaîne pour liste", () => {
      const donnéesJSON = [1, 2, 3];
      expect(() => extraireDonnées(donnéesJSON, ["0"])).to.throw;
    });
    it("Erreur indexe numérique pour objet", () => {
      const donnéesJSON = [1, 2, 3];
      expect(() => extraireDonnées(donnéesJSON, ["0"])).to.throw;
    });
    it("Erreur indexer non-élément", () => {
      const donnéesJSON = { a: 1 };
      expect(() => extraireDonnées(donnéesJSON, [0])).to.throw;
    });
  });

  describe("Aplatire données", function () {
    step("Aplatire objet", () => {
      const données = { a: [{ b: 2 }, { b: 3 }, { b: 4 }], c: 1 };

      const aplaties = aplatirDonnées(données, ["a"]);
      expect(aplaties).to.have.deep.members([
        { c: 1, a: { b: 2 } },
        { c: 1, a: { b: 3 } },
        { c: 1, a: { b: 4 } },
      ]);
    });
    step("Aplatire liste", () => {
      const données = [[{ b: 2 }, { b: 3 }, { b: 4 }], { c: 1 }];

      const aplaties = aplatirDonnées(données, [0]);
      expect(aplaties).to.have.deep.members([
        [{ b: 2 }, { c: 1 }],
        [{ b: 3 }, { c: 1 }],
        [{ b: 4 }, { c: 1 }],
      ]);
    });
    step("Aplatire début liste", () => {
      const données = [{ b: 2 }, { b: 3 }, { b: 4 }];

      const aplaties = aplatirDonnées(données);
      expect(aplaties).to.have.deep.members([{ b: 2 }, { b: 3 }, { b: 4 }]);
    });
    step("Aplatire début dict", () => {
      const données = { a: { b: 2 }, b: { b: 3 }, c: { b: 4 } };

      const aplaties = aplatirDonnées(données);
      expect(aplaties).to.have.deep.members([{ b: 2 }, { b: 3 }, { b: 4 }]);
    });
    step("Aplatire dict imbriqué", () => {
      const données = {
        AFG: {
          location: "Afghanistan",
          population: 39835428.0,
          data: [
            {
              date: "2020-02-24",
              new_cases: 5.0,
            },
            {
              date: "2020-02-25",
              new_cases: 0.0,
            },
          ],
        },
        OWID_AFR: {
          location: "Africa",
          population: 1373486472.0,
          data: [
            {
              date: "2020-02-13",
              new_cases: 0.0,
            },
            {
              date: "2020-02-14",
              new_cases: 1.0,
            },
          ],
        },
      };

      const aplaties = aplatirDonnées(données, [null, "data"]);
      expect(aplaties).to.have.deep.members([
        {
          location: "Afghanistan",
          population: 39835428.0,
          data: {
            date: "2020-02-24",
            new_cases: 5.0,
          },
        },
        {
          location: "Afghanistan",
          population: 39835428.0,
          data: {
            date: "2020-02-25",
            new_cases: 0.0,
          },
        },
        {
          location: "Africa",
          population: 1373486472.0,
          data: {
            date: "2020-02-13",
            new_cases: 0.0,
          },
        },
        {
          location: "Africa",
          population: 1373486472.0,
          data: {
            date: "2020-02-14",
            new_cases: 1.0,
          },
        },
      ]);
    });
  });

  describe("Importateur JSON", function () {
    let données: élément[];

    before(async () => {
      //Données de https://covid.ourworldindata.org/data/owid-covid-data.json
      const donnéesJSON = JSON.parse(
        (
          await fs.promises.readFile(
            path.resolve(__dirname, "../_ressources/donnéesTest.json")
          )
        ).toString()
      );
      const importateur = new ImportateurDonnéesJSON({
        "mes données": { "sont ici": [donnéesJSON] },
      });
      données = importateur.obtDonnées(
        ["mes données", "sont ici", 0],
        [null, "data"],
        {
          région: ["location"],
          date: ["data", "date"],
          nouveauxCas: ["data", "new_cases"],
          totalCas: ["data", "total_cases"],
          nouveauxVaccinés: ["data", "new_vaccinations"],
        }
      );
    });

    step("Données importées", async () => {
      expect(données).to.be.an("array").that.is.not.empty;
      expect(données[0]).to.have.keys([
        "région",
        "date",
        "nouveauxCas",
        "totalCas",
      ]);
    });
  });
});
