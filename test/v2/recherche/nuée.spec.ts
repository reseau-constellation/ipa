import { expect } from "aegir/chai";
import {
  rechercherNuéesSelonNom,
  rechercherNuéesSelonNomMotClef,
  rechercherNuéesSelonIdMotClef,
  rechercherNuéesSelonMotClef,
  rechercherNuéesSelonNomVariable,
  rechercherNuéesSelonIdVariable,
  rechercherNuéesSelonVariable,
  rechercherNuéesSelonTexte,
  rechercherNuéesSelonDescription,
} from "@/v2/recherche/fonctions/nuées.js";
import { créerConstellationsTest, obtenir } from "../utils.js";
import type { Oublier } from "@/v2/crabe/types.js";
import type {
  RésultatObjectifRecherche,
  InfoRésultatTexte,
  InfoRésultatRecherche,
  InfoRésultatVide,
  SuivreObjectifRecherche,
} from "@/v2/recherche/types.js";
import type { Constellation } from "@/v2/index.js";

describe("Rechercher nuées", function () {
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

  describe("Selon nom", function () {
    let idNuée: string;

    let recherche: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();

      recherche = rechercherNuéesSelonNom("Météo");
    });

    it("pas de résultat quand la nuée n'a pas de nom", async () => {
      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ siNonDéfini }) =>
        recherche({
          constl,
          idObjet: idNuée,
          f: siNonDéfini(),
        }),
      );
      expect(résultat).to.be.undefined();
    });

    it("ajout nom détecté", async () => {
      const pRésultat = obtenir<RésultatObjectifRecherche<InfoRésultatTexte>>(
        ({ siDéfini }) => recherche({ constl, idObjet: idNuée, f: siDéfini() }),
      );
      await constl.nuées.sauvegarderNoms({
        idNuée,
        noms: {
          fr: "Météorologie",
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
          fin: 5,
          texte: "Météorologie",
        },
        score: 1,
      });
    });
  });

  describe("selon description", function () {
    let idNuée: string;

    let recherche: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();

      recherche = rechercherNuéesSelonDescription("Météo");

      it("pas de résultat quand la nuée n'a pas de description", async () => {
        const résultat = await obtenir<
          RésultatObjectifRecherche<InfoRésultatTexte> | undefined
        >(({ siNonDéfini }) =>
          recherche({
            constl,
            idObjet: idNuée,
            f: siNonDéfini(),
          }),
        );
        expect(résultat).to.be.undefined();
      });

      it("ajout description détecté", async () => {
        const pRésultat = obtenir<RésultatObjectifRecherche<InfoRésultatTexte>>(
          ({ siDéfini }) =>
            recherche({ constl, idObjet: idNuée, f: siDéfini() }),
        );

        await constl.nuées.sauvegarderDescriptions({
          idNuée,
          descriptions: {
            fr: "Météo historique",
          },
        });

        const résultat = await pRésultat;
        expect(résultat).to.deep.equal({
          type: "résultat",
          clef: "fr",
          de: "descriptions",
          info: {
            type: "texte",
            début: 0,
            fin: 5,
            texte: "Météo historique",
          },
          score: 1,
        });
      });
    });
  });

  describe("selon mot-clef", function () {
    let idNuée: string;
    let idMotClef: string;

    type TypeRésultat = InfoRésultatRecherche<InfoRésultatTexte>;

    let rechercheId: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheNom: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheTous: SuivreObjectifRecherche<TypeRésultat>;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
      idMotClef = await constl.motsClefs.créerMotClef();

      rechercheId = rechercherNuéesSelonIdMotClef(idMotClef.slice(0, 15));
      rechercheNom = rechercherNuéesSelonNomMotClef("Météo");
      rechercheTous = rechercherNuéesSelonMotClef("Météo");
    });

    it("pas de résultat quand la nuée n'a pas de mot-clef", async () => {
      const résultatId = await obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siNonDéfini }) =>
          rechercheId({
            constl,
            idObjet: idNuée,
            f: siNonDéfini(),
          }),
      );
      const résultatNom = await obtenir<
        RésultatObjectifRecherche<TypeRésultat>
      >(({ siNonDéfini }) =>
        rechercheNom({
          constl,
          idObjet: idNuée,
          f: siNonDéfini(),
        }),
      );
      const résultatTous = await obtenir<
        RésultatObjectifRecherche<TypeRésultat>
      >(({ siNonDéfini }) =>
        rechercheTous({
          constl,
          idObjet: idNuée,
          f: siNonDéfini(),
        }),
      );

      expect(résultatId).to.be.undefined();
      expect(résultatNom).to.be.undefined();
      expect(résultatTous).to.be.undefined();
    });

    it("ajout mot-clef détecté", async () => {
      const pRésultatId = obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siDéfini }) =>
          rechercheId({ constl, idObjet: idNuée, f: siDéfini() }),
      );
      await constl.nuées.ajouterMotsClefs({
        idNuée,
        idsMotsClefs: idMotClef,
      });

      const résultatId = await pRésultatId;

      const réfRésId: RésultatObjectifRecherche<
        InfoRésultatRecherche<InfoRésultatTexte>
      > = {
        type: "résultat",
        clef: idMotClef,
        de: "motClef",
        info: {
          type: "résultat",
          de: "id",
          info: {
            type: "texte",
            début: 0,
            fin: 15,
            texte: idMotClef,
          },
        },
        score: 1,
      };

      expect(résultatId).to.deep.equal(réfRésId);
    });

    it("ajout nom mot-clef détecté", async () => {
      const pRésultatNom = obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siDéfini }) =>
          rechercheNom({ constl, idObjet: idNuée, f: siDéfini() }),
      );
      const pRésultatTous = obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siDéfini }) =>
          rechercheTous({ constl, idObjet: idNuée, f: siDéfini() }),
      );

      await constl.motsClefs.sauvegarderNoms({
        idMotClef,
        noms: {
          fr: "Météo historique pour la région de Montréal",
        },
      });

      const résultatNom = await pRésultatNom;
      const résultatTous = await pRésultatTous;

      const réfRésNom: RésultatObjectifRecherche<
        InfoRésultatRecherche<InfoRésultatTexte>
      > = {
        type: "résultat",
        clef: idMotClef,
        de: "motClef",
        info: {
          type: "résultat",
          de: "nom",
          clef: "fr",
          info: {
            type: "texte",
            début: 0,
            fin: 5,
            texte: "Météo historique pour la région de Montréal",
          },
        },
        score: 1,
      };

      expect(résultatNom).to.deep.equal(réfRésNom);
      expect(résultatTous).to.deep.equal(réfRésNom);
    });
  });

  describe("selon variable", function () {
    let idNuée: string;
    let idVariable: string;

    type TypeRésultat = InfoRésultatRecherche<InfoRésultatTexte>;

    let rechercheId: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheNom: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheTous: SuivreObjectifRecherche<TypeRésultat>;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      rechercheId = rechercherNuéesSelonIdVariable(idVariable.slice(0, 15));
      rechercheNom = rechercherNuéesSelonNomVariable("Précip");
      rechercheTous = rechercherNuéesSelonVariable("Précip");
    });

    it("Pas de résultat quand la nuée n'a pas de variable", async () => {
      const résultatId = await obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siNonDéfini }) =>
          rechercheId({
            constl,
            idObjet: idNuée,
            f: siNonDéfini(),
          }),
      );
      const résultatNom = await obtenir<
        RésultatObjectifRecherche<TypeRésultat>
      >(({ siNonDéfini }) =>
        rechercheNom({
          constl,
          idObjet: idNuée,
          f: siNonDéfini(),
        }),
      );
      const résultatTous = await obtenir<
        RésultatObjectifRecherche<TypeRésultat>
      >(({ siNonDéfini }) =>
        rechercheTous({
          constl,
          idObjet: idNuée,
          f: siNonDéfini(),
        }),
      );

      expect(résultatId).to.be.undefined();
      expect(résultatNom).to.be.undefined();
      expect(résultatTous).to.be.undefined();
    });

    it("ajout variable détecté", async () => {
      const pRésultatId = obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siDéfini }) =>
          rechercheId({ constl, idObjet: idNuée, f: siDéfini() }),
      );

      const idTableau = await constl.nuées.ajouterTableau({ idNuée });
      await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuée,
        idTableau,
        idVariable,
      });

      const résultatId = await pRésultatId;

      const réfRésId: RésultatObjectifRecherche<
        InfoRésultatRecherche<InfoRésultatTexte>
      > = {
        type: "résultat",
        clef: idVariable,
        de: "variable",
        info: {
          type: "résultat",
          de: "id",
          info: {
            type: "texte",
            début: 0,
            fin: 15,
            texte: idVariable,
          },
        },
        score: 1,
      };

      expect(résultatId).to.deep.equal(réfRésId);
    });

    it("ajout nom variable détecté", async () => {
      const pRésultatNom = obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siDéfini }) =>
          rechercheNom({ constl, idObjet: idNuée, f: siDéfini() }),
      );
      const pRésultatTous = obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ siDéfini }) =>
          rechercheTous({ constl, idObjet: idNuée, f: siDéfini() }),
      );

      await constl.variables.sauvegarderNoms({
        idVariable,
        noms: {
          fr: "Précipitation mensuelle",
        },
      });

      const résultatNom = await pRésultatNom;
      const résultatTous = await pRésultatTous;

      const réfRésNom: RésultatObjectifRecherche<
        InfoRésultatRecherche<InfoRésultatTexte>
      > = {
        type: "résultat",
        clef: idVariable,
        de: "variable",
        info: {
          type: "résultat",
          de: "nom",
          clef: "fr",
          info: {
            type: "texte",
            début: 0,
            fin: 6,
            texte: "Précipitation mensuelle",
          },
        },
        score: 1,
      };

      expect(résultatNom).to.deep.equal(réfRésNom);
      expect(résultatTous).to.deep.equal(réfRésNom);
    });
  });

  describe("selon texte", function () {
    let idNuée: string;

    type TypeRésultat =
      | InfoRésultatTexte
      | InfoRésultatRecherche<
          | InfoRésultatTexte
          | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
        >
      | InfoRésultatVide;

    let rechercheNom: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheId: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheDescription: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheVariable: SuivreObjectifRecherche<TypeRésultat>;
    let rechercheMotClef: SuivreObjectifRecherche<TypeRésultat>;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();

      rechercheNom = rechercherNuéesSelonTexte("Hydrologie");
      rechercheId = rechercherNuéesSelonTexte(idNuée.slice(0, 15));
      rechercheDescription = rechercherNuéesSelonTexte("Montréal");
      rechercheVariable = rechercherNuéesSelonTexte("Température");
      rechercheMotClef = rechercherNuéesSelonTexte("Météo");
    });

    it("résultat id détecté", async () => {
      const résultatId = await obtenir<
        RésultatObjectifRecherche<TypeRésultat>
      >(({ siDéfini }) =>
        rechercheId({ constl, idObjet: idNuée, f: siDéfini() }),
      );
      expect(résultatId).to.deep.equal({
        type: "résultat",
        de: "id",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: idNuée,
        },
        score: 1,
      });
    });

    it("résultat nom détecté", async () => {
      const pRésultatNom = obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ si }) =>
          rechercheNom({ constl, idObjet: idNuée, f: si(r => !!r && r.de === "nom") }),
      );

      await constl.nuées.sauvegarderNoms({
        idNuée,
        noms: {
          fr: "Hydrologie",
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
          texte: "Hydrologie",
        },
        score: 1,
      });
    });

    it("résultat description détecté", async () => {
      const pRésultatDescription = obtenir<
        RésultatObjectifRecherche<TypeRésultat>
      >(({ siDéfini }) =>
        rechercheDescription({ constl, idObjet: idNuée, f: siDéfini() }),
      );

      await constl.nuées.sauvegarderDescriptions({
        idNuée,
        descriptions: {
          fr: "Hydrologie de Montréal",
        },
      });

      const résultatDescription = await pRésultatDescription;

      expect(résultatDescription).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "descriptions",
        info: {
          type: "texte",
          début: 14,
          fin: 22,
          texte: "Hydrologie de Montréal",
        },
        score: 1,
      });
    });

    it("résultat variable détecté", async () => {
      const pRésultatVariable = obtenir<
        RésultatObjectifRecherche<TypeRésultat>
      >(({ si }) =>
        rechercheVariable({
          constl,
          idObjet: idNuée,
          f: si(
            (r) =>
              !!r &&
              r.de === "variable" &&
              r.info.type === "résultat" &&
              r.info.de === "nom",
          ),
        }),
      );

      const idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      const idTableau = await constl.nuées.ajouterTableau({ idNuée });
      await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuée,
        idTableau,
        idVariable,
      });
      await constl.variables.sauvegarderNoms({
        idVariable,
        noms: {
          fr: "Température maximale",
        },
      });

      const résultatVariable = await pRésultatVariable;

      const résRéf: RésultatObjectifRecherche<
        InfoRésultatRecherche<InfoRésultatTexte>
      > = {
        type: "résultat",
        clef: idVariable,
        de: "variable",
        info: {
          type: "résultat",
          de: "nom",
          clef: "fr",
          info: {
            type: "texte",
            début: 0,
            fin: 11,
            texte: "Température maximale",
          },
        },
        score: 1,
      };

      expect(résultatVariable).to.deep.equal(résRéf);
    });

    it("résultat mot-clef détecté", async () => {
      const pRésultatMotClef = obtenir<RésultatObjectifRecherche<TypeRésultat>>(
        ({ si }) =>
          rechercheMotClef({
            constl,
            idObjet: idNuée,
            f: si(
              (r) =>
                !!r &&
                r.de === "motClef" &&
                r.info.type === "résultat" &&
                r.info.de === "nom",
            ),
          }),
      );

      const idMotClef = await constl.motsClefs.créerMotClef();
      await constl.motsClefs.sauvegarderNoms({
        idMotClef,
        noms: {
          fr: "Météorologie",
        },
      });
      await constl.nuées.ajouterMotsClefs({
        idNuée: idNuée,
        idsMotsClefs: idMotClef,
      });
      const résultatMotClef = await pRésultatMotClef;

      const résRéf: RésultatObjectifRecherche<
        InfoRésultatRecherche<InfoRésultatTexte>
      > = {
        type: "résultat",
        clef: idMotClef,
        de: "motClef",
        info: {
          type: "résultat",
          de: "nom",
          clef: "fr",
          info: {
            type: "texte",
            début: 0,
            fin: 5,
            texte: "Météorologie",
          },
        },
        score: 1,
      };
      expect(résultatMotClef).to.deep.equal(résRéf);
    });
  });
});
