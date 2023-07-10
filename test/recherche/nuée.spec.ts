import type { default as ClientConstellation } from "@/client.js";
import { config } from "@/utilsTests/sfip";
import { générerClients } from "@/utilsTests/client.js";
import {
  rechercherNuéeSelonNom,
  rechercherNuéeSelonDescr,
  rechercherNuéeSelonIdMotClef,
  rechercherNuéeSelonNomMotClef,
  rechercherNuéeSelonMotClef,
  rechercherNuéeSelonIdVariable,
  rechercherNuéeSelonNomVariable,
  rechercherNuéeSelonVariable,
  rechercherNuéeSelonTexte,
} from "@/recherche/nuée.js";

import type {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatTexte,
  infoRésultatRecherche,
} from "@/utils/index.js";
import { AttendreRésultat } from "@/utilsTests/attente.js";

import { expect } from "aegir/chai";

describe("Client ", function () {
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
    let idNuée: string;
    let résultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idNuée = await client.nuées!.créerNuée({});

      const fRecherche = rechercherNuéeSelonNom("Météo");
      fOublier = await fRecherche(client, idNuée, (r) => (résultat = r));
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand la nuée n'a pas de nom", async () => {
      expect(résultat).to.be.undefined();
    });

    it("Ajout nom détecté", async () => {
      await client.nuées!.ajouterNomsNuée({
        id: idNuée,
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
    let idNuée: string;
    let résultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idNuée = await client.nuées!.créerNuée({});

      const fRecherche = rechercherNuéeSelonDescr("Météo");
      fOublier = await fRecherche(client, idNuée, (r) => (résultat = r));
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand la nuée n'a pas de description", async () => {
      expect(résultat).to.be.undefined();
    });

    it("Ajout description détecté", async () => {
      await client.nuées!.ajouterDescriptionsNuée({
        id: idNuée,
        descriptions: {
          fr: "Météo historique",
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
          texte: "Météo historique",
        },
        score: 1,
      });
    });
  });

  describe("Selon mot-clef", function () {
    let idNuée: string;
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
      idNuée = await client.nuées!.créerNuée({});
      idMotClef = await client.motsClefs!.créerMotClef();

      const fRechercheNom = rechercherNuéeSelonNomMotClef("Météo");
      fsOublier.push(
        await fRechercheNom(client, idNuée, (r) => (résultatNom = r))
      );

      const fRechercheId = rechercherNuéeSelonIdMotClef(idMotClef.slice(0, 15));
      fsOublier.push(
        await fRechercheId(client, idNuée, (r) => (résultatId = r))
      );

      const fRechercheTous = rechercherNuéeSelonMotClef("Météo");
      fsOublier.push(
        await fRechercheTous(client, idNuée, (r) => (résultatTous = r))
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    it("Pas de résultat quand la nuée n'a pas de mot-clef", async () => {
      expect(résultatId).to.be.undefined();
      expect(résultatNom).to.be.undefined();
      expect(résultatTous).to.be.undefined();
    });

    it("Ajout mot-clef détecté", async () => {
      await client.nuées!.ajouterMotsClefsNuée({
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
    let idNuée: string;
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
      idNuée = await client.nuées!.créerNuée({});
      idVariable = await client.variables!.créerVariable({
        catégorie: "numérique",
      });

      const fRechercheNom = rechercherNuéeSelonNomVariable("Précip");
      fsOublier.push(
        await fRechercheNom(client, idNuée, (r) => (résultatNom = r))
      );

      const fRechercheId = rechercherNuéeSelonIdVariable(
        idVariable.slice(0, 15)
      );
      fsOublier.push(
        await fRechercheId(client, idNuée, (r) => (résultatId = r))
      );

      const fRechercheTous = rechercherNuéeSelonVariable("Précip");
      fsOublier.push(
        await fRechercheTous(client, idNuée, (r) => (résultatTous = r))
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    it("Pas de résultat quand la nuée n'a pas de variable", async () => {
      expect(résultatId).to.be.undefined();
      expect(résultatNom).to.be.undefined();
      expect(résultatTous).to.be.undefined();
    });

    it("Ajout variable détecté", async () => {
      const idTableau = await client.nuées!.ajouterTableauNuée({ idNuée });
      await client.nuées!.ajouterColonneTableauNuée({
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
    let idNuée: string;
    let résultatId:
      | résultatObjectifRecherche<
          | infoRésultatTexte
          | infoRésultatRecherche<
              infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
            >
        >
      | undefined;
    let résultatNom:
      | résultatObjectifRecherche<
          | infoRésultatTexte
          | infoRésultatRecherche<
              infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
            >
        >
      | undefined;
    let résultatDescr:
      | résultatObjectifRecherche<
          | infoRésultatTexte
          | infoRésultatRecherche<
              infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
            >
        >
      | undefined;
    let résultatVariable:
      | résultatObjectifRecherche<
          | infoRésultatTexte
          | infoRésultatRecherche<
              infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
            >
        >
      | undefined;

    const résultatMotClef = new AttendreRésultat<
      résultatObjectifRecherche<
        | infoRésultatTexte
        | infoRésultatRecherche<
            infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
          >
      >
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idNuée = await client.nuées!.créerNuée({});

      const fRechercheNom = rechercherNuéeSelonTexte("Hydrologie");
      fsOublier.push(
        await fRechercheNom(client, idNuée, (r) => (résultatNom = r))
      );

      const fRechercheId = rechercherNuéeSelonTexte(idNuée.slice(0, 15));
      fsOublier.push(
        await fRechercheId(client, idNuée, (r) => (résultatId = r))
      );

      const fRechercheDescr = rechercherNuéeSelonTexte("Montréal");
      fsOublier.push(
        await fRechercheDescr(client, idNuée, (r) => (résultatDescr = r))
      );

      const fRechercheVariables = rechercherNuéeSelonTexte("Température");
      fsOublier.push(
        await fRechercheVariables(client, idNuée, (r) => (résultatVariable = r))
      );

      const fRechercheMotsClef = rechercherNuéeSelonTexte("Météo");
      fsOublier.push(
        await fRechercheMotsClef(client, idNuée, (r) =>
          résultatMotClef.mettreÀJour(r)
        )
      );
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
      résultatMotClef.toutAnnuler();
    });

    it("Résultat id détecté", async () => {
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

    it("Résultat nom détecté", async () => {
      await client.nuées!.ajouterNomsNuée({
        id: idNuée,
        noms: {
          fr: "Hydrologie",
        },
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
      await client.nuées!.ajouterDescriptionsNuée({
        id: idNuée,
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
      const idTableau = await client.nuées!.ajouterTableauNuée({ idNuée });
      await client.nuées!.ajouterColonneTableauNuée({
        idTableau,
        idVariable,
      });
      await client.variables!.ajouterNomsVariable({
        id: idVariable,
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

      expect(résultatVariable).to.equal(résRéf);
    });

    it("Résultat mot-clef détecté", async () => {
      const idMotClef = await client.motsClefs!.créerMotClef();
      await client.motsClefs!.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "Météorologie",
        },
      });
      await client.nuées!.ajouterMotsClefsNuée({
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

      const val = await résultatMotClef.attendreExiste();
      expect(val).to.equal(résRéf);
    });
  });
});
