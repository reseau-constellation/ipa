import { expect } from "aegir/chai";
import {
  rechercherVariablesSelonDescription,
  rechercherVariablesSelonNom,
  rechercherVariablesSelonTexte,
} from "@/v2/recherche/fonctions/variables.js";
import { créerConstellationsTest, obtenir } from "../utils.js";
import type { Oublier } from "@/v2/crabe/types.js";
import type { Constellation } from "@/v2/index.js";
import type {
  InfoRésultatTexte,
  InfoRésultatVide,
  RésultatObjectifRecherche,
  SuivreObjectifRecherche,
} from "@/v2/recherche/types.js";
import { variables } from "@/index.js";

describe("Rechercher variables", function () {
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
    let idVariable: string;
    let recherche: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      recherche = rechercherVariablesSelonNom("Radiation solaire");
    });

    it("pas de résultat quand la variable n'a pas de nom", async () => {
      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ siNonDéfini }) =>
        recherche({
          constl,
          idObjet: idVariable,
          f: siNonDéfini(),
        }),
      );
      expect(résultat).to.be.undefined();
    });

    it("pas de résultat si le nom n'a vraiment rien à voir", async () => {
      await constl.variables.sauvegarderNoms({
        idVariable,
        noms: {
          த: "சூரிய கதிர்வீச்சு",
        },
      });

      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ siNonDéfini }) =>
        recherche({
          constl,
          idObjet: idVariable,
          f: siNonDéfini(),
        }),
      );
      expect(résultat).to.be.undefined();
    });

    it("résultat si la variable est presque exacte", async () => {
      const pRésultat = obtenir<RésultatObjectifRecherche<InfoRésultatTexte>>(
        ({ siDéfini }) =>
          recherche({ constl, idObjet: idVariable, f: siDéfini() }),
      );

      await constl.variables.sauvegarderNoms({
        idVariable,
        noms: {
          cst: "Radiación solar",
        },
      });

      const résultat = await pRésultat;

      expect(résultat).to.deep.equal({
        type: "résultat",
        clef: "cst",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: "Radiación solar",
        },
        score: 0.2,
      });
    });

    it("résultat si le mot-clef est exacte", async () => {
      const pRésultat = obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ si }) =>
        recherche({
          constl,
          idObjet: idVariable,
          f: si((x) => x !== undefined && x.score > 0.5),
        }),
      );

      await constl.variables.sauvegarderNoms({
        idVariable,
        noms: {
          fr: "Radiation solaire",
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
          fin: 17,
          texte: "Radiation solaire",
        },
        score: 1,
      });
    });
  });

  describe("selon description", function () {
    let idVariable: string;
    let recherche: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      recherche = rechercherVariablesSelonDescription("Radiation solaire");
    });

    it("pas de résultat quand la variable n'a pas de description", async () => {
      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ siNonDéfini }) =>
        recherche({
          constl,
          idObjet: idVariable,
          f: siNonDéfini(),
        }),
      );

      expect(résultat).to.be.undefined();
    });

    it("pas de résultat si la description n'a vraiment rien à voir", async () => {
      await constl.variables.sauvegarderDescriptions({
        idVariable,
        descriptions: {
          த: "சூரிய கதிர்வீச்சு",
        },
      });

      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ siNonDéfini }) =>
        recherche({
          constl,
          idObjet: idVariable,
          f: siNonDéfini(),
        }),
      );

      expect(résultat).to.be.undefined();
    });

    it("résultat si la variable est presque exacte", async () => {
      await constl.variables.sauvegarderDescriptions({
        idVariable,
        descriptions: {
          cst: "Radiación solar",
        },
      });
      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ siDéfini }) =>
        recherche({ constl, idObjet: idVariable, f: siDéfini() }),
      );

      expect(résultat).to.deep.equal({
        type: "résultat",
        clef: "cst",
        de: "descriptions",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: "Radiación solar",
        },
        score: 0.2,
      });
    });

    it("résultat si la description est exacte", async () => {
      await constl.variables.sauvegarderDescriptions({
        idVariable,
        descriptions: {
          fr: "Radiation solaire",
        },
      });

      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ si }) =>
        recherche({
          constl,
          idObjet: idVariable,
          f: si((x) => x !== undefined && x.score > 0.5),
        }),
      );

      expect(résultat).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "descriptions",
        info: {
          type: "texte",
          début: 0,
          fin: 17,
          texte: "Radiation solaire",
        },
        score: 1,
      });
    });
  });

  describe("selon texte", function () {
    let idVariable: string;

    type TypeRésultat = InfoRésultatTexte | InfoRésultatVide
    
    let rechercheId: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheNom: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheDescription: SuivreObjectifRecherche<TypeRésultat>;

    before(async () => {
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      rechercheId = rechercherVariablesSelonTexte(idVariable.slice(0, 15));
      rechercheNom = rechercherVariablesSelonTexte("précipitation");
      rechercheDescription = rechercherVariablesSelonTexte("neige");

      await constl.variables.sauvegarderNoms({
        idVariable,
        noms: {
          fr: "précipitation",
        },
      });
    });

    it("résultat id détecté", async () => {
      const résultatId = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte | InfoRésultatVide>
      >(({ siDéfini }) =>
        rechercheId({ constl, idObjet: idVariable, f: siDéfini() }),
      );
      expect(résultatId).to.deep.equal({
        type: "résultat",
        de: "id",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: idVariable,
        },
        score: 1,
      });
    });

    it("résultat nom détecté", async () => {
      const résultatNom = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte | InfoRésultatVide>
      >(({ siDéfini }) =>
        rechercheNom({ constl, idObjet: idVariable, f: siDéfini() }),
      );
      expect(résultatNom).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 13,
          texte: "précipitation",
        },
        score: 1,
      });
    });


    it("résultat description détecté", async () => {
      const pRésultatDescription = obtenir<RésultatObjectifRecherche<TypeRésultat>>(({ siDéfini }) =>
        rechercheDescription({ constl, idObjet: idVariable, f: siDéfini() }),
      );

      await constl.variables.sauvegarderDescriptions({
        idVariable,
        descriptions: {
          fr: "Pluie ou neige",
        },
      });

      const résultatDescription = await pRésultatDescription;

      expect(résultatDescription).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "nom",
        info: {
          type: "texte",
          début: 9,
          fin: 14,
          texte: "neige",
        },
        score: 1,
      });
    });

  });
});
