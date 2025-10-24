import { créerConstellationsTest } from "@constl/utils-tests";
import { expect } from "aegir/chai";
import { MAX_TAILLE_IMAGE_SAUVEGARDER } from "@/v2/crabe/services/consts.js";
import { TraducsTexte } from "@/v2/types.js";
import { créerConstellation } from "@/v2/index.js";
import { obtenir } from "../../../utils/utils.js";
import { obtRessourceTest } from "../../../ressources/index.js";
import type { Constellation } from "@/v2/constellation.js";

describe("Profil", function () {
  let fermer: () => Promise<void>;
  let constls: Constellation[];
  let constl: Constellation;

  before(async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 1,
      créerConstellation,
    }));
    [constl] = constls;
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("Initialiser profil", function () {
    it("Pas initialisé pour commencer", async () => {
      const initialisé = await obtenir(({ siDéfini }) =>
        constl.profil.suivreInitialisé({
          f: siDéfini(),
        }),
      );
      expect(initialisé).to.be.false();
    });

    it("Initialiser", async () => {
      await constl.profil.initialiser();
      const initialisé = await obtenir(({ si }) =>
        constl.profil.suivreInitialisé({
          f: si((x) => !!x),
        }),
      );

      expect(initialisé).to.be.true();
    });
  });

  describe("Courriels", function () {
    const COURRIEL = "தொடர்பு@லஸ்ஸி.இந்தியா";

    it("Pas de courriel pour commencer", async () => {
      const courriel = await obtenir(({ siDéfini }) =>
        constl.profil.suivreCourriel({
          f: siDéfini(),
        }),
      );
      expect(courriel).to.be.null();
    });

    it("Ajouter un courriel", async () => {
      await constl.profil.sauvegarderCourriel({ courriel: COURRIEL });
      const courriel = await obtenir(({ siPasNul }) =>
        constl.profil.suivreCourriel({
          f: siPasNul(),
        }),
      );
      expect(courriel).to.equal(COURRIEL);
    });

    it("Effacer le courriel", async () => {
      await constl.profil.effacerCourriel();
      const courriel = await obtenir(({ siNul }) =>
        constl.profil.suivreCourriel({
          f: siNul(),
        }),
      );
      expect(courriel).to.be.null();
    });
  });

  describe("Noms", function () {
    it("Pas de noms pour commencer", async () => {
      const noms = await obtenir(({ siDéfini }) =>
        constl.profil.suivreNoms({
          f: siDéfini(),
        }),
      );
      expect(noms).to.be.empty();
    });

    it("Ajouter un nom", async () => {
      await constl.profil.sauvegarderNom({
        langue: "fr",
        nom: "Julien Malard-Adam",
      });
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.profil.suivreNoms({
          f: siPasVide(),
        }),
      );
      expect(noms.fr).to.equal("Julien Malard-Adam");

      await constl.profil.sauvegarderNom({
        langue: "த",
        nom: "ஜூலீஎன்",
      });
      const nomsModifiés = await obtenir<TraducsTexte>(({ si }) =>
        constl.profil.suivreNoms({
          f: si((x) => !!x && Object.keys(x).length > 1),
        }),
      );
      expect(nomsModifiés.த).to.equal("ஜூலீஎன்");
    });

    it("Changer un nom", async () => {
      await constl.profil.sauvegarderNom({
        langue: "த",
        nom: "ம.-ஆதான் ஜூலீஎன்",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.profil.suivreNoms({
          f: si((x) => !!x && x.த !== "ஜூலீஎன்"),
        }),
      );
      expect(noms.த).to.equal("ம.-ஆதான் ஜூலீஎன்");
    });

    it("Effacer un nom", async () => {
      await constl.profil.effacerNom({ langue: "fr" });

      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.profil.suivreNoms({
          f: si((x) => !!x && Object.keys(x).length <= 1),
        }),
      );
      expect(noms).to.deep.equal({ த: "ம.-ஆதான் ஜூலீஎன்" });
    });
  });

  describe("Bios", function () {
    it("Pas de bios pour commencer", async () => {
      const bios = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.profil.suivreNoms({
          f: siDéfini(),
        }),
      );
      expect(Object.keys(bios)).to.be.empty();
    });

    it("Ajouter une bio", async () => {
      await constl.profil.sauvegarderBio({
        langue: "fr",
        bio: "Julien Malard-Adam",
      });
      const bios: TraducsTexte = await obtenir(({ siPasVide }) =>
        constl.profil.suivreNoms({
          f: siPasVide(),
        }),
      );
      expect(bios.fr).to.equal("Julien Malard-Adam");

      await constl.profil.sauvegarderBio({
        langue: "मै",
        bio: "अहाँ सिखैत रहू।",
      });
      const biosModifiées: TraducsTexte = await obtenir(({ si }) =>
        constl.profil.suivreNoms({
          f: si((x) => !!x && Object.keys(x).length > 1),
        }),
      );
      expect(biosModifiées?.मै).to.equal("अहाँ सिखैत रहू।");
    });

    it("Changer une bio", async () => {
      await constl.profil.sauvegarderBio({
        langue: "मै",
        bio: "अहाँ सिखैत रहू",
      });
      const bios: TraducsTexte = await obtenir(({ si }) =>
        constl.profil.suivreNoms({
          f: si((x) => !!x && x.मै !== "अहाँ सिखैत रहू।"),
        }),
      );
      expect(bios.मै).to.equal("अहाँ सिखैत रहू");
    });

    it("Effacer un bio", async () => {
      await constl.profil.effacerBio({ langue: "fr" });
      const bios = await obtenir<TraducsTexte>(({ si }) =>
        constl.profil.suivreNoms({
          f: si((x) => !!x && Object.keys(x).length <= 1),
        }),
      );
      expect(bios).to.deep.equal({ मै: "अहाँ सिखैत रहू।" });
    });
  });

  describe("Images", function () {
    let IMAGE: Uint8Array;

    before(async () => {
      IMAGE = await obtRessourceTest({
        nomFichier: "logo.svg",
      });
    });

    it("Pas d'image pour commencer", async () => {
      const val = await obtenir(({ siDéfini }) =>
        constl.profil.suivreImage({
          f: siDéfini(),
        }),
      );

      expect(val).to.be.null();
    });

    it("Ajouter une image", async () => {
      await constl.profil.sauvegarderImage({
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });

      const val = await obtenir<{ image: Uint8Array; idImage: string } | null>(
        ({ siPasNul }) =>
          constl.profil.suivreImage({
            f: siPasNul(),
          }),
      );

      expect(val?.image).to.deep.equal(new Uint8Array(IMAGE));
    });

    it("Effacer l'image", async () => {
      await constl.profil.effacerImage();

      const val = await obtenir<{ image: Uint8Array; idImage: string } | null>(
        ({ siNul }) =>
          constl.profil.suivreImage({
            f: siNul(),
          }),
      );
      expect(val).to.be.null();
    });

    it("Ajouter une image trop grande", async () => {
      expect(
        constl.profil.sauvegarderImage({
          image: {
            contenu: new Uint8Array(MAX_TAILLE_IMAGE_SAUVEGARDER + 1),
            nomFichier: "moi.png",
          },
        }),
      ).to.be.rejected();
    });
  });
});
