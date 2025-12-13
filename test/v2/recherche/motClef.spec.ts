import { expect } from "aegir/chai";

import {
  rechercherMotsClefsSelonNom,
  rechercherMotsClefsSelonTexte,
} from "@/v2/recherche/fonctions/motsClefs.js";
import { créerConstellationsTest, obtenir } from "../utils.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type { Constellation } from "@/v2/index.js";
import type {
  InfoRésultatTexte,
  InfoRésultatVide,
  RésultatObjectifRecherche,
  SuivreObjectifRecherche,
} from "@/v2/recherche/types.js";

describe("Rechercher mots-clefs", function () {
  let fermer: Oublier;
  let constls: Constellation[];
  let constl: Constellation;

  before(async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 1,
      avecMandataire: false,
    }));
    constl = constls[0];
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("selon nom", function () {
    let idMotClef: string;
    let recherche: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      idMotClef = await constl.motsClefs.créerMotClef();

      recherche = rechercherMotsClefsSelonNom("hydrologie");
    });

    it("pas de résultat quand le mot-clef n'a pas de nom", async () => {
      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ siNonDéfini }) =>
        recherche({
          constl,
          idObjet: idMotClef,
          f: siNonDéfini(),
        }),
      );
      expect(résultat).to.be.undefined();
    });

    it("pas de résultat si le mot-clef n'a vraiment rien à voir", async () => {
      await constl.motsClefs.sauvegarderNoms({
        idMotClef,
        noms: {
          த: "நீரியல்",
        },
      });

      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ siNonDéfini }) =>
        recherche({
          constl,
          idObjet: idMotClef,
          f: siNonDéfini(),
        }),
      );
      expect(résultat).to.be.undefined();
    });

    it("résultat si le mot-clef est presque exacte", async () => {
      const pRésultat = obtenir<RésultatObjectifRecherche<InfoRésultatTexte>>(
        ({ siDéfini }) =>
          recherche({ constl, idObjet: idMotClef, f: siDéfini() }),
      );

      await constl.motsClefs.sauvegarderNoms({
        idMotClef,
        noms: {
          fr: "Sciences hydrologiques",
        },
      });

      const résultat = await pRésultat;

      expect(résultat).to.deep.equal({
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

    it("résultat si le mot-clef est exacte", async () => {
      const pRésultat = obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ si }) =>
        recherche({
          constl,
          idObjet: idMotClef,
          f: si((x) => x !== undefined && x.score > 0.5),
        }),
      );

      await constl.motsClefs.sauvegarderNoms({
        idMotClef,
        noms: {
          fr: "hydrologie",
        },
      });

      const résultat = await pRésultat;

      expect(résultat).to.deep.equal({
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

  describe("selon texte", function () {
    let idMotClef: string;

    type TypeRésultat = InfoRésultatTexte | InfoRésultatVide;
    let rechercheId: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheNom: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheDescription: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheVide: SuivreObjectifRecherche<TypeRésultat>;

    before(async () => {
      idMotClef = await constl.motsClefs.créerMotClef();

      rechercheNom = rechercherMotsClefsSelonTexte("hydrologie");
      rechercheDescription = rechercherMotsClefsSelonTexte("domaine de l'eau");
      rechercheId = rechercherMotsClefsSelonTexte(idMotClef.slice(0, 15));
      rechercheVide = rechercherMotsClefsSelonTexte("");
    });

    it("résultat id détecté", async () => {
      const résultatId = await obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siDéfini }) =>
          rechercheId({ constl, idObjet: idMotClef, f: siDéfini() }),
      );

      expect(résultatId).to.deep.equal({
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

    it("résultat nom détecté", async () => {
      const pRésultatNom = obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siDéfini }) =>
          rechercheNom({ constl, idObjet: idMotClef, f: siDéfini() }),
      );

      await constl.motsClefs.sauvegarderNoms({
        idMotClef,
        noms: {
          fr: "hydrologie",
        },
      });
      const résultatNom = await pRésultatNom;

      expect(résultatNom).to.deep.equal({
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

    it("résultat description détecté", async () => {
      const pRésultatDescription = obtenir<
        RésultatObjectifRecherche<TypeRésultat>
      >(({ siDéfini }) =>
        rechercheDescription({ constl, idObjet: idMotClef, f: siDéfini() }),
      );

      await constl.motsClefs.sauvegarderDescriptions({
        idMotClef,
        descriptions: {
          fr: "un mot-clef pour le domaine de l'eau",
        },
      });

      const résultatDescription = await pRésultatDescription;

      expect(résultatDescription).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "description",
        info: {
          type: "texte",
          début: 20,
          fin: 36,
          texte: "domaine de l'eau",
        },
        score: 1,
      });
    });

    it("résultat recherche vide", async () => {
      const résultat = await obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siDéfini }) =>
          rechercheVide({ constl, idObjet: idMotClef, f: siDéfini() }),
      );

      const réf: RésultatObjectifRecherche<InfoRésultatVide> = {
        type: "résultat",
        de: "*",
        info: {
          type: "vide",
        },
        score: 1,
      };
      expect(résultat).to.deep.equal(réf);
    });
  });
});
