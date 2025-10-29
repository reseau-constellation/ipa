import { expect } from "aegir/chai";
import { idcEtFichierValide } from "@/v2/epingles.js";

describe("Épingles", function () {
  describe("vérification idc", function () {
    const idc = "bafkreie7ohywtosou76tasm7j63yigtzxe7d5zqus4zu3j6oltvgtibeom";
    it("idc et fichier", async () => {
      const validé = idcEtFichierValide(`${idc}/mon fichier.txt`);
      expect(validé).to.deep.equal({
        idc,
        fichier: "mon fichier.txt",
      });
    });

    it("idc sans fichier", async () => {
      const validé = idcEtFichierValide(idc);
      expect(validé).to.be.false();
    });

    it("idc avec fichier imbriqué", async () => {
      const validé = idcEtFichierValide(`${idc}/mon/fichier.txt`);
      expect(validé).to.deep.equal({
        idc,
        fichier: "mon/fichier.txt",
      });
    });
  });

  describe("orbite", function () {
    it("épingler", async () => {
      throw new Error("à faire");
    });

    it("désépingler", async () => {
      throw new Error("à faire");
    });
  });

  describe("hélia", function () {
    it("épingler", async () => {
      throw new Error("à faire");
    });

    it("désépingler", async () => {
      throw new Error("à faire");
    });
  });

  describe("cycle de vie", function () {
    it("bds fermées après fermeture", async () => {
      throw new Error("à faire");
    });
    it("pas d'erreur si bd non disponible", async () => {
      throw new Error("à faire");
    });
    it("pas d'erreur si idc hélia non disponible", async () => {
      throw new Error("à faire");
    });
  });
});
