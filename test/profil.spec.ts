import fs from "fs";
import path from "path";

import type { default as ClientConstellation } from "@/client.js";
import { MAX_TAILLE_IMAGE } from "@/profil.js";
import type { schémaFonctionOublier } from "@/utils/index.js";

import { générerClients, typesClients } from "@/utilsTests/client.js";
import { AttendreRésultat } from "@/utilsTests/attente.js";
import { dossierRessourcesTests } from "@/utilsTests/dossiers.js";

import {expect} from "aegir/chai";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Profil", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      before(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        [client] = clients;
      });

      after(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe.only("Courriels", function () {
        let fOublier: schémaFonctionOublier;
        
        const résultatCourriel = new AttendreRésultat<string | null>();
        const COURRIEL = "தொடர்பு@லஸ்ஸி.இந்தியா";

        before(async () => {
          fOublier = await client.profil!.suivreCourriel({
            f: (c) => (résultatCourriel.mettreÀJour(c)),
          });
        });
        
        it("Pas de courriel pour commencer", async () => {
          const courriel = await résultatCourriel.attendreQue(c => c !== undefined)
          expect(courriel).to.be.null();
        });

        it("Ajouter un courriel", async () => {
          await client.profil!.sauvegarderCourriel({ courriel: COURRIEL });
          const courriel = await résultatCourriel.attendreExiste();
          expect(courriel).to.equal(COURRIEL);
        });

        it("Effacer le courriel", async () => {
          await client.profil!.effacerCourriel();
          const courriel = await résultatCourriel.attendreQue(c => !c)
          expect(courriel).to.be.null();
        });

        after(async () => {
          if (fOublier) await fOublier();
        });
      });

      describe("Noms", function () {
        const rés = new AttendreRésultat<{ [key: string]: string }>();
        let fOublier: schémaFonctionOublier;

        before(async () => {
          fOublier = await client.profil!.suivreNoms({
            f: (n) => rés.mettreÀJour(n),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });

        it("Pas de noms pour commencer", async () => {
          const val = await rés.attendreExiste();
          expect(Object.keys(val)).to.be.empty();
        });

        it("Ajouter un nom", async () => {
          await client.profil!.sauvegarderNom({
            langue: "fr",
            nom: "Julien Malard-Adam",
          });
          const val = await rés.attendreQue((x) => Object.keys(x).length > 0);
          expect(val.fr).to.equal("Julien Malard-Adam");

          await client.profil!.sauvegarderNom({
            langue: "த",
            nom: "ஜூலீஎன்",
          });
          const val2 = await rés.attendreQue((x) => Object.keys(x).length > 1);
          expect(val2.த).to.equal("ஜூலீஎன்");
        });

        it("Changer un nom", async () => {
          await client.profil!.sauvegarderNom({
            langue: "த",
            nom: "ம.-ஆதான் ஜூலீஎன்",
          });
          const val = await rés.attendreQue((x) => x.த !== "ஜூலீஎன்");
          expect(val.த).to.equal("ம.-ஆதான் ஜூலீஎன்");
        });

        it("Effacer un nom", async () => {
          await client.profil!.effacerNom({ langue: "fr" });
          const val = await rés.attendreQue((x) => Object.keys(x).length <= 1);
          expect(val).to.deep.equal({ த: "ம.-ஆதான் ஜூலீஎன்" });
        });
      });

      describe("Images", function () {
        const rés = new AttendreRésultat<Uint8Array | null>();

        let fOublier: schémaFonctionOublier;

        let IMAGE: Uint8Array;

        before(async () => {
          IMAGE = fs.readFileSync(
            path.join(await dossierRessourcesTests(), "logo.svg")
          );
        });

        before(async () => {
          fOublier = await client.profil!.suivreImage({
            f: (i) => rés.mettreÀJour(i),
          });
        });

        after(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });

        it("Pas d'image pour commencer", async () => {
          const val = await rés.attendreQue((x) => x === null);
          expect(val).to.be.null();
        });

        it("Ajouter une image", async () => {
          await client.profil!.sauvegarderImage({ image: IMAGE });
          const val = await rés.attendreExiste();
          expect(val).to.equal(new Uint8Array(IMAGE));
        });

        it("Effacer l'image", async () => {
          await client.profil!.effacerImage();
          const val = await rés.attendreQue((x) => x === null);
          expect(val).to.be.null();
        });

        it("Ajouter une image trop grande", async () => {
          expect(
            client.profil!.sauvegarderImage({
              image: Object.assign({}, IMAGE, { size: MAX_TAILLE_IMAGE + 1 }),
            })
          ).to.be.rejected();
        });
      });
    });
  });
});
