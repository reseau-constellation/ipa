import { attente as utilsTestAttente } from "@constl/utils-tests";

import { expect } from "aegir/chai";
import {
  rechercherVariablesSelonDescr,
  rechercherVariablesSelonNom,
  rechercherVariablesSelonTexte,
} from "@/recherche/variable.js";
import { générerClientsInternes } from "../ressources/utils.js";
import type {
  infoRésultatTexte,
  infoRésultatVide,
  résultatObjectifRecherche,
  schémaFonctionOublier,
} from "@/types.js";
import type { Constellation } from "@/client.js";

describe("Rechercher variables", function () {
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
    let idVariable: string;
    const résultat = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte>
    >();
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });

      const fRecherche = rechercherVariablesSelonNom("Radiation solaire");
      fOublier = await fRecherche(client, idVariable, async (r) =>
        résultat.mettreÀJour(r),
      );
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand la variable n'a pas de nom", async () => {
      expect(résultat.val).to.be.undefined();
    });
    it("Pas de résultat si le mot-clef n'a vraiment rien à voir", async () => {
      await client.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          த: "சூரிய கதிர்வீச்சு",
        },
      });

      expect(résultat.val).to.be.undefined();
    });
    it("Résultat si la variable est presque exacte", async () => {
      await client.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          cst: "Radiación solar",
        },
      });

      const val = await résultat.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "cst",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: "Radiación solar",
        },
        score: 0.2,
      });
    });
    it("Résultat si le mot-clef est exacte", async () => {
      await client.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          fr: "Radiation solaire",
        },
      });
      const val = await résultat.attendreQue((x) => x.score > 0.5);
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 17,
          texte: "Radiation solaire",
        },
        score: 1,
      });
    });
  });

  describe("Selon descr", function () {
    let idVariable: string;
    const résultat = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte>
    >();
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });

      const fRecherche = rechercherVariablesSelonDescr("Radiation solaire");
      fOublier = await fRecherche(client, idVariable, async (r) =>
        résultat.mettreÀJour(r),
      );
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand la variable n'a pas de description", async () => {
      expect(résultat.val).to.be.undefined();
    });
    it("Pas de résultat si la description n'a vraiment rien à voir", async () => {
      await client.variables.sauvegarderDescriptionsVariable({
        idVariable,
        descriptions: {
          த: "சூரிய கதிர்வீச்சு",
        },
      });
      expect(résultat.val).to.be.undefined();
    });
    it("Résultat si la variable est presque exacte", async () => {
      await client.variables.sauvegarderDescriptionsVariable({
        idVariable,
        descriptions: {
          cst: "Radiación solar",
        },
      });

      const val = await résultat.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "cst",
        de: "descr",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: "Radiación solar",
        },
        score: 0.2,
      });
    });
    it("Résultat si la description est exacte", async () => {
      await client.variables.sauvegarderDescriptionsVariable({
        idVariable,
        descriptions: {
          fr: "Radiation solaire",
        },
      });
      const val = await résultat.attendreQue((x) => x.score > 0.5);
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "descr",
        info: {
          type: "texte",
          début: 0,
          fin: 17,
          texte: "Radiation solaire",
        },
        score: 1,
      });
    });
  });

  describe("Selon texte", function () {
    let idVariable: string;
    const résultatId = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte | infoRésultatVide>
    >();
    const résultatNom = new utilsTestAttente.AttendreRésultat<
      résultatObjectifRecherche<infoRésultatTexte | infoRésultatVide>
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });

      const fRechercheNom = rechercherVariablesSelonTexte("précipitation");
      fsOublier.push(
        await fRechercheNom(client, idVariable, async (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const fRechercheId = rechercherVariablesSelonTexte(
        idVariable.slice(0, 15),
      );
      fsOublier.push(
        await fRechercheId(client, idVariable, async (r) =>
          résultatId.mettreÀJour(r),
        ),
      );

      await client.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          fr: "précipitation",
        },
      });
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("Résultat nom détecté", async () => {
      const val = await résultatNom.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 13,
          texte: "précipitation",
        },
        score: 1,
      });
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
          texte: idVariable,
        },
        score: 1,
      });
    });
  });
});
