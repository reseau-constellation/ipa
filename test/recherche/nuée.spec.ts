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
} from "@/recherche/nuée.js";
import { générerClientsInternes } from "../ressources/utils.js";
import type { Constellation } from "@/client.js";

import type {
  infoRésultatRecherche,
  infoRésultatTexte,
  infoRésultatVide,
  résultatObjectifRecherche,
  schémaFonctionOublier,
} from "@/types.js";

describe("Rechercher nuées", function () {
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

  describe("Selon nom", function () {
    let idNuée: string;
    const résultat = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte>
    >();
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idNuée = await client.nuées.créerNuée();

      const fRecherche = rechercherNuéesSelonNom("Météo");
      fOublier = await fRecherche(client, idNuée, async (r) =>
        résultat.mettreÀJour(r),
      );
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand la nuée n'a pas de nom", async () => {
      expect(résultat.val).to.be.undefined();
    });

    it("Ajout nom détecté", async () => {
      await client.nuées.sauvegarderNomsNuée({
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
      résultatObjectifRecherche<infoRésultatTexte>
    >();
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idNuée = await client.nuées.créerNuée();

      const fRecherche = rechercherNuéesSelonDescr("Météo");
      fOublier = await fRecherche(client, idNuée, async (r) =>
        résultat.mettreÀJour(r),
      );
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand la nuée n'a pas de description", async () => {
      expect(résultat.val).to.be.undefined();
    });

    it("Ajout description détecté", async () => {
      await client.nuées.sauvegarderDescriptionsNuée({
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
      idNuée = await client.nuées.créerNuée();
      idMotClef = await client.motsClefs.créerMotClef();

      const fRechercheNom = rechercherNuéesSelonNomMotClef("Météo");
      fsOublier.push(
        await fRechercheNom(client, idNuée, async (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const fRechercheId = rechercherNuéesSelonIdMotClef(
        idMotClef.slice(0, 15),
      );
      fsOublier.push(
        await fRechercheId(client, idNuée, async (r) =>
          résultatId.mettreÀJour(r),
        ),
      );

      const fRechercheTous = rechercherNuéesSelonMotClef("Météo");
      fsOublier.push(
        await fRechercheTous(client, idNuée, async (r) =>
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
      await client.nuées.ajouterMotsClefsNuée({
        idNuée,
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
      await client.motsClefs.sauvegarderNomsMotClef({
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
    let idNuée: string;
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
      idNuée = await client.nuées.créerNuée();
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });

      const fRechercheNom = rechercherNuéesSelonNomVariable("Précip");
      fsOublier.push(
        await fRechercheNom(client, idNuée, async (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const fRechercheId = rechercherNuéesSelonIdVariable(
        idVariable.slice(0, 15),
      );
      fsOublier.push(
        await fRechercheId(client, idNuée, async (r) =>
          résultatId.mettreÀJour(r),
        ),
      );

      const fRechercheTous = rechercherNuéesSelonVariable("Précip");
      fsOublier.push(
        await fRechercheTous(client, idNuée, async (r) =>
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
      const idTableau = await client.nuées.ajouterTableauNuée({ idNuée });
      await client.nuées.ajouterColonneTableauNuée({
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
      await client.variables.sauvegarderNomsVariable({
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

  describe("Selon texte", function () {
    let idNuée: string;
    const résultatId = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            | infoRésultatTexte
            | infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
          >
        | infoRésultatVide
      >
    >();
    const résultatNom = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            | infoRésultatTexte
            | infoRésultatRecherche<infoRésultatTexte>
            | infoRésultatVide
          >
        | infoRésultatVide
      >
    >();
    const résultatDescr = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            | infoRésultatTexte
            | infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
          >
        | infoRésultatVide
      >
    >();
    const résultatVariable = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            | infoRésultatTexte
            | infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
          >
        | infoRésultatVide
      >
    >();

    const résultatMotClef = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            | infoRésultatTexte
            | infoRésultatRecherche<infoRésultatTexte | infoRésultatVide>
          >
        | infoRésultatVide
      >
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idNuée = await client.nuées.créerNuée();

      const fRechercheNom = rechercherNuéesSelonTexte("Hydrologie");
      fsOublier.push(
        await fRechercheNom(client, idNuée, async (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const fRechercheId = rechercherNuéesSelonTexte(idNuée.slice(0, 15));
      fsOublier.push(
        await fRechercheId(client, idNuée, async (r) =>
          résultatId.mettreÀJour(r),
        ),
      );

      const fRechercheDescr = rechercherNuéesSelonTexte("Montréal");
      fsOublier.push(
        await fRechercheDescr(client, idNuée, async (r) =>
          résultatDescr.mettreÀJour(r),
        ),
      );

      const fRechercheVariables = rechercherNuéesSelonTexte("Température");
      fsOublier.push(
        await fRechercheVariables(client, idNuée, async (r) =>
          résultatVariable.mettreÀJour(r),
        ),
      );

      const fRechercheMotsClef = rechercherNuéesSelonTexte("Météo");
      fsOublier.push(
        await fRechercheMotsClef(client, idNuée, async (r) =>
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
      await client.nuées.sauvegarderNomsNuée({
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
      await client.nuées.sauvegarderDescriptionsNuée({
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
      const idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });
      const idTableau = await client.nuées.ajouterTableauNuée({ idNuée });
      await client.nuées.ajouterColonneTableauNuée({
        idTableau,
        idVariable,
      });
      await client.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          fr: "Température maximale",
        },
      });

      const résRéf: résultatObjectifRecherche<
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
      const idMotClef = await client.motsClefs.créerMotClef();
      await client.motsClefs.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "Météorologie",
        },
      });
      await client.nuées.ajouterMotsClefsNuée({
        idNuée: idNuée,
        idsMotsClefs: idMotClef,
      });

      const résRéf: résultatObjectifRecherche<
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
