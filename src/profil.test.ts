import fs from "fs";
import path from "path";

import { enregistrerContrôleurs } from "@/accès/index.js";
import type { default as ClientConstellation } from "@/client.js";
import { MAX_TAILLE_IMAGE } from "@/profil.js";
import type { schémaFonctionOublier } from "@/utils/index.js";

import {
  générerClients,
  typesClients,
  AttendreRésultat,
  dirRessourcesTests,
} from "@/utilsTests/index.js";
import { config } from "@/utilsTests/sfipTest.js";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Profil", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      beforeAll(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        [client] = clients;

        enregistrerContrôleurs();
      }, config.patienceInit);

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("Courriels", function () {
        let courriel: string | null;
        let fOublier: schémaFonctionOublier;

        const COURRIEL = "தொடர்பு@லஸ்ஸி.இந்தியா";

        beforeAll(async () => {
          fOublier = await client.profil!.suivreCourriel({
            f: (c) => (courriel = c),
          });
        });

        test("Pas de courriel pour commencer", async () => {
          expect(courriel).toBeNull;
        });

        test("Ajouter un courriel", async () => {
          await client.profil!.sauvegarderCourriel({ courriel: COURRIEL });
          expect(courriel).toEqual(COURRIEL);
        });

        test("Effacer le courriel", async () => {
          await client.profil!.effacerCourriel();
          expect(courriel).toBeNull;
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
        });
      });

      describe("Noms", function () {
        const rés = new AttendreRésultat<{ [key: string]: string }>();
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.profil!.suivreNoms({
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
          await client.profil!.sauvegarderNom({
            langue: "fr",
            nom: "Julien Malard-Adam",
          });
          await rés.attendreQue((x) => Object.keys(x).length > 0);
          expect(rés.val.fr).toEqual("Julien Malard-Adam");

          await client.profil!.sauvegarderNom({
            langue: "த",
            nom: "ஜூலீஎன்",
          });
          await rés.attendreQue((x) => Object.keys(x).length > 1);
          expect(rés.val.த).toEqual("ஜூலீஎன்");
        });

        test("Changer un nom", async () => {
          await client.profil!.sauvegarderNom({
            langue: "த",
            nom: "ம.-ஆதான் ஜூலீஎன்",
          });
          const val = await rés.attendreQue((x) => x.த !== "ஜூலீஎன்");
          expect(val.த).toEqual("ம.-ஆதான் ஜூலீஎன்");
        });

        test("Effacer un nom", async () => {
          await client.profil!.effacerNom({ langue: "fr" });
          const val = await rés.attendreQue((x) => Object.keys(x).length <= 1);
          expect(val).toEqual({ த: "ம.-ஆதான் ஜூலீஎன்" });
        });
      });

      describe("Images", function () {
        const rés = new AttendreRésultat<Uint8Array | null>();

        let fOublier: schémaFonctionOublier;

        const IMAGE = new Uint8Array(
          fs.readFileSync(path.join(dirRessourcesTests(), "logo.svg")).buffer
        );

        beforeAll(async () => {
          fOublier = await client.profil!.suivreImage({
            f: (i) => rés.mettreÀJour(i),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });

        test("Pas d'image pour commencer", async () => {
          const val = await rés.attendreQue((x) => x === null);
          expect(val).toBeNull;
        });

        test("Ajouter une image", async () => {
          await client.profil!.sauvegarderImage({ image: IMAGE });
          const val = await rés.attendreExiste();
          expect(val).toEqual(IMAGE);
        });

        test("Effacer l'image", async () => {
          await client.profil!.effacerImage();
          const val = await rés.attendreQue((x) => x === null);
          expect(val).toBeNull;
        });

        test("Ajouter une image trop grande", async () => {
          await expect(() =>
            client.profil!.sauvegarderImage({
              image: Object.assign({}, IMAGE, { size: MAX_TAILLE_IMAGE + 1 }),
            })
          ).rejects.toThrow();
        });
      });
    });
  });
});
