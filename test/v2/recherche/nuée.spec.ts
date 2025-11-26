import { attente as utilsTestAttente } from "@constl/utils-tests";
import { expect } from "aegir/chai";
import {
  rechercherNuéesSelonDescr,
  rechercherNuéesSelonIdMotClef,
  rechercherNuéesSelonIdVariable,
  rechercherNuéesSelonMotClef,
  rechercherNuéesSelonNom,
  rechercherNuéesSelonNomMotClef,
  rechercherNuéesSelonNomVariable,
  rechercherNuéesSelonTexte,
  rechercherNuéesSelonVariable,
} from "@/v2/recherche/fonctions/nuées.js";
import { générerconstlsInternes } from "../../ressources/utils.js";
import type { Constellation } from "@/constl.js";

import type {
  InfoRésultatRecherche,
  InfoRésultatTexte,
  InfoRésultatVide,
  RésultatObjectifRecherche,
  schémaFonctionOublier,
} from "@/types.js";

describe("Rechercher nuées", function () {
  let fermer: Oublier;
  let constls: Constellation[];
  let constl: Constellation;

  before(async () => {
    ({ fermer, constls } = await générerconstlsInternes({
      n: 1,
    }));
    constl = constls[0];
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("Selon nom", function () {
    let idNuée: string;
    const résultat = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatTexte>
    >();

    before(async () => {
      idNuée = await constl.nuées.créerNuée();

      const recherche = rechercherNuéesSelonNom("Météo");
      fOublier = await recherche(constl, idNuée, async (r) =>
        résultat.mettreÀJour(r),
      );
    });

    it("Pas de résultat quand la nuée n'a pas de nom", async () => {
      expect(résultat.val).to.be.undefined();
    });

    it("Ajout nom détecté", async () => {
      await constl.nuées.sauvegarderNomsNuée({
        idNuée,
        noms: {
          fr: "Météorologie",
        },
      });

      const val = await résultat.attendreExiste();
      expect(val).to.deep.equal({
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

  describe("Selon description", function () {
    let idNuée: string;
    const résultat = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatTexte>
    >();

    before(async () => {
      idNuée = await constl.nuées.créerNuée();

      const recherche = rechercherNuéesSelonDescr("Météo");
      fOublier = await recherche(constl, idNuée, async (r) =>
        résultat.mettreÀJour(r),
      );
    });

    it("Pas de résultat quand la nuée n'a pas de description", async () => {
      expect(résultat.val).to.be.undefined();
    });

    it("Ajout description détecté", async () => {
      await constl.nuées.sauvegarderDescriptionsNuée({
        idNuée,
        descriptions: {
          fr: "Météo historique",
        },
      });

      const val = await résultat.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "descr",
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

  describe("Selon mot-clef", function () {
    let idNuée: string;
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
      idNuée = await constl.nuées.créerNuée();
      idMotClef = await constl.motsClefs.créerMotClef();

      const rechercheNom = rechercherNuéesSelonNomMotClef("Météo");
      fsOublier.push(
        await rechercheNom(constl, idNuée, async (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const rechercheId = rechercherNuéesSelonIdMotClef(idMotClef.slice(0, 15));
      fsOublier.push(
        await rechercheId(constl, idNuée, async (r) =>
          résultatId.mettreÀJour(r),
        ),
      );

      const rechercheTous = rechercherNuéesSelonMotClef("Météo");
      fsOublier.push(
        await rechercheTous(constl, idNuée, async (r) =>
          résultatTous.mettreÀJour(r),
        ),
      );
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("Pas de résultat quand la nuée n'a pas de mot-clef", async () => {
      expect(résultatId.val).to.be.undefined();
      expect(résultatNom.val).to.be.undefined();
      expect(résultatTous.val).to.be.undefined();
    });

    it("Ajout mot-clef détecté", async () => {
      await constl.nuées.ajouterMotsClefsNuée({
        idNuée,
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
    let idNuée: string;
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
      idNuée = await constl.nuées.créerNuée();
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      const rechercheNom = rechercherNuéesSelonNomVariable("Précip");
      fsOublier.push(
        await rechercheNom(constl, idNuée, async (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const rechercheId = rechercherNuéesSelonIdVariable(
        idVariable.slice(0, 15),
      );
      fsOublier.push(
        await rechercheId(constl, idNuée, async (r) =>
          résultatId.mettreÀJour(r),
        ),
      );

      const rechercheTous = rechercherNuéesSelonVariable("Précip");
      fsOublier.push(
        await rechercheTous(constl, idNuée, async (r) =>
          résultatTous.mettreÀJour(r),
        ),
      );
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("Pas de résultat quand la nuée n'a pas de variable", async () => {
      expect(résultatId.val).to.be.undefined();
      expect(résultatNom.val).to.be.undefined();
      expect(résultatTous.val).to.be.undefined();
    });

    it("Ajout variable détecté", async () => {
      const idTableau = await constl.nuées.ajouterTableauNuée({ idNuée });
      await constl.nuées.ajouterColonneTableauNuée({
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

      const val = await résultatId.attendreExiste();
      expect(val).to.deep.equal(réfRésId);
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
    let idNuée: string;
    const résultatId = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<
        | InfoRésultatTexte
        | InfoRésultatRecherche<
            | InfoRésultatTexte
            | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
          >
        | InfoRésultatVide
      >
    >();
    const résultatNom = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<
        | InfoRésultatTexte
        | InfoRésultatRecherche<
            | InfoRésultatTexte
            | InfoRésultatRecherche<InfoRésultatTexte>
            | InfoRésultatVide
          >
        | InfoRésultatVide
      >
    >();
    const résultatDescr = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<
        | InfoRésultatTexte
        | InfoRésultatRecherche<
            | InfoRésultatTexte
            | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
          >
        | InfoRésultatVide
      >
    >();
    const résultatVariable = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<
        | InfoRésultatTexte
        | InfoRésultatRecherche<
            | InfoRésultatTexte
            | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
          >
        | InfoRésultatVide
      >
    >();

    const résultatMotClef = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<
        | InfoRésultatTexte
        | InfoRésultatRecherche<
            | InfoRésultatTexte
            | InfoRésultatRecherche<InfoRésultatTexte | InfoRésultatVide>
          >
        | InfoRésultatVide
      >
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idNuée = await constl.nuées.créerNuée();

      const rechercheNom = rechercherNuéesSelonTexte("Hydrologie");
      fsOublier.push(
        await rechercheNom(constl, idNuée, async (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const rechercheId = rechercherNuéesSelonTexte(idNuée.slice(0, 15));
      fsOublier.push(
        await rechercheId(constl, idNuée, async (r) =>
          résultatId.mettreÀJour(r),
        ),
      );

      const rechercheDescr = rechercherNuéesSelonTexte("Montréal");
      fsOublier.push(
        await rechercheDescr(constl, idNuée, async (r) =>
          résultatDescr.mettreÀJour(r),
        ),
      );

      const rechercheVariables = rechercherNuéesSelonTexte("Température");
      fsOublier.push(
        await rechercheVariables(constl, idNuée, async (r) =>
          résultatVariable.mettreÀJour(r),
        ),
      );

      const rechercheMotsClef = rechercherNuéesSelonTexte("Météo");
      fsOublier.push(
        await rechercheMotsClef(constl, idNuée, async (r) =>
          résultatMotClef.mettreÀJour(r),
        ),
      );
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
      résultatMotClef.toutAnnuler();
    });

    it("Résultat id détecté", async () => {
      const valRésultatId = await résultatId.attendreExiste();
      expect(valRésultatId).to.deep.equal({
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

    it("Résultat nom détecté", async () => {
      await constl.nuées.sauvegarderNomsNuée({
        idNuée,
        noms: {
          fr: "Hydrologie",
        },
      });

      const valRésultatNom = await résultatNom.attendreExiste();
      expect(valRésultatNom).to.deep.equal({
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
      await constl.nuées.sauvegarderDescriptionsNuée({
        idNuée,
        descriptions: {
          fr: "Hydrologie de Montréal",
        },
      });
      const valRésultatDescr = await résultatDescr.attendreExiste();
      expect(valRésultatDescr).to.deep.equal({
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
      const idTableau = await constl.nuées.ajouterTableauNuée({ idNuée });
      await constl.nuées.ajouterColonneTableauNuée({
        idTableau,
        idVariable,
      });
      await constl.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          fr: "Température maximale",
        },
      });

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

      const valRésultatVariable = await résultatVariable.attendreQue(
        (x) => x.de === "variable",
      );
      expect(valRésultatVariable).to.deep.equal(résRéf);
    });

    it("Résultat mot-clef détecté", async () => {
      const idMotClef = await constl.motsClefs.créerMotClef();
      await constl.motsClefs.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "Météorologie",
        },
      });
      await constl.nuées.ajouterMotsClefsNuée({
        idNuée: idNuée,
        idsMotsClefs: idMotClef,
      });

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

      const val = await résultatMotClef.attendreQue(
        (x) =>
          x.de === "motClef" &&
          x.info.type === "résultat" &&
          x.info.de === "nom",
      );
      expect(val).to.deep.equal(résRéf);
    });
  });
});
