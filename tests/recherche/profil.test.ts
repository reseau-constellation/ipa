import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";
import fs from "fs";
import path from "path";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatTexte,
  infoRésultatVide,
} from "@/utils";
import {
  rechercherProfilSelonNom,
  rechercherProfilSelonTexte,
  rechercherProfilSelonActivité,
  rechercherProfilSelonCourriel,
} from "@/recherche/profil";

import { testAPIs, config } from "../sfipTest";
import { générerClients, typesClients, attendreRésultat } from "../utils";

chai.should();
chai.use(chaiAsPromised);

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Rechercher profil", function () {
        this.timeout(config.timeout);

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation;

        before(async () => {
          enregistrerContrôleurs();
          ({ fOublier: fOublierClients, clients } = await générerClients(
            1,
            API,
            type
          ));
          client = clients[0];
        });

        after(async () => {
          if (fOublierClients) await fOublierClients();
        });

        describe("Selon activité", function () {
          let fOublier: schémaFonctionOublier;

          const rés: {ultat: résultatObjectifRecherche<infoRésultatVide> | undefined} = { ultat: undefined};

          before(async () => {
            const fRecherche = rechercherProfilSelonActivité();
            fOublier = await fRecherche(
              client,
              client.profil!.idBd,
              (r) => (rés.ultat = r)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
            await client.profil!.effacerNom("த");
            await client.profil!.effacerImage();
            await client.profil!.effacerCourriel();
          });

          step("Score 0 pour commencer", async () => {
            expect(rés.ultat).to.deep.equal({
              type: "résultat",
              score: 0,
              de: "activité",
              info: { type: "vide" },
            });
          });

          step("On améliore le score en ajoutant notre nom", async () => {
            await client.profil!.sauvegarderNom("த", "ஜூலீஎன்");
            expect(rés.ultat?.score).to.equal(1/3);
          });

          step("Encore mieux avec un courriel", async () => {
            await client.profil!.sauvegarderCourriel("julien.malard@mail.mcgill.ca");
            expect(rés.ultat?.score).to.equal(2/3);
          });
          step("C'est parfait avec un photo !", async () => {
            const IMAGE = fs.readFileSync(
              path.resolve(__dirname, "../_ressources/logo.png")
            );

            await client.profil!.sauvegarderImage(IMAGE);
            await attendreRésultat(rés, "ultat", (x: résultatObjectifRecherche<infoRésultatVide> | undefined) => x?.score === 1)

            expect(rés.ultat?.score).to.equal(1);
          });
        });

        describe("Selon nom", function () {
          let résultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
          let fOublier: schémaFonctionOublier;

          before(async () => {
            const fRecherche = rechercherProfilSelonNom("Julien");
            fOublier = await fRecherche(
              client,
              client.profil!.idBd,
              (r) => (résultat = r)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
            await client.profil!.effacerNom("es");
            await client.profil!.effacerNom("fr");
          });

          step("Rien pour commencer", async () => {
            expect(résultat).to.be.undefined;
          });

          step("Ajout nom détecté", async () => {
            await client.profil!.sauvegarderNom("es", "Julián");

            expect(résultat).to.deep.equal({
              type: "résultat",
              clef: "es",
              score: 0.5,
              de: "nom",
              info: { type: "texte", texte: "Julián", début: 0, fin: 6 },
            });
          });

          step("Meilleur nom détecté", async () => {
            await client.profil!.sauvegarderNom("fr", "Julien");

            expect(résultat).to.deep.equal({
              type: "résultat",
              clef: "fr",
              score: 1,
              de: "nom",
              info: { type: "texte", texte: "Julien", début: 0, fin: 6 },
            });
          });
        });

        describe("Selon courriel", function () {
          let fOublier: schémaFonctionOublier;

          const rés: {ultat: résultatObjectifRecherche<infoRésultatTexte> | undefined} = { ultat: undefined};

          before(async () => {
            const fRecherche = rechercherProfilSelonCourriel("julien");
            fOublier = await fRecherche(
              client,
              client.profil!.idBd,
              (r) => (rés.ultat = r)
            );
          });

          after(async () => {
            if (fOublier) fOublier();
            await client.profil!.effacerCourriel();
          });

          step("Rien pour commencer", async () => {
            expect(rés.ultat).to.be.undefined;
          });

          step("Ajout courriel détecté", async () => {
            await client.profil!.sauvegarderCourriel("julien.malard@mail.mcgill.ca");

            expect(rés.ultat).to.deep.equal({
              type: "résultat",
              score: 1,
              de: "courriel",
              info: { type: "texte", texte: "julien.malard@mail.mcgill.ca", début: 0, fin: 6 },
            });
          });
        });

        describe("Selon texte", function () {
          let résultatCourriel:
            | résultatObjectifRecherche<infoRésultatTexte>
            | undefined;
          let résultatNom:
            | résultatObjectifRecherche<infoRésultatTexte>
            | undefined;

          const fsOublier: schémaFonctionOublier[] = [];

          before(async () => {
            const fRechercheNom = rechercherProfilSelonTexte("Julien Malard");
            fsOublier.push(
              await fRechercheNom(client, client.profil!.idBd, (r) => (résultatNom = r))
            );

            const fRechercherCourriel = rechercherProfilSelonTexte(
              "julien."
            );
            fsOublier.push(
              await fRechercherCourriel(client, client.profil!.idBd, (r) => (résultatCourriel = r))
            );

          });

          after(() => {
            fsOublier.forEach((f) => f());
          });

          step("Rien pour commencer", async () => {
            expect(résultatNom).to.be.undefined;
          });

          step("Ajout nom détecté", async () => {
            await client.profil!.sauvegarderNom("fr", "Julien Malard-Adam")
            expect(résultatNom).to.deep.equal({
              type: "résultat",
              clef: "fr",
              de: "nom",
              info: {
                type: "texte",
                début: 0,
                fin: 13,
                texte: "Julien Malard-Adam",
              },
              score: 1,
            });
            expect(résultatCourriel).to.deep.equal({
              type: "résultat",
              clef: "fr",
              de: "nom",
              info: {
                type: "texte",
                début: 0,
                fin: 7,
                texte: "Julien Malard-Adam",
              },
              score: 1/3,
            });
          });

          it("Ajout courriel détecté", async () => {
            await client.profil!.sauvegarderCourriel("julien.malard@mail.mcgill.ca")
            expect(résultatCourriel).to.deep.equal({
              type: "résultat",
              de: "courriel",
              info: {
                type: "texte",
                début: 0,
                fin: 7,
                texte: "julien.malard@mail.mcgill.ca",
              },
              score: 1,
            });
          });
        });
      });
    });
  });
});
