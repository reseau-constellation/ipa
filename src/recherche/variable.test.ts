import { config } from "@/utilsTests/sfipTest.js";

import { enregistrerContrôleurs } from "@/accès/index.js";
import type { default as ClientConstellation } from "@/client.js";
import type {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatTexte,
} from "@/utils/index.js";
import {
  rechercherVariableSelonNom,
  rechercherVariableSelonDescr,
  rechercherVariableSelonTexte,
} from "@/recherche/variable.js";

import { générerClients } from "@/utilsTests/index.js";

describe("Rechercher variables", function () {
  let fOublierClients: () => Promise<void>;
  let clients: ClientConstellation[];
  let client: ClientConstellation;

  beforeAll(async () => {
    enregistrerContrôleurs();
    ({ fOublier: fOublierClients, clients } = await générerClients(1));
    client = clients[0];
  }, config.patienceInit);

  afterAll(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Selon nom", function () {
    let idVariable: string;
    let résultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
    let fOublier: schémaFonctionOublier;

    beforeAll(async () => {
      idVariable = await client.variables!.créerVariable({
        catégorie: "numérique",
      });

      const fRecherche = rechercherVariableSelonNom("Radiation solaire");
      fOublier = await fRecherche(client, idVariable, (r) => (résultat = r));
    }, config.patience);

    afterAll(async () => {
      if (fOublier) await fOublier();
    });

    test("Pas de résultat quand la variable n'a pas de nom", async () => {
      expect(résultat).toBeUndefined;
    });
    test("Pas de résultat si le mot-clef n'a vraiment rien à voir", async () => {
      await client.variables!.ajouterNomsVariable({
        id: idVariable,
        noms: {
          த: "சூரிய கதிர்வீச்சு",
        },
      });
      expect(résultat).toBeUndefined;
    });
    test("Résultat si la variable est presque exacte", async () => {
      await client.variables!.ajouterNomsVariable({
        id: idVariable,
        noms: {
          es: "Radiación solar",
        },
      });

      expect(résultat).toEqual({
        type: "résultat",
        clef: "es",
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
    test("Résultat si le mot-clef est exacte", async () => {
      await client.variables!.ajouterNomsVariable({
        id: idVariable,
        noms: {
          fr: "Radiation solaire",
        },
      });
      expect(résultat).toEqual({
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
    let résultat: résultatObjectifRecherche<infoRésultatTexte> | undefined;
    let fOublier: schémaFonctionOublier;

    beforeAll(async () => {
      idVariable = await client.variables!.créerVariable({
        catégorie: "numérique",
      });

      const fRecherche = rechercherVariableSelonDescr("Radiation solaire");
      fOublier = await fRecherche(client, idVariable, (r) => (résultat = r));
    }, config.patience);

    afterAll(async () => {
      if (fOublier) await fOublier();
    });

    test("Pas de résultat quand la variable n'a pas de description", async () => {
      expect(résultat).toBeUndefined;
    });
    test("Pas de résultat si la description n'a vraiment rien à voir", async () => {
      await client.variables!.ajouterDescriptionsVariable({
        id: idVariable,
        descriptions: {
          த: "சூரிய கதிர்வீச்சு",
        },
      });
      expect(résultat).toBeUndefined;
    });
    test("Résultat si la variable est presque exacte", async () => {
      await client.variables!.ajouterDescriptionsVariable({
        id: idVariable,
        descriptions: {
          es: "Radiación solar",
        },
      });

      expect(résultat).toEqual({
        type: "résultat",
        clef: "es",
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
    test("Résultat si la description est exacte", async () => {
      await client.variables!.ajouterDescriptionsVariable({
        id: idVariable,
        descriptions: {
          fr: "Radiation solaire",
        },
      });
      expect(résultat).toEqual({
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
    let résultatId: résultatObjectifRecherche<infoRésultatTexte> | undefined;
    let résultatNom: résultatObjectifRecherche<infoRésultatTexte> | undefined;

    const fsOublier: schémaFonctionOublier[] = [];

    beforeAll(async () => {
      idVariable = await client.variables!.créerVariable({
        catégorie: "numérique",
      });

      const fRechercheNom = rechercherVariableSelonTexte("précipitation");
      fsOublier.push(
        await fRechercheNom(client, idVariable, (r) => (résultatNom = r))
      );

      const fRechercheId = rechercherVariableSelonTexte(
        idVariable.slice(0, 15)
      );
      fsOublier.push(
        await fRechercheId(client, idVariable, (r) => (résultatId = r))
      );

      await client.variables!.ajouterNomsVariable({
        id: idVariable,
        noms: {
          fr: "précipitation",
        },
      });
    }, config.patience);

    afterAll(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    test("Résultat nom détecté", async () => {
      expect(résultatNom).toEqual({
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

    test("Résultat id détecté", async () => {
      expect(résultatId).toEqual({
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
