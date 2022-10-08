import fs from "fs";
import path from "path";

import ClientConstellation from "@/client.js";
import {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatTexte,
  infoRésultatVide,
} from "@/utils/index.js";
import {
  rechercherProfilSelonNom,
  rechercherProfilSelonTexte,
  rechercherProfilSelonActivité,
  rechercherProfilSelonCourriel,
} from "@/recherche/profil";

import {
  générerClients,
  typesClients,
  attendreRésultat,
  dirRessourcesTests,
} from "@/utilsTests";
import { config } from "@/utilsTests/sfipTest";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Rechercher profil", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      beforeAll(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        client = clients[0];
      }, config.patienceInit);

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
            client.idBdCompte!,
            (r) => (rés.ultat = r)
          );
        });

        afterAll(async () => {
          if (fOublier) fOublier();
          await client.profil!.effacerNom({ langue: "த" });
          await client.profil!.effacerImage();
          await client.profil!.effacerCourriel();
        });

        test("Score 0 pour commencer", async () => {
          expect(rés.ultat).toEqual({
            type: "résultat",
            score: 0,
            de: "activité",
            info: { type: "vide" },
          });
        });

        test("On améliore le score en ajoutant notre nom", async () => {
          await client.profil!.sauvegarderNom({ langue: "த", nom: "ஜூலீஎன்" });
          await attendreRésultat(rés, "ultat", (x) => !!x && x.score > 0);
          expect(rés.ultat?.score).toEqual(1 / 3);
        });

        test("Encore mieux avec un courriel", async () => {
          await client.profil!.sauvegarderCourriel({
            courriel: "julien.malard@mail.mcgill.ca",
          });
          await attendreRésultat(rés, "ultat", (x) => !!x && x.score > 1 / 3);
          expect(rés.ultat?.score).toEqual(2 / 3);
        });

        test("C'est parfait avec un photo !", async () => {
          const IMAGE = fs.readFileSync(
            path.join(dirRessourcesTests(), "logo.png")
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
            client.idBdCompte!,
            (r) => (rés.ultat = r)
          );
        });

        afterAll(async () => {
          if (fOublier) fOublier();
          await client.profil!.effacerNom({ langue: "es" });
          await client.profil!.effacerNom({ langue: "fr" });
        });

        test("Rien pour commencer", async () => {
          expect(rés.ultat).toBeUndefined;
        });

        test("Ajout nom détecté", async () => {
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

        test("Meilleur nom détecté", async () => {
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
            client.idBdCompte!,
            (r) => (rés.ultat = r)
          );
        });

        afterAll(async () => {
          if (fOublier) fOublier();
          await client.profil!.effacerCourriel();
        });

        test("Rien pour commencer", async () => {
          expect(rés.ultat).toBeUndefined;
        });

        test("Ajout courriel détecté", async () => {
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
        const fsOublier: schémaFonctionOublier[] = [];
        const résultat: {
          nom?: résultatObjectifRecherche<infoRésultatTexte>;
          courriel?: résultatObjectifRecherche<infoRésultatTexte>;
        } = {};

        beforeAll(async () => {
          const fRechercheNom = rechercherProfilSelonTexte("Julien Malard");
          fsOublier.push(
            await fRechercheNom(
              client,
              client.idBdCompte!,
              (r) => (résultat.nom = r)
            )
          );

          const fRechercherCourriel = rechercherProfilSelonTexte("julien.");
          fsOublier.push(
            await fRechercherCourriel(
              client,
              client.idBdCompte!,
              (r) => (résultat.courriel = r)
            )
          );
        });

        afterAll(() => {
          fsOublier.forEach((f) => f());
        });

        test("Rien pour commencer", async () => {
          expect(résultat.nom).toBeUndefined;
          expect(résultat.courriel).toBeUndefined;
        });

        test("Ajout nom détecté", async () => {
          await client.profil!.sauvegarderNom({
            langue: "fr",
            nom: "Julien Malard-Adam",
          });
          await attendreRésultat(résultat, "nom");
          expect(résultat.nom).toEqual({
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

          await attendreRésultat(résultat, "courriel");
          expect(résultat.courriel).toEqual({
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

        test("Ajout courriel détecté", async () => {
          await client.profil!.sauvegarderCourriel({
            courriel: "julien.malard@mail.mcgill.ca",
          });

          await attendreRésultat(résultat, "courriel", (x) =>
            Boolean(x && x.score > 1 / 3)
          );
          expect(résultat.courriel).toEqual({
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
