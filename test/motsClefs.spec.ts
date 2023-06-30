import pkg from 'lodash';
const { isArray } = pkg;

import { expect } from "aegir/chai";

import type { default as ClientConstellation } from "@/client.js";
import type { schémaFonctionOublier } from "@/utils/index.js";

import { générerClients, typesClients } from "@/utilsTests/client.js";
import { AttendreRésultat } from "@/utilsTests/attente.js";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Mots-clefs", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      before("Préparer clients", async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        client = clients[0];
      });

      after(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("Création", function () {
        let motsClefs: string[];
        let idMotClef: string;
        let fOublier: schémaFonctionOublier;

        before(async () => {
          fOublier = await client.motsClefs!.suivreMotsClefs({
            f: (x) => (motsClefs = x),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });
        it("Pas de mots-clefs pour commencer", async () => {
          expect(isArray(motsClefs)).to.be.true;
          expect(motsClefs.length).to.equal(0);
        });
        it("Créer des mots-clefs", async () => {
          idMotClef = await client.motsClefs!.créerMotClef();
          expect(isArray(motsClefs)).to.be.true;
          expect(motsClefs.length).to.equal(1);
        });
        it("Effacer un mot-clef", async () => {
          await client.motsClefs!.effacerMotClef({ idMotClef });
          expect(isArray(motsClefs)).to.be.true;
          expect(motsClefs.length).to.equal(0);
        });
      });

      describe("Mes mots-clefs", function () {
        let idMotClef: string;
        let mesMotsClefs: string[] = [];
        let fOublier: schémaFonctionOublier;

        before(async () => {
          idMotClef = await client.motsClefs!.créerMotClef();
          fOublier = await client.motsClefs!.suivreMotsClefs({
            f: (mc) => (mesMotsClefs = mc),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
        });

        it("Le mot-clef est déjà ajouté", async () => {
          expect(mesMotsClefs).to.contain(idMotClef);
        });

        it("Enlever de mes mots-clefs", async () => {
          await client.motsClefs!.enleverDeMesMotsClefs({ idMotClef });
          expect(mesMotsClefs).not.to.contain(idMotClef);
        });

        it("Ajouter à mes mots-clefs", async () => {
          await client.motsClefs!.ajouterÀMesMotsClefs({ idMotClef });
          expect(mesMotsClefs).to.contain(idMotClef);
        });
      });

      describe("Noms", function () {
        const rés = new AttendreRésultat<{ [key: string]: string }>();
        let idMotClef: string;
        let fOublier: schémaFonctionOublier;

        before(async () => {
          idMotClef = await client.motsClefs!.créerMotClef();
          fOublier = await client.motsClefs!.suivreNomsMotClef({
            idMotClef,
            f: (n) => rés.mettreÀJour(n),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });

        it("Pas de noms pour commencer", async () => {
          const val = await rés.attendreExiste();
          expect(Object.keys(val).length).to.equal(0);
        });

        it("Ajouter un nom", async () => {
          await client.motsClefs!.sauvegarderNomMotClef({
            idMotClef,
            langue: "fr",
            nom: "Hydrologie",
          });
          const val = await rés.attendreQue((x) => Object.keys(x).length > 0);
          expect(val.fr).to.equal("Hydrologie");
        });

        it("Ajouter des noms", async () => {
          await client.motsClefs!.sauvegarderNomsMotClef({
            idMotClef,
            noms: {
              த: "நீரியல்",
              हिं: "जल विज्ञान",
            },
          });
          await rés.attendreQue((x) => Object.keys(x).length >= 3);
          expect(rés.val).to.deep.equal({
            த: "நீரியல்",
            हिं: "जल विज्ञान",
            fr: "Hydrologie",
          });
        });

        it("Changer un nom", async () => {
          await client.motsClefs!.sauvegarderNomMotClef({
            idMotClef,
            langue: "fr",
            nom: "hydrologie",
          });

          await rés.attendreQue((x) => x["fr"] == "hydrologie");
          expect(rés.val?.fr).to.equal("hydrologie");
        });

        it("Effacer un nom", async () => {
          await client.motsClefs!.effacerNomMotClef({
            idMotClef,
            langue: "fr",
          });
          await rés.attendreQue((x) => !Object.keys(x).includes("fr"));
          expect(rés.val).to.deep.equal({
            த: "நீரியல்",
            हिं: "जल विज्ञान",
          });
        });
      });

      describe("Copier mots-clefs", function () {
        let motsClefs: string[];
        let noms: { [key: string]: string };

        let idMotClef2: string;
        let fOublier: schémaFonctionOublier;
        let fOublier2: schémaFonctionOublier;

        before(async () => {
          fOublier = await client.motsClefs!.suivreMotsClefs({
            f: (x) => (motsClefs = x),
          });

          const idMotClef = await client.motsClefs!.créerMotClef();
          await client.motsClefs!.sauvegarderNomsMotClef({
            idMotClef,
            noms: {
              த: "நீரியல்",
              हिं: "जल विज्ञान",
            },
          });

          idMotClef2 = await client.motsClefs!.copierMotClef({
            idMotClef,
          });
          fOublier2 = await client.motsClefs!.suivreNomsMotClef({
            idMotClef: idMotClef2,
            f: (x) => (noms = x),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
          if (fOublier2) fOublier2();
        });

        it("Le mot-clef est copié", async () => {
          expect(isArray(motsClefs)).to.be.true;
          expect(motsClefs).to.contain(idMotClef2);
        });

        it("Les noms sont copiés", async () => {
          expect(noms).to.deep.equal({ த: "நீரியல்", हिं: "जल विज्ञान" });
        });
      });
    });
  });
});
