import { expect } from "aegir/chai";
import {
  rechercherBdsSelonDescription,
  rechercherBdsSelonIdMotClef,
  rechercherBdsSelonIdVariable,
  rechercherBdsSelonMotClef,
  rechercherBdsSelonNomMotClef,
  rechercherBdsSelonNomVariable,
  rechercherBdsSelonTexte,
  rechercherBdsSelonVariable,
} from "@/v2/recherche/fonctions/bds.js";
import { rechercherVariablesSelonTexte } from "@/v2/recherche/fonctions/variables.js";
import { créerConstellationsTest, obtenir } from "../utils.js";
import type { ServicesNécessairesRechercheBds } from "@/v2/recherche/fonctions/bds.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type { Constellation } from "@/v2/index.js";
import type {
  InfoRésultatRecherche,
  InfoRésultatTexte,
  InfoRésultatVide,
  RésultatObjectifRecherche,
  SuivreObjectifRecherche,
} from "@/v2/recherche/types.js";

describe("Rechercher bds", function () {
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
    let idBd: string;
    let recherche: SuivreObjectifRecherche<
      InfoRésultatTexte,
      ServicesNécessairesRechercheBds
    >;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      recherche = rechercherBdsSelonDescription("Météo");
    });

    it("pas de résultat quand la bd n'a pas de nom", async () => {
      const résultat = await obtenir(({ siNonDéfini }) =>
        recherche({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siNonDéfini(),
        }),
      );
      expect(résultat).to.be.empty();
    });

    it("ajout nom détecté", async () => {
      const pRésultat = obtenir(({ siDéfini }) =>
        recherche({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siDéfini(),
        }),
      );
      await constl.bds.sauvegarderNoms({
        idBd,
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
    let idBd: string;
    let recherche: SuivreObjectifRecherche<
      InfoRésultatTexte,
      ServicesNécessairesRechercheBds
    >;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      recherche = rechercherBdsSelonDescription("Météo");
    });

    it("pas de résultat quand la bd n'a pas de description", async () => {
      const résultat = await obtenir(({ siNonDéfini }) =>
        recherche({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siNonDéfini(),
        }),
      );
      expect(résultat).to.be.empty();
    });

    it("ajout description détecté", async () => {
      const pRésultat = obtenir(({ siDéfini }) =>
        recherche({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siDéfini(),
        }),
      );
      await constl.bds.sauvegarderDescriptions({
        idBd,
        descriptions: {
          fr: "Météo historique pour la région de Montréal",
        },
      });

      const résultat = await pRésultat;

      const réf: RésultatObjectifRecherche<InfoRésultatTexte> = {
        type: "résultat",
        clef: "fr",
        de: "descriptions",
        info: {
          type: "texte",
          début: 0,
          fin: 5,
          texte: "Météo historique pour la région de Montréal",
        },
        score: 1,
      };
      expect(résultat).to.deep.equal(réf);
    });
  });

  describe("selon mot-clef", function () {
    let idBd: string;
    let idMotClef: string;

    type TypeRésultat = InfoRésultatRecherche<InfoRésultatTexte>;

    let rechercheNomMotClef: SuivreObjectifRecherche<
      TypeRésultat,
      ServicesNécessairesRechercheBds
    >;
    let rechercheIdMotClef: SuivreObjectifRecherche<
      TypeRésultat,
      ServicesNécessairesRechercheBds
    >;
    let rechercheMotClef: SuivreObjectifRecherche<
      TypeRésultat,
      ServicesNécessairesRechercheBds
    >;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      idMotClef = await constl.motsClefs.créerMotClef();

      rechercheNomMotClef = rechercherBdsSelonNomMotClef("Météo");
      rechercheIdMotClef = rechercherBdsSelonIdMotClef(idMotClef.slice(0, 15));
      rechercheMotClef = rechercherBdsSelonMotClef("Météo");
    });

    it("pas de résultat quand la bd n'a pas de mot-clef", async () => {
      const résultatNom = await obtenir(({ siNonDéfini }) =>
        rechercheNomMotClef({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siNonDéfini(),
        }),
      );
      const résultatId = await obtenir(({ siNonDéfini }) =>
        rechercheIdMotClef({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siNonDéfini(),
        }),
      );
      const résultatTous = await obtenir(({ siNonDéfini }) =>
        rechercheMotClef({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
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
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siNonDéfini(),
        }),
      );
      const pRésultatTous = obtenir(({ siNonDéfini }) =>
        rechercheMotClef({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siNonDéfini(),
        }),
      );

      await constl.bds.ajouterMotsClefs({
        idBd,
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
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siNonDéfini(),
        }),
      );
      const pRésultatTous = obtenir(({ siNonDéfini }) =>
        rechercheMotClef({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
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
    let idBd: string;
    let idVariable: string;

    let rechercheNomVariable: SuivreObjectifRecherche<
      InfoRésultatRecherche<InfoRésultatTexte>,
      ServicesNécessairesRechercheBds
    >;
    let rechercheIdVariable: SuivreObjectifRecherche<
      InfoRésultatRecherche<InfoRésultatTexte>,
      ServicesNécessairesRechercheBds
    >;
    let rechercheVariable: SuivreObjectifRecherche<
      InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>,
      ServicesNécessairesRechercheBds
    >;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      rechercheNomVariable = rechercherBdsSelonNomVariable("Précip");
      rechercheIdVariable = rechercherBdsSelonIdVariable(
        idVariable.slice(0, 15),
      );
      rechercheVariable = rechercherBdsSelonVariable("Précip");
    });

    it("pas de résultat quand la bd n'a pas de variable", async () => {
      const résultatNom = await obtenir(({ siNonDéfini }) =>
        rechercheNomVariable({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siNonDéfini(),
        }),
      );
      const résultatId = await obtenir(({ siNonDéfini }) =>
        rechercheIdVariable({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siNonDéfini(),
        }),
      );
      const résultatTous = await obtenir(({ siNonDéfini }) =>
        rechercheVariable({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
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
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siNonDéfini(),
        }),
      );
      const pRésultatTous = obtenir(({ siNonDéfini }) =>
        rechercheVariable({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siNonDéfini(),
        }),
      );

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
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siNonDéfini(),
        }),
      );
      const pRésultatTous = obtenir(({ siNonDéfini }) =>
        rechercheVariable({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
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

  describe("selon texte", function () {
    let idBd: string;

    type TypeRésultatBd =
      | InfoRésultatTexte
      | InfoRésultatRecherche<InfoRésultatTexte>
      | InfoRésultatVide;

    let rechercheId: SuivreObjectifRecherche<
      TypeRésultatBd,
      ServicesNécessairesRechercheBds
    >;
    let rechercheNom: SuivreObjectifRecherche<
      TypeRésultatBd,
      ServicesNécessairesRechercheBds
    >;
    let rechercheDescription: SuivreObjectifRecherche<
      TypeRésultatBd,
      ServicesNécessairesRechercheBds
    >;
    let rechercheVariables: SuivreObjectifRecherche<
      TypeRésultatBd,
      ServicesNécessairesRechercheBds
    >;
    let rechercheMotsClefs: SuivreObjectifRecherche<
      TypeRésultatBd,
      ServicesNécessairesRechercheBds
    >;
    let rechercheVide: SuivreObjectifRecherche<
      TypeRésultatBd,
      ServicesNécessairesRechercheBds
    >;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });

      rechercheNom = rechercherBdsSelonTexte("Hydrologie");
      rechercheDescription = rechercherBdsSelonTexte("Montréal");
      rechercheId = rechercherBdsSelonTexte(idBd.slice(0, 15));
      rechercheVariables = rechercherBdsSelonTexte("Température");
      rechercheMotsClefs = rechercherBdsSelonTexte("Météo");
      rechercheVide = rechercherVariablesSelonTexte("");
    });

    it("résultat id détecté", async () => {
      const résultatId = await obtenir(({ siNonDéfini }) =>
        rechercheId({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siNonDéfini(),
        }),
      );

      const réf: RésultatObjectifRecherche<TypeRésultatBd> = {
        type: "résultat",
        de: "id",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: idBd,
        },
        score: 1,
      };
      expect(résultatId).to.deep.equal(réf);
    });

    it("résultat nom détecté", async () => {
      const pRésultatNom = obtenir<RésultatObjectifRecherche<TypeRésultatBd>>(
        ({ siDéfini }) =>
          rechercheNom({
            services: (clef) => constl.services[clef],
            idObjet: idBd,
            f: siDéfini(),
          }),
      );
      await constl.bds.sauvegarderNoms({
        idBd,
        noms: { fr: "Hydrologie" },
      });

      const résulatNoms = await pRésultatNom;

      const réf: RésultatObjectifRecherche<TypeRésultatBd> = {
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

    it("résultat descriptions détecté", async () => {
      const pRésultatDescription = obtenir<
        RésultatObjectifRecherche<TypeRésultatBd>
      >(({ siDéfini }) =>
        rechercheDescription({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: siDéfini(),
        }),
      );

      await constl.bds.sauvegarderDescriptions({
        idBd,
        descriptions: {
          fr: "Hydrologie de Montréal",
        },
      });

      const résulatDescriptions = await pRésultatDescription;

      const réf: RésultatObjectifRecherche<TypeRésultatBd> = {
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
      expect(résulatDescriptions).to.deep.equal(réf);
    });

    it("résultat variable détecté", async () => {
      const pRésultatVariable = obtenir<
        RésultatObjectifRecherche<TypeRésultatBd>
      >(({ si }) =>
        rechercheVariables({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
          f: si(
            (r) =>
              !!r &&
              r.type === "résultat" &&
              r.de === "variable" &&
              r.info.type === "résultat" &&
              r.info.de === "nom",
          ),
        }),
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

      const réf: RésultatObjectifRecherche<TypeRésultatBd> = {
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
      expect(résulatVariable).to.deep.equal(réf);
    });

    it("résultat mot-clef détecté", async () => {
      const pRésultatMotClef = obtenir<
        RésultatObjectifRecherche<TypeRésultatBd>
      >(({ si }) =>
        rechercheMotsClefs({
          services: (clef) => constl.services[clef],
          idObjet: idBd,
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

      const réf: RésultatObjectifRecherche<TypeRésultatBd> = {
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
      expect(résulatMotClef).to.deep.equal(réf);
    });

    it("résultat recherche vide", async () => {
      const résultat = await obtenir<RésultatObjectifRecherche<TypeRésultatBd>>(
        ({ siDéfini }) =>
          rechercheVide({
            services: (clef) => constl.services[clef],
            idObjet: idBd,
            f: siDéfini(),
          }),
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
