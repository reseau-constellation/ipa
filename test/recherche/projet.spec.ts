import { type ClientConstellation } from "@/index.js";
import type {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatTexte,
  infoRésultatRecherche,
} from "@/types.js";
import {
  rechercherProjetsSelonNom,
  rechercherProjetsSelonDescr,
  rechercherProjetsSelonIdBd,
  rechercherProjetsSelonBd,
  rechercherProjetsSelonIdMotClef,
  rechercherProjetsSelonNomMotClef,
  rechercherProjetsSelonMotClef,
  rechercherProjetsSelonIdVariable,
  rechercherProjetsSelonNomVariable,
  rechercherProjetsSelonVariable,
  rechercherProjetsSelonTexte,
} from "@/recherche/projet.js";

import { attente as utilsTestAttente } from "@constl/utils-tests";
import { générerClientsInternes } from "../ressources/utils.js";

import { expect } from "aegir/chai";

describe("Rechercher projets", function () {
  let fOublierClients: () => Promise<void>;
  let clients: ClientConstellation[];
  let client: ClientConstellation;

  before(async () => {
    ({ fOublier: fOublierClients, clients: clients as unknown } =
      await générerClientsInternes({ n: 1 }));
    client = clients[0];
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Selon nom", function () {
    let idProjet: string;
    const résultat = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte>
    >();
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idProjet = await client.projets!.créerProjet();

      const fRecherche = rechercherProjetsSelonNom("Météo");
      fOublier = await fRecherche(client, idProjet, (r) =>
        résultat.mettreÀJour(r),
      );
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand le projet n'a pas de nom", async () => {
      expect(résultat.val).to.be.undefined();
    });

    it("Ajout nom détecté", async () => {
      await client.projets!.sauvegarderNomsProjet({
        idProjet,
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
    let idProjet: string;
    const résultat = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte>
    >();
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idProjet = await client.projets!.créerProjet();

      const fRecherche = rechercherProjetsSelonDescr("Météo");
      fOublier = await fRecherche(client, idProjet, (r) =>
        résultat.mettreÀJour(r),
      );
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand le projet n'a pas de description", async () => {
      expect(résultat.val).to.be.undefined();
    });

    it("Ajout description détecté", async () => {
      await client.projets!.sauvegarderDescriptionsProjet({
        idProjet,
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
    let idProjet: string;
    let idMotClef: string;
    const résultatNom = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
    >();
    const résultatId = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
    >();
    const résultatTous = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idProjet = await client.projets!.créerProjet();
      idMotClef = await client.motsClefs!.créerMotClef();

      const fRechercheNom = rechercherProjetsSelonNomMotClef("Météo");
      fsOublier.push(
        await fRechercheNom(client, idProjet, (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const fRechercheId = rechercherProjetsSelonIdMotClef(
        idMotClef.slice(0, 15),
      );
      fsOublier.push(
        await fRechercheId(client, idProjet, (r) => résultatId.mettreÀJour(r)),
      );

      const fRechercheTous = rechercherProjetsSelonMotClef("Météo");
      fsOublier.push(
        await fRechercheTous(client, idProjet, (r) =>
          résultatTous.mettreÀJour(r),
        ),
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    it("Pas de résultat quand le projet n'a pas de mot-clef", async () => {
      expect(résultatId.val).to.be.undefined();
      expect(résultatNom.val).to.be.undefined();
      expect(résultatTous.val).to.be.undefined();
    });

    it("Ajout mot-clef détecté", async () => {
      await client.projets!.ajouterMotsClefsProjet({
        idProjet,
        idsMotsClefs: idMotClef,
      });

      const réfRésId: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatTexte>
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
      await client.motsClefs!.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "Météo historique pour la région de Montréal",
        },
      });

      const réfRésNom: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatTexte>
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
    let idProjet: string;
    let idVariable: string;
    const résultatNom = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
    >();
    const résultatId = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
    >();
    const résultatTous = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idProjet = await client.bds.créerBd({ licence: "ODbl-1_0" });
      idVariable = await client.variables!.créerVariable({
        catégorie: "numérique",
      });

      const fRechercheNom = rechercherProjetsSelonNomVariable("Précip");
      fsOublier.push(
        await fRechercheNom(client, idProjet, (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const fRechercheId = rechercherProjetsSelonIdVariable(
        idVariable.slice(0, 15),
      );
      fsOublier.push(
        await fRechercheId(client, idProjet, (r) => résultatId.mettreÀJour(r)),
      );

      const fRechercheTous = rechercherProjetsSelonVariable("Précip");
      fsOublier.push(
        await fRechercheTous(client, idProjet, (r) =>
          résultatTous.mettreÀJour(r),
        ),
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    it("Pas de résultat quand la bd n'a pas de variable", async () => {
      expect(résultatId.val).to.be.undefined();
      expect(résultatNom.val).to.be.undefined();
      expect(résultatTous.val).to.be.undefined();
    });

    it("Ajout variable détecté", async () => {
      const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
      await client.projets!.ajouterBdProjet({ idProjet, idBd });

      const idTableau = await client.bds.ajouterTableauBd({ idBd });
      await client.tableaux!.ajouterColonneTableau({
        idTableau,
        idVariable,
      });

      const réfRésId: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatTexte>
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
      await client.variables!.sauvegarderNomsVariable({
        idVariable,
        noms: {
          fr: "Précipitation mensuelle",
        },
      });

      const réfRésNom: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatTexte>
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

  describe("Selon bd", function () {
    let idProjet: string;
    let idBd: string;
    const résultatId = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
          >
      >
    >();
    const résultatNom = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
          >
      >
    >();
    const résultatDescr = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
          >
      >
    >();
    const résultatVariable = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
          >
      >
    >();
    const résultatMotsClef = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
          >
      >
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idProjet = await client.projets!.créerProjet();
      idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });

      const fRechercheNom = rechercherProjetsSelonBd("Hydrologie");
      fsOublier.push(
        await fRechercheNom(client, idProjet, (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const fRechercheId = rechercherProjetsSelonIdBd(idBd.slice(0, 15));
      fsOublier.push(
        await fRechercheId(client, idProjet, (r) => résultatId.mettreÀJour(r)),
      );

      const fRechercheDescr = rechercherProjetsSelonBd("Montréal");
      fsOublier.push(
        await fRechercheDescr(client, idProjet, (r) =>
          résultatDescr.mettreÀJour(r),
        ),
      );

      const fRechercheVariables = rechercherProjetsSelonBd("Température");
      fsOublier.push(
        await fRechercheVariables(client, idProjet, (r) =>
          résultatVariable.mettreÀJour(r),
        ),
      );

      const fRechercheMotsClef = rechercherProjetsSelonBd("Météo");
      fsOublier.push(
        await fRechercheMotsClef(client, idProjet, (r) =>
          résultatMotsClef.mettreÀJour(r),
        ),
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    it("Résultat id détecté", async () => {
      await client.projets!.ajouterBdProjet({ idProjet, idBd });

      const réfRés: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatTexte>
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

      const val = await résultatId.attendreExiste();
      expect(val).to.deep.equal(réfRés);
    });

    it("Résultat nom détecté", async () => {
      await client.bds.sauvegarderNomsBd({
        idBd,
        noms: { fr: "Hydrologie" },
      });

      const réfRés: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatTexte>
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

      const val = await résultatNom.attendreExiste();
      expect(val).to.deep.equal(réfRés);
    });

    it("Résultat descr détecté", async () => {
      await client.bds.sauvegarderDescriptionsBd({
        idBd,
        descriptions: {
          fr: "Hydrologie de Montréal",
        },
      });
      const réfRés: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatTexte>
      > = {
        type: "résultat",
        de: "bd",
        clef: idBd,
        info: {
          type: "résultat",
          clef: "fr",
          de: "descr",
          info: {
            type: "texte",
            début: 14,
            fin: 22,
            texte: "Hydrologie de Montréal",
          },
        },
        score: 1,
      };

      const val = await résultatDescr.attendreExiste();
      expect(val).to.deep.equal(réfRés);
    });

    it("Résultat variable détecté", async () => {
      const idVariable = await client.variables!.créerVariable({
        catégorie: "numérique",
      });
      const idTableau = await client.bds.ajouterTableauBd({ idBd });
      await client.tableaux!.ajouterColonneTableau({
        idTableau,
        idVariable,
      });
      await client.variables!.sauvegarderNomsVariable({
        idVariable,
        noms: {
          fr: "Température maximale",
        },
      });

      const réfRés: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatRecherche<infoRésultatTexte>>
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

      const val = await résultatVariable.attendreExiste();
      expect(val).to.deep.equal(réfRés);
    });

    it("Résultat mot-clef détecté", async () => {
      const idMotClef = await client.motsClefs!.créerMotClef();
      await client.bds.ajouterMotsClefsBd({
        idBd,
        idsMotsClefs: idMotClef,
      });
      await client.motsClefs!.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "Météorologie",
        },
      });

      const réfRés: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatRecherche<infoRésultatTexte>>
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

      const val = await résultatMotsClef.attendreExiste();
      expect(val).to.deep.equal(réfRés);
    });
  });

  describe("Selon texte", function () {
    let idProjet: string;
    let idBd: string;
    const résultatId = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
          >
      >
    >();
    const résultatNom = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
          >
      >
    >();
    const résultatDescr = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
          >
      >
    >();
    const résultatBd = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
          >
      >
    >();
    const résultatVariable = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
          >
      >
    >();

    const résultatMotClef = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
          >
      >
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idProjet = await client.projets!.créerProjet();
      idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });

      const fRechercheNom = rechercherProjetsSelonTexte("Hydrologie");
      fsOublier.push(
        await fRechercheNom(client, idProjet, (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const fRechercheId = rechercherProjetsSelonTexte(idProjet.slice(0, 15));
      fsOublier.push(
        await fRechercheId(client, idProjet, (r) => résultatId.mettreÀJour(r)),
      );

      const fRechercheDescr = rechercherProjetsSelonTexte("Montréal");
      fsOublier.push(
        await fRechercheDescr(client, idProjet, (r) =>
          résultatDescr.mettreÀJour(r),
        ),
      );

      const fRechercheBds = rechercherProjetsSelonTexte(idBd);
      fsOublier.push(
        await fRechercheBds(client, idProjet, (r) => résultatBd.mettreÀJour(r)),
      );

      const fRechercheVariables = rechercherProjetsSelonTexte("Température");
      fsOublier.push(
        await fRechercheVariables(client, idProjet, (r) =>
          résultatVariable.mettreÀJour(r),
        ),
      );

      const fRechercheMotsClef = rechercherProjetsSelonTexte("Météo");
      fsOublier.push(
        await fRechercheMotsClef(client, idProjet, (r) =>
          résultatMotClef.mettreÀJour(r),
        ),
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
      résultatMotClef.toutAnnuler();
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
          texte: idProjet,
        },
        score: 1,
      });
    });

    it("Résultat nom détecté", async () => {
      await client.projets!.sauvegarderNomsProjet({
        idProjet,
        noms: {
          fr: "Hydrologie",
        },
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
      await client.projets!.sauvegarderDescriptionsProjet({
        idProjet,
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

    it("Résultat bd détecté", async () => {
      await client.projets!.ajouterBdProjet({ idProjet, idBd });

      const val = await résultatBd.attendreExiste();
      expect(val).to.deep.equal({
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
      });
    });

    it("Résultat variable détecté", async () => {
      const idVariable = await client.variables!.créerVariable({
        catégorie: "numérique",
      });
      const idTableau = await client.bds.ajouterTableauBd({ idBd });
      await client.tableaux!.ajouterColonneTableau({
        idTableau,
        idVariable,
      });
      await client.variables!.sauvegarderNomsVariable({
        idVariable,
        noms: {
          fr: "Température maximale",
        },
      });

      const résRéf: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatRecherche<infoRésultatTexte>>
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

      const val = await résultatVariable.attendreExiste();
      expect(val).to.deep.equal(résRéf);
    });

    it("Résultat mot-clef détecté", async () => {
      const idMotClef = await client.motsClefs!.créerMotClef();
      await client.motsClefs!.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "Météorologie",
        },
      });
      await client.projets!.ajouterMotsClefsProjet({
        idProjet: idProjet,
        idsMotsClefs: idMotClef,
      });

      const résRéfMotClef: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatTexte>
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

      const résRéfMotClefDeBd: résultatObjectifRecherche<
        infoRésultatRecherche<infoRésultatRecherche<infoRésultatTexte>>
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

      const val = await résultatMotClef.attendreExiste();

      // Il faut vérifier les deux, parce que le mot-clef peut être détecté sur le projet lui-même ou bien sur la bd
      if (val.de === "bd") {
        expect(val).to.deep.equal(résRéfMotClefDeBd);
      } else {
        expect(val).to.deep.equal(résRéfMotClef);
      }
    });
  });
});
