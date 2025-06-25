import { expect } from "aegir/chai";

import { constellation as utilsTestConstellation } from "@constl/utils-tests";
import { obtenir } from "@constl/utils-ipa";
import { créerConstellation, type Constellation } from "@/index.js";
import { TraducsNom, type schémaFonctionOublier } from "@/types.js";

const { créerConstellationsTest } = utilsTestConstellation;

describe.only("Mots-clefs", function () {
  let fOublierClients: () => Promise<void>;
  let clients: Constellation[];
  let client: Constellation;

  before("Préparer clients", async () => {
    ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
      n: 1,

      créerConstellation,
    }));
    client = clients[0];
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Création", function () {
    let idMotClef: string;

    it("Pas de mots-clefs pour commencer", async () => {
      const motsClefs = await obtenir<string[]>(({ siDéfini }) =>
        client.motsClefs.suivreMotsClefs({
          f: siDéfini(),
        }),
      );

      expect(motsClefs).to.be.an.empty("array");
    });

    it("Créer des mots-clefs", async () => {
      idMotClef = await client.motsClefs.créerMotClef();
      const motsClefs = await obtenir<string[]>(({ siPasVide }) =>
        client.motsClefs.suivreMotsClefs({
          f: siPasVide(),
        }),
      );

      expect(Array.isArray(motsClefs)).to.be.true();
      expect(motsClefs.length).to.equal(1);
    });
    it("Effacer un mot-clef", async () => {
      await client.motsClefs.effacerMotClef({ idMotClef });
      const motsClefs = await obtenir<string[]>(({ siVide }) =>
        client.motsClefs.suivreMotsClefs({
          f: siVide(),
        }),
      );

      expect(motsClefs).to.be.an.empty("array");
    });
  });

  describe("Mes mots-clefs", function () {
    let idMotClef: string;

    before(async () => {
      idMotClef = await client.motsClefs.créerMotClef();
    });

    it("Le mot-clef est déjà ajouté", async () => {
      const motsClefs = await obtenir<string[]>(({ siPasVide }) =>
        client.motsClefs.suivreMotsClefs({
          f: siPasVide(),
        }),
      );

      expect(motsClefs).to.contain(idMotClef);
    });

    it("Enlever de mes mots-clefs", async () => {
      await client.motsClefs.enleverDeMesMotsClefs({ idMotClef });
      const motsClefs = await obtenir<string[]>(({ siVide }) =>
        client.motsClefs.suivreMotsClefs({
          f: siVide(),
        }),
      );

      expect(motsClefs).not.to.contain(idMotClef);
    });

    it("Ajouter à mes mots-clefs", async () => {
      await client.motsClefs.ajouterÀMesMotsClefs({ idMotClef });
      const motsClefs = await obtenir<string[]>(({ siPasVide }) =>
        client.motsClefs.suivreMotsClefs({
          f: siPasVide(),
        }),
      );

      expect(motsClefs).to.contain(idMotClef);
    });
  });

  describe("Noms", function () {
    let idMotClef: string;

    before(async () => {
      idMotClef = await client.motsClefs.créerMotClef();
    });

    it("Pas de noms pour commencer", async () => {
      const noms = await obtenir<TraducsNom>(({ siDéfini }) =>
        client.motsClefs.suivreNomsMotClef({
          idMotClef,
          f: siDéfini(),
        }),
      );
      expect(Object.keys(noms).length).to.equal(0);
    });

    it("Ajouter un nom", async () => {
      await client.motsClefs.sauvegarderNomMotClef({
        idMotClef,
        langue: "fr",
        nom: "Hydrologie",
      });
      const noms = await obtenir<TraducsNom>(({ siPasVide }) =>
        client.motsClefs.suivreNomsMotClef({
          idMotClef,
          f: siPasVide(),
        }),
      );
      expect(noms.fr).to.equal("Hydrologie");
    });

    it("Ajouter des noms", async () => {
      await client.motsClefs.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          த: "நீரியல்",
          हिं: "जल विज्ञान",
        },
      });
      const noms = await obtenir<TraducsNom>(({ si }) =>
        client.motsClefs.suivreNomsMotClef({
          idMotClef,
          f: si((x) => Object.keys(x).length >= 3),
        }),
      );

      expect(noms).to.deep.equal({
        த: "நீரியல்",
        हिं: "जल विज्ञान",
        fr: "Hydrologie",
      });
    });

    it("Changer un nom", async () => {
      await client.motsClefs.sauvegarderNomMotClef({
        idMotClef,
        langue: "fr",
        nom: "hydrologie",
      });

      const noms = await obtenir<TraducsNom>(({ si }) =>
        client.motsClefs.suivreNomsMotClef({
          idMotClef,
          f: si((x) => x["fr"] === "hydrologie"),
        }),
      );
      expect(noms.fr).to.equal("hydrologie");
    });

    it("Effacer un nom", async () => {
      await client.motsClefs.effacerNomMotClef({
        idMotClef,
        langue: "fr",
      });
      const noms = await obtenir<TraducsNom>(({ si }) =>
        client.motsClefs.suivreNomsMotClef({
          idMotClef,
          f: si((x) => !Object.keys(x).includes("fr")),
        }),
      );
      expect(noms).to.deep.equal({
        த: "நீரியல்",
        हिं: "जल विज्ञान",
      });
    });
  });

  describe("Copier mots-clefs", function () {
    let idMotClef2: string;

    before(async () => {
      const idMotClef = await client.motsClefs.créerMotClef();
      await client.motsClefs.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          த: "நீரியல்",
          हिं: "जल विज्ञान",
        },
      });

      await client.motsClefs.sauvegarderDescriptionsMotClef({
        idMotClef,
        descriptions: {
          த: "நீரியலுக்காக ஒரு சிறப்பு சொலு",
          हिं: "जल विज्ञान के आँकड़ों के लिये",
        },
      });

      idMotClef2 = await client.motsClefs.copierMotClef({
        idMotClef,
      });
    });

    it("Le mot-clef est copié", async () => {
      const motsClefs = await obtenir(({ siPasVide }) =>
        client.motsClefs.suivreMotsClefs({
          f: siPasVide(),
        }),
      );
      expect(Array.isArray(motsClefs)).to.be.true();
      expect(motsClefs).to.contain(idMotClef2);
    });

    it("Les noms sont copiés", async () => {
      const noms = await obtenir<TraducsNom>(({ siDéfini }) =>
        client.motsClefs.suivreNomsMotClef({
          idMotClef: idMotClef2,
          f: siDéfini(),
        }),
      );
      expect(noms).to.deep.equal({ த: "நீரியல்", हिं: "जल विज्ञान" });
    });

    it("Les descriptions sont copiés", async () => {
      const descriptions = await obtenir<TraducsNom>(({ siDéfini }) =>
        client.motsClefs.suivreDescriptionsMotClef({
          idMotClef: idMotClef2,
          f: siDéfini(),
        }),
      );
      expect(descriptions).to.deep.equal({
        த: "நீரியலுக்காக ஒரு சிறப்பு சொலு",
        हिं: "जल विज्ञान के आँकड़ों के लिये",
      });
    });
  });
});
