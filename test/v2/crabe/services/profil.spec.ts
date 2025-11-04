import { expect } from "aegir/chai";
import { MAX_TAILLE_IMAGE_SAUVEGARDER } from "@/v2/crabe/services/consts.js";
import { TraducsTexte } from "@/v2/types.js";
import { obtenir } from "../../utils.js";
import { obtRessourceTest } from "../../../ressources/index.js";
import { CrabeTest, créerCrabesTest } from "../utils.js";

describe.only("Profil", function () {
  let fermer: () => Promise<void>;
  let crabes: CrabeTest[];
  let crabe: CrabeTest;

  before(async () => {
    ({ fermer, crabes } = await créerCrabesTest({
      n: 1,
      services: {}
    }));

    [crabe] = crabes;
    await crabe.démarrer();
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("Initialiser profil", function () {

    it("Pas initialisé pour commencer", async () => {
      const initialisé = await obtenir(({ siDéfini }) =>
        crabe.profil.suivreInitialisé({
          f: siDéfini(),
        }),
      );
      expect(initialisé).to.be.false();
    });

    it("Initialiser", async () => {
      await crabe.profil.initialiser();
      const initialisé = await obtenir(({ si }) =>
        crabe.profil.suivreInitialisé({
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
        crabe.profil.suivreCourriel({
          f: siDéfini(),
        }),
      );
      expect(courriel).to.be.null();
    });

    it("Ajouter un courriel", async () => {
      await crabe.profil.sauvegarderCourriel({ courriel: COURRIEL });
      const courriel = await obtenir(({ siPasNul }) =>
        crabe.profil.suivreCourriel({
          f: siPasNul(),
        }),
      );
      expect(courriel).to.equal(COURRIEL);
    });

    it("Effacer le courriel", async () => {
      await crabe.profil.effacerCourriel();
      const courriel = await obtenir(({ siNul }) =>
        crabe.profil.suivreCourriel({
          f: siNul(),
        }),
      );
      expect(courriel).to.be.null();
    });
  });

  describe("Noms", function () {
    it("Pas de noms pour commencer", async () => {
      const noms = await obtenir(({ siDéfini }) =>
        crabe.profil.suivreNoms({
          f: siDéfini(),
        }),
      );
      expect(noms).to.be.empty();
    });

    it("Ajouter un nom", async () => {
      await crabe.profil.sauvegarderNom({
        langue: "fr",
        nom: "Julien Malard-Adam",
      });
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        crabe.profil.suivreNoms({
          f: siPasVide(),
        }),
      );
      expect(noms.fr).to.equal("Julien Malard-Adam");

      await crabe.profil.sauvegarderNom({
        langue: "த",
        nom: "ஜூலீஎன்",
      });
      const nomsModifiés = await obtenir<TraducsTexte>(({ si }) =>
        crabe.profil.suivreNoms({
          f: si((x) => !!x && Object.keys(x).length > 1),
        }),
      );
      expect(nomsModifiés.த).to.equal("ஜூலீஎன்");
    });

    it("Changer un nom", async () => {
      await crabe.profil.sauvegarderNom({
        langue: "த",
        nom: "ம.-ஆதான் ஜூலீஎன்",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        crabe.profil.suivreNoms({
          f: si((x) => !!x && x.த !== "ஜூலீஎன்"),
        }),
      );
      expect(noms.த).to.equal("ம.-ஆதான் ஜூலீஎன்");
    });

    it("Effacer un nom", async () => {
      await crabe.profil.effacerNom({ langue: "fr" });

      const noms = await obtenir<TraducsTexte>(({ si }) =>
        crabe.profil.suivreNoms({
          f: si((x) => !!x && Object.keys(x).length <= 1),
        }),
      );
      expect(noms).to.deep.equal({ த: "ம.-ஆதான் ஜூலீஎன்" });
    });
  });

  describe("Bios", function () {
    it("Pas de bios pour commencer", async () => {
      const bios = await obtenir<TraducsTexte>(({ siDéfini }) =>
        crabe.profil.suivreBios({
          f: siDéfini(),
        }),
      );
      expect(Object.keys(bios)).to.be.empty();
    });

    it("Ajouter une bio", async () => {
      await crabe.profil.sauvegarderBio({
        langue: "fr",
        bio: "Julien Malard-Adam",
      });
      const bios: TraducsTexte = await obtenir(({ siPasVide }) =>
        crabe.profil.suivreBios({
          f: siPasVide(),
        }),
      );
      expect(bios.fr).to.equal("Julien Malard-Adam");

      await crabe.profil.sauvegarderBio({
        langue: "मै",
        bio: "अहाँ सिखैत रहू।",
      });
      const biosModifiées: TraducsTexte = await obtenir(({ si }) =>
        crabe.profil.suivreBios({
          f: si((x) => !!x && Object.keys(x).length > 1),
        }),
      );
      expect(biosModifiées?.मै).to.equal("अहाँ सिखैत रहू।");
    });

    it("Changer une bio", async () => {
      await crabe.profil.sauvegarderBio({
        langue: "मै",
        bio: "अहाँ सिखैत रहू",
      });
      const bios: TraducsTexte = await obtenir(({ si }) =>
        crabe.profil.suivreBios({
          f: si((x) => !!x && x.मै !== "अहाँ सिखैत रहू।"),
        }),
      );
      expect(bios.मै).to.equal("अहाँ सिखैत रहू");
    });

    it("Effacer une bio", async () => {
      await crabe.profil.effacerBio({ langue: "fr" });
      const bios = await obtenir<TraducsTexte>(({ si }) =>
        crabe.profil.suivreBios({
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
        crabe.profil.suivreImage({
          f: siDéfini(),
        }),
      );

      expect(val).to.be.null();
    });

    it("Ajouter une image", async () => {
      await crabe.profil.sauvegarderImage({
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });

      const val = await obtenir<{ image: Uint8Array; idImage: string } | null>(
        ({ siPasNul }) =>
          crabe.profil.suivreImage({
            f: siPasNul(),
          }),
      );

      expect(val?.image).to.deep.equal(new Uint8Array(IMAGE));
    });

    it("Effacer l'image", async () => {
      await crabe.profil.effacerImage();

      const val = await obtenir<{ image: Uint8Array; idImage: string } | null>(
        ({ siNul }) =>
          crabe.profil.suivreImage({
            f: siNul(),
          }),
      );
      expect(val).to.be.null();
    });

    it("Ajouter une image trop grande", async () => {
      expect(
        crabe.profil.sauvegarderImage({
          image: {
            contenu: new Uint8Array(MAX_TAILLE_IMAGE_SAUVEGARDER + 1),
            nomFichier: "moi.png",
          },
        }),
      ).to.be.rejected();
    });
  });
});
