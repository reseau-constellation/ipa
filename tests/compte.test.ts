import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";

import fs from "fs";
import path from "path";

chai.should();
chai.use(chaiAsPromised);

const assert = chai.assert;

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation, { schémaFonctionOublier } from "@/client";
import { MAX_TAILLE_IMAGE } from "@/compte";
import { testAPIs, config } from "./sfipTest";
import { attendreRésultat, générerClients, typesClients } from "./utils";

typesClients.forEach((type)=>{
  describe("Client " + type, function() {
    Object.keys(testAPIs).forEach((API) => {
      describe("Compte", function () {
        this.timeout(config.timeout);

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation

        before(async () => {
          ({ fOublier: fOublierClients, clients } = await générerClients(1, API, type));
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
            fOublier = await client.compte!.suivreCourriel((c) => (courriel = c));
          });

          step("Pas de courriel pour commencer", async () => {
            expect(courriel).to.be.null;
          });

          step("Ajouter un courriel", async () => {
            await client.compte!.sauvegarderCourriel(COURRIEL);
            expect(courriel).to.equal(COURRIEL);
          });

          step("Effacer le courriel", async () => {
            await client.compte!.effacerCourriel();
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
            fOublier = await client.compte!.suivreNoms((n) => (rés["ultat"] = n));
          });

          after(async () => {
            if (fOublier) fOublier();
          });

          step("Pas de noms pour commencer", async () => {
            await attendreRésultat(rés, "ultat");
            expect(rés.ultat).to.be.empty;
          });

          step("Ajouter un nom", async () => {
            await client.compte!.sauvegarderNom("fr", "Julien Malard-Adam");
            expect(rés.ultat?.fr).to.equal("Julien Malard-Adam");

            await client.compte!.sauvegarderNom("த", "ஜூலீஎன்");
            expect(rés.ultat?.த).to.equal("ஜூலீஎன்");
          });

          step("Changer un nom", async () => {
            await client.compte!.sauvegarderNom("த", "ம.-ஆதான் ஜூலீஎன்");
            expect(rés.ultat?.த).to.equal("ம.-ஆதான் ஜூலீஎன்");
          });

          step("Effacer un nom", async () => {
            await client.compte!.effacerNom("fr");
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
            fOublier = await client.compte!.suivreImage((i) => (rés.ultat = i));
          });

          step("Pas d'image pour commencer", async () => {
            expect(rés["ultat"]).to.be.null;
          });

          step("Ajouter une image", async () => {
            await client.compte!.sauvegarderImage(IMAGE);
            await attendreRésultat(rés, "ultat", (v: unknown) => Boolean(v));
            expect(rés.ultat).to.deep.equal(new Uint8Array(IMAGE));
          });

          step("Effacer l'image", async () => {
            await client.compte!.effacerImage();
            expect(rés.ultat).to.be.null;
          });

          step("Ajouter une image trop grande", async () => {
            assert.isRejected(
              client.compte!.sauvegarderImage(
                Object.assign({}, IMAGE, { size: MAX_TAILLE_IMAGE + 1 })
              )
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
