import { expect } from "aegir/chai";
import { rechercherBdsSelonDescription } from "@/v2/recherche/fonctions/bds.js";
import { créerConstellationsTest, obtenir } from "../utils.js";
import type { Constellation } from "@/v2/index.js";
import type {
  InfoRésultatTexte,
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
    let recherche: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      recherche = rechercherBdsSelonDescription("Météo");
    });

    it("pas de résultat quand la bd n'a pas de nom", async () => {
      const résultat = await obtenir(({ siNonDéfini }) =>
        recherche({ constl, idObjet: idBd, f: siNonDéfini() }),
      );
      expect(résultat).to.be.empty();
    });

    it("ajout nom détecté", async () => {
      const pRésultat = obtenir(({ siDéfini }) =>
        recherche({ constl, idObjet: idBd, f: siDéfini() }),
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
    let recherche: SuivreObjectifRecherche<InfoRésultatTexte>;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      recherche = rechercherBdsSelonDescription("Météo");
    });

    it("pas de résultat quand la bd n'a pas de description", async () => {
      const résultat = await obtenir(({ siNonDéfini }) =>
        recherche({ constl, idObjet: idBd, f: siNonDéfini() }),
      );
      expect(résultat).to.be.empty();
    });

    it("ajout description détecté", async () => {
      const pRésultat = obtenir(({ siDéfini }) =>
        recherche({ constl, idObjet: idBd, f: siDéfini() }),
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
        de: "descr",
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

  describe("Selon mot-clef", function () {
    let idBd: string;
    let idMotClef: string;
    const résultatNom = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>>
    >();
    const résultatId = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>>
    >();
    const résultatTous = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>>
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      idMotClef = await constl.motsClefs.créerMotClef();

      const rechercheNom = rechercherBdsSelonNomMotClef("Météo");
      fsOublier.push(
        await rechercheNom(constl, idBd, async (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const rechercheId = rechercherBdsSelonIdMotClef(idMotClef.slice(0, 15));
      fsOublier.push(
        await rechercheId(constl, idBd, async (r) => résultatId.mettreÀJour(r)),
      );

      const rechercheTous = rechercherBdsSelonMotClef("Météo");
      fsOublier.push(
        await rechercheTous(constl, idBd, async (r) =>
          résultatTous.mettreÀJour(r),
        ),
      );
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("Pas de résultat quand la bd n'a pas de mot-clef", async () => {
      expect(résultatId.val).to.be.undefined();
      expect(résultatNom.val).to.be.undefined();
      expect(résultatTous.val).to.be.undefined();
    });

    it("Ajout mot-clef détecté", async () => {
      await constl.bds.ajouterMotsClefsBd({
        idBd,
        idsMotsClefs: idMotClef,
      });

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

      const val = await résultatId.attendreExiste();
      expect(val).to.deep.equal(réfRésId);
    });

    it("Ajout nom mot-clef détecté", async () => {
      await constl.motsClefs.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "Météo historique pour la région de Montréal",
        },
      });

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

      const valRésultatNom = await résultatNom.attendreExiste();
      const valRésultatTous = await résultatTous.attendreExiste();
      expect(valRésultatNom).to.deep.equal(réfRésNom);
      expect(valRésultatTous).to.deep.equal(réfRésNom);
    });
  });

  describe("Selon variable", function () {
    let idBd: string;
    let idVariable: string;
    const résultatNom = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>>
    >();
    const résultatId = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>>
    >();
    const résultatTous = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>>
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      const rechercheNom = rechercherBdsSelonNomVariable("Précip");
      fsOublier.push(
        await rechercheNom(constl, idBd, async (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const rechercheId = rechercherBdsSelonIdVariable(idVariable.slice(0, 15));
      fsOublier.push(
        await rechercheId(constl, idBd, async (r) => résultatId.mettreÀJour(r)),
      );

      const rechercheTous = rechercherBdsSelonVariable("Précip");
      fsOublier.push(
        await rechercheTous(constl, idBd, async (r) =>
          résultatTous.mettreÀJour(r),
        ),
      );
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("Pas de résultat quand la bd n'a pas de variable", async () => {
      expect(résultatId.val).to.be.undefined();
      expect(résultatNom.val).to.be.undefined();
      expect(résultatTous.val).to.be.undefined();
    });

    it("Ajout variable détecté", async () => {
      const idTableau = await constl.bds.ajouterTableauBd({ idBd });
      await constl.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable,
      });

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

      const valRésultatId = await résultatId.attendreExiste();
      expect(valRésultatId).to.deep.equal(réfRésId);
    });

    it("Ajout nom variable détecté", async () => {
      await constl.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          fr: "Précipitation mensuelle",
        },
      });

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

      const valRésultatNom = await résultatNom.attendreExiste();
      const valRésultatTous = await résultatTous.attendreExiste();
      expect(valRésultatNom).to.deep.equal(réfRésNom);
      expect(valRésultatTous).to.deep.equal(réfRésNom);
    });
  });

  describe("Selon texte", function () {
    let idBd: string;
    const résultatId = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<
        | InfoRésultatTexte
        | InfoRésultatRecherche<InfoRésultatTexte>
        | InfoRésultatVide
      >
    >();
    const résultatNom = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<
        | InfoRésultatTexte
        | InfoRésultatRecherche<InfoRésultatTexte>
        | InfoRésultatVide
      >
    >();
    const résultatDescr = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<
        | InfoRésultatTexte
        | InfoRésultatRecherche<InfoRésultatTexte>
        | InfoRésultatVide
      >
    >();
    const résultatVariable = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<
        | InfoRésultatTexte
        | InfoRésultatRecherche<InfoRésultatTexte>
        | InfoRésultatVide
      >
    >();
    const résultatMotsClef = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<
        | InfoRésultatTexte
        | InfoRésultatRecherche<InfoRésultatTexte>
        | InfoRésultatVide
      >
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });

      const rechercheNom = rechercherBdsSelonTexte("Hydrologie");
      fsOublier.push(
        await rechercheNom(constl, idBd, async (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const rechercheId = rechercherBdsSelonTexte(idBd.slice(0, 15));
      fsOublier.push(
        await rechercheId(constl, idBd, async (r) => résultatId.mettreÀJour(r)),
      );

      const rechercheDescr = rechercherBdsSelonTexte("Montréal");
      fsOublier.push(
        await rechercheDescr(constl, idBd, async (r) =>
          résultatDescr.mettreÀJour(r),
        ),
      );

      const rechercheVariables = rechercherBdsSelonTexte("Température");
      fsOublier.push(
        await rechercheVariables(constl, idBd, async (r) =>
          résultatVariable.mettreÀJour(r),
        ),
      );

      const rechercheMotsClef = rechercherBdsSelonTexte("Météo");
      fsOublier.push(
        await rechercheMotsClef(constl, idBd, async (r) =>
          résultatMotsClef.mettreÀJour(r),
        ),
      );
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("Résultat id détecté", async () => {
      const val = await résultatId.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        de: "id",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: idBd,
        },
        score: 1,
      });
    });

    it("Résultat nom détecté", async () => {
      await constl.bds.sauvegarderNomsBd({
        idBd,
        noms: { fr: "Hydrologie" },
      });
      const val = await résultatNom.attendreExiste();
      expect(val).to.deep.equal({
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

    it("Résultat descr détecté", async () => {
      await constl.bds.sauvegarderDescriptionsBd({
        idBd,
        descriptions: {
          fr: "Hydrologie de Montréal",
        },
      });
      const val = await résultatDescr.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "descr",
        info: {
          type: "texte",
          début: 14,
          fin: 22,
          texte: "Hydrologie de Montréal",
        },
        score: 1,
      });
    });

    it("Résultat variable détecté", async () => {
      const idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      const idTableau = await constl.bds.ajouterTableauBd({ idBd });
      await constl.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable,
      });
      await constl.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          fr: "Température maximale",
        },
      });
      const val = await résultatVariable.attendreExiste();
      expect(val).to.deep.equal({
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
      });
    });

    it("Résultat mot-clef détecté", async () => {
      const idMotClef = await constl.motsClefs.créerMotClef();
      await constl.bds.ajouterMotsClefsBd({
        idBd,
        idsMotsClefs: idMotClef,
      });
      await constl.motsClefs.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "Météorologie",
        },
      });

      const val = await résultatMotsClef.attendreQue(
        (x) =>
          x.de === "motClef" &&
          x.info.type === "résultat" &&
          x.info.de === "nom",
      );
      expect(val).to.deep.equal({
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
      });
    });
  });
});
