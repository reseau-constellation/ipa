import { attente } from "@constl/utils-tests";
import { expect } from "aegir/chai";
import { JSONSchemaType } from "ajv";
import {
  combinerRecherches,
  rechercherDansTexte,
  rechercherSelonId,
  rechercherTous,
  similImages,
  similTexte,
  sousRecherche,
} from "@/recherche/utils.js";
import { obtRessourceTest } from "../ressources/index.js";
import { générerClientsInternes } from "../ressources/utils.js";
import type {
  infoRésultatRecherche,
  infoRésultatTexte,
  infoRésultatVide,
  résultatObjectifRecherche,
  schémaFonctionOublier,
} from "@/types.js";
import type { Constellation } from "@/client.js";

describe("Utils recherche", function () {
  let fOublierClients: () => Promise<void>;
  let clients: Constellation[];
  let client: Constellation;

  before(async () => {
    ({ fOublier: fOublierClients, clients } = await générerClientsInternes({
      n: 1,
    }));
    client = clients[0];
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Rechercher dans texte", function () {
    it("Recherche exacte", () => {
      const résultat = rechercherDansTexte(
        "வணக்கம்",
        "வணக்கம், சாப்பிட்டீர்களா?",
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
        "வணககம், சாப்பிட்டீர்களா?",
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
        cst: "hidrología",
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
        cst: "hidrología",
        த: "நீரியல்",
      };

      const résultat = similTexte("hydrologie", textes);
      expect(résultat).to.deep.equal({
        type: "résultat",
        clef: "cst",
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
        cst: "hidrología",
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
        cst: "hidrología",
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
      IMAGE = await obtRessourceTest({
        nomFichier: "logo.png",
        optsAxios: { responseType: "arraybuffer" },
      });
      IMAGE2 = await obtRessourceTest({
        nomFichier: "logo2.png",
        optsAxios: { responseType: "arraybuffer" },
      });
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
    const résultat = new attente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte> | undefined
    >();
    let fOublier: schémaFonctionOublier;

    const fRecherche = rechercherSelonId("id");

    before(async () => {
      fOublier = await fRecherche(client, "voici mon id", async (rés) =>
        résultat.mettreÀJour(rés),
      );
    });
    after(async () => {
      if (fOublier) await fOublier();
    });
    it("Résultat détecté", async () => {
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
      const val = await résultat.attendreExiste();
      expect(val).to.deep.equal(réfRés);
    });
  });

  describe("Combiner recherches", function () {
    const résultat = new attente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte> | undefined
    >();
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
        async (rés) => résultat.mettreÀJour(rés),
      );
    });
    after(async () => {
      if (fOublier) await fOublier();
    });
    it("Résultat détecté", async () => {
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
      const val = await résultat.attendreExiste();
      expect(val).to.deep.equal(réfRés);
    });
  });

  describe("Sous-recherche", function () {
    let idBd: string;
    const résultat = new attente.AttendreRésultat<
      | résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
      | undefined
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idBd = await client.créerBdIndépendante({ type: "set" });

      const fListe = async (
        fSuivreRacine: (idsVariables: string[]) => void,
      ): Promise<schémaFonctionOublier> => {
        return await client.suivreBdListe({ id: idBd, f: fSuivreRacine });
      };

      const fRechercher = rechercherSelonId("précipitation");
      const fSuivreRecherche = async (
        rés?: résultatObjectifRecherche<
          infoRésultatRecherche<infoRésultatTexte>
        >,
      ) => {
        résultat.mettreÀJour(rés);
      };

      fsOublier.push(
        await sousRecherche(
          "variable",
          fListe,
          fRechercher,
          client,
          fSuivreRecherche,
        ),
      );
    });
    after(async () => await Promise.allSettled(fsOublier.map((f) => f())));

    it("Rien pour commencer", () => {
      expect(résultat.val).to.be.undefined();
    });

    it("Ajout variable détecté", async () => {
      const { orbite } = await client.attendreSfipEtOrbite();
      const { bd, fOublier } = await orbite.ouvrirBdTypée({
        id: idBd,
        type: "set",
        schéma: { type: "string" } as JSONSchemaType<string>,
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

      const val = await résultat.attendreExiste();
      expect(val).to.deep.equal(réfRés);
    });

    it("Ajout meilleure variable détecté", async () => {
      const { orbite } = await client.attendreSfipEtOrbite();
      const { bd, fOublier } = await orbite.ouvrirBdTypée({
        id: idBd,
        type: "set",
        schéma: { type: "string" } as JSONSchemaType<string>,
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
      const val = await résultat.attendreQue(
        (x) => x?.clef === "précipitation",
      );
      expect(val).to.deep.equal(réfRés);
    });
  });

  describe("Rechercher tous égaux", function () {
    const résultat = new attente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatVide> | undefined
    >();
    let fOublier: schémaFonctionOublier;

    before(async () => {
      const fRecherche = rechercherTous();
      fOublier = await fRecherche(client, "abc", async (rés) =>
        résultat.mettreÀJour(rés),
      );
    });
    after(async () => {
      if (fOublier) await fOublier();
    });
    it("Tous ont le même score", async () => {
      const réfRés: résultatObjectifRecherche<infoRésultatVide> = {
        type: "résultat",
        score: 1,
        de: "*",
        info: { type: "vide" },
      };
      const val = await résultat.attendreExiste();
      expect(val).to.deep.equal(réfRés);
    });
  });
});
