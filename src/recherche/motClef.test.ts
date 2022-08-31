import { enregistrerContrôleurs } from "@/accès/index.js";
import ClientConstellation from "@/client.js";
import {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatTexte,
} from "@/utils/index.js";
import {
  rechercherMotClefSelonNom,
  rechercherMotClefSelonTexte,
} from "@/recherche/motClef.js";

import { générerClients, typesClients } from "@/utilsTests/index.js";

import { config } from "@/utilsTests/sfipTest.js";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("Rechercher mots clefs", function () {
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

      describe("Selon nom", function () {
        let idMotClef: string;
        let résultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          idMotClef = await client.motsClefs!.créerMotClef();

          const fRecherche = rechercherMotClefSelonNom("hydrologie");
          fOublier = await fRecherche(client, idMotClef, (r) => (résultat = r));
        }, config.timeout);

        afterAll(() => {
          if (fOublier) fOublier();
        });

        test("Pas de résultat quand le mot-clef n'a pas de nom", async () => {
          expect(résultat).toBeUndefined;
        });
        test("Pas de résultat si le mot-clef n'a vraiment rien à voir", async () => {
          await client.motsClefs!.ajouterNomsMotClef({
            id: idMotClef,
            noms: {
              த: "நீரியல்",
            },
          });
          expect(résultat).toBeUndefined;
        });
        test("Résultat si le mot-clef est presque exacte", async () => {
          await client.motsClefs!.ajouterNomsMotClef({
            id: idMotClef,
            noms: {
              fr: "Sciences hydrologiques",
            },
          });

          expect(résultat).toEqual({
            type: "résultat",
            clef: "fr",
            de: "nom",
            info: {
              type: "texte",
              début: 9,
              fin: 19,
              texte: "Sciences hydrologiques",
            },
            score: 0.5,
          });
        });
        test("Résultat si le mot-clef est exacte", async () => {
          await client.motsClefs!.ajouterNomsMotClef({
            id: idMotClef,
            noms: {
              fr: "hydrologie",
            },
          });
          expect(résultat).toEqual({
            type: "résultat",
            clef: "fr",
            de: "nom",
            info: {
              type: "texte",
              début: 0,
              fin: 10,
              texte: "hydrologie",
            },
            score: 1,
          });
        });
      });

      describe("Selon texte", function () {
        let idMotClef: string;
        let résultatId:
          | résultatObjectifRecherche<infoRésultatTexte>
          | undefined;
        let résultatNom:
          | résultatObjectifRecherche<infoRésultatTexte>
          | undefined;

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idMotClef = await client.motsClefs!.créerMotClef();

          const fRechercheNom = rechercherMotClefSelonTexte("hydrologie");
          fsOublier.push(
            await fRechercheNom(client, idMotClef, (r) => (résultatNom = r))
          );

          const fRechercheId = rechercherMotClefSelonTexte(
            idMotClef.slice(0, 15)
          );
          fsOublier.push(
            await fRechercheId(client, idMotClef, (r) => (résultatId = r))
          );

          await client.motsClefs!.ajouterNomsMotClef({
            id: idMotClef,
            noms: {
              fr: "hydrologie",
            },
          });
        }, config.timeout);

        afterAll(() => {
          fsOublier.forEach((f) => f());
        });

        test("Résultat nom détecté", async () => {
          expect(résultatNom).toEqual({
            type: "résultat",
            clef: "fr",
            de: "nom",
            info: {
              type: "texte",
              début: 0,
              fin: 10,
              texte: "hydrologie",
            },
            score: 1,
          });
        });
        test("Résultat id détecté", async () => {
          expect(résultatId).toEqual({
            type: "résultat",
            de: "id",
            info: {
              type: "texte",
              début: 0,
              fin: 15,
              texte: idMotClef,
            },
            score: 1,
          });
        });
      });
    });
  });
});
