import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";

import fs from "fs";
import path from "path";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import { MAX_TAILLE_IMAGE } from "@/profil";
import { schémaFonctionOublier } from "@/utils";
import { testAPIs, config } from "./sfipTest";
import { attendreRésultat, générerClients, typesClients } from "./utils";

chai.should();
chai.use(chaiAsPromised);

const assert = chai.assert;

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Profil", function () {
        this.timeout(config.timeout);

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation;

        before(async () => {
          ({ fOublier: fOublierClients, clients } = await générerClients(
            1,
            API,
            type
          ));
          [client] = clients;

          enregistrerContrôleurs();
        });

        after(async () => {
          if (fOublierClients) await fOublierClients();
        });

        describe("Courriels", function () {
          let courriel: string | null;
          let fOublier: schémaFonctionOublier;

          const COURRIEL = "தொடர்பு@லஸ்ஸி.இந்தியா";

          before(async () => {
            fOublier = await client.profil!.suivreCourriel({
              f: (c) => (courriel = c),
            });
          });

          step("Pas de courriel pour commencer", async () => {
            expect(courriel).to.be.null;
          });

          step("Ajouter un courriel", async () => {
            await client.profil!.sauvegarderCourriel({ courriel: COURRIEL });
            expect(courriel).to.equal(COURRIEL);
          });

          step("Effacer le courriel", async () => {
            await client.profil!.effacerCourriel();
            expect(courriel).to.be.null;
          });

          after(async () => {
            if (fOublier) fOublier();
          });
        });

        describe("Noms", function () {
          const rés: {
            ultat: { [key: string]: string } | undefined;
          } = { ultat: undefined };
          let fOublier: schémaFonctionOublier;

          before(async () => {
            fOublier = await client.profil!.suivreNoms({
              f: (n) => (rés.ultat = n),
            });
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Pas de noms pour commencer", async () => {
            await attendreRésultat(rés, "ultat");
            expect(rés.ultat).to.be.empty;
          });

          step("Ajouter un nom", async () => {
            await client.profil!.sauvegarderNom({
              langue: "fr",
              nom: "Julien Malard-Adam",
            });
            expect(rés.ultat?.fr).to.equal("Julien Malard-Adam");

            await client.profil!.sauvegarderNom({
              langue: "த",
              nom: "ஜூலீஎன்",
            });
            expect(rés.ultat?.த).to.equal("ஜூலீஎன்");
          });

          step("Changer un nom", async () => {
            await client.profil!.sauvegarderNom({
              langue: "த",
              nom: "ம.-ஆதான் ஜூலீஎன்",
            });
            expect(rés.ultat?.த).to.equal("ம.-ஆதான் ஜூலீஎன்");
          });

          step("Effacer un nom", async () => {
            await client.profil!.effacerNom({ langue: "fr" });
            expect(rés.ultat).to.deep.equal({ த: "ம.-ஆதான் ஜூலீஎன்" });
          });
        });

        describe("Images", function () {
          const rés: {
            ultat: Uint8Array | undefined | null;
          } = { ultat: undefined };
          let fOublier: schémaFonctionOublier;

          const IMAGE = fs.readFileSync(
            path.resolve(__dirname, "_ressources/logo.svg")
          );

          before(async () => {
            fOublier = await client.profil!.suivreImage({
              f: (i) => (rés.ultat = i),
            });
          });

          step("Pas d'image pour commencer", async () => {
            expect(rés.ultat).to.be.null;
          });

          step("Ajouter une image", async () => {
            await client.profil!.sauvegarderImage({ image: IMAGE });
            await attendreRésultat(rés, "ultat", (v: unknown) => Boolean(v));
            expect(rés.ultat).to.deep.equal(new Uint8Array(IMAGE));
          });

          step("Effacer l'image", async () => {
            await client.profil!.effacerImage();
            expect(rés.ultat).to.be.null;
          });

          step("Ajouter une image trop grande", async () => {
            assert.isRejected(
              client.profil!.sauvegarderImage({
                image: Object.assign({}, IMAGE, { size: MAX_TAILLE_IMAGE + 1 }),
              })
            );
          });

          after(async () => {
            if (fOublier) fOublier();
          });
        });
      });
    });
  });
});
