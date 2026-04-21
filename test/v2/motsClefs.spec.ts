import { expect } from "aegir/chai";
import { TOUS_DISPOSITIFS } from "@/v2/nébuleuse/services/favoris.js";
import {
  MEMBRE,
  MODÉRATRICE,
} from "@/v2/nébuleuse/services/compte/accès/index.js";
import { créerConstellationsTest, obtenir } from "./utils.js";
import type { ÉpingleFavorisAvecId } from "@/v2/nébuleuse/services/favoris.js";
import type { ÉpingleMotClef } from "@/v2/motsClefs.js";
import type { Constellation } from "@/v2/index.js";
import type {
  InfoAuteur,
  PartielRécursif,
  StatutDonnées,
  TraducsTexte,
} from "@/v2/types.js";

describe("Mots-clefs", function () {
  let fermer: () => Promise<void>;
  let constls: Constellation[];
  let constl: Constellation;

  let idsComptes: string[];

  before("préparer constls", async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 2,
    }));
    constl = constls[0];
    idsComptes = await Promise.all(constls.map((c) => c.compte.obtIdCompte()));
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("création mots-clefs", function () {
    let idMotClef: string;

    it("pas de mots-clefs pour commencer", async () => {
      const motsClefs = await obtenir(({ siDéfini }) =>
        constl.motsClefs.suivreMotsClefs({
          f: siDéfini(),
        }),
      );
      expect(motsClefs).to.be.an.empty("array");
    });

    it("création", async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
      expect(
        await constl.motsClefs.identifiantValide({ identifiant: idMotClef }),
      ).to.be.true();
    });

    it("accès", async () => {
      const permission = await obtenir(({ siDéfini }) =>
        constl.motsClefs.suivrePermission({
          idObjet: idMotClef,
          f: siDéfini(),
        }),
      );
      expect(permission).to.equal(MODÉRATRICE);
    });

    it("automatiquement ajouté à mes mots-clefs", async () => {
      const mesMotsClefs = await obtenir<string[]>(({ siPasVide }) =>
        constl.motsClefs.suivreMotsClefs({
          f: siPasVide(),
        }),
      );
      expect(mesMotsClefs).to.be.an("array").and.to.contain(idMotClef);
    });

    it("détecté sur un autre compte", async () => {
      const sesMotsClefs = await obtenir<string[]>(({ siPasVide }) =>
        constls[1].motsClefs.suivreMotsClefs({
          f: siPasVide(),
          idCompte: idsComptes[0],
        }),
      );
      expect(sesMotsClefs).have.members([idMotClef]);
    });

    it("enlever de mes mots-clefs", async () => {
      await constl.motsClefs.enleverDeMesMotsClefs({ idMotClef });
      const mesMotsClefs = await obtenir<string[] | undefined>(({ siVide }) =>
        constl.motsClefs.suivreMotsClefs({
          f: siVide(),
        }),
      );
      expect(mesMotsClefs).to.be.an.empty("array");
    });

    it("ajouter manuellement à mes mots-clefs", async () => {
      await constl.motsClefs.ajouterÀMesMotsClefs({ idMotClef });
      const mesMotsClefs = await obtenir<string[]>(({ siPasVide }) =>
        constl.motsClefs.suivreMotsClefs({
          f: siPasVide(),
        }),
      );
      expect(mesMotsClefs).to.have.members([idMotClef]);
    });

    it("effacer mot-clef", async () => {
      const pÉpinglés = obtenir<ÉpingleFavorisAvecId[]>(({ si }) =>
        constl.favoris.suivreFavoris({
          f: si((x) => !!x && !x.find((fav) => fav.idObjet === idMotClef)),
        }),
      );

      await constl.motsClefs.effacerMotClef({ idMotClef });
      const mesMotsClefs = await obtenir<string[] | undefined>(({ siVide }) =>
        constl.motsClefs.suivreMotsClefs({
          f: siVide(),
        }),
      );
      expect(mesMotsClefs).to.be.empty();

      const épinglés = await pÉpinglés;
      expect(épinglés.map((é) => é.idObjet)).to.not.include(idMotClef);
    });
  });

  describe("noms", function () {
    let idMotClef: string;

    before(async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
    });

    it("pas de noms pour commencer", async () => {
      const noms = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.motsClefs.suivreNoms({
          idMotClef,
          f: siDéfini(),
        }),
      );
      expect(Object.keys(noms).length).to.equal(0);
    });

    it("ajouter un nom", async () => {
      await constl.motsClefs.sauvegarderNom({
        idMotClef,
        langue: "fr",
        nom: "Hydrologie",
      });
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.motsClefs.suivreNoms({
          idMotClef,
          f: siPasVide(),
        }),
      );
      expect(noms.fr).to.equal("Hydrologie");
    });

    it("ajouter des noms", async () => {
      await constl.motsClefs.sauvegarderNoms({
        idMotClef,
        noms: {
          த: "நீரியல்",
          हिं: "जल विज्ञान",
        },
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.motsClefs.suivreNoms({
          idMotClef,
          f: si((x) => !!x && Object.keys(x).length >= 3),
        }),
      );

      expect(noms).to.deep.equal({
        த: "நீரியல்",
        हिं: "जल विज्ञान",
        fr: "Hydrologie",
      });
    });

    it("changer un nom", async () => {
      await constl.motsClefs.sauvegarderNom({
        idMotClef,
        langue: "fr",
        nom: "hydrologie",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.motsClefs.suivreNoms({
          idMotClef,
          f: si((x) => x?.["fr"] === "hydrologie"),
        }),
      );

      expect(noms.fr).to.equal("hydrologie");
    });

    it("effacer un nom", async () => {
      await constl.motsClefs.effacerNom({
        idMotClef,
        langue: "fr",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.motsClefs.suivreNoms({
          idMotClef,
          f: si((x) => !!x && !Object.keys(x).includes("fr")),
        }),
      );

      expect(noms).to.deep.equal({
        த: "நீரியல்",
        हिं: "जल विज्ञान",
      });
    });
  });

  describe("descriptions", function () {
    let idMotClef: string;

    before(async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
    });

    it("pas de descriptions pour commencer", async () => {
      const descriptions = await obtenir<TraducsTexte>(({ siDéfini }) =>
        constl.motsClefs.suivreDescriptions({
          idMotClef,
          f: siDéfini(),
        }),
      );
      expect(Object.keys(descriptions).length).to.equal(0);
    });

    it("ajouter une description", async () => {
      await constl.motsClefs.sauvegarderDescription({
        idMotClef,
        langue: "fr",
        description: "Données liées au domaine de l'hydrologie",
      });
      const descriptions = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.motsClefs.suivreDescriptions({
          idMotClef,
          f: siPasVide(),
        }),
      );
      expect(descriptions.fr).to.equal(
        "Données liées au domaine de l'hydrologie",
      );
    });

    it("ajouter des descriptions", async () => {
      await constl.motsClefs.sauvegarderDescriptions({
        idMotClef,
        descriptions: {
          த: "நீரியல் சம்பந்தமான தரவுகளுக்காக",
          हिं: "जल विज्ञान से संबंधित आँकड़ों के लिये",
        },
      });
      const descriptions = await obtenir<TraducsTexte>(({ si }) =>
        constl.motsClefs.suivreDescriptions({
          idMotClef,
          f: si((x) => !!x && Object.keys(x).length >= 3),
        }),
      );

      expect(descriptions).to.deep.equal({
        த: "நீரியல் சம்பந்தமான தரவுகளுக்காக",
        हिं: "जल विज्ञान से संबंधित आँकड़ों के लिये",
        fr: "Données liées au domaine de l'hydrologie",
      });
    });

    it("changer une description", async () => {
      await constl.motsClefs.sauvegarderDescription({
        idMotClef,
        langue: "fr",
        description: "Données liées à l'hydrologie",
      });
      const descriptions = await obtenir<TraducsTexte>(({ si }) =>
        constl.motsClefs.suivreDescriptions({
          idMotClef,
          f: si((x) => !x?.fr?.includes("domaine")),
        }),
      );

      expect(descriptions.fr).to.equal("Données liées à l'hydrologie");
    });

    it("effacer une description", async () => {
      await constl.motsClefs.effacerDescription({
        idMotClef,
        langue: "fr",
      });
      const descriptions = await obtenir<TraducsTexte>(({ si }) =>
        constl.motsClefs.suivreDescriptions({
          idMotClef,
          f: si((x) => !!x && !Object.keys(x).includes("fr")),
        }),
      );

      expect(descriptions).to.deep.equal({
        த: "நீரியல் சம்பந்தமான தரவுகளுக்காக",
        हिं: "जल विज्ञान से संबंधित आँकड़ों के लिये",
      });
    });
  });

  describe("copier", function () {
    let idMotClef: string;
    let idMotClefCopie: string;

    before(async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
      await constl.motsClefs.sauvegarderNoms({
        idMotClef,
        noms: {
          த: "நீரியல்",
          हिं: "जल विज्ञान",
        },
      });

      await constl.motsClefs.sauvegarderDescriptions({
        idMotClef,
        descriptions: {
          த: "நீரியலுக்காக ஒரு சிறப்பு சொலு",
          हिं: "जल विज्ञान के आँकड़ों के लिये",
        },
      });

      idMotClefCopie = await constl.motsClefs.copierMotClef({
        idMotClef,
      });
    });

    it("le mot-clef est copié", async () => {
      expect(typeof idMotClefCopie).to.equal("string");
    });

    it("le mot-clef est ajouté à mes mots-clefs", async () => {
      const motsClefs = await obtenir<string[]>(({ si }) =>
        constl.motsClefs.suivreMotsClefs({
          f: si((x) => !!x?.includes(idMotClefCopie)),
        }),
      );
      expect(motsClefs).to.include.members([idMotClef, idMotClefCopie]);
    });

    it("les noms sont copiés", async () => {
      const noms = await obtenir(({ siPasVide }) =>
        constl.motsClefs.suivreNoms({ idMotClef, f: siPasVide() }),
      );
      expect(noms).to.deep.equal({ த: "நீரியல்", हिं: "जल विज्ञान" });
    });

    it("les descriptions sont copiées", async () => {
      const descriptions = await obtenir(({ siPasVide }) =>
        constl.motsClefs.suivreDescriptions({
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

  describe("statut", function () {
    let idMotClef: string;

    it("statut actif par défaut", async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
      const statut = await obtenir(({ siDéfini }) =>
        constl.motsClefs.suivreStatut({
          idMotClef,
          f: siDéfini(),
        }),
      );

      const réf: StatutDonnées = {
        statut: "active",
      };
      expect(statut).to.deep.equal(réf);
    });

    it("changer statut", async () => {
      const nouveauStatut: StatutDonnées = {
        statut: "obsolète",
        // Pour une vraie application, utiliser un identifiant valide, bien entendu.
        idNouvelle: "/constl/motClef/orbitdb/unAutreMotClef",
      };
      await constl.motsClefs.sauvegarderStatut({
        idMotClef,
        statut: nouveauStatut,
      });

      const statut = await obtenir<PartielRécursif<StatutDonnées> | undefined>(
        ({ si }) =>
          constl.motsClefs.suivreStatut({
            idMotClef,
            f: si((x) => x?.statut !== "active"),
          }),
      );

      expect(statut).to.deep.equal(nouveauStatut);
    });
  });

  describe("épingler", function () {
    let idMotClef: string;

    before(async () => {
      idMotClef = await constl.motsClefs.créerMotClef();
    });

    it("épinglée par défaut", async () => {
      const épingle = await obtenir<ÉpingleMotClef>(({ siDéfini }) =>
        constl.motsClefs.suivreÉpingle({ idMotClef, f: siDéfini() }),
      );

      const réf: ÉpingleMotClef = {
        type: "mot-clef",
        épingle: {
          base: TOUS_DISPOSITIFS,
        },
      };
      expect(épingle).to.deep.equal(réf);
    });

    it("désépingler", async () => {
      await constl.motsClefs.désépingler({ idMotClef });

      const épingle = await obtenir(({ siNonDéfini }) =>
        constl.motsClefs.suivreÉpingle({
          idMotClef,
          f: siNonDéfini(),
        }),
      );
      expect(épingle).to.be.undefined();
    });

    it("épingler", async () => {
      const idMotClef = await constl.motsClefs.créerMotClef({
        épingler: false,
      });
      await constl.motsClefs.épingler({ idMotClef });

      const épingle = await obtenir<ÉpingleMotClef>(({ siDéfini }) =>
        constl.motsClefs.suivreÉpingle({ idMotClef, f: siDéfini() }),
      );

      const réf: ÉpingleMotClef = {
        type: "mot-clef",
        épingle: { base: TOUS_DISPOSITIFS },
      };
      expect(épingle).to.deep.equal(réf);
    });

    it("résoudre épingle", async () => {
      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.motsClefs.suivreRésolutionÉpingle({
          épingle: {
            idObjet: "n'importe",
            épingle: {
              type: "mot-clef",
              épingle: {
                base: true,
              },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolution]).to.have.members(["n'importe"]);
    });
  });

  describe("auteurs", function () {
    let idMotClef: string;

    const accepté = (idCompte: string) => (auteurs?: InfoAuteur[]) =>
      !!auteurs?.find((a) => a.idCompte === idCompte && a.accepté);
    let compte1Accepté: (auteurs?: InfoAuteur[]) => boolean;
    let compte2Accepté: (auteurs?: InfoAuteur[]) => boolean;

    before(async () => {
      idMotClef = await constl.motsClefs.créerMotClef();

      compte1Accepté = accepté(idsComptes[0]);
      compte2Accepté = accepté(idsComptes[1]);
    });

    it("compte créateur autorisé pour commencer", async () => {
      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.motsClefs.suivreAuteurs({
          idMotClef,
          f: si(compte1Accepté),
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

    it("confirmer permission", async () => {
      await constl.motsClefs.confirmerPermission({ idMotClef });
    });

    it("confirmer permission - compte non autorisé", async () => {
      await expect(
        constls[1].motsClefs.confirmerPermission({ idMotClef }),
      ).to.eventually.be.rejectedWith("Permission de modification refusée");
    });

    it("inviter compte", async () => {
      await constl.motsClefs.inviterAuteur({
        idMotClef,
        idCompte: idsComptes[1],
        rôle: MEMBRE,
      });
      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.motsClefs.suivreAuteurs({
          idMotClef,
          f: si((x) => !!x && x.length > 1 && compte1Accepté(x)),
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
      await constls[1].motsClefs.ajouterÀMesMotsClefs({ idMotClef });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.motsClefs.suivreAuteurs({
          idMotClef,
          f: si((x) => compte1Accepté(x) && compte2Accepté(x)),
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

    it("modification par le nouvel auteur", async () => {
      await obtenir(({ siDéfini }) =>
        constls[1].motsClefs.suivrePermission({
          idObjet: idMotClef,
          f: siDéfini(),
        }),
      );

      // Modification du mot-clef
      await constls[1].motsClefs.sauvegarderNom({
        idMotClef,
        langue: "fr",
        nom: "Pédologie",
      });
      const noms = await obtenir(({ siPasVide }) =>
        constls[0].motsClefs.suivreNoms({ idMotClef, f: siPasVide() }),
      );
      expect(noms).to.deep.equal({ fr: "Pédologie" });
    });

    it("promotion à modératrice", async () => {
      await constl.motsClefs.inviterAuteur({
        idMotClef,
        idCompte: idsComptes[1],
        rôle: MODÉRATRICE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.motsClefs.suivreAuteurs({
          idMotClef,
          f: si(
            (x) =>
              x?.find((a) => a.idCompte === idsComptes[1])?.rôle ===
                MODÉRATRICE &&
              compte1Accepté(x) &&
              compte2Accepté(x),
          ),
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
          rôle: MODÉRATRICE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });

    it("inviter compte hors ligne", async () => {
      const compteHorsLigne =
        "/nébuleuse/compte/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX";
      await constl.motsClefs.inviterAuteur({
        idMotClef,
        idCompte: compteHorsLigne,
        rôle: MEMBRE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.motsClefs.suivreAuteurs({
          idMotClef,
          f: si(
            (x) =>
              !!x?.find((a) => a.idCompte === compteHorsLigne) &&
              compte1Accepté(x) &&
              compte2Accepté(x),
          ),
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
          rôle: MODÉRATRICE,
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
