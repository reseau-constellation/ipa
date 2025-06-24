import {
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";
import { expect } from "aegir/chai";
import { type Constellation, créerConstellation } from "@/index.js";
import { MAX_TAILLE_IMAGE } from "@/profil.js";
import { obtRessourceTest } from "./ressources/index.js";
import type { TraducsNom, schémaFonctionOublier } from "@/types.js";
import { obtenir } from "@constl/utils-ipa";

describe("Profil", function () {
  let fOublierClients: () => Promise<void>;
  let clients: Constellation[];
  let client: Constellation;

  before(async () => {
    ({ fOublier: fOublierClients, clients } =
      await utilsTestConstellation.créerConstellationsTest({
        n: 1,
        créerConstellation,
      }));
    [client] = clients;
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Initialiser profil", function () {
    let fOublier: schémaFonctionOublier;

    it("Pas initialisé pour commencer", async () => {
      const initialisé = await obtenir(({siDéfini}) => client.profil.suivreInitialisé({
        f: siDéfini(),
      }));
      expect(initialisé).to.be.false();
    });

    it("Initialiser", async () => {
      await client.profil.initialiser();
      const initialisé = await obtenir(({si}) => client.profil.suivreInitialisé({
        f: si(x=>x !== false),
      }));
      expect(initialisé).to.be.true();
    });

    after(async () => {
      if (fOublier) await fOublier();
    });
  });

  describe("Courriels", function () {
    let fOublier: schémaFonctionOublier;

    const COURRIEL = "தொடர்பு@லஸ்ஸி.இந்தியா";

    it("Pas de courriel pour commencer", async () => {
      const courriel = await await obtenir(({siDéfini}) => client.profil.suivreCourriel({
        f: siDéfini(),
      }));
      expect(courriel).to.be.null();
    });

    it("Ajouter un courriel", async () => {
      await client.profil.sauvegarderCourriel({ courriel: COURRIEL });
      const courriel = await obtenir(({siPasNul}) => client.profil.suivreInitialisé({
        f: siPasNul(),
      }));
      expect(courriel).to.equal(COURRIEL);
    });

    it("Effacer le courriel", async () => {
      await client.profil.effacerCourriel();
      const courriel = await obtenir(({siNul}) => client.profil.suivreInitialisé({
        f: siNul(),
      }));
      expect(courriel).to.be.null();
    });

    after(async () => {
      if (fOublier) await fOublier();
    });
  });
// nom
  describe("Noms", function () {
    it("Pas de noms pour commencer", async () => {
      const noms = await obtenir<TraducsNom>(({siDéfini})=>client.profil.suivreNoms({
        f: siDéfini(),
      }));
      expect(Object.keys(noms)).to.be.empty();
    });

    it("Ajouter un nom", async () => {
      await client.profil.sauvegarderNom({
        langue: "fr",
        nom: "Julien Malard-Adam",
      });
      const noms = await obtenir<TraducsNom>(({siPasVide})=>client.profil.suivreNoms({
        f: siPasVide(),
      }));
      expect(noms.fr).to.equal("Julien Malard-Adam");

      await client.profil.sauvegarderNom({
        langue: "த",
        nom: "ஜூலீஎன்",
      });
      const nomsMaintenant = await obtenir<TraducsNom>(({siPasVide})=>client.profil.suivreNoms({
        f: siPasVide(),
      }));
      expect(nomsMaintenant.த).to.equal("ஜூலீஎன்");
    });

    it("Changer un nom", async () => {
      await client.profil.sauvegarderNom({
        langue: "த",
        nom: "ம.-ஆதான் ஜூலீஎன்",
      });
      const noms = await obtenir<TraducsNom>(({si})=>client.profil.suivreNoms({
        f: si((x) => x.த !== "ஜூலீஎன்"),
      }));
      expect(noms.த).to.equal("ம.-ஆதான் ஜூலீஎன்");
    });

    it("Effacer un nom", async () => {
      await client.profil.effacerNom({ langue: "fr" });
      const noms = await obtenir<TraducsNom>(({si})=>client.profil.suivreNoms({
        f: si((x) => Object.keys(x).length <= 1),
      }));
      expect(noms).to.deep.equal({ த: "ம.-ஆதான் ஜூலீஎன்" });
    });
  });
// bio
describe("Bios", function () {

  it("Pas de bios pour commencer", async () => {
    const bios = await obtenir<TraducsNom>(({siDéfini})=>client.profil.suivreBios({
      f: siDéfini(),
    }));
    expect(Object.keys(bios)).to.be.empty();
  });
  

  it("Ajouter une bio", async () => {
    await client.profil.sauvegarderBio({
      langue: "fr",
      bio: "Julien Malard-Adam",
    });
    const bios = await obtenir<TraducsNom>(({siPasVide})=>client.profil.suivreBios({
      f: siPasVide(),
    }));
    expect(bios.fr).to.equal("Julien Malard-Adam");

    await client.profil.sauvegarderBio({
      langue: "मै",
      bio: "अहाँ सिखैत रहू।",  
    });
    const bios2 = await obtenir<TraducsNom>(({si})=>client.profil.suivreBios({
      f: si((x) => Object.keys(x).length > 1),
    }));
    expect(bios2.मैथिली).to.equal("अहाँ सिखैत रहू।");
  });

  it("Changer une bio", async () => {
    await client.profil.sauvegarderBio({
      langue: "मै",
      bio: "अहाँ सिखैत रहू।",
    });
    const bios = await obtenir<TraducsNom>(({si})=>client.profil.suivreBios({
      f: si((x) => x.मै !== "अहाँ सिखैत रहू।"),
    }));
    expect(bios.मैथिली).to.equal("अहाँ सिखैत रहू।");
  });

  it("Effacer une bio", async () => {
    await client.profil.effacerBio({ langue: "fr" });
    const bios = await obtenir<TraducsNom>(({si})=>client.profil.suivreBios({
      f: si((x) => Object.keys(x).length <= 1),
    }));
    expect(bios).to.deep.equal({ मैथिली: "अहाँ सिखैत रहू।" });
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
      const image = await obtenir(({siDéfini})=>client.profil.suivreImage({
        f: siDéfini(),
      }));
      expect(image).to.be.null();
    });

    it("Ajouter une image", async () => {
      await client.profil.sauvegarderImage({
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });
      const image = await obtenir<{
        image: Uint8Array;
        idImage: string;
    } | null>(({siPasNul})=>client.profil.suivreImage({
        f: siPasNul(),
      }));
      expect(image?.image).to.deep.equal(new Uint8Array(IMAGE));
    });

    it("Effacer l'image", async () => {
      await client.profil.effacerImage();
      const image = await obtenir(({siNul})=>client.profil.suivreImage({
        f: siNul(),
      }));
      expect(image).to.be.null();
    });

    it("Ajouter une image trop grande", async () => {
      expect(
        client.profil.sauvegarderImage({
          image: {
            contenu: new Uint8Array(MAX_TAILLE_IMAGE + 1),
            nomFichier: "moi.png",
          },
        }),
      ).to.be.rejected();
    });
  });
});
