import fs from "fs";
import path from "path";
import type FeedStore from "orbit-db-feedstore";
import { config } from "@/utilsTests/sfip.js";

import { enregistrerContrôleurs } from "@/accès/index.js";
import type { default as ClientConstellation } from "@/client.js";
import type {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatRecherche,
  infoRésultatTexte,
  infoRésultatVide,
} from "@/utils/index.js";
import {
  rechercherDansTexte,
  similTexte,
  similImages,
  rechercherSelonId,
  combinerRecherches,
  sousRecherche,
  rechercherTous,
} from "@/recherche/utils.js";

import { générerClients } from "@/utilsTests/client.js";
import { dossierRessourcesTests } from "@/utilsTests/dossiers.js";

describe("Utils recherche", function () {
  let fOublierClients: () => Promise<void>;
  let clients: ClientConstellation[];
  let client: ClientConstellation;

  beforeAll(async () => {
    enregistrerContrôleurs();
    ({ fOublier: fOublierClients, clients } = await générerClients(1));
    client = clients[0];
  }, config.patienceInit);

  afterAll(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Rechercher dans texte", function () {
    test("Recherche exacte", () => {
      const résultat = rechercherDansTexte(
        "வணக்கம்",
        "வணக்கம், சாப்பிட்டீர்களா?"
      );
      expect(résultat).toEqual({
        type: "texte",
        score: 1,
        début: 0,
        fin: 7,
      });
    });

    test("Recherche approximative", () => {
      const résultat = rechercherDansTexte(
        "வணக்கம்",
        "வணககம், சாப்பிட்டீர்களா?"
      );
      expect(résultat).toEqual({
        type: "texte",
        score: 0.5,
        début: 0,
        fin: 6,
      });
    });

    test("Recherche retourne meilleure", () => {
      const résultat = rechercherDansTexte("வணக்கம்", "வணககம், வணக்கம்");
      expect(résultat).toEqual({
        type: "texte",
        score: 1,
        début: 8,
        fin: 15,
      });
    });

    test("Recherche vraiment pas possible", () => {
      const résultat = rechercherDansTexte("வணக்கம்", "សួស្តី");
      expect(résultat).toBeUndefined;
    });
  });

  describe("Simil texte", function () {
    test("exacte", () => {
      const textes = {
        fr: "hydrologie",
        es: "hidrología",
        த: "நீரியல்",
      };

      const résultat = similTexte("hydrologie", textes);
      expect(résultat).toEqual({
        type: "résultat",
        clef: "fr",
        info: {
          type: "texte",
          début: 0,
          fin: 10,
          texte: "hydrologie",
        },
        score: 1,
      });
    });
    test("approx", () => {
      const textes = {
        es: "hidrología",
        த: "நீரியல்",
      };

      const résultat = similTexte("hydrologie", textes);
      expect(résultat).toEqual({
        type: "résultat",
        clef: "es",
        info: {
          type: "texte",
          début: 0,
          fin: 10,
          texte: "hidrología",
        },
        score: 0.25,
      });
    });
    test("meilleure", () => {
      const textes = {
        fr: "hydrologie",
        es: "hidrología",
        த: "நீரியல்",
      };

      const résultat = similTexte("hydro", textes);
      expect(résultat).toEqual({
        type: "résultat",
        clef: "fr",
        info: {
          type: "texte",
          début: 0,
          fin: 5,
          texte: "hydrologie",
        },
        score: 1,
      });
    });
    test("aucune", () => {
      const textes = {
        fr: "hydrologie",
        es: "hidrología",
        த: "நீரியல்",
      };

      const résultat = similTexte("entomologie", textes);
      expect(résultat).toBeUndefined;
    });

    test("simil texte liste", () => {
      const résultat = similTexte("entomologie", [
        "entomología",
        "entomologie",
      ]);
      expect(résultat).toEqual({
        type: "résultat",
        clef: "entomologie",
        info: {
          type: "texte",
          début: 0,
          fin: 11,
          texte: "entomologie",
        },
        score: 1,
      });
    });
  });

  describe.skip("Simil image", function () {
    let IMAGE: Buffer;
    let IMAGE2: Buffer;

    before(async () => {
      IMAGE = fs.readFileSync(path.join(await dossierRessourcesTests(), "logo.png"));
      IMAGE2 = fs.readFileSync(
        path.join(await dossierRessourcesTests(), "logo2.png")
      );
    })

    test("Pas d'image réf", () => {
      const résultat = similImages(IMAGE, null);
      expect(résultat).toEqual(0);
    });

    test("Images identiques", () => {
      const résultat = similImages(IMAGE, IMAGE);
      expect(résultat).toEqual(1);
    });

    test("Images similaires", () => {
      const résultat = similImages(IMAGE, IMAGE2);
      expect(résultat).toBeGreaterThan(0.5);
    });
  });

  describe("Rechercher selon id", function () {
    let résultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
    let fOublier: schémaFonctionOublier;

    const fRecherche = rechercherSelonId("id");

    beforeAll(async () => {
      fOublier = await fRecherche(
        client,
        "voici mon id",
        (rés) => (résultat = rés)
      );
    });
    afterAll(async () => {
      if (fOublier) await fOublier();
    });
    test("Résultat détecté", () => {
      const réfRés: résultatObjectifRecherche<infoRésultatTexte> = {
        type: "résultat",
        de: "id",
        info: {
          type: "texte",
          début: 10,
          fin: 12,
          texte: "voici mon id",
        },
        score: 1,
      };

      expect(résultat).toEqual(réfRés);
    });
  });

  describe("Combiner recherches", function () {
    let résultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
    let fOublier: schémaFonctionOublier;

    beforeAll(async () => {
      const fRechercheAbc = rechercherSelonId("abc");
      const fRechercheAbcdef = rechercherSelonId("abcdef");

      fOublier = await combinerRecherches(
        {
          abc: fRechercheAbc,
          abcdef: fRechercheAbcdef,
        },
        client,
        "abcdefghij",
        (rés) => (résultat = rés)
      );
    });
    afterAll(async () => {
      if (fOublier) await fOublier();
    });
    test("Résultat détecté", () => {
      const réfRés: résultatObjectifRecherche<infoRésultatTexte> = {
        type: "résultat",
        de: "id",
        info: {
          type: "texte",
          début: 0,
          fin: 6,
          texte: "abcdefghij",
        },
        score: 1,
      };
      expect(résultat).toEqual(réfRés);
    });
  });

  describe("Sous-recherche", function () {
    let idBd: string;
    let résultat:
      | résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
      | undefined;

    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      idBd = await client.créerBdIndépendante({ type: "feed" });

      const fListe = async (
        fSuivreRacine: (idsVariables: string[]) => void
      ): Promise<schémaFonctionOublier> => {
        return await client.suivreBdListe({ id: idBd, f: fSuivreRacine });
      };

      const fRechercher = rechercherSelonId("précipitation");
      const fSuivreRecherche = (
        rés?: résultatObjectifRecherche<
          infoRésultatRecherche<infoRésultatTexte>
        >
      ) => {
        résultat = rés;
      };

      fsOublier.push(
        await sousRecherche(
          "variable",
          fListe,
          fRechercher,
          client,
          fSuivreRecherche
        )
      );
    }, config.patience);
    afterAll(async () => await Promise.all(fsOublier.map((f) => f())));

    test("Rien pour commencer", () => {
      expect(résultat).toBeUndefined;
    });

    test("Ajout variable détecté", async () => {
      const { bd, fOublier } = await client.ouvrirBd<FeedStore<string>>({
        id: idBd,
      });
      await bd.add("precipitation");
      await fOublier();

      const réfRés: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatTexte>
      > = {
        type: "résultat",
        clef: "precipitation",
        de: "variable",
        info: {
          type: "résultat",
          de: "id",
          info: {
            début: 0,
            fin: 13,
            texte: "precipitation",
            type: "texte",
          },
        },
        score: 0.5,
      };

      expect(résultat).toEqual(réfRés);
    });

    test("Ajout meilleure variable détecté", async () => {
      const { bd, fOublier } = await client.ouvrirBd<FeedStore<string>>({
        id: idBd,
      });
      await bd.add("précipitation");
      await fOublier();

      const réfRés: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatTexte>
      > = {
        clef: "précipitation",
        de: "variable",
        info: {
          type: "résultat",
          de: "id",
          info: {
            début: 0,
            fin: 13,
            texte: "précipitation",
            type: "texte",
          },
        },
        score: 1,
        type: "résultat",
      };

      expect(résultat).toEqual(réfRés);
    });
  });

  describe("Rechercher tous égaux", function () {
    let résultat: résultatObjectifRecherche<infoRésultatVide> | undefined;
    let fOublier: schémaFonctionOublier;

    beforeAll(async () => {
      const fRecherche = rechercherTous();
      fOublier = await fRecherche(client, "abc", (rés) => (résultat = rés));
    });
    afterAll(async () => {
      if (fOublier) await fOublier();
    });
    test("Tous ont le même score", () => {
      const réfRés: résultatObjectifRecherche<infoRésultatVide> = {
        type: "résultat",
        score: 1,
        de: "*",
        info: { type: "vide" },
      };
      expect(résultat).toEqual(réfRés);
    });
  });
});
