import { expect } from "aegir/chai";
import {
  rechercherProjetsSelonBd,
  rechercherProjetsSelonIdBd,
  rechercherProjetsSelonIdMotClef,
  rechercherProjetsSelonIdVariable,
  rechercherProjetsSelonMotClef,
  rechercherProjetsSelonNom,
  rechercherProjetsSelonNomMotClef,
  rechercherProjetsSelonNomVariable,
  rechercherProjetsSelonTexte,
  rechercherProjetsSelonVariable,
} from "@/v2/recherche/fonctions/projets.js";
import { créerConstellationsTest, obtenir } from "../utils.js";
import type { Constellation } from "@/v2/index.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type {
  RésultatObjectifRecherche,
  InfoRésultatTexte,
  InfoRésultatRecherche,
  InfoRésultatVide,
  SuivreObjectifRecherche,
} from "@/v2/recherche/types.js";

describe("Rechercher projets", function () {
  let constls: Constellation[];
  let constl: Constellation;
  let fermer: Oublier;

  before(async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 1,
      avecMandataire: false,
    }));
    constl = constls[0] as Constellation;
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("selon nom", function () {
    let idProjet: string;
    let recherche: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      idProjet = await constl.projets.créerProjet();

      recherche = rechercherProjetsSelonNom("Météo");
    });

    it("pas de résultat quand le projet n'a pas de nom", async () => {
      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ siNonDéfini }) =>
        recherche({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      expect(résultat).to.be.undefined();
    });

    it("ajout nom détecté", async () => {
      const pRésultat = obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ siDéfini }) =>
        recherche({
          services: constl.services,
          idObjet: idProjet,
          f: siDéfini(),
        }),
      );

      await constl.projets.sauvegarderNoms({
        idProjet,
        noms: {
          fr: "Météorologie",
        },
      });

      const résultat = await pRésultat;

      const réf: RésultatObjectifRecherche<InfoRésultatTexte> = {
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
      };
      expect(résultat).to.deep.equal(réf);
    });
  });

  describe("selon description", function () {
    let idProjet: string;
    let recherche: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
      recherche = rechercherProjetsSelonNom("Météo");
    });

    it("pas de résultat quand le projet n'a pas de description", async () => {
      const résultat = await obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ siNonDéfini }) =>
        recherche({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      expect(résultat).to.be.undefined();
    });

    it("Ajout description détecté", async () => {
      const pRésultat = obtenir<
        RésultatObjectifRecherche<InfoRésultatTexte> | undefined
      >(({ siDéfini }) =>
        recherche({
          services: constl.services,
          idObjet: idProjet,
          f: siDéfini(),
        }),
      );

      await constl.projets.sauvegarderDescriptions({
        idProjet,
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

  describe("selon mot-clef", function () {
    let idProjet: string;
    let idMotClef: string;

    let rechercheNomMotClef: SuivreObjectifRecherche<
      InfoRésultatRecherche<InfoRésultatTexte>
    >;
    let rechercheIdMotClef: SuivreObjectifRecherche<
      InfoRésultatRecherche<InfoRésultatTexte>
    >;
    let rechercheMotClef: SuivreObjectifRecherche<
      InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
    >;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
      idMotClef = await constl.motsClefs.créerMotClef();

      rechercheNomMotClef = rechercherProjetsSelonNomMotClef("Météo");
      rechercheIdMotClef = rechercherProjetsSelonIdMotClef(
        idMotClef.slice(0, 15),
      );
      rechercheMotClef = rechercherProjetsSelonMotClef("Météo");
    });

    it("pas de résultat quand le projet n'a pas de mot-clef", async () => {
      const résultatNom = await obtenir(({ siNonDéfini }) =>
        rechercheNomMotClef({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      const résultatId = await obtenir(({ siNonDéfini }) =>
        rechercheIdMotClef({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      const résultatTous = await obtenir(({ siNonDéfini }) =>
        rechercheMotClef({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      expect(résultatId).to.be.undefined();
      expect(résultatNom).to.be.undefined();
      expect(résultatTous).to.be.undefined();
    });

    it("ajout mot-clef détecté", async () => {
      const pRésultatId = obtenir(({ siNonDéfini }) =>
        rechercheIdMotClef({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      const pRésultatTous = obtenir(({ siNonDéfini }) =>
        rechercheMotClef({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      await constl.projets.ajouterMotsClefs({
        idProjet,
        idsMotsClefs: idMotClef,
      });

      const résultatId = await pRésultatId;
      const résultatTous = await pRésultatTous;

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
      expect(résultatTous).to.deep.equal(réfRésId);
    });

    it("ajout nom mot-clef détecté", async () => {
      const pRésultatNom = obtenir(({ siNonDéfini }) =>
        rechercheNomMotClef({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      const pRésultatTous = obtenir(({ siNonDéfini }) =>
        rechercheMotClef({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
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
    let idProjet: string;
    let idVariable: string;

    let rechercheNomVariable: SuivreObjectifRecherche<
      InfoRésultatRecherche<InfoRésultatTexte>
    >;
    let rechercheIdVariable: SuivreObjectifRecherche<
      InfoRésultatRecherche<InfoRésultatTexte>
    >;
    let rechercheVariable: SuivreObjectifRecherche<
      InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
    >;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      rechercheNomVariable = rechercherProjetsSelonNomVariable("Précip");
      rechercheIdVariable = rechercherProjetsSelonIdVariable(
        idVariable.slice(0, 15),
      );
      rechercheVariable = rechercherProjetsSelonVariable("Précip");
    });

    it("pas de résultat quand la bd n'a pas de variable", async () => {
      const résultatNom = await obtenir(({ siNonDéfini }) =>
        rechercheNomVariable({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      const résultatId = await obtenir(({ siNonDéfini }) =>
        rechercheIdVariable({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      const résultatTous = await obtenir(({ siNonDéfini }) =>
        rechercheVariable({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      expect(résultatId).to.be.undefined();
      expect(résultatNom).to.be.undefined();
      expect(résultatTous).to.be.undefined();
    });

    it("ajout variable détecté", async () => {
      const pRésultatId = obtenir(({ siNonDéfini }) =>
        rechercheIdVariable({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      const pRésultatTous = obtenir(({ siNonDéfini }) =>
        rechercheVariable({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );

      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      await constl.projets.ajouterBds({ idProjet, idsBds: idBd });

      const idTableau = await constl.bds.ajouterTableau({ idBd });
      await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idVariable,
      });

      const résultatId = await pRésultatId;
      const résultatTous = await pRésultatTous;

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
      expect(résultatTous).to.deep.equal(réfRésId);
    });

    it("ajout nom variable détecté", async () => {
      const pRésultatNom = obtenir(({ siNonDéfini }) =>
        rechercheNomVariable({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      const pRésultatTous = obtenir(({ siNonDéfini }) =>
        rechercheVariable({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
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

  describe("selon bd", function () {
    let idProjet: string;
    let idBd: string;

    type TypeRésultatBd = InfoRésultatRecherche<
      | InfoRésultatVide
      | InfoRésultatTexte
      | InfoRésultatRecherche<
          | InfoRésultatTexte
          | InfoRésultatRecherche<InfoRésultatTexte>
          | InfoRésultatVide
        >
    >;

    let rechercheIdBd: SuivreObjectifRecherche<
      InfoRésultatRecherche<InfoRésultatTexte>
    >;
    let rechercheNomBd: SuivreObjectifRecherche<TypeRésultatBd>;
    let rechercheDescriptionBd: SuivreObjectifRecherche<TypeRésultatBd>;
    let rechercheVariablesBd: SuivreObjectifRecherche<TypeRésultatBd>;
    let rechercheMotsClefBd: SuivreObjectifRecherche<TypeRésultatBd>;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });

      rechercheIdBd = rechercherProjetsSelonIdBd(idBd.slice(0, 15));
      rechercheNomBd = rechercherProjetsSelonBd("Hydrologie");
      rechercheDescriptionBd = rechercherProjetsSelonBd("Montréal");
      rechercheVariablesBd = rechercherProjetsSelonBd("Température");
      rechercheMotsClefBd = rechercherProjetsSelonBd("Météo");
    });

    it("résultat id détecté", async () => {
      const pRésultatId = obtenir(({ siNonDéfini }) =>
        rechercheIdBd({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );
      await constl.projets.ajouterBds({ idProjet, idsBds: [idBd] });

      const résultatId = await pRésultatId;

      const réfRés: RésultatObjectifRecherche<
        InfoRésultatRecherche<InfoRésultatTexte>
      > = {
        type: "résultat",
        de: "bd",
        clef: idBd,
        info: {
          type: "résultat",
          de: "id",
          info: {
            type: "texte",
            début: 0,
            fin: 15,
            texte: idBd,
          },
        },
        score: 1,
      };
      expect(résultatId).to.deep.equal(réfRés);
    });

    it("résultat nom détecté", async () => {
      const pRésultatNom = obtenir<RésultatObjectifRecherche<TypeRésultatBd>>(
        ({ siDéfini }) =>
          rechercheNomBd({ services: constl.services, idObjet: idProjet, f: siDéfini() }),
      );

      await constl.bds.sauvegarderNoms({
        idBd,
        noms: { fr: "Hydrologie" },
      });

      const résulatNom = await pRésultatNom;

      const réfRés: RésultatObjectifRecherche<
        InfoRésultatRecherche<InfoRésultatTexte>
      > = {
        type: "résultat",
        de: "bd",
        clef: idBd,
        info: {
          type: "résultat",
          clef: "fr",
          de: "nom",
          info: {
            type: "texte",
            début: 0,
            fin: 10,
            texte: "Hydrologie",
          },
        },
        score: 1,
      };

      expect(résulatNom).to.deep.equal(réfRés);
    });

    it("résultat description détectée", async () => {
      const pRésultatDescription = obtenir<
        RésultatObjectifRecherche<TypeRésultatBd>
      >(({ siDéfini }) =>
        rechercheDescriptionBd({ services: constl.services, idObjet: idProjet, f: siDéfini() }),
      );
      await constl.bds.sauvegarderDescriptions({
        idBd,
        descriptions: {
          fr: "Hydrologie de Montréal",
        },
      });
      const résulatDescription = await pRésultatDescription;

      const réfRés: RésultatObjectifRecherche<
        InfoRésultatRecherche<InfoRésultatTexte>
      > = {
        type: "résultat",
        de: "bd",
        clef: idBd,
        info: {
          type: "résultat",
          clef: "fr",
          de: "descriptions",
          info: {
            type: "texte",
            début: 14,
            fin: 22,
            texte: "Hydrologie de Montréal",
          },
        },
        score: 1,
      };
      expect(résulatDescription).to.deep.equal(réfRés);
    });

    it("résultat variable détecté", async () => {
      const pRésultatVariable = obtenir<
        RésultatObjectifRecherche<TypeRésultatBd>
      >(({ siDéfini }) =>
        rechercheVariablesBd({ services: constl.services, idObjet: idProjet, f: siDéfini() }),
      );

      const idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      const idTableau = await constl.bds.ajouterTableau({ idBd });
      await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idVariable,
      });
      await constl.variables.sauvegarderNoms({
        idVariable,
        noms: {
          fr: "Température maximale",
        },
      });

      const résulatVariable = await pRésultatVariable;

      const réfRés: RésultatObjectifRecherche<
        InfoRésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>
      > = {
        type: "résultat",
        de: "bd",
        clef: idBd,
        info: {
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
        },
        score: 1,
      };
      expect(résulatVariable).to.deep.equal(réfRés);
    });

    it("résultat mot-clef détecté", async () => {
      const pRésultatMotClef = obtenir<
        RésultatObjectifRecherche<TypeRésultatBd>
      >(({ si }) =>
        rechercheMotsClefBd({
          services: constl.services,
          idObjet: idProjet,
          f: si(
            (r) =>
              !!r &&
              r.type === "résultat" &&
              r.info.de === "motClef" &&
              r.info.info.type === "résultat" &&
              r.info.info.de === "nom",
          ),
        }),
      );

      const idMotClef = await constl.motsClefs.créerMotClef();
      await constl.bds.ajouterMotsClefs({
        idBd,
        idsMotsClefs: idMotClef,
      });
      await constl.motsClefs.sauvegarderNoms({
        idMotClef,
        noms: {
          fr: "Météorologie",
        },
      });

      const résulatMotClef = await pRésultatMotClef;

      const réfRés: RésultatObjectifRecherche<
        InfoRésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>
      > = {
        type: "résultat",
        de: "bd",
        clef: idBd,
        info: {
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
        },
        score: 1,
      };
      expect(résulatMotClef).to.deep.equal(réfRés);
    });
  });

  describe("selon texte", function () {
    let idProjet: string;
    let idBd: string;

    type TypeRésultatProjet =
      | InfoRésultatTexte
      | InfoRésultatRecherche<
          | InfoRésultatTexte
          | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
          | InfoRésultatVide
        >
      | InfoRésultatVide;

    let rechercheId: SuivreObjectifRecherche<TypeRésultatProjet>;
    let rechercheNom: SuivreObjectifRecherche<TypeRésultatProjet>;
    let rechercheDescription: SuivreObjectifRecherche<TypeRésultatProjet>;
    let rechercheBds: SuivreObjectifRecherche<TypeRésultatProjet>;
    let rechercheVariables: SuivreObjectifRecherche<TypeRésultatProjet>;
    let rechercheMotsClefs: SuivreObjectifRecherche<TypeRésultatProjet>;
    let rechercheVide: SuivreObjectifRecherche<TypeRésultatProjet>;

    before(async () => {
      idProjet = await constl.projets.créerProjet();
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });

      rechercheNom = rechercherProjetsSelonTexte("Hydrologie");
      rechercheId = rechercherProjetsSelonTexte(idProjet.slice(0, 15));
      rechercheDescription = rechercherProjetsSelonTexte("Montréal");
      rechercheBds = rechercherProjetsSelonTexte(idBd);
      rechercheVariables = rechercherProjetsSelonTexte("Température");
      rechercheMotsClefs = rechercherProjetsSelonTexte("Météo");
      rechercheVide = rechercherProjetsSelonTexte("");
    });

    it("résultat id détecté", async () => {
      const résultatId = await obtenir(({ siNonDéfini }) =>
        rechercheId({
          services: constl.services,
          idObjet: idProjet,
          f: siNonDéfini(),
        }),
      );

      const réf: RésultatObjectifRecherche<TypeRésultatProjet> = {
        type: "résultat",
        de: "id",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: idProjet,
        },
        score: 1,
      };
      expect(résultatId).to.deep.equal(réf);
    });

    it("résultat nom détecté", async () => {
      const pRésultatNom = obtenir<
        RésultatObjectifRecherche<TypeRésultatProjet>
      >(({ siDéfini }) =>
        rechercheNom({ services: constl.services, idObjet: idProjet, f: siDéfini() }),
      );
      await constl.projets.sauvegarderNoms({
        idProjet,
        noms: {
          fr: "Hydrologie",
        },
      });
      const résulatNoms = await pRésultatNom;

      const réf: RésultatObjectifRecherche<TypeRésultatProjet> = {
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
      };
      expect(résulatNoms).to.deep.equal(réf);
    });

    it("résultat description détecté", async () => {
      const pRésultatDescription = obtenir<
        RésultatObjectifRecherche<TypeRésultatProjet>
      >(({ siDéfini }) =>
        rechercheDescription({ services: constl.services, idObjet: idProjet, f: siDéfini() }),
      );

      await constl.projets.sauvegarderDescriptions({
        idProjet,
        descriptions: {
          fr: "Hydrologie de Montréal",
        },
      });

      const résulatDescription = await pRésultatDescription;

      const réf: RésultatObjectifRecherche<TypeRésultatProjet> = {
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
      };
      expect(résulatDescription).to.deep.equal(réf);
    });

    it("résultat bd détecté", async () => {
      const pRésultatBd = obtenir<
        RésultatObjectifRecherche<TypeRésultatProjet>
      >(({ siDéfini }) =>
        rechercheBds({ services: constl.services, idObjet: idProjet, f: siDéfini() }),
      );
      await constl.projets.ajouterBds({ idProjet, idsBds: idBd });

      const résulatBd = await pRésultatBd;

      const réf: RésultatObjectifRecherche<TypeRésultatProjet> = {
        type: "résultat",
        clef: idBd,
        de: "bd",
        info: {
          type: "résultat",
          de: "id",
          info: {
            type: "texte",
            début: 0,
            fin: idBd.length,
            texte: idBd,
          },
        },
        score: 1,
      };
      expect(résulatBd).to.deep.equal(réf);
    });

    it("résultat variable détecté", async () => {
      const pRésultatVariable = obtenir<
        RésultatObjectifRecherche<TypeRésultatProjet>
      >(({ siDéfini }) =>
        rechercheVariables({ services: constl.services, idObjet: idProjet, f: siDéfini() }),
      );
      const idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      const idTableau = await constl.bds.ajouterTableau({ idBd });
      await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idVariable,
      });
      await constl.variables.sauvegarderNoms({
        idVariable,
        noms: {
          fr: "Température maximale",
        },
      });
      const résulatVariable = await pRésultatVariable;

      const réf: RésultatObjectifRecherche<
        InfoRésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>
      > = {
        type: "résultat",
        de: "bd",
        clef: idBd,
        info: {
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
        },
        score: 1,
      };
      expect(résulatVariable).to.deep.equal(réf);
    });

    it("résultat mot-clef détecté", async () => {
      const pRésultatMotClef = obtenir<
        RésultatObjectifRecherche<TypeRésultatProjet>
      >(({ si }) =>
        rechercheMotsClefs({
          services: constl.services,
          idObjet: idProjet,
          f: si(
            (r) =>
              !!r &&
              r.de !== "id" &&
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
      await constl.projets.ajouterMotsClefs({
        idProjet: idProjet,
        idsMotsClefs: idMotClef,
      });

      const résulatMotClef = await pRésultatMotClef;

      const résRéfMotClef: RésultatObjectifRecherche<
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

      const résRéfMotClefDeBd: RésultatObjectifRecherche<
        InfoRésultatRecherche<InfoRésultatRecherche<InfoRésultatTexte>>
      > = {
        type: "résultat",
        clef: idBd,
        de: "bd",
        info: {
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
        },
        score: 1,
      };

      // Il faut vérifier les deux, parce que le mot-clef peut être détecté sur le projet lui-même ou bien sur la bd
      if (résulatMotClef.de === "bd") {
        expect(résulatMotClef).to.deep.equal(résRéfMotClefDeBd);
      } else {
        expect(résulatMotClef).to.deep.equal(résRéfMotClef);
      }
    });

    it("résultat recherche vide", async () => {
      const résultat = await obtenir<
        RésultatObjectifRecherche<TypeRésultatProjet>
      >(({ siDéfini }) =>
        rechercheVide({ services: constl.services, idObjet: idProjet, f: siDéfini() }),
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
