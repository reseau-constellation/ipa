import { expect } from "aegir/chai";
import { obtenir } from "@constl/utils-ipa";
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
  schémaFonctionSuivreObjectifRecherche,
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
    let fRecherche: schémaFonctionSuivreObjectifRecherche<infoRésultatTexte>;

    before(async () => {
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });

      fRecherche = rechercherVariablesSelonNom("Radiation solaire");
    });

    it("Pas de résultat quand la variable n'a pas de nom", async () => {
      const résultat = await obtenir<
        résultatObjectifRecherche<infoRésultatTexte> | undefined
      >(({ si }) =>
        fRecherche(
          client,
          idVariable,
          si((x) => x === undefined),
        ),
      );
      expect(résultat).to.be.undefined();
    });
    it("Pas de résultat si le mot-clef n'a vraiment rien à voir", async () => {
      await client.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          த: "சூரிய கதிர்வீச்சு",
        },
      });
      const résultat = await obtenir<
        résultatObjectifRecherche<infoRésultatTexte> | undefined
      >(({ si }) =>
        fRecherche(
          client,
          idVariable,
          si((x) => x === undefined),
        ),
      );

      expect(résultat).to.be.undefined();
    });
    it("Résultat si la variable est presque exacte", async () => {
      await client.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          cst: "Radiación solar",
        },
      });

      const résultat = await obtenir<
        résultatObjectifRecherche<infoRésultatTexte>
      >(({ siDéfini }) => fRecherche(client, idVariable, siDéfini()));

      expect(résultat).to.deep.equal({
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
      const résultat = await obtenir<
        résultatObjectifRecherche<infoRésultatTexte> | undefined
      >(({ si }) =>
        fRecherche(
          client,
          idVariable,
          si((x) => x !== undefined && x.score > 0.5),
        ),
      );

      expect(résultat).to.deep.equal({
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
    let fRecherche: schémaFonctionSuivreObjectifRecherche<infoRésultatTexte>;

    before(async () => {
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });

      fRecherche = rechercherVariablesSelonDescr("Radiation solaire");
    });

    it("Pas de résultat quand la variable n'a pas de description", async () => {
      const résultat = await obtenir<
        résultatObjectifRecherche<infoRésultatTexte> | undefined
      >(({ si }) =>
        fRecherche(
          client,
          idVariable,
          si((x) => x === undefined),
        ),
      );

      expect(résultat).to.be.undefined();
    });
    it("Pas de résultat si la description n'a vraiment rien à voir", async () => {
      await client.variables.sauvegarderDescriptionsVariable({
        idVariable,
        descriptions: {
          த: "சூரிய கதிர்வீச்சு",
        },
      });
      const résultat = await obtenir<
        résultatObjectifRecherche<infoRésultatTexte> | undefined
      >(({ si }) =>
        fRecherche(
          client,
          idVariable,
          si((x) => x === undefined),
        ),
      );

      expect(résultat).to.be.undefined();
    });
    it("Résultat si la variable est presque exacte", async () => {
      await client.variables.sauvegarderDescriptionsVariable({
        idVariable,
        descriptions: {
          cst: "Radiación solar",
        },
      });
      const résultat = await obtenir<
        résultatObjectifRecherche<infoRésultatTexte> | undefined
      >(({ siDéfini }) => fRecherche(client, idVariable, siDéfini()));

      expect(résultat).to.deep.equal({
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
      const résultat = await obtenir<
        résultatObjectifRecherche<infoRésultatTexte> | undefined
      >(({ si }) =>
        fRecherche(
          client,
          idVariable,
          si((x) => x !== undefined && x.score > 0.5),
        ),
      );

      expect(résultat).to.deep.equal({
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
    let fRechercheNom: schémaFonctionSuivreObjectifRecherche<
      infoRésultatTexte | infoRésultatVide
    >;
    let fRechercheId: schémaFonctionSuivreObjectifRecherche<
      infoRésultatTexte | infoRésultatVide
    >;

    before(async () => {
      idVariable = await client.variables.créerVariable({
        catégorie: "numérique",
      });

      fRechercheNom = rechercherVariablesSelonTexte("précipitation");

      fRechercheId = rechercherVariablesSelonTexte(idVariable.slice(0, 15));

      await client.variables.sauvegarderNomsVariable({
        idVariable,
        noms: {
          fr: "précipitation",
        },
      });
    });

    it("Résultat nom détecté", async () => {
      const résultatNom = await obtenir<
        résultatObjectifRecherche<infoRésultatTexte | infoRésultatVide>
      >(({ siDéfini }) => fRechercheNom(client, idVariable, siDéfini()));
      expect(résultatNom).to.deep.equal({
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
      const résultatId = await obtenir<
        résultatObjectifRecherche<infoRésultatTexte | infoRésultatVide>
      >(({ siDéfini }) => fRechercheId(client, idVariable, siDéfini()));
      expect(résultatId).to.deep.equal({
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
