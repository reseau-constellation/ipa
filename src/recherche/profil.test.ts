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


import { générerClients, typesClients } from "@/utilsTests";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Rechercher profil", function () {
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
      });

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
      });

      describe("Selon activité", function () {
        let fOublier: schémaFonctionOublier;

        const rés: {
          ultat: résultatObjectifRecherche<infoRésultatVide> | undefined;
        } = { ultat: undefined };

        beforeAll(async () => {
          const fRecherche = rechercherProfilSelonActivité();
          fOublier = await fRecherche(
            client,
            client.profil!.idBd,
            (r) => (rés.ultat = r)
          );
        });

        afterAll(async () => {
          if (fOublier) fOublier();
          await client.profil!.effacerNom({ langue: "த" });
          await client.profil!.effacerImage();
          await client.profil!.effacerCourriel();
        });

        step("Score 0 pour commencer", async () => {
          expect(rés.ultat).toEqual({
            type: "résultat",
            score: 0,
            de: "activité",
            info: { type: "vide" },
          });
        });

        step("On améliore le score en ajoutant notre nom", async () => {
          await client.profil!.sauvegarderNom({ langue: "த", nom: "ஜூலீஎன்" });
          await attendreRésultat(rés, "ultat", (x) => !!x && x.score > 0);
          expect(rés.ultat?.score).toEqual(1 / 3);
        });

        step("Encore mieux avec un courriel", async () => {
          await client.profil!.sauvegarderCourriel({
            courriel: "julien.malard@mail.mcgill.ca",
          });
          await attendreRésultat(rés, "ultat", (x) => !!x && x.score > 1 / 3);
          expect(rés.ultat?.score).toEqual(2 / 3);
        });
        step("C'est parfait avec un photo !", async () => {
          const IMAGE = fs.readFileSync(
            path.resolve(path.dirname(""), "tests/_ressources/logo.png")
          );

          await client.profil!.sauvegarderImage({ image: IMAGE });
          await attendreRésultat(
            rés,
            "ultat",
            (x: résultatObjectifRecherche<infoRésultatVide> | undefined) =>
              x?.score === 1
          );

          expect(rés.ultat?.score).toEqual(1);
        });
      });

      describe("Selon nom", function () {
        let fOublier: schémaFonctionOublier;

        const rés: {
          ultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
        } = { ultat: undefined };

        beforeAll(async () => {
          const fRecherche = rechercherProfilSelonNom("Julien");
          fOublier = await fRecherche(
            client,
            client.profil!.idBd,
            (r) => (rés.ultat = r)
          );
        });

        afterAll(async () => {
          if (fOublier) fOublier();
          await client.profil!.effacerNom({ langue: "es" });
          await client.profil!.effacerNom({ langue: "fr" });
        });

        step("Rien pour commencer", async () => {
          expect(rés.ultat).toBeUndefined;
        });

        step("Ajout nom détecté", async () => {
          await client.profil!.sauvegarderNom({ langue: "es", nom: "Julián" });
          await attendreRésultat(rés, "ultat", (x) => !!x && x.score > 0);

          expect(rés.ultat).toEqual({
            type: "résultat",
            clef: "es",
            score: 0.5,
            de: "nom",
            info: { type: "texte", texte: "Julián", début: 0, fin: 6 },
          });
        });

        step("Meilleur nom détecté", async () => {
          await client.profil!.sauvegarderNom({ langue: "fr", nom: "Julien" });
          await attendreRésultat(rés, "ultat", (x) => !!x && x.score > 0.5);

          expect(rés.ultat).toEqual({
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

        const rés: {
          ultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
        } = { ultat: undefined };

        beforeAll(async () => {
          const fRecherche = rechercherProfilSelonCourriel("julien");
          fOublier = await fRecherche(
            client,
            client.profil!.idBd,
            (r) => (rés.ultat = r)
          );
        });

        afterAll(async () => {
          if (fOublier) fOublier();
          await client.profil!.effacerCourriel();
        });

        step("Rien pour commencer", async () => {
          expect(rés.ultat).toBeUndefined;
        });

        step("Ajout courriel détecté", async () => {
          await client.profil!.sauvegarderCourriel({
            courriel: "julien.malard@mail.mcgill.ca",
          });

          await attendreRésultat(rés, "ultat", (x) => !!x && x.score > 0);

          expect(rés.ultat).toEqual({
            type: "résultat",
            score: 1,
            de: "courriel",
            info: {
              type: "texte",
              texte: "julien.malard@mail.mcgill.ca",
              début: 0,
              fin: 6,
            },
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

        beforeAll(async () => {
          const fRechercheNom = rechercherProfilSelonTexte("Julien Malard");
          fsOublier.push(
            await fRechercheNom(
              client,
              client.profil!.idBd,
              (r) => (résultatNom = r)
            )
          );

          const fRechercherCourriel = rechercherProfilSelonTexte("julien.");
          fsOublier.push(
            await fRechercherCourriel(
              client,
              client.profil!.idBd,
              (r) => (résultatCourriel = r)
            )
          );
        });

        afterAll(() => {
          fsOublier.forEach((f) => f());
        });

        step("Rien pour commencer", async () => {
          expect(résultatNom).toBeUndefined;
        });

        step("Ajout nom détecté", async () => {
          await client.profil!.sauvegarderNom({
            langue: "fr",
            nom: "Julien Malard-Adam",
          });
          expect(résultatNom).toEqual({
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
          expect(résultatCourriel).toEqual({
            type: "résultat",
            clef: "fr",
            de: "nom",
            info: {
              type: "texte",
              début: 0,
              fin: 7,
              texte: "Julien Malard-Adam",
            },
            score: 1 / 3,
          });
        });

        it("Ajout courriel détecté", async () => {
          await client.profil!.sauvegarderCourriel({
            courriel: "julien.malard@mail.mcgill.ca",
          });
          expect(résultatCourriel).toEqual({
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
