import fs from "fs";
import path from "path";
import type FeedStore from "orbit-db-feedstore";

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

import { expect } from "aegir/chai";

describe("Utils recherche", function () {
  let fOublierClients: () => Promise<void>;
  let clients: ClientConstellation[];
  let client: ClientConstellation;

  before(async () => {
    ({ fOublier: fOublierClients, clients } = await générerClients(1));
    client = clients[0];
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Rechercher dans texte", function () {
    it("Recherche exacte", () => {
      const résultat = rechercherDansTexte(
        "வணக்கம்",
        "வணக்கம், சாப்பிட்டீர்களா?"
      );
      expect(résultat).to.deep.equal({
        type: "texte",
        score: 1,
        début: 0,
        fin: 7,
      });
    });

    it("Recherche approximative", () => {
      const résultat = rechercherDansTexte(
        "வணக்கம்",
        "வணககம், சாப்பிட்டீர்களா?"
      );
      expect(résultat).to.deep.equal({
        type: "texte",
        score: 0.5,
        début: 0,
        fin: 6,
      });
    });

    it("Recherche retourne meilleure", () => {
      const résultat = rechercherDansTexte("வணக்கம்", "வணககம், வணக்கம்");
      expect(résultat).to.deep.equal({
        type: "texte",
        score: 1,
        début: 8,
        fin: 15,
      });
    });

    it("Recherche vraiment pas possible", () => {
      const résultat = rechercherDansTexte("வணக்கம்", "សួស្តី");
      expect(résultat).to.be.undefined();
    });
  });

  describe("Simil texte", function () {
    it("exacte", () => {
      const textes = {
        fr: "hydrologie",
        es: "hidrología",
        த: "நீரியல்",
      };

      const résultat = similTexte("hydrologie", textes);
      expect(résultat).to.deep.equal({
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
    it("approx", () => {
      const textes = {
        es: "hidrología",
        த: "நீரியல்",
      };

      const résultat = similTexte("hydrologie", textes);
      expect(résultat).to.deep.equal({
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
    it("meilleure", () => {
      const textes = {
        fr: "hydrologie",
        es: "hidrología",
        த: "நீரியல்",
      };

      const résultat = similTexte("hydro", textes);
      expect(résultat).to.deep.equal({
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
    it("aucune", () => {
      const textes = {
        fr: "hydrologie",
        es: "hidrología",
        த: "நீரியல்",
      };

      const résultat = similTexte("entomologie", textes);
      expect(résultat).to.be.undefined();
    });

    it("simil texte liste", () => {
      const résultat = similTexte("entomologie", [
        "entomología",
        "entomologie",
      ]);
      expect(résultat).to.deep.equal({
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
      IMAGE = fs.readFileSync(
        path.join(await dossierRessourcesTests(), "logo.png")
      );
      IMAGE2 = fs.readFileSync(
        path.join(await dossierRessourcesTests(), "logo2.png")
      );
    });

    it("Pas d'image réf", () => {
      const résultat = similImages(IMAGE, null);
      expect(résultat).to.equal(0);
    });

    it("Images identiques", () => {
      const résultat = similImages(IMAGE, IMAGE);
      expect(résultat).to.equal(1);
    });

    it("Images similaires", () => {
      const résultat = similImages(IMAGE, IMAGE2);
      expect(résultat).to.be.greaterThan(0.5);
    });
  });

  describe("Rechercher selon id", function () {
    let résultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
    let fOublier: schémaFonctionOublier;

    const fRecherche = rechercherSelonId("id");

    before(async () => {
      fOublier = await fRecherche(
        client,
        "voici mon id",
        (rés) => (résultat = rés)
      );
    });
    after(async () => {
      if (fOublier) await fOublier();
    });
    it("Résultat détecté", () => {
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

      expect(résultat).to.deep.equal(réfRés);
    });
  });

  describe("Combiner recherches", function () {
    let résultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
    let fOublier: schémaFonctionOublier;

    before(async () => {
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
    after(async () => {
      if (fOublier) await fOublier();
    });
    it("Résultat détecté", () => {
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
      expect(résultat).to.deep.equal(réfRés);
    });
  });

  describe("Sous-recherche", function () {
    let idBd: string;
    let résultat:
      | résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
      | undefined;

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
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
    });
    after(async () => await Promise.all(fsOublier.map((f) => f())));

    it("Rien pour commencer", () => {
      expect(résultat).to.be.undefined();
    });

    it("Ajout variable détecté", async () => {
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

      expect(résultat).to.deep.equal(réfRés);
    });

    it("Ajout meilleure variable détecté", async () => {
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

      expect(résultat).to.deep.equal(réfRés);
    });
  });

  describe("Rechercher tous égaux", function () {
    let résultat: résultatObjectifRecherche<infoRésultatVide> | undefined;
    let fOublier: schémaFonctionOublier;

    before(async () => {
      const fRecherche = rechercherTous();
      fOublier = await fRecherche(client, "abc", (rés) => (résultat = rés));
    });
    after(async () => {
      if (fOublier) await fOublier();
    });
    it("Tous ont le même score", () => {
      const réfRés: résultatObjectifRecherche<infoRésultatVide> = {
        type: "résultat",
        score: 1,
        de: "*",
        info: { type: "vide" },
      };
      expect(résultat).to.deep.equal(réfRés);
    });
  });
});
