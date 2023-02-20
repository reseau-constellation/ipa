import isArray from "lodash/isArray";

import { enregistrerContrôleurs } from "@/accès/index.js";
import type { default as ClientConstellation } from "@/client.js";
import type { schémaFonctionOublier } from "@/utils/index.js";

import {
  générerClients,
  typesClients,
} from "@/utilsTests/client.js";
import {
  AttendreRésultat,
} from "@/utilsTests/attente.js";

import { config } from "@/utilsTests/sfip.js";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Mots-clefs", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      beforeAll(async () => {
        enregistrerContrôleurs();
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        client = clients[0];
      }, config.patienceInit);

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("Création", function () {
        let motsClefs: string[];
        let idMotClef: string;
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.motsClefs!.suivreMotsClefs({
            f: (x) => (motsClefs = x),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
        });
        test("Pas de mots-clefs pour commencer", async () => {
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(0);
        });
        test("Créer des mots-clefs", async () => {
          idMotClef = await client.motsClefs!.créerMotClef();
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(1);
        });
        test("Effacer un mot-clef", async () => {
          await client.motsClefs!.effacerMotClef({ id: idMotClef });
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(0);
        });
      });

      describe("Mes mots-clefs", function () {
        let idMotClef: string;
        let mesMotsClefs: string[] = [];
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          idMotClef = await client.motsClefs!.créerMotClef();
          fOublier = await client.motsClefs!.suivreMotsClefs({
            f: (mc) => (mesMotsClefs = mc),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
        });

        test("Le mot-clef est déjà ajouté", async () => {
          expect(mesMotsClefs).toContain(idMotClef);
        });

        test("Enlever de mes mots-clefs", async () => {
          await client.motsClefs!.enleverDeMesMotsClefs({ id: idMotClef });
          expect(mesMotsClefs).not.toContain(idMotClef);
        });

        test("Ajouter à mes mots-clefs", async () => {
          await client.motsClefs!.ajouterÀMesMotsClefs({ id: idMotClef });
          expect(mesMotsClefs).toContain(idMotClef);
        });
      });

      describe("Noms", function () {
        const rés = new AttendreRésultat<{ [key: string]: string }>();
        let idMotClef: string;
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          idMotClef = await client.motsClefs!.créerMotClef();
          fOublier = await client.motsClefs!.suivreNomsMotClef({
            id: idMotClef,
            f: (n) => rés.mettreÀJour(n),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });

        test("Pas de noms pour commencer", async () => {
          const val = await rés.attendreExiste();
          expect(Object.keys(val)).toHaveLength(0);
        });

        test("Ajouter un nom", async () => {
          await client.motsClefs!.sauvegarderNomMotClef({
            id: idMotClef,
            langue: "fr",
            nom: "Hydrologie",
          });
          const val = await rés.attendreQue((x) => Object.keys(x).length > 0);
          expect(val.fr).toEqual("Hydrologie");
        });

        test("Ajouter des noms", async () => {
          await client.motsClefs!.ajouterNomsMotClef({
            id: idMotClef,
            noms: {
              த: "நீரியல்",
              हिं: "जल विज्ञान",
            },
          });
          await rés.attendreQue((x) => Object.keys(x).length >= 3);
          expect(rés.val).toEqual({
            த: "நீரியல்",
            हिं: "जल विज्ञान",
            fr: "Hydrologie",
          });
        });

        test("Changer un nom", async () => {
          await client.motsClefs!.sauvegarderNomMotClef({
            id: idMotClef,
            langue: "fr",
            nom: "hydrologie",
          });

          await rés.attendreQue((x) => x["fr"] == "hydrologie");
          expect(rés.val?.fr).toEqual("hydrologie");
        });

        test("Effacer un nom", async () => {
          await client.motsClefs!.effacerNomMotClef({
            id: idMotClef,
            langue: "fr",
          });
          await rés.attendreQue((x) => !Object.keys(x).includes("fr"));
          expect(rés.val).toEqual({
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

        beforeAll(async () => {
          fOublier = await client.motsClefs!.suivreMotsClefs({
            f: (x) => (motsClefs = x),
          });

          const idMotClef = await client.motsClefs!.créerMotClef();
          await client.motsClefs!.ajouterNomsMotClef({
            id: idMotClef,
            noms: {
              த: "நீரியல்",
              हिं: "जल विज्ञान",
            },
          });

          idMotClef2 = await client.motsClefs!.copierMotClef({
            id: idMotClef,
          });
          fOublier2 = await client.motsClefs!.suivreNomsMotClef({
            id: idMotClef2,
            f: (x) => (noms = x),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
          if (fOublier2) fOublier2();
        });

        test("Le mot-clef est copié", async () => {
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toContain(idMotClef2);
        });

        test("Les noms sont copiés", async () => {
          expect(noms).toEqual({ த: "நீரியல்", हिं: "जल विज्ञान" });
        });
      });
    });
  });
});
