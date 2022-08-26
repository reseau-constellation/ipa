import fs from "fs";
import path from "path";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import { MAX_TAILLE_IMAGE } from "@/profil";
import { schémaFonctionOublier } from "@/utils";

import {
  générerClients,
  typesClients,
  attendreRésultat,
  dirRessourcesTests,
} from "@/utilsTests";
import { config } from "@/utilsTests/sfipTest";

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
          if (fOublier) fOublier();
        });
      });

      describe("Noms", function () {
        const rés: {
          ultat: { [key: string]: string } | undefined;
        } = { ultat: undefined };
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.profil!.suivreNoms({
            f: (n) => (rés.ultat = n),
          });
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });

        test("Pas de noms pour commencer", async () => {
          await attendreRésultat(rés, "ultat");
          expect(Object.keys(rés.ultat!)).toHaveLength(0);
        });

        test("Ajouter un nom", async () => {
          await client.profil!.sauvegarderNom({
            langue: "fr",
            nom: "Julien Malard-Adam",
          });
          expect(rés.ultat?.fr).toEqual("Julien Malard-Adam");

          await client.profil!.sauvegarderNom({
            langue: "த",
            nom: "ஜூலீஎன்",
          });
          expect(rés.ultat?.த).toEqual("ஜூலீஎன்");
        });

        test("Changer un nom", async () => {
          await client.profil!.sauvegarderNom({
            langue: "த",
            nom: "ம.-ஆதான் ஜூலீஎன்",
          });
          expect(rés.ultat?.த).toEqual("ம.-ஆதான் ஜூலீஎன்");
        });

        test("Effacer un nom", async () => {
          await client.profil!.effacerNom({ langue: "fr" });
          expect(rés.ultat).toEqual({ த: "ம.-ஆதான் ஜூலீஎன்" });
        });
      });

      describe("Images", function () {
        const rés: {
          ultat: Uint8Array | undefined | null;
        } = { ultat: undefined };
        let fOublier: schémaFonctionOublier;

        const IMAGE = fs.readFileSync(
          path.join(dirRessourcesTests(), "logo.svg")
        );

        beforeAll(async () => {
          fOublier = await client.profil!.suivreImage({
            f: (i) => (rés.ultat = i),
          });
        });

        test("Pas d'image pour commencer", async () => {
          expect(rés.ultat).toBeNull;
        });

        test("Ajouter une image", async () => {
          await client.profil!.sauvegarderImage({ image: IMAGE });
          await attendreRésultat(rés, "ultat", (v: unknown) => Boolean(v));
          expect(rés.ultat).toEqual(IMAGE);
        });

        test("Effacer l'image", async () => {
          await client.profil!.effacerImage();
          expect(rés.ultat).toBeNull;
        });

        test("Ajouter une image trop grande", async () => {
          await expect(() =>
            client.profil!.sauvegarderImage({
              image: Object.assign({}, IMAGE, { size: MAX_TAILLE_IMAGE + 1 }),
            })
          ).rejects.toThrow();
        });

        afterAll(async () => {
          if (fOublier) fOublier();
        });
      });
    });
  });
});
