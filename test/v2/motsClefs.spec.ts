import { obtenir } from "@constl/utils-ipa";
import { créerConstellationsTest } from "@constl/utils-tests";
import { expect } from "aegir/chai";
import { Constellation, créerConstellation } from "@/v2/index.js";
import { TraducsTexte } from "@/v2/types.js";
import { TOUS_DISPOSITIFS } from "@/v2/favoris.js";

describe("Mots-clefs", function () {
  let fermer: () => Promise<void>;
  let constls: Constellation[];
  let constl: Constellation;

  before("Préparer constls", async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 1,

      créerConstellation,
    }));
    constl = constls[0];
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("Création", function () {
    let idMotClef: string;

    it("Pas de mots-clefs pour commencer", async () => {
      const motsClefs = await obtenir(({ siDéfini }) =>
        constl.motsClefs.suivreMotsClefs({
          f: siDéfini(),
        }),
      );

      expect(motsClefs).to.be.an.empty("array");
    });

    it("Créer un mot-clef", async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
      const motsClefs = await obtenir(({ siPasVide }) =>
        constl.motsClefs.suivreMotsClefs({
          f: siPasVide(),
        }),
      );

      expect(motsClefs).to.have.members([idMotClef]);

      const épingle = await obtenir(({ siDéfini }) =>
        constl.motsClefs.suivreÉpingleMotClef({ idMotClef, f: siDéfini() }),
      );
      expect(épingle).to.not.be.undefined();
    });

    it("Effacer un mot-clef", async () => {
      await constl.motsClefs.effacerMotClef({ idMotClef });
      const motsClefs = await obtenir(({ siVide }) =>
        constl.motsClefs.suivreMotsClefs({
          f: siVide(),
        }),
      );

      expect(motsClefs).to.be.an.empty("array");
    });
  });

  describe("Mes mots-clefs", function () {
    let idMotClef: string;

    it("Le mot-clef est déjà ajouté", async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
      const mesMotsClefs = await obtenir(({ siPasVide }) =>
        constl.motsClefs.suivreMotsClefs({
          f: siPasVide(),
        }),
      );

      expect(mesMotsClefs).to.contain(idMotClef);
    });

    it("Enlever de mes mots-clefs", async () => {
      await constl.motsClefs.enleverDeMesMotsClefs({ idMotClef });
      const mesMotsClefs = await obtenir(({ siVide }) =>
        constl.motsClefs.suivreMotsClefs({
          f: siVide(),
        }),
      );

      expect(mesMotsClefs).not.to.contain(idMotClef);
    });

    it("Ajouter à mes mots-clefs", async () => {
      await constl.motsClefs.ajouterÀMesMotsClefs({ idMotClef });
      const mesMotsClefs = await obtenir(({ siPasVide }) =>
        constl.motsClefs.suivreMotsClefs({
          f: siPasVide(),
        }),
      );

      expect(mesMotsClefs).to.contain(idMotClef);
    });
  });

  describe("Noms", function () {
    let idMotClef: string;

    before(async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
    });

    it("Pas de noms pour commencer", async () => {
      const noms = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.motsClefs.suivreNomsMotClef({
          idMotClef,
          f: siDéfini(),
        }),
      );
      expect(Object.keys(noms).length).to.equal(0);
    });

    it("Ajouter un nom", async () => {
      await constl.motsClefs.sauvegarderNomMotClef({
        idMotClef,
        langue: "fr",
        nom: "Hydrologie",
      });
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.motsClefs.suivreNomsMotClef({
          idMotClef,
          f: siPasVide(),
        }),
      );
      expect(noms.fr).to.equal("Hydrologie");
    });

    it("Ajouter des noms", async () => {
      await constl.motsClefs.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          த: "நீரியல்",
          हिं: "जल विज्ञान",
        },
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.motsClefs.suivreNomsMotClef({
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
      await constl.motsClefs.sauvegarderNomMotClef({
        idMotClef,
        langue: "fr",
        nom: "hydrologie",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.motsClefs.suivreNomsMotClef({
          idMotClef,
          f: si((x) => x["fr"] == "hydrologie"),
        }),
      );

      expect(noms.fr).to.equal("hydrologie");
    });

    it("Effacer un nom", async () => {
      await constl.motsClefs.effacerNomMotClef({
        idMotClef,
        langue: "fr",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.motsClefs.suivreNomsMotClef({
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
    let idMotClef: string;
    let idMotClef2: string;

    before(async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
      await constl.motsClefs.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          த: "நீரியல்",
          हिं: "जल विज्ञान",
        },
      });

      await constl.motsClefs.sauvegarderDescriptionsMotClef({
        idMotClef,
        descriptions: {
          த: "நீரியலுக்காக ஒரு சிறப்பு சொலு",
          हिं: "जल विज्ञान के आँकड़ों के लिये",
        },
      });

      idMotClef2 = await constl.motsClefs.copierMotClef({
        idMotClef,
      });
    });

    it("Le mot-clef est copié", async () => {
      const motsClefs = await obtenir(({ siPasVide }) =>
        constl.motsClefs.suivreMotsClefs({ f: siPasVide() }),
      );
      expect(motsClefs).to.have.members([idMotClef, idMotClef2]);
    });

    it("Les noms sont copiés", async () => {
      const noms = await obtenir(({ siPasVide }) =>
        constl.motsClefs.suivreNomsMotClef({ idMotClef, f: siPasVide() }),
      );
      expect(noms).to.deep.equal({ த: "நீரியல்", हिं: "जल विज्ञान" });
    });

    it("Les descriptions sont copiés", async () => {
      const descriptions = await obtenir(({ siPasVide }) =>
        constl.motsClefs.suivreDescriptionsMotClef({
          idMotClef,
          f: siPasVide(),
        }),
      );
      expect(descriptions).to.deep.equal({
        த: "நீரியலுக்காக ஒரு சிறப்பு சொலு",
        हिं: "जल विज्ञान के आँकड़ों के लिये",
      });
    });
  });

  describe("Épingler", function () {
    it("désépingler", async () => {
      const idMotClef = await constl.motsClefs.créerMotClef();
      await constl.motsClefs.désépinglerMotClef({ idMotClef });

      const épingle = await obtenir(({ si }) =>
        constl.motsClefs.suivreÉpingleMotClef({
          idMotClef,
          f: si((x) => x === undefined),
        }),
      );
      expect(épingle).to.be.undefined();
    });

    it("épingler", async () => {
      const idMotClef = await constl.motsClefs.créerMotClef({
        épingler: false,
      });
      await constl.motsClefs.épinglerMotClef({ idMotClef });

      const épingle = await obtenir(({ siDéfini }) =>
        constl.motsClefs.suivreÉpingleMotClef({ idMotClef, f: siDéfini() }),
      );
      expect(épingle).to.deep.equal({
        base: TOUS_DISPOSITIFS,
        type: "mot-clef",
      });
    });

    it("résoudre épingle", async () => {
      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.motsClefs.suivreRésolutionÉpingle({
          épingle: {
            idObjet: "n'importe",
            épingle: {
              type: "mot-clef",
              base: true,
            },
          },
          f: siDéfini(),
        }),
      );
      expect(résolution).to.have.members(["n'importe"]);
    });
  });
});
