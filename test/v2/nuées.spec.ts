import { expect } from "aegir/chai";
import { MEMBRE, MODÉRATRICE } from "@/v2/crabe/services/compte/accès/index.js";
import { obtenir, créerConstellationsTest } from "./utils.js";
import type { InfoAuteur, Métadonnées, TraducsTexte } from "@/v2/types.js";
import type { Constellation } from "@/v2/index.js";
import type { Oublier } from "@/v2/crabe/types.js";
import { obtRessourceTest } from "test/ressources/index.js";

describe("Nuées", function () {
  let fermer: Oublier;
  let constls: Constellation[];
  let constl: Constellation;

  let idsComptes: string[];

  before(async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 2,
    }));
    constl = constls[0];
    idsComptes = await Promise.all(constls.map((c) => c.compte.obtIdCompte()));
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("noms", function () {
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("pas de noms pour commencer", async () => {
      const noms = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.nuées.suivreNoms({ idNuée, f: siDéfini() }),
      );
      expect(Object.keys(noms).length).to.equal(0);
    });

    it("ajouter un nom", async () => {
      await constl.nuées.sauvegarderNom({
        idNuée,
        langue: "fr",
        nom: "Alphabets",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreNoms({
          idNuée,
          f: si((n) => !!n && Object.keys(n).length > 0),
        }),
      );
      expect(noms.fr).to.equal("Alphabets");
    });

    it("ajouter des noms", async () => {
      await constl.nuées.sauvegarderNoms({
        idNuée,
        noms: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreNoms({
          idNuée,
          f: si((n) => !!n && Object.keys(n).length > 2),
        }),
      );
      expect(noms).to.deep.equal({
        fr: "Alphabets",
        த: "எழுத்துகள்",
        हिं: "वर्णमाला",
      });
    });

    it("changer un nom", async () => {
      await constl.nuées.sauvegarderNom({
        idNuée,
        langue: "fr",
        nom: "Systèmes d'écriture",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreNoms({
          idNuée,
          f: si((n) => n?.["fr"] !== "Alphabets"),
        }),
      );

      expect(noms?.fr).to.equal("Systèmes d'écriture");
    });

    it("effacer un nom", async () => {
      await constl.nuées.effacerNom({ idNuée, langue: "fr" });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreNoms({ idNuée, f: si((n) => !!n && !n["fr"]) }),
      );
      expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  })

  describe("descriptions", function () {
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("aucune description pour commencer", async () => {
      const descrs = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.nuées.suivreDescriptions({ idNuée, f: siDéfini() }),
      );
      expect(Object.keys(descrs).length).to.equal(0);
    });

    it("ajouter une description", async () => {
      await constl.nuées.sauvegarderDescription({
        idNuée,
        langue: "fr",
        description: "Alphabets",
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreDescriptions({ idNuée, f: si((x) => !!x?.["fr"]) }),
      );
      expect(descrs.fr).to.equal("Alphabets");
    });

    it("ajouter des descriptions", async () => {
      await constl.nuées.sauvegarderDescriptions({
        idNuée,
        descriptions: {
          த: "எழுத்துகள்",
          हिं: "वर्णमाला",
        },
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreDescriptions({
          idNuée,
          f: si((x) => !!x && Object.keys(x).length > 2),
        }),
      );
      expect(descrs).to.deep.equal({
        fr: "Alphabets",
        த: "எழுத்துகள்",
        हिं: "वर्णमाला",
      });
    });

    it("changer une description", async () => {
      await constl.nuées.sauvegarderDescription({
        idNuée,
        langue: "fr",
        description: "Systèmes d'écriture",
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreDescriptions({
          idNuée,
          f: si((x) => x?.["fr"] !== "Alphabets"),
        }),
      );
      expect(descrs?.fr).to.equal("Systèmes d'écriture");
    });

    it("effacer une description", async () => {
      await constl.nuées.effacerDescription({ idNuée, langue: "fr" });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreDescriptions({ idNuée, f: si((x) => !!x && !x["fr"]) }),
      );
      expect(descrs).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  })

  describe("métadonnées", function () {
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("pas de métadonnées pour commencer", async () => {
      const métadonnées = await obtenir<Métadonnées>(({ siDéfini }) =>
        constl.nuées.suivreMétadonnées({ idNuée, f: siDéfini() }),
      );
      expect(Object.keys(métadonnées).length).to.equal(0);
    });

    it("ajouter une métadonnée", async () => {
      await constl.nuées.sauvegarderMétadonnée({
        idNuée,
        clef: "clef1",
        valeur: true,
      });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.nuées.suivreMétadonnées({
          idNuée,
          f: si((n) => !!n && Object.keys(n).length > 0),
        }),
      );
      expect(métadonnées.clef1).to.be.true();
    });

    it("ajouter des métadonnées", async () => {
      await constl.nuées.sauvegarderMétadonnées({
        idNuée,
        métadonnées: {
          clef2: 123,
          clef3: "du texte",
        },
      });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.nuées.suivreMétadonnées({
          idNuée,
          f: si((n) => !!n && Object.keys(n).length > 2),
        }),
      );
      expect(métadonnées).to.deep.equal({
        clef1: true,
        clef2: 123,
        clef3: "du texte",
      });
    });

    it("changer un métadonnée", async () => {
      await constl.nuées.sauvegarderMétadonnée({
        idNuée,
        clef: "clef1",
        valeur: false,
      });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.nuées.suivreMétadonnées({
          idNuée,
          f: si((n) => n?.["clef1"] !== true),
        }),
      );

      expect(métadonnées?.clef1).to.be.false();
    });

    it("effacer une métadonnée", async () => {
      await constl.nuées.effacerMétadonnée({ idNuée, clef: "clef1" });
      const métadonnées = await obtenir<Métadonnées>(({ si }) =>
        constl.nuées.suivreMétadonnées({
          idNuée,
          f: si((n) => !!n && !n["clef1"]),
        }),
      );
      expect(métadonnées).to.deep.equal({ clef2: 123, clef3: "du texte" });
    });
  });

  describe("mots-clefs", function () {
    let idMotClef: string;
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("pas de mots-clefs pour commencer", async () => {
      const motsClefs = await obtenir<string[]>(({ siDéfini }) =>
        constl.nuées.suivreMotsClefs({
          idNuée,
          f: siDéfini(),
        }),
      );
      expect(motsClefs).to.be.an.empty("array");
    });

    it("ajout d'un mot-clef", async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
      await constl.nuées.ajouterMotsClefs({
        idNuée,
        idsMotsClefs: idMotClef,
      });

      const motsClefs = await obtenir<string[]>(({ siPasVide }) =>
        constl.nuées.suivreMotsClefs({ idNuée, f: siPasVide() }),
      );
      expect(Array.isArray(motsClefs)).to.be.true();
      expect(motsClefs.length).to.equal(1);
    });

    it("effacer un mot-clef", async () => {
      await constl.nuées.effacerMotClef({ idNuée, idMotClef });

      const motsClefs = await obtenir<string[]>(({ siVide }) =>
        constl.nuées.suivreMotsClefs({
          idNuée,
          f: siVide(),
        }),
      );
      expect(motsClefs).to.be.an.empty("array");
    });
  });

  describe("image", function () {
    let IMAGE: Uint8Array;
    let idNuée: string;

    before(async () => {
      IMAGE = await obtRessourceTest({
        nomFichier: "logo.svg",
      });

      idNuée = await constl.nuées.créerNuée();
    });

    it("aucune image pour commencer", async () => {
      const image = await obtenir(({ siNul }) =>
        constl.nuées.suivreImage({ idNuée, f: siNul() }),
      );
      expect(image).to.be.null();
    });

    it("ajouter image", async () => {
      const idImage = await constl.nuées.sauvegarderImage({
        idNuée,
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });
      expect(idImage).to.endWith("logo.svg");

      const image = await obtenir<{
        image: Uint8Array;
        idImage: string;
      } | null>(({ siPasNul }) =>
        constl.nuées.suivreImage({ idNuée, f: siPasNul() }),
      );

      const réf = { idImage, image: IMAGE };
      expect(image).to.deep.equal(réf);
    });

    it("effacer image", async () => {
      await constl.nuées.effacerImage({ idNuée });
      const image = await obtenir(({ siNul }) =>
        constl.nuées.suivreImage({ idNuée, f: siNul() }),
      );
      expect(image).to.be.null();
    });
  });


  describe("autorisations", function () {
    it("nuée ouverte - tous peuvent écrire");
    it("nuée ouverte - bloquer compte");
    it("nuée ouverte - débloquer compte");
    it("nuée par invitation - compte créateur peut écrire");
    it("nuée par invitation - compte membre peut écrire");
    it("nuée par invitation - les autres ne peuvent pas écrire");
    it("nuée par invitation - inviter compte");
    it("nuée par invitation - désinviter compte");

    it("convertir à ouverte");
    it("reconvertir à par invitation - invités persistent");

    it("convertir à par invitation");
    it("reconvertir à ouverte - bloqués persistent");

    it("erreur nuée ouverte - bloquer compte créateur nuée");
    it("erreur nuée ouverte - bloquer compte créateur nuée");
    it("erreur nuée par invitation - désinviter compte membre nuée");
    it("erreur nuée par invitation - désinviter compte membre nuée");
  });

  describe("auteurs", function () {
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("compte créateur autorisé pour commencer", async () => {
      const auteurs = await obtenir<InfoAuteur[]>(({ siPasVide }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
          f: siPasVide(),
        }),
      );
      const réf: InfoAuteur[] = [
        {
          idCompte: idsComptes[0],
          accepté: true,
          rôle: MODÉRATRICE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });

    it("inviter compte", async () => {
      await constl.nuées.inviterAuteur({
        idNuée,
        idCompte: idsComptes[1],
        rôle: MEMBRE,
      });
      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
          f: si((x) => !!x && x.length > 1),
        }),
      );
      const réf: InfoAuteur[] = [
        {
          idCompte: idsComptes[0],
          accepté: true,
          rôle: MODÉRATRICE,
        },
        {
          idCompte: idsComptes[1],
          accepté: false,
          rôle: MEMBRE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });

    it("acceptation invitation", async () => {
      await constls[1].nuées.ajouterÀMesNuées({ idNuée });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
          f: si((x) => !!x?.find((a) => a.idCompte === idsComptes[1])?.accepté),
        }),
      );
      const réf: InfoAuteur[] = [
        {
          idCompte: idsComptes[0],
          accepté: true,
          rôle: MODÉRATRICE,
        },
        {
          idCompte: idsComptes[1],
          accepté: true,
          rôle: MEMBRE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });

    it("inviter compte hors ligne", async () => {
      const compteHorsLigne =
        "/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX";
      await constl.nuées.inviterAuteur({
        idNuée,
        idCompte: compteHorsLigne,
        rôle: MEMBRE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
          f: si((x) => !!x?.find((a) => a.idCompte === compteHorsLigne)),
        }),
      );
      const réf: InfoAuteur[] = [
        {
          idCompte: idsComptes[0],
          accepté: true,
          rôle: MODÉRATRICE,
        },
        {
          idCompte: idsComptes[1],
          accepté: true,
          rôle: MEMBRE,
        },
        {
          idCompte: compteHorsLigne,
          accepté: false,
          rôle: MEMBRE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });
  });
});
