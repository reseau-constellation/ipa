import { expect } from "aegir/chai";
import { MAX_TAILLE_IMAGE_SAUVEGARDER } from "@/v2/nébuleuse/services/consts.js";
import {
  AUCUN_DISPOSITIF,
  TOUS_DISPOSITIFS,
} from "@/v2/nébuleuse/services/favoris.js";
import { idcEtFichierValide } from "@/v2/utils.js";
import { obtenir } from "../../utils.js";
import { obtRessourceTest } from "../../../ressources/index.js";
import { créerNébuleusesTest } from "../utils.js";
import type {
  ServicesNécessairesProfil,
  ÉpingleProfil,
} from "@/v2/nébuleuse/services/profil.js";
import type { NébuleuseTest } from "../utils.js";
import type { TraducsTexte } from "@/v2/types.js";

describe.only("Profil", function () {
  let fermer: () => Promise<void>;
  let nébuleuses: NébuleuseTest[];
  let nébuleuse: NébuleuseTest;

  let idsComptes: string[];

  let IMAGE: Uint8Array;

  before(async () => {
    ({ fermer, nébuleuses } = await créerNébuleusesTest({
      n: 2,
      services: {},
    }));

    [nébuleuse] = nébuleuses;
    await nébuleuse.démarrer();

    idsComptes = await Promise.all(
      nébuleuses.map((n) => n.compte.obtIdCompte()),
    );

    IMAGE = await obtRessourceTest({
      nomFichier: "logo.svg",
    });
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("initialiser profil", function () {
    it("pas initialisé pour commencer", async () => {
      const initialisé = await obtenir(({ siDéfini }) =>
        nébuleuse.profil.suivreInitialisé({
          f: siDéfini(),
        }),
      );
      expect(initialisé).to.be.false();
    });

    it("initialiser", async () => {
      await nébuleuse.profil.initialiser();
      const initialisé = await obtenir(({ si }) =>
        nébuleuse.profil.suivreInitialisé({
          f: si((x) => !!x),
        }),
      );

      expect(initialisé).to.be.true();
    });
  });

  describe("courriels", function () {
    const COURRIEL = "தொடர்பு@லஸ்ஸி.இந்தியா";

    it("Pas de courriel pour commencer", async () => {
      const courriel = await obtenir(({ siDéfini }) =>
        nébuleuse.profil.suivreCourriel({
          f: siDéfini(),
        }),
      );
      expect(courriel).to.be.null();
    });

    it("ajouter un courriel", async () => {
      await nébuleuse.profil.sauvegarderCourriel({ courriel: COURRIEL });
      const courriel = await obtenir(({ siPasNul }) =>
        nébuleuse.profil.suivreCourriel({
          f: siPasNul(),
        }),
      );
      expect(courriel).to.equal(COURRIEL);
    });

    it("effacer le courriel", async () => {
      await nébuleuse.profil.effacerCourriel();
      const courriel = await obtenir(({ siNul }) =>
        nébuleuse.profil.suivreCourriel({
          f: siNul(),
        }),
      );
      expect(courriel).to.be.null();
    });
  });

  describe("noms", function () {
    it("pas de noms pour commencer", async () => {
      const noms = await obtenir(({ siDéfini }) =>
        nébuleuse.profil.suivreNoms({
          f: siDéfini(),
        }),
      );
      expect(noms).to.be.empty();
    });

    it("ajouter un nom", async () => {
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

    it("changer un nom", async () => {
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

    it("effacer un nom", async () => {
      await nébuleuse.profil.effacerNom({ langue: "fr" });

      const noms = await obtenir<TraducsTexte>(({ si }) =>
        nébuleuse.profil.suivreNoms({
          f: si((x) => !!x && Object.keys(x).length <= 1),
        }),
      );
      expect(noms).to.deep.equal({ த: "ம.-ஆதான் ஜூலீஎன்" });
    });
  });

  describe("bios", function () {
    it("pas de bios pour commencer", async () => {
      const bios = await obtenir<TraducsTexte>(({ siDéfini }) =>
        nébuleuse.profil.suivreBios({
          f: siDéfini(),
        }),
      );
      expect(Object.keys(bios)).to.be.empty();
    });

    it("ajouter une bio", async () => {
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

    it("changer une bio", async () => {
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

    it("effacer une bio", async () => {
      await nébuleuse.profil.effacerBio({ langue: "fr" });
      const bios = await obtenir<TraducsTexte>(({ si }) =>
        nébuleuse.profil.suivreBios({
          f: si((x) => !!x && Object.keys(x).length <= 1),
        }),
      );
      expect(bios).to.deep.equal({ मै: "अहाँ सिखैत रहू" });
    });
  });

  describe("images", function () {
    it("pas d'image pour commencer", async () => {
      const val = await obtenir(({ siDéfini }) =>
        nébuleuse.profil.suivreImage({
          f: siDéfini(),
        }),
      );

      expect(val).to.be.null();
    });

    it("ajouter une image", async () => {
      const idImage = await nébuleuse.profil.sauvegarderImage({
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });

      expect(idcEtFichierValide(idImage)).to.be.true();

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

    it("effacer l'image", async () => {
      await nébuleuse.profil.effacerImage();

      const val = await obtenir<{ image: Uint8Array; idImage: string } | null>(
        ({ siNul }) =>
          nébuleuse.profil.suivreImage({
            f: siNul(),
          }),
      );
      expect(val).to.be.null();
    });

    it("ajouter une image trop grande", async () => {
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

  describe("épingles", function () {
    let idImage: string;

    const idCompteInexistant =
      "/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX";

    it("épingler profil", async () => {
      await nébuleuse.profil.épingler({
        idCompte: idsComptes[1],
      });

      const épingle = await obtenir(({ siDéfini }) =>
        nébuleuse.profil.suivreÉpingle({
          idCompte: idsComptes[1],
          f: siDéfini(),
        }),
      );

      const réf: ÉpingleProfil = {
        type: "profil",
        épingle: {
          base: TOUS_DISPOSITIFS,
          favoris: AUCUN_DISPOSITIF,
        },
      };
      expect(épingle).to.deep.equal(réf);
    });

    it("résoudre épingle - base", async () => {
      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        nébuleuse.profil.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idsComptes[1],
            épingle: {
              type: "profil",
              épingle: { base: true },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolution]).to.have.members([idsComptes[1]]);

      idImage = await nébuleuses[1].profil.sauvegarderImage({
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });
      const résolutionAvecImage = await obtenir<Set<string>>(({ si }) =>
        nébuleuse.profil.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idsComptes[1],
            épingle: {
              type: "profil",
              épingle: {
                base: true,
              },
            },
          },
          f: si((x) => !!x && x.size > 1),
        }),
      );
      expect([...résolutionAvecImage]).to.have.members([
        idsComptes[1],
        idImage,
      ]);
    });

    it("résoudre épingle - favoris", async () => {
      await nébuleuses[1].profil.épingler({ idCompte: idCompteInexistant });
      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        nébuleuse.profil.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idsComptes[1],
            épingle: {
              type: "profil",
              épingle: { base: true, favoris: true },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolution]).to.have.members([
        idsComptes[1],
        idImage,
        idCompteInexistant,
      ]);
    });

    it("résoudre épingle - favoris circulaires", async () => {
      await nébuleuses[1].profil.épingler({ idCompte: idsComptes[0] });

      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        nébuleuse.profil.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idsComptes[1],
            épingle: {
              type: "profil",
              épingle: { base: true, favoris: true },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolution]).to.have.members([
        idsComptes[1],
        idImage,
        idCompteInexistant,
        idsComptes[0],
      ]);
    });

    it("désépingler profil", async () => {
      await nébuleuse.profil.désépingler({ idCompte: idsComptes[1] });

      const épingle = await obtenir(({ siNonDéfini }) =>
        nébuleuse.profil.suivreÉpingle({
          idCompte: idsComptes[1],
          f: siNonDéfini(),
        }),
      );
      expect(épingle).to.be.undefined();
    });
  });

  describe("rejoindre compte", function () {
    let applis: Appli<ServicesNécessairesProfil & { profil: ServiceProfil }>[];
    let comptes: ServiceCompte<StructureNébuleuse & Record<string, never>>[];
    let fermer: () => Promise<void>;

    let idObjet: string;

    let idsDispositifs: string[];
    let idsComptes: string[];

    before(async () => {
      ({ applis, fermer } = await créerApplisTest({
        n: 2,
        services: {},
      }));
      comptes = applis.map((a) => a.services["compte"]);

      idsDispositifs = await Promise.all(
        comptes.map(async (compte) => await compte.obtIdDispositif()),
      );
      idsComptes = await Promise.all(
        comptes.map((compte) => compte.obtIdCompte()),
      );

      await applis[0].profil.sauvegarderNom({
        nom: "Julien Malard-Adam",
        langue: "fr",
      });

      await comptes[0].ajouterDispositif({
        idDispositif: await comptes[1].obtIdDispositif(),
      });
      await comptes[1].rejoindreCompte({
        idCompte: await comptes[0].obtIdCompte(),
      });
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("le nouveau dispositif suit le profil", async () => {
      const noms = await obtenir<TraducsTexte | undefined>(({ si }) =>
        applis[1].profil.suivreNoms({
          f: si((x) => !!x && Object.keys(x).includes("fr")),
        }),
      );

      expect(noms?.fr).to.equal("Julien Malard-Adam");
    });

    it("le nouveau dispositif peut modifier le compte", async () => {
      await applis[1].profil.sauvegarderNom({
        langue: "த",
        nom: "ம.-அதான் ஜூலீஎன்",
      });

      const pNoms = obtenir<TraducsTexte | undefined>(({ si }) =>
        applis[0].profil.suivreNoms({
          f: si((x) => !!x && Object.keys(x).includes("த")),
        }),
      );

      const noms = await pNoms;
      expect(noms).to.deep.equal({
        fr: "Julien Malard-Adam",
        த: "ம.-அதான் ஜூலீஎன்",
      });
    });
  });
});
