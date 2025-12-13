import { expect } from "aegir/chai";
import { isNode, isElectronMain } from "wherearewe";
import { créerConstellationsTest } from "./utils.js";
import type { Résolveur } from "@/v2/nébuleuse/services/favoris.js";
import type { Constellation } from "@/v2/index.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";

describe("Favoris", function () {
  let fermer: () => Promise<void>;
  let constls: Constellation[];
  let constl: Constellation;

  before(async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 1,
    }));
    constl = constls[0];
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("épingler sur dispositifs", function () {
    it("tous", async () => {
      const épinglé = await constl.favoris.estÉpingléSurDispositif({
        dispositifs: "TOUS",
      });
      expect(épinglé).to.be.true();
    });

    it("installés", async () => {
      const épinglé = await constl.favoris.estÉpingléSurDispositif({
        dispositifs: "INSTALLÉ",
      });
      if (isNode || isElectronMain) {
        expect(épinglé).to.be.true();
      } else {
        expect(épinglé).to.be.false();
      }
    });

    it("installé, pour un autre dispositif", async () => {
      const idDispositifAutre = "abc";
      const épinglé = await constl.favoris.estÉpingléSurDispositif({
        dispositifs: "INSTALLÉ",
        idDispositif: idDispositifAutre,
      });
      expect(épinglé).to.be.false();
    });

    it("spécifiques - unique", async () => {
      const idDispositif = await constl.compte.obtIdDispositif();
      const épinglé = await constl.favoris.estÉpingléSurDispositif({
        dispositifs: idDispositif,
      });
      expect(épinglé).to.be.true();
    });

    it("spécifiques - liste", async () => {
      const idDispositif = await constl.compte.obtIdDispositif();
      const épinglé = await constl.favoris.estÉpingléSurDispositif({
        dispositifs: [idDispositif],
      });
      expect(épinglé).to.be.true();
    });
  });

  describe("résolution épingles", function () {
    it("inscrire résolution", async () => {
      const résolution: Résolveur = async ({
        épingle,
        f,
      }): Promise<Oublier> => {};
      await constl.favoris.inscrireRésolution({
        clef: "ma résolution",
        résolution,
      });
      await constl.favoris.épinglerFavori({});
    });

    it("erreur si résolution non inscrite", async () => {
      throw new Error("à faire");
    });

    it("résoudre sous-bds", async () => {
      throw new Error("à faire");
    });

    it("pas d'erreur même si référence circulaire", async () => {
      throw new Error("à faire");
    });
  });

  describe("gestion favoris", function () {
    it("épingler favoris", async () => {
      throw new Error("à faire");
    });
    it("détecter sur autre compte", async () => {
      throw new Error("à faire");
    });
    it("rechercher favoris objet", async () => {
      throw new Error("à faire");
    });
    it("désépingler favoris", async () => {
      throw new Error("à faire");
    });
  });
});
