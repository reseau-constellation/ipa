import type { default as ClientConstellation } from "@/client.js";
import type {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatTexte,
  infoRésultatRecherche,
} from "@/utils/index.js";
import {
  rechercherBdSelonNom,
  rechercherBdSelonDescr,
  rechercherBdSelonTexte,
  rechercherBdSelonMotClef,
  rechercherBdSelonVariable,
  rechercherBdSelonIdMotClef,
  rechercherBdSelonIdVariable,
  rechercherBdSelonNomMotClef,
  rechercherBdSelonNomVariable,
} from "@/recherche/bd.js";

import { générerClients } from "@/utilsTests/client.js";

import { expect } from "aegir/chai";
import { AttendreRésultat } from "@/utilsTests/attente.js";

describe("Rechercher bds", function () {
  let fOublierClients: () => Promise<void>;
  let clients: ClientConstellation[];
  let client: ClientConstellation;

  before(async () => {
    ({ fOublier: fOublierClients, clients } = await générerClients(1));
    client = clients[0];
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Selon nom", function () {
    let idBd: string;
    const résultat = new AttendreRésultat<résultatObjectifRecherche<infoRésultatTexte>>();
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

      const fRecherche = rechercherBdSelonNom("Météo");
      fOublier = await fRecherche(client, idBd, (r) => (résultat.mettreÀJour(r)));
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand la bd n'a pas de nom", async () => {
      expect(résultat.val).to.be.undefined();
    });

    it("Ajout nom détecté", async () => {
      await client.bds!.ajouterNomsBd({
        id: idBd,
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
    let idBd: string;
    const résultat = new AttendreRésultat<résultatObjectifRecherche<infoRésultatTexte>>();
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

      const fRecherche = rechercherBdSelonDescr("Météo");
      fOublier = await fRecherche(client, idBd, (r) => (résultat.mettreÀJour(r)));
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand la bd n'a pas de description", async () => {
      expect(résultat.val).to.be.undefined();
    });

    it("Ajout description détecté", async () => {
      await client.bds!.ajouterDescriptionsBd({
        id: idBd,
        descriptions: {
          fr: "Météo historique pour la région de Montréal",
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
          texte: "Météo historique pour la région de Montréal",
        },
        score: 1,
      });
    });
  });

  describe("Selon mot-clef", function () {
    let idBd: string;
    let idMotClef: string;
    const résultatNom = new AttendreRésultat<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>>();
    const résultatId = new AttendreRésultat<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>>();
    const résultatTous = new AttendreRésultat<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>>();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
      idMotClef = await client.motsClefs!.créerMotClef();

      const fRechercheNom = rechercherBdSelonNomMotClef("Météo");
      fsOublier.push(
        await fRechercheNom(client, idBd, (r) => (résultatNom.mettreÀJour(r)))
      );

      const fRechercheId = rechercherBdSelonIdMotClef(idMotClef.slice(0, 15));
      fsOublier.push(await fRechercheId(client, idBd, (r) => (résultatId.mettreÀJour(r))));

      const fRechercheTous = rechercherBdSelonMotClef("Météo");
      fsOublier.push(
        await fRechercheTous(client, idBd, (r) => (résultatTous.mettreÀJour(r)))
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    it("Pas de résultat quand la bd n'a pas de mot-clef", async () => {
      expect(résultatId.val).to.be.undefined();
      expect(résultatNom.val).to.be.undefined();
      expect(résultatTous.val).to.be.undefined();
    });

    it("Ajout mot-clef détecté", async () => {
      await client.bds!.ajouterMotsClefsBd({
        idBd,
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
    let idBd: string;
    let idVariable: string;
    const résultatNom = new AttendreRésultat<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>>();
    const résultatId = new AttendreRésultat<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>>();
    const résultatTous = new AttendreRésultat<résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>>();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
      idVariable = await client.variables!.créerVariable({
        catégorie: "numérique",
      });

      const fRechercheNom = rechercherBdSelonNomVariable("Précip");
      fsOublier.push(
        await fRechercheNom(client, idBd, (r) => (résultatNom.mettreÀJour(r)))
      );

      const fRechercheId = rechercherBdSelonIdVariable(idVariable.slice(0, 15));
      fsOublier.push(await fRechercheId(client, idBd, (r) => (résultatId.mettreÀJour(r))));

      const fRechercheTous = rechercherBdSelonVariable("Précip");
      fsOublier.push(
        await fRechercheTous(client, idBd, (r) => (résultatTous.mettreÀJour(r)))
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
      const idTableau = await client.bds!.ajouterTableauBd({ idBd });
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
      
      const valRésultatId = await résultatId.attendreExiste();
      expect(valRésultatId).to.deep.equal(réfRésId);
    });

    it("Ajout nom variable détecté", async () => {
      await client.variables!.ajouterNomsVariable({
        id: idVariable,
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
    // node --experimental-specifier-resolution=node --inspect dist/recherche/bd.test.js
    let idBd: string;
    const résultatId = new AttendreRésultat<résultatObjectifRecherche<
          infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
        >>();
    const résultatNom = new AttendreRésultat<résultatObjectifRecherche<
          infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
        >>();
    const résultatDescr = new AttendreRésultat<résultatObjectifRecherche<
          infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
        >>();
    const résultatVariable = new AttendreRésultat<résultatObjectifRecherche<
          infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
        >>();
    const résultatMotsClef = new AttendreRésultat<résultatObjectifRecherche<
          infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
        >>();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

      const fRechercheNom = rechercherBdSelonTexte("Hydrologie");
      fsOublier.push(
        await fRechercheNom(client, idBd, (r) => (résultatNom.mettreÀJour(r)))
      );

      const fRechercheId = rechercherBdSelonTexte(idBd.slice(0, 15));
      fsOublier.push(await fRechercheId(client, idBd, (r) => (résultatId.mettreÀJour(r))));

      const fRechercheDescr = rechercherBdSelonTexte("Montréal");
      fsOublier.push(
        await fRechercheDescr(client, idBd, (r) => (résultatDescr.mettreÀJour(r)))
      );

      const fRechercheVariables = rechercherBdSelonTexte("Température");
      fsOublier.push(
        await fRechercheVariables(client, idBd, (r) => (résultatVariable.mettreÀJour(r)))
      );

      const fRechercheMotsClef = rechercherBdSelonTexte("Météo");
      fsOublier.push(
        await fRechercheMotsClef(client, idBd, (r) => (résultatMotsClef.mettreÀJour(r)))
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
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
      await client.bds!.ajouterNomsBd({
        id: idBd,
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
      await client.bds!.ajouterDescriptionsBd({
        id: idBd,
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
      const idVariable = await client.variables!.créerVariable({
        catégorie: "numérique",
      });
      const idTableau = await client.bds!.ajouterTableauBd({ idBd });
      await client.tableaux!.ajouterColonneTableau({
        idTableau,
        idVariable,
      });
      await client.variables!.ajouterNomsVariable({
        id: idVariable,
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
      const idMotClef = await client.motsClefs!.créerMotClef();
      await client.bds!.ajouterMotsClefsBd({
        idBd,
        idsMotsClefs: idMotClef,
      });
      await client.motsClefs!.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "Météorologie",
        },
      });

      const val = await résultatMotsClef.attendreExiste();
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
