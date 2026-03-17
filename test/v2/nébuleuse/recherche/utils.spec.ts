import { expect } from "aegir/chai";
import { faisRien } from "@constl/utils-ipa";
import {
  combinerRecherches,
  rechercherDansTexte,
  rechercherSelonId,
  rechercherTous,
  similImages,
  similTexte,
  sousRecherche,
} from "@/v2/recherche/fonctions/utils.js";
import { obtRessourceTest } from "../../ressources/index.js";
import { obtenir } from "../../utils.js";
import { créerNébuleusesTest } from "../utils.js";
import type { NébuleuseTest } from "../utils.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type {
  InfoRésultatRecherche,
  InfoRésultatTexte,
  InfoRésultatVide,
  RésultatObjectifRecherche,
  SuivreObjectifRecherche,
} from "@/v2/recherche/types.js";

describe.skip("Utils recherche", function () {
  let fermer: Oublier;
  let nébuleuses: NébuleuseTest[];
  let nébuleuse: NébuleuseTest;

  before(async () => {
    ({ fermer, nébuleuses } = await créerNébuleusesTest({ n: 1 }));
    nébuleuse = nébuleuses[0];
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("rechercher dans texte", function () {
    it("recherche exacte", () => {
      const résultat = rechercherDansTexte({
        schéma: "வணக்கம்",
        texte: "வணக்கம், சாப்பிட்டீர்களா?",
      });
      expect(résultat).to.deep.equal({
        type: "texte",
        score: 1,
        début: 0,
        fin: 7,
      });
    });

    it("recherche approximative", () => {
      const résultat = rechercherDansTexte({
        schéma: "வணக்கம்",
        texte: "வணககம், சாப்பிட்டீர்களா?",
      });
      expect(résultat).to.deep.equal({
        type: "texte",
        score: 0.5,
        début: 0,
        fin: 6,
      });
    });

    it("recherche retourne meilleure", () => {
      const résultat = rechercherDansTexte({
        schéma: "வணக்கம்",
        texte: "வணககம், வணக்கம்",
      });
      expect(résultat).to.deep.equal({
        type: "texte",
        score: 1,
        début: 8,
        fin: 15,
      });
    });

    it("recherche vraiment pas possible", () => {
      const résultat = rechercherDansTexte({
        schéma: "வணக்கம்",
        texte: "សួស្តី",
      });
      expect(résultat).to.be.undefined();
    });
  });

  describe("simil texte", function () {
    it("exacte", () => {
      const textes = {
        fr: "hydrologie",
        cst: "hidrología",
        த: "நீரியல்",
      };

      const résultat = similTexte({
        texte: "hydrologie",
        possibilités: textes,
      });
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

      const résultat = similTexte({
        texte: "hydrologie",
        possibilités: textes,
      });
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

      const résultat = similTexte({ texte: "hydro", possibilités: textes });
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

      const résultat = similTexte({
        texte: "entomologie",
        possibilités: textes,
      });
      expect(résultat).to.be.undefined();
    });

    it("simil texte liste", () => {
      const résultat = similTexte({
        texte: "entomologie",
        possibilités: ["entomología", "entomologie"],
      });
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

  describe("simil image", function () {
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

    it("pas d'image réf", () => {
      const résultat = similImages({ image: IMAGE, imageRéf: null });
      expect(résultat).to.equal(0);
    });

    it("images identiques", () => {
      const résultat = similImages({ image: IMAGE, imageRéf: IMAGE });
      expect(résultat).to.equal(1);
    });

    it("images similaires", () => {
      const résultat = similImages({ image: IMAGE, imageRéf: IMAGE2 });
      expect(résultat).to.be.greaterThan(0.5);
    });
  });

  describe("rechercher selon id", function () {
    let recherche: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      recherche = rechercherSelonId("id");
    });

    it("résultat détecté", async () => {
      const résultat = await obtenir(({ siDéfini }) =>
        recherche({
          services: (clef) => nébuleuse.services[clef],
          idObjet: "voici mon id",
          f: siDéfini(),
        }),
      );

      const réf: RésultatObjectifRecherche<InfoRésultatTexte> = {
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
      expect(résultat).to.deep.equal(réf);
    });
  });

  describe("combiner recherches", function () {
    let rechercheAbc: SuivreObjectifRecherche<InfoRésultatTexte>;
    let rechercheAbcdef: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      rechercheAbc = rechercherSelonId("abc");
      rechercheAbcdef = rechercherSelonId("abcdef");
    });

    it("résultat détecté", async () => {
      const résultat = await obtenir(({ siDéfini }) =>
        combinerRecherches({
          fsRecherche: {
            abc: rechercheAbc,
            abcdef: rechercheAbcdef,
          },
          services: (clef) => nébuleuse.services[clef],
          idObjet: "abcdefghij",
          fSuivreRecherche: siDéfini(),
        }),
      );

      const réf: RésultatObjectifRecherche<InfoRésultatTexte> = {
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
      expect(résultat).to.deep.equal(réf);
    });
  });

  describe("sous-recherche", function () {
    type TypeRésultat = RésultatObjectifRecherche<
      InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
    >;
    let rechercheId: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      rechercheId = rechercherSelonId("précipitation");
    });

    it("rien pour commencer", async () => {
      const résultat = await obtenir<RésultatObjectifRecherche>(
        ({ siNonDéfini }) =>
          sousRecherche({
            de: "variable",
            fListe: async ({ fSuivreRacine }) => {
              fSuivreRacine([]);
              return faisRien;
            },
            fRechercher: rechercheId,
            services: (clef) => nébuleuse.services[clef],
            fSuivreRecherche: siNonDéfini(),
          }),
      );
      expect(résultat).to.be.undefined();
    });

    it("ajout variable détecté", async () => {
      const résultat = await obtenir<RésultatObjectifRecherche>(
        ({ siNonDéfini }) =>
          sousRecherche({
            de: "variable",
            fListe: async ({ fSuivreRacine }) => {
              fSuivreRacine(["precipitation"]);
              return faisRien;
            },
            fRechercher: rechercheId,
            services: (clef) => nébuleuse.services[clef],
            fSuivreRecherche: siNonDéfini(),
          }),
      );

      const réf: TypeRésultat = {
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

      expect(résultat).to.deep.equal(réf);
    });

    it("ajout meilleure variable détecté", async () => {
      const résultat = await obtenir<RésultatObjectifRecherche>(({ si }) =>
        sousRecherche({
          de: "variable",
          fListe: async ({ fSuivreRacine }) => {
            fSuivreRacine(["precipitation"]);
            fSuivreRacine(["precipitation", "précipitation"]);
            return faisRien;
          },
          fRechercher: rechercheId,
          services: (clef) => nébuleuse.services[clef],
          fSuivreRecherche: si((x) => !!x && x.score > 0.5),
        }),
      );
      const réf: TypeRésultat = {
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
      expect(résultat).to.deep.equal(réf);
    });
  });

  describe("rechercher tous égaux", function () {
    let recherche: SuivreObjectifRecherche<InfoRésultatVide>;

    before(async () => {
      recherche = rechercherTous();
    });

    it("tous ont le même score", async () => {
      const résultat = await obtenir(({ siDéfini }) =>
        recherche({
          services: (clef) => nébuleuse.services[clef],
          idObjet: "abc",
          f: siDéfini(),
        }),
      );
      const réf: RésultatObjectifRecherche<InfoRésultatVide> = {
        type: "résultat",
        score: 1,
        de: "*",
        info: { type: "vide" },
      };
      expect(résultat).to.deep.equal(réf);
    });
  });
});
