import { expect } from "aegir/chai";
import { MAX_TAILLE_IMAGE_SAUVEGARDER } from "@/v2/nébuleuse/services/consts.js";
import { obtenir } from "../../utils.js";
import { obtRessourceTest } from "../../../ressources/index.js";
import { créerNébuleusesTest } from "../utils.js";
import type { NébuleuseTest } from "../utils.js";
import type { TraducsTexte } from "@/v2/types.js";

describe.only("Profil", function () {
  let fermer: () => Promise<void>;
  let nébuleuses: NébuleuseTest[];
  let nébuleuse: NébuleuseTest;

  before(async () => {
    ({ fermer, nébuleuses } = await créerNébuleusesTest({
      n: 1,
      services: {},
    }));

    [nébuleuse] = nébuleuses;
    await nébuleuse.démarrer();
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("Initialiser profil", function () {
    it("Pas initialisé pour commencer", async () => {
      const initialisé = await obtenir(({ siDéfini }) =>
        nébuleuse.profil.suivreInitialisé({
          f: siDéfini(),
        }),
      );
      expect(initialisé).to.be.false();
    });

    it("Initialiser", async () => {
      await nébuleuse.profil.initialiser();
      const initialisé = await obtenir(({ si }) =>
        nébuleuse.profil.suivreInitialisé({
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
        nébuleuse.profil.suivreCourriel({
          f: siDéfini(),
        }),
      );
      expect(courriel).to.be.null();
    });

    it("Ajouter un courriel", async () => {
      await nébuleuse.profil.sauvegarderCourriel({ courriel: COURRIEL });
      const courriel = await obtenir(({ siPasNul }) =>
        nébuleuse.profil.suivreCourriel({
          f: siPasNul(),
        }),
      );
      expect(courriel).to.equal(COURRIEL);
    });

    it("Effacer le courriel", async () => {
      await nébuleuse.profil.effacerCourriel();
      const courriel = await obtenir(({ siNul }) =>
        nébuleuse.profil.suivreCourriel({
          f: siNul(),
        }),
      );
      expect(courriel).to.be.null();
    });
  });

  describe("Noms", function () {
    it("Pas de noms pour commencer", async () => {
      const noms = await obtenir(({ siDéfini }) =>
        nébuleuse.profil.suivreNoms({
          f: siDéfini(),
        }),
      );
      expect(noms).to.be.empty();
    });

    it("Ajouter un nom", async () => {
      await nébuleuse.profil.sauvegarderNom({
        langue: "fr",
        nom: "Julien Malard-Adam",
      });
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        nébuleuse.profil.suivreNoms({
          f: siPasVide(),
        }),
      );
      expect(noms.fr).to.equal("Julien Malard-Adam");

      await nébuleuse.profil.sauvegarderNom({
        langue: "த",
        nom: "ஜூலீஎன்",
      });
      const nomsModifiés = await obtenir<TraducsTexte>(({ si }) =>
        nébuleuse.profil.suivreNoms({
          f: si((x) => !!x && Object.keys(x).length > 1),
        }),
      );
      expect(nomsModifiés.த).to.equal("ஜூலீஎன்");
    });

    it("Changer un nom", async () => {
      await nébuleuse.profil.sauvegarderNom({
        langue: "த",
        nom: "ம.-ஆதான் ஜூலீஎன்",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        nébuleuse.profil.suivreNoms({
          f: si((x) => !!x && x.த !== "ஜூலீஎன்"),
        }),
      );
      expect(noms.த).to.equal("ம.-ஆதான் ஜூலீஎன்");
    });

    it("Effacer un nom", async () => {
      await nébuleuse.profil.effacerNom({ langue: "fr" });

      const noms = await obtenir<TraducsTexte>(({ si }) =>
        nébuleuse.profil.suivreNoms({
          f: si((x) => !!x && Object.keys(x).length <= 1),
        }),
      );
      expect(noms).to.deep.equal({ த: "ம.-ஆதான் ஜூலீஎன்" });
    });
  });

  describe("Bios", function () {
    it("Pas de bios pour commencer", async () => {
      const bios = await obtenir<TraducsTexte>(({ siDéfini }) =>
        nébuleuse.profil.suivreBios({
          f: siDéfini(),
        }),
      );
      expect(Object.keys(bios)).to.be.empty();
    });

    it("Ajouter une bio", async () => {
      await nébuleuse.profil.sauvegarderBio({
        langue: "fr",
        bio: "Julien Malard-Adam",
      });
      const bios: TraducsTexte = await obtenir(({ siPasVide }) =>
        nébuleuse.profil.suivreBios({
          f: siPasVide(),
        }),
      );
      expect(bios.fr).to.equal("Julien Malard-Adam");

      await nébuleuse.profil.sauvegarderBio({
        langue: "मै",
        bio: "अहाँ सिखैत रहू।",
      });
      const biosModifiées: TraducsTexte = await obtenir(({ si }) =>
        nébuleuse.profil.suivreBios({
          f: si((x) => !!x && Object.keys(x).length > 1),
        }),
      );
      expect(biosModifiées?.मै).to.equal("अहाँ सिखैत रहू।");
    });

    it("Changer une bio", async () => {
      await nébuleuse.profil.sauvegarderBio({
        langue: "मै",
        bio: "अहाँ सिखैत रहू",
      });
      const bios: TraducsTexte = await obtenir(({ si }) =>
        nébuleuse.profil.suivreBios({
          f: si((x) => !!x && x.मै !== "अहाँ सिखैत रहू।"),
        }),
      );
      expect(bios.मै).to.equal("अहाँ सिखैत रहू");
    });

    it("Effacer une bio", async () => {
      await nébuleuse.profil.effacerBio({ langue: "fr" });
      const bios = await obtenir<TraducsTexte>(({ si }) =>
        nébuleuse.profil.suivreBios({
          f: si((x) => !!x && Object.keys(x).length <= 1),
        }),
      );
      expect(bios).to.deep.equal({ मै: "अहाँ सिखैत रहू" });
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
        nébuleuse.profil.suivreImage({
          f: siDéfini(),
        }),
      );

      expect(val).to.be.null();
    });

    it("Ajouter une image", async () => {
      await nébuleuse.profil.sauvegarderImage({
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });

      const image = await obtenir<{
        image: Uint8Array;
        idImage: string;
      } | null>(({ siPasNul }) =>
        nébuleuse.profil.suivreImage({
          f: siPasNul(),
        }),
      );

      expect(image?.image).to.deep.equal(new Uint8Array(IMAGE));
    });

    it("Effacer l'image", async () => {
      await nébuleuse.profil.effacerImage();

      const val = await obtenir<{ image: Uint8Array; idImage: string } | null>(
        ({ siNul }) =>
          nébuleuse.profil.suivreImage({
            f: siNul(),
          }),
      );
      expect(val).to.be.null();
    });

    it("Ajouter une image trop grande", async () => {
      expect(
        nébuleuse.profil.sauvegarderImage({
          image: {
            contenu: new Uint8Array(MAX_TAILLE_IMAGE_SAUVEGARDER + 1),
            nomFichier: "moi.png",
          },
        }),
      ).to.be.rejected();
    });
  });
});
