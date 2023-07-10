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
    let résultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

      const fRecherche = rechercherBdSelonNom("Météo");
      fOublier = await fRecherche(client, idBd, (r) => (résultat = r));
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand la bd n'a pas de nom", async () => {
      expect(résultat).to.be.undefined();
    });

    it("Ajout nom détecté", async () => {
      await client.bds!.ajouterNomsBd({
        id: idBd,
        noms: {
          fr: "Météorologie",
        },
      });

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

  describe("Selon description", function () {
    let idBd: string;
    let résultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

      const fRecherche = rechercherBdSelonDescr("Météo");
      fOublier = await fRecherche(client, idBd, (r) => (résultat = r));
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand la bd n'a pas de description", async () => {
      expect(résultat).to.be.undefined();
    });

    it("Ajout description détecté", async () => {
      await client.bds!.ajouterDescriptionsBd({
        id: idBd,
        descriptions: {
          fr: "Météo historique pour la région de Montréal",
        },
      });

      expect(résultat).to.deep.equal({
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
    let résultatNom:
      | résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
      | undefined;
    let résultatId:
      | résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
      | undefined;
    let résultatTous:
      | résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
      | undefined;

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
      idMotClef = await client.motsClefs!.créerMotClef();

      const fRechercheNom = rechercherBdSelonNomMotClef("Météo");
      fsOublier.push(
        await fRechercheNom(client, idBd, (r) => (résultatNom = r))
      );

      const fRechercheId = rechercherBdSelonIdMotClef(idMotClef.slice(0, 15));
      fsOublier.push(await fRechercheId(client, idBd, (r) => (résultatId = r)));

      const fRechercheTous = rechercherBdSelonMotClef("Météo");
      fsOublier.push(
        await fRechercheTous(client, idBd, (r) => (résultatTous = r))
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    it("Pas de résultat quand la bd n'a pas de mot-clef", async () => {
      expect(résultatId).to.be.undefined();
      expect(résultatNom).to.be.undefined();
      expect(résultatTous).to.be.undefined();
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

      expect(résultatId).to.deep.equal(réfRésId);
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

      expect(résultatNom).to.deep.equal(réfRésNom);
      expect(résultatTous).to.deep.equal(réfRésNom);
    });
  });

  describe("Selon variable", function () {
    let idBd: string;
    let idVariable: string;
    let résultatNom:
      | résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
      | undefined;
    let résultatId:
      | résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
      | undefined;
    let résultatTous:
      | résultatObjectifRecherche<infoRésultatRecherche<infoRésultatTexte>>
      | undefined;

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
      idVariable = await client.variables!.créerVariable({
        catégorie: "numérique",
      });

      const fRechercheNom = rechercherBdSelonNomVariable("Précip");
      fsOublier.push(
        await fRechercheNom(client, idBd, (r) => (résultatNom = r))
      );

      const fRechercheId = rechercherBdSelonIdVariable(idVariable.slice(0, 15));
      fsOublier.push(await fRechercheId(client, idBd, (r) => (résultatId = r)));

      const fRechercheTous = rechercherBdSelonVariable("Précip");
      fsOublier.push(
        await fRechercheTous(client, idBd, (r) => (résultatTous = r))
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    it("Pas de résultat quand la bd n'a pas de variable", async () => {
      expect(résultatId).to.be.undefined();
      expect(résultatNom).to.be.undefined();
      expect(résultatTous).to.be.undefined();
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

      expect(résultatId).to.deep.equal(réfRésId);
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

      expect(résultatNom).to.deep.equal(réfRésNom);
      expect(résultatTous).to.deep.equal(réfRésNom);
    });
  });

  describe("Selon texte", function () {
    // node --experimental-specifier-resolution=node --inspect dist/recherche/bd.test.js
    let idBd: string;
    let résultatId:
      | résultatObjectifRecherche<
          infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
        >
      | undefined;
    let résultatNom:
      | résultatObjectifRecherche<
          infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
        >
      | undefined;
    let résultatDescr:
      | résultatObjectifRecherche<
          infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
        >
      | undefined;
    let résultatVariable:
      | résultatObjectifRecherche<
          infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
        >
      | undefined;
    let résultatMotsClef:
      | résultatObjectifRecherche<
          infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
        >
      | undefined;

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

      const fRechercheNom = rechercherBdSelonTexte("Hydrologie");
      fsOublier.push(
        await fRechercheNom(client, idBd, (r) => (résultatNom = r))
      );

      const fRechercheId = rechercherBdSelonTexte(idBd.slice(0, 15));
      fsOublier.push(await fRechercheId(client, idBd, (r) => (résultatId = r)));

      const fRechercheDescr = rechercherBdSelonTexte("Montréal");
      fsOublier.push(
        await fRechercheDescr(client, idBd, (r) => (résultatDescr = r))
      );

      const fRechercheVariables = rechercherBdSelonTexte("Température");
      fsOublier.push(
        await fRechercheVariables(client, idBd, (r) => (résultatVariable = r))
      );

      const fRechercheMotsClef = rechercherBdSelonTexte("Météo");
      fsOublier.push(
        await fRechercheMotsClef(client, idBd, (r) => (résultatMotsClef = r))
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    it("Résultat id détecté", async () => {
      expect(résultatId).to.deep.equal({
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

    it("Résultat descr détecté", async () => {
      await client.bds!.ajouterDescriptionsBd({
        id: idBd,
        descriptions: {
          fr: "Hydrologie de Montréal",
        },
      });
      expect(résultatDescr).to.deep.equal({
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

      expect(résultatVariable).to.deep.equal({
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

      expect(résultatMotsClef).to.deep.equal({
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
