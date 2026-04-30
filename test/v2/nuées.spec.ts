import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { expect } from "aegir/chai";
import JSZip from "jszip";
import { dossierTempo } from "@constl/utils-tests";
import { isBrowser, isElectronRenderer } from "wherearewe";
import {
  MEMBRE,
  MODÉRATRICE,
} from "@/v2/nébuleuse/services/compte/accès/index.js";
import {
  DISPOSITIFS_INSTALLÉS,
  TOUS_DISPOSITIFS,
} from "@/v2/nébuleuse/services/favoris.js";
import { stabiliser } from "@/v2/nébuleuse/utils.js";
import {
  enleverPréfixes,
  enleverPréfixesEtOrbite,
  moyenne,
  type DonnéesFichierBdExportées,
} from "@/v2/utils.js";
import {
  CONFIANCE_INVITÉ,
  PÉNALITÉ_CONFIANCE_BLOQUÉ,
} from "@/v2/nuées/nuées.js";
import { CONFIANCE_DE_COAUTEUR } from "@/v2/nébuleuse/services/consts.js";
import { obtRessourceTest } from "./ressources/index.js";
import { obtenir, créerConstellationsTest } from "./utils.js";
import type {
  AutorisationNuée,
  InfoTableauNuée,
  ScoreNuée,
  ValeurAscendance,
  ÉpingleNuée,
} from "@/v2/nuées/nuées.js";
import type { ÉpingleFavorisAvecId } from "@/v2/nébuleuse/services/favoris.js";
import type { ÉlémentDonnéesTableau } from "@/v2/bds/tableaux.js";
import type { DonnéesRangéeNuée } from "@/v2/nuées/tableaux.js";
import type { RègleBornes, RègleColonne } from "@/v2/règles.js";
import type {
  InfoAuteur,
  Métadonnées,
  StatutDonnées,
  TraducsTexte,
} from "@/v2/types.js";
import type { Constellation } from "@/v2/index.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type {
  DifférenceBds,
  DonnéesBdExportées,
  SchémaBd,
} from "@/v2/bds/bds.js";
import type { DonnéesRangéeTableau, InfoColonne } from "@/v2/tableaux.js";
import type { RelationImmédiate } from "@/v2/nébuleuse/services/réseau/réseau.js";

describe("Nuées", function () {
  let fermer: Oublier;
  let constls: Constellation[];
  let constl: Constellation;

  let idsComptes: string[];

  before(async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 3,
    }));
    constl = constls[0];
    idsComptes = await Promise.all(constls.map((c) => c.compte.obtIdCompte()));
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("création nuées", function () {
    let idNuée: string;

    it("pas de nuées pour commencer", async () => {
      const nuées = await obtenir(({ siDéfini }) =>
        constl.nuées.suivreNuées({
          f: siDéfini(),
        }),
      );
      expect(nuées).to.be.an.empty("array");
    });

    it("création", async () => {
      idNuée = await constl.nuées.créerNuée();
      expect(
        await constl.nuées.identifiantValide({ identifiant: idNuée }),
      ).to.be.true();
    });

    it("accès", async () => {
      const permission = await obtenir(({ siDéfini }) =>
        constl.nuées.suivrePermission({
          idObjet: idNuée,
          f: siDéfini(),
        }),
      );
      expect(permission).to.equal(MODÉRATRICE);
    });

    it("automatiquement ajoutée à mes nuées", async () => {
      const mesNuées = await obtenir<string[]>(({ siPasVide }) =>
        constl.nuées.suivreNuées({
          f: siPasVide(),
        }),
      );
      expect(mesNuées).to.be.an("array").and.to.contain(idNuée);
    });

    it("détectée sur un autre compte", async () => {
      const sesNuées = await obtenir<string[]>(({ siPasVide }) =>
        constls[1].nuées.suivreNuées({
          f: siPasVide(),
          idCompte: idsComptes[0],
        }),
      );
      expect(sesNuées).have.members([idNuée]);
    });

    it("enlever de mes nuées", async () => {
      await constl.nuées.enleverDeMesNuées({ idNuée });
      const mesNuées = await obtenir<string[] | undefined>(({ siVide }) =>
        constl.nuées.suivreNuées({
          f: siVide(),
        }),
      );
      expect(mesNuées).to.be.an.empty("array");
    });

    it("ajouter manuellement à mes nuées", async () => {
      await constl.nuées.ajouterÀMesNuées({ idNuée });
      const mesNuées = await obtenir<string[]>(({ siPasVide }) =>
        constl.nuées.suivreNuées({
          f: siPasVide(),
        }),
      );
      expect(mesNuées).to.have.members([idNuée]);
    });

    it("effacer nuée", async () => {
      const pÉpinglées = obtenir<ÉpingleFavorisAvecId[]>(({ si }) =>
        constl.favoris.suivreFavoris({
          f: si((x) => !!x && !x.find((fav) => fav.idObjet === idNuée)),
        }),
      );

      await constl.nuées.effacerNuée({ idNuée });
      const mesNuées = await obtenir<string[] | undefined>(({ siVide }) =>
        constl.nuées.suivreNuées({
          f: siVide(),
        }),
      );
      expect(mesNuées).to.be.empty();

      const épinglées = await pÉpinglées;
      expect(épinglées.map((é) => é.idObjet)).to.not.include(idNuée);
    });
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
        langue: "fra",
        nom: "Alphabets",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreNoms({
          idNuée,
          f: si((n) => !!n && Object.keys(n).length > 0),
        }),
      );
      expect(noms.fra).to.equal("Alphabets");
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
        fra: "Alphabets",
        த: "எழுத்துகள்",
        हिं: "वर्णमाला",
      });
    });

    it("changer un nom", async () => {
      await constl.nuées.sauvegarderNom({
        idNuée,
        langue: "fra",
        nom: "Systèmes d'écriture",
      });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreNoms({
          idNuée,
          f: si((n) => n?.["fra"] !== "Alphabets"),
        }),
      );

      expect(noms?.fra).to.equal("Systèmes d'écriture");
    });

    it("effacer un nom", async () => {
      await constl.nuées.effacerNom({ idNuée, langue: "fra" });
      const noms = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreNoms({ idNuée, f: si((n) => !!n && !n["fra"]) }),
      );
      expect(noms).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

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
        langue: "fra",
        description: "Alphabets",
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreDescriptions({ idNuée, f: si((x) => !!x?.["fra"]) }),
      );
      expect(descrs.fra).to.equal("Alphabets");
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
        fra: "Alphabets",
        த: "எழுத்துகள்",
        हिं: "वर्णमाला",
      });
    });

    it("changer une description", async () => {
      await constl.nuées.sauvegarderDescription({
        idNuée,
        langue: "fra",
        description: "Systèmes d'écriture",
      });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreDescriptions({
          idNuée,
          f: si((x) => x?.["fra"] !== "Alphabets"),
        }),
      );
      expect(descrs?.fra).to.equal("Systèmes d'écriture");
    });

    it("effacer une description", async () => {
      await constl.nuées.effacerDescription({ idNuée, langue: "fra" });

      const descrs = await obtenir<TraducsTexte>(({ si }) =>
        constl.nuées.suivreDescriptions({
          idNuée,
          f: si((x) => !!x && !x["fra"]),
        }),
      );
      expect(descrs).to.deep.equal({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
    });
  });

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
          f: si((n) => !!n && !Object.keys(n).includes("clef1")),
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
      const motsClefs = await obtenir<ValeurAscendance<string>[]>(
        ({ siDéfini }) =>
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

      const motsClefs = await obtenir<ValeurAscendance<string>[]>(
        ({ siPasVide }) =>
          constl.nuées.suivreMotsClefs({ idNuée, f: siPasVide() }),
      );

      const réf: ValeurAscendance<string>[] = [
        {
          val: idMotClef,
          source: idNuée,
        },
      ];
      expect(motsClefs).to.have.deep.members(réf);
    });

    it("effacer un mot-clef", async () => {
      await constl.nuées.effacerMotClef({ idNuée, idMotClef });

      const motsClefs = await obtenir<ValeurAscendance<string>[]>(
        ({ siVide }) =>
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

  describe("confiance", function () {
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée({ autorisation: "par invitation" });
    });

    it("compte invité", async () => {
      await constl.nuées.inviterCompte({ idNuée, idCompte: idsComptes[1] });

      const confiances = await obtenir<RelationImmédiate[]>(({ si }) =>
        constl.nuées.résolutionConfiance({
          de: idsComptes[0],
          f: si((x) => !!x && x.length > 0),
        }),
      );

      const réf: RelationImmédiate = {
        idCompte: idsComptes[1],
        confiance: CONFIANCE_INVITÉ,
      };
      expect(confiances).to.deep.equal([réf]);
    });

    it("compte bloqué", async () => {
      await constl.nuées.modifierTypeAutorisation({ idNuée, type: "ouverte" });
      await constl.nuées.bloquerCompte({ idNuée, idCompte: idsComptes[1] });

      const confiances = await obtenir<RelationImmédiate[]>(({ si }) =>
        constl.nuées.résolutionConfiance({
          de: idsComptes[0],
          f: si(
            (x) =>
              !!x?.find((a) => a.idCompte === idsComptes[1] && a.confiance < 0),
          ),
        }),
      );

      const réf: RelationImmédiate = {
        idCompte: idsComptes[1],
        confiance: -PÉNALITÉ_CONFIANCE_BLOQUÉ,
      };
      expect(confiances).to.deep.equal([réf]);
    });

    it("compte bloqué et invité", async () => {
      const idNuée2 = await constl.nuées.créerNuée({
        autorisation: "par invitation",
      });
      await constl.nuées.inviterCompte({
        idNuée: idNuée2,
        idCompte: idsComptes[1],
      });

      const confiances = await obtenir<RelationImmédiate[]>(({ si }) =>
        constl.nuées.résolutionConfiance({
          de: idsComptes[0],
          f: si(
            (x) =>
              !!x?.find(
                (a) => a.idCompte === idsComptes[1] && a.confiance === 0,
              ),
          ),
        }),
      );

      const réf: RelationImmédiate = {
        idCompte: idsComptes[1],
        confiance: 0,
      };
      expect(confiances).to.deep.equal([réf]);
    });

    it("de coauteurs", async () => {
      await constl.nuées.inviterAuteur({
        idNuée,
        idCompte: idsComptes[1],
        rôle: MEMBRE,
      });

      const relations = await obtenir<RelationImmédiate[]>(({ si }) =>
        constl.nuées.résolutionConfiance({
          de: idsComptes[0],
          f: si(
            (x) =>
              !!x?.find((a) => a.idCompte === idsComptes[1] && a.confiance > 0),
          ),
        }),
      );

      const réf: RelationImmédiate[] = [
        {
          idCompte: idsComptes[1],
          confiance: CONFIANCE_DE_COAUTEUR,
        },
      ];
      expect(relations).to.deep.equal(réf);
    });
  });

  describe("autorisations", function () {
    describe("nuée ouverte", function () {
      let idNuée: string;

      beforeEach(async () => {
        idNuée = await constl.nuées.créerNuée({ autorisation: "ouverte" });
      });

      it("le compte créateur peut contribuer", async () => {
        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });
        const autorisation = await obtenir<boolean>(({ siDéfini }) =>
          constl.nuées.suivreAutorisationBd({ idNuée, idBd, f: siDéfini() }),
        );

        expect(autorisation).to.be.true();
      });

      it("tous peuvent contribuer", async () => {
        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });

        const autorisation = await obtenir<boolean>(({ siDéfini }) =>
          constl.nuées.suivreAutorisationBd({ idNuée, idBd, f: siDéfini() }),
        );

        expect(autorisation).to.be.true();
      });

      it("bloquer compte", async () => {
        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });

        await constl.nuées.bloquerCompte({ idNuée, idCompte: idsComptes[1] });
        const autorisation = await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== true),
          }),
        );

        expect(autorisation).to.be.false();
      });

      it("débloquer compte", async () => {
        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });

        await constl.nuées.bloquerCompte({ idNuée, idCompte: idsComptes[1] });
        await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== true),
          }),
        );

        await constl.nuées.débloquerCompte({ idNuée, idCompte: idsComptes[1] });
        const autorisation = await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== false),
          }),
        );

        expect(autorisation).to.be.true();
      });

      it("convertir à par invitation", async () => {
        await constl.nuées.modifierTypeAutorisation({
          idNuée,
          type: "par invitation",
        });
        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });

        const autorisation = await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== true),
          }),
        );
        expect(autorisation).to.be.false();
      });

      it("reconvertir à ouverte - bloqués persistent", async () => {
        await constl.nuées.bloquerCompte({ idNuée, idCompte: idsComptes[1] });

        await constl.nuées.modifierTypeAutorisation({
          idNuée,
          type: "par invitation",
        });
        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });

        await constl.nuées.modifierTypeAutorisation({
          idNuée,
          type: "ouverte",
        });

        const autorisation = await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== true),
          }),
        );
        expect(autorisation).to.be.false();
      });

      it("bd bloquée si un seul auteur bloqué", async () => {
        await constl.nuées.bloquerCompte({ idNuée, idCompte: idsComptes[2] });

        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });
        await constls[1].bds.inviterAuteur({
          idBd,
          idCompte: idsComptes[2],
          rôle: MEMBRE,
        });

        await obtenir(({ siDéfini }) =>
          constl.bds.suivrePermission({
            idObjet: idBd,
            idCompte: idsComptes[2],
            f: siDéfini(),
          }),
        );

        // Bloquée même si invitation non acceptée
        const autorisation = await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== true),
          }),
        );
        expect(autorisation).to.be.false();
      });

      it("erreur - bloquer compte membre nuée", async () => {
        await expect(
          constl.nuées.bloquerCompte({ idNuée, idCompte: idsComptes[0] }),
        ).to.eventually.be.rejectedWith(
          "Impossible d'exclure un compte qui a des permissions d'édition de la nuée elle-même",
        );
      });

      it("erreur - désinviter compte", async () => {
        await expect(
          constl.nuées.désinviterCompte({ idNuée, idCompte: idsComptes[1] }),
        ).to.eventually.be.rejectedWith(
          "est à accès par invitation. Bloquez les comptes avec `constl.nuéesbloquerCompte({ idNuée, idCompte })`.",
        );
      });
    });

    describe("nuée par invitation", async () => {
      let idNuée: string;

      beforeEach(async () => {
        idNuée = await constl.nuées.créerNuée({
          autorisation: "par invitation",
        });
      });

      it("le compte créateur peut contribuer", async () => {
        const idBd = await constls[0].bds.créerBd({ licence: "ODbl-1_0" });

        const autorisation = await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== false),
          }),
        );
        expect(autorisation).to.be.true();
      });

      it("le grand public ne peut pas contribuer", async () => {
        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });

        const autorisation = await obtenir<boolean>(({ siDéfini }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd: idBd,
            f: siDéfini(),
          }),
        );
        expect(autorisation).to.be.false();
      });

      it("un compte membre peut écrire", async () => {
        await constl.nuées.inviterAuteur({
          idNuée,
          idCompte: idsComptes[1],
          rôle: MEMBRE,
        });
        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });
        const autorisation = await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== false),
          }),
        );
        expect(autorisation).to.be.true();
      });

      it("inviter compte", async () => {
        await constl.nuées.inviterCompte({ idNuée, idCompte: idsComptes[1] });

        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });

        const autorisation = await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== false),
          }),
        );
        expect(autorisation).to.be.true();
      });

      it("désinviter compte", async () => {
        await constl.nuées.inviterCompte({ idNuée, idCompte: idsComptes[1] });

        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });

        await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x === true),
          }),
        );

        await constl.nuées.désinviterCompte({
          idNuée,
          idCompte: idsComptes[1],
        });

        const autorisation = await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== true),
          }),
        );
        expect(autorisation).to.be.false();
      });

      it("convertir à ouverte", async () => {
        await constl.nuées.modifierTypeAutorisation({
          idNuée,
          type: "ouverte",
        });
        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });

        const autorisation = await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== false),
          }),
        );
        expect(autorisation).to.be.true();
      });

      it("reconvertir à par invitation - invités persistent", async () => {
        await constl.nuées.inviterCompte({ idNuée, idCompte: idsComptes[1] });

        await constl.nuées.modifierTypeAutorisation({
          idNuée,
          type: "ouverte",
        });
        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });

        await constl.nuées.modifierTypeAutorisation({
          idNuée,
          type: "par invitation",
        });

        const autorisation = await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== false),
          }),
        );
        expect(autorisation).to.be.true();
      });

      it("bd incluse si un seul auteur invité", async () => {
        await constl.nuées.inviterCompte({ idNuée, idCompte: idsComptes[2] });

        const idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });
        await constls[1].bds.inviterAuteur({
          idBd,
          idCompte: idsComptes[2],
          rôle: MEMBRE,
        });

        await obtenir(({ siDéfini }) =>
          constl.bds.suivrePermission({
            idObjet: idBd,
            idCompte: idsComptes[2],
            f: siDéfini(),
          }),
        );

        // Pas incluse si invitation pas encore acceptée
        const autorisationAvant = await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== true),
          }),
        );
        expect(autorisationAvant).to.be.false();

        // Incluse si invitation acceptée
        await constls[2].bds.ajouterÀMesBds({ idBd });

        const autorisationAprès = await obtenir<boolean>(({ si }) =>
          constl.nuées.suivreAutorisationBd({
            idNuée,
            idBd,
            f: si((x) => x !== undefined && x !== false),
          }),
        );
        expect(autorisationAprès).to.be.true();
      });

      it("erreur - désinviter compte membre nuée", async () => {
        await expect(
          constl.nuées.désinviterCompte({ idNuée, idCompte: idsComptes[0] }),
        ).to.eventually.be.rejectedWith(
          "Impossible d'exclure un compte qui a des permissions d'édition de la nuée elle-même",
        );
      });

      it("erreur - bloquer compte", async () => {
        await expect(
          constl.nuées.bloquerCompte({ idNuée, idCompte: idsComptes[1] }),
        ).to.eventually.be.rejectedWith(
          "est à accès par invitation. Désinvitez les comptes avec `constl.nuées.désinviterCompte({ idNuée, idCompte })`.",
        );
      });
    });
  });

  describe("tableaux", function () {
    let idTableau: string;
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("pas de tableaux pour commencer", async () => {
      const tableaux = await obtenir<InfoTableauNuée[]>(({ siDéfini }) =>
        constl.nuées.suivreTableaux({
          idNuée,
          f: siDéfini(),
        }),
      );
      expect(tableaux).to.be.an.empty("array");
    });

    it("ajout d'un tableau", async () => {
      idTableau = await constl.nuées.ajouterTableau({
        idNuée,
      });
      expect(typeof idTableau).to.equal("string");

      const tableaux = await obtenir<InfoTableauNuée[]>(({ siPasVide }) =>
        constl.nuées.suivreTableaux({
          idNuée,
          f: siPasVide(),
        }),
      );

      const réf: InfoTableauNuée[] = [{ id: idTableau, source: idNuée }];
      expect(tableaux).to.have.deep.members(réf);
    });

    it("suivre colonnes tableau", async () => {
      const idVariable = await constl.variables.créerVariable({
        catégorie: "vidéo",
      });
      const idColonne = await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuée,
        idTableau,
        idVariable,
      });
      const colonnes = await obtenir<InfoColonne[]>(({ siPasVide }) =>
        constl.nuées.tableaux.suivreColonnes({
          idStructure: idNuée,
          idTableau,
          f: siPasVide(),
        }),
      );
      const réf: InfoColonne[] = [
        {
          id: idColonne,
          variable: idVariable,
        },
      ];
      expect(colonnes).to.have.deep.members(réf);
    });

    it.skip("réordonner tableaux", async () => {
      throw new Error("pas encore possible");
    });

    it("effacer un tableau", async () => {
      await constl.nuées.effacerTableau({ idNuée, idTableau });

      const tableaux = await obtenir<InfoTableauNuée[]>(({ siVide }) =>
        constl.nuées.suivreTableaux({
          idNuée,
          f: siVide(),
        }),
      );
      expect(tableaux).to.be.an.empty("array");
    });
  });

  describe("variables", function () {
    let idTableau: string;
    let idVariable: string;
    let idColonne: string;
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("pas de variables pour commencer", async () => {
      const variables = await obtenir<string[]>(({ siDéfini }) =>
        constl.nuées.suivreVariables({
          idNuée,
          f: siDéfini(),
        }),
      );
      expect(variables).to.be.an.empty("array");
    });

    it("ajout d'un tableau et d'une variable", async () => {
      idTableau = await constl.nuées.ajouterTableau({ idNuée });
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      idColonne = await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuée,
        idTableau,
        idVariable,
      });

      const variables = await obtenir<string[]>(({ siPasVide }) =>
        constl.nuées.suivreVariables({
          idNuée,
          f: siPasVide(),
        }),
      );
      expect(Array.isArray(variables)).to.be.true();
      expect(variables.length).to.equal(1);
      expect(variables[0]).to.equal(idVariable);
    });

    it("effacer une variable", async () => {
      await constl.nuées.tableaux.effacerColonne({
        idStructure: idNuée,
        idTableau,
        idColonne,
      });
      const variables = await obtenir<string[]>(({ siVide }) =>
        constl.nuées.suivreVariables({
          idNuée,
          f: siVide(),
        }),
      );
      expect(variables).to.be.an.empty("array");
    });
  });

  describe("statut", function () {
    let idNuée: string;

    it("statut actif par défaut", async () => {
      idNuée = await constl.nuées.créerNuée();
      const statut = await obtenir(({ siDéfini }) =>
        constl.nuées.suivreStatut({
          idNuée,
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
        idNouvelle: "/const/nuée/orbitdb/uneAutreBaseDeDonnées",
      };
      await constl.nuées.sauvegarderStatut({
        idNuée,
        statut: nouveauStatut,
      });

      const statut = await obtenir<StatutDonnées | null>(({ si }) =>
        constl.nuées.suivreStatut({
          idNuée,
          f: si((x) => x?.statut !== "active"),
        }),
      );

      expect(statut).to.deep.equal(nouveauStatut);
    });
  });

  describe("épingles", function () {
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("épinglée par défaut", async () => {
      const épingle = await obtenir<ÉpingleNuée>(({ siDéfini }) =>
        constl.nuées.suivreÉpingle({ idNuée, f: siDéfini() }),
      );

      const réf: ÉpingleNuée = {
        type: "nuée",
        épingle: {
          base: TOUS_DISPOSITIFS,
          bds: {
            type: "bd",
            épingle: {
              base: TOUS_DISPOSITIFS,
              données: {
                tableaux: TOUS_DISPOSITIFS,
                fichiers: DISPOSITIFS_INSTALLÉS,
              },
            },
          },
        },
      };
      expect(épingle).to.deep.equal(réf);
    });

    it("désépingler nuée", async () => {
      await constl.nuées.désépingler({ idNuée });

      const épingle = await obtenir(({ siNonDéfini }) =>
        constl.nuées.suivreÉpingle({
          idNuée,
          f: siNonDéfini(),
        }),
      );
      expect(épingle).to.be.undefined();
    });

    it("épingler nuée", async () => {
      const idNuée = await constl.nuées.créerNuée({
        épingler: false,
      });
      await constl.nuées.épingler({ idNuée });

      const épingle = await obtenir(({ siDéfini }) =>
        constl.nuées.suivreÉpingle({ idNuée, f: siDéfini() }),
      );

      const réf: ÉpingleNuée = {
        type: "nuée",
        épingle: {
          base: TOUS_DISPOSITIFS,
          bds: {
            type: "bd",
            épingle: {
              base: TOUS_DISPOSITIFS,
              données: {
                tableaux: TOUS_DISPOSITIFS,
                fichiers: DISPOSITIFS_INSTALLÉS,
              },
            },
          },
        },
      };
      expect(épingle).to.deep.equal(réf);
    });

    it("résoudre épingle - base", async () => {
      const idNuée = await constl.nuées.créerNuée();
      const résolution = await obtenir<Set<string>>(({ si }) =>
        constl.nuées.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idNuée,
            épingle: {
              type: "nuée",
              épingle: { base: true },
            },
          },
          f: si((x) => !!x && x.size > 0),
        }),
      );
      expect([...résolution]).to.have.members([enleverPréfixes(idNuée)]);
    });

    it.skip("résoudre épingle - bds", async () => {
      const idNuée = await constl.nuées.créerNuée();

      const idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
      const idTableau = await constl.nuées.ajouterTableau({ idNuée });

      await constl.bds.ajouterTableau({ idBd, idTableau });
      const idDonnéesTableau = await constl.bds.tableaux.obtIdDonnées({
        idStructure: idNuée,
        idTableau,
      });

      const résolution = await obtenir<Set<string>>(({ si }) =>
        constl.nuées.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idNuée,
            épingle: {
              type: "nuée",
              épingle: {
                base: true,
                bds: {
                  type: "bd",
                  épingle: {
                    base: true,
                    données: {
                      tableaux: true,
                    },
                  },
                },
              },
            },
          },
          f: si((x) => !!x && x.size > 2),
        }),
      );
      expect([...résolution]).to.have.members([
        enleverPréfixes(idNuée),
        enleverPréfixes(idBd),
        idDonnéesTableau,
      ]);

      const résolutionSansTableaux = await obtenir<Set<string>>(
        ({ siDéfini }) =>
          constl.nuées.suivreRésolutionÉpingle({
            épingle: {
              idObjet: idNuée,
              épingle: {
                type: "nuée",
                épingle: {
                  base: true,
                  bds: {
                    type: "bd",
                    épingle: {
                      base: true,
                      données: {
                        tableaux: false,
                      },
                    },
                  },
                },
              },
            },
            f: siDéfini(),
          }),
      );
      expect([...résolutionSansTableaux]).to.have.members([
        enleverPréfixes(idNuée),
        enleverPréfixes(idBd),
      ]);
    });

    it.skip("résoudre épingle - fichiers", async () => {
      const idNuée = await constl.nuées.créerNuée();

      const idTableau = await constl.nuées.ajouterTableau({ idNuée });
      const idVariable = await constl.variables.créerVariable({
        catégorie: "fichier",
      });
      const idColonne = await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuée,
        idTableau,
        idVariable,
      });

      const schéma = await constl.nuées.créerSchémaDeNuée({
        idNuée,
        licence: "ODbl-1_0",
      });

      const idBd = await constl.bds.créerBdDeSchéma({ schéma });

      const idc = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ/fichier.mp4";
      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idNuée,
        idTableau,
        éléments: [{ [idColonne]: idc }],
      });

      const idDonnéesTableau = await constl.bds.tableaux.obtIdDonnées({
        idStructure: idBd,
        idTableau,
      });

      const résolution = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.nuées.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idNuée,
            épingle: {
              type: "nuée",
              épingle: {
                base: true,
                bds: {
                  type: "bd",
                  épingle: {
                    base: true,
                    données: {
                      tableaux: true,
                      fichiers: true,
                    },
                  },
                },
              },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolution]).to.have.members([
        enleverPréfixes(idNuée),
        enleverPréfixes(idBd),
        idDonnéesTableau,
        idc,
      ]);

      const résolutionSansFichers = await obtenir<Set<string>>(({ siDéfini }) =>
        constl.nuées.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idNuée,
            épingle: {
              type: "nuée",
              épingle: {
                base: true,
                bds: {
                  type: "bd",
                  épingle: {
                    base: true,
                    données: {
                      tableaux: true,
                      fichiers: false,
                    },
                  },
                },
              },
            },
          },
          f: siDéfini(),
        }),
      );
      expect([...résolutionSansFichers]).to.have.members([
        enleverPréfixes(idNuée),
        enleverPréfixes(idBd),
        idDonnéesTableau,
      ]);

      const résolutionSansFichersOuTableaux = await obtenir<Set<string>>(
        ({ siDéfini }) =>
          constl.nuées.suivreRésolutionÉpingle({
            épingle: {
              idObjet: idNuée,
              épingle: {
                type: "nuée",
                épingle: {
                  base: true,
                  bds: {
                    type: "bd",
                    épingle: {
                      base: true,
                    },
                  },
                },
              },
            },
            f: siDéfini(),
          }),
      );
      expect([...résolutionSansFichersOuTableaux]).to.have.members([
        enleverPréfixes(idNuée),
        enleverPréfixes(idBd),
      ]);
    });

    it("résoudre épingle - ascendance", async () => {
      const idParent = await constl.nuées.créerNuée();
      const idNuée = await constl.nuées.créerNuée({ parent: idParent });

      const résolution = await obtenir<Set<string>>(({ si }) =>
        constl.nuées.suivreRésolutionÉpingle({
          épingle: {
            idObjet: idNuée,
            épingle: {
              type: "nuée",
              épingle: { base: true },
            },
          },
          f: si((x) => !!x && x.size > 1),
        }),
      );
      expect([...résolution]).to.have.members([
        enleverPréfixes(idNuée),
        enleverPréfixes(idParent),
      ]);
    });
  });

  describe("schémas", function () {
    const idColonneLangue = "langue";
    const idColonneClef = "clef";
    const idColonneTraduc = "traduc";
    const idColonneNomLangue = "nom langue";

    const idTableauTraducs = "tableau traducs";
    const idTableauLangues = "tableau langues";

    const licence = "ODbl-1_0";
    const licenceContenu = "CC-BY-SA-4_0";

    const métadonnées = { clef: true, clef2: [1, 2, 3] };
    const statut: StatutDonnées = { statut: "interne" };

    let idVarClef: string;
    let idVarTraduc: string;
    let idVarLangue: string;
    let idVarNomLangue: string;

    let idMotClef: string;
    let idNuée: string;

    let schéma: SchémaBd;

    before(async () => {
      idVarClef = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarTraduc = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarLangue = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
      idVarNomLangue = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });

      idMotClef = await constl.motsClefs.créerMotClef();
      idNuée = await constl.nuées.créerNuée();

      schéma = {
        licence,
        licenceContenu,
        motsClefs: [idMotClef],
        métadonnées,
        statut,
        tableaux: {
          [idTableauTraducs]: {
            cols: [
              {
                idVariable: idVarClef,
                idColonne: idColonneClef,
                index: true,
              },
              {
                idVariable: idVarLangue,
                idColonne: idColonneLangue,
                index: true,
              },
              {
                idVariable: idVarTraduc,
                idColonne: idColonneTraduc,
              },
            ],
          },
          [idTableauLangues]: {
            cols: [
              {
                idVariable: idVarLangue,
                idColonne: idColonneLangue,
              },
              {
                idVariable: idVarNomLangue,
                idColonne: idColonneNomLangue,
              },
            ],
          },
        },
      };
    });

    describe("création nuée à partir de schéma", function () {
      before(async () => {
        idNuée = await constl.nuées.créerNuéeDeSchéma({ schéma });
      });

      it("métadonnées", async () => {
        const métadonnéesNuée = await obtenir<Métadonnées>(({ si }) =>
          constl.nuées.suivreMétadonnées({
            idNuée,
            f: si((x) => !!x && Object.keys(x).length > 0),
          }),
        );

        expect(métadonnéesNuée).to.deep.equal(métadonnées);
      });

      it("mots-clefs", async () => {
        const motsClefs = await obtenir<ValeurAscendance<string>[] | undefined>(
          ({ siPasVide }) =>
            constl.nuées.suivreMotsClefs({ idNuée, f: siPasVide() }),
        );

        expect(motsClefs).to.have.deep.members([
          { val: idMotClef, source: idNuée },
        ]);
      });

      it("statut", async () => {
        const statutNuée = await obtenir<StatutDonnées | undefined>(
          ({ siDéfini }) =>
            constl.nuées.suivreStatut({
              idNuée,
              f: siDéfini(),
            }),
        );

        expect(statutNuée).to.deep.equal(statut);
      });

      it("tableaux", async () => {
        const tableaux = await obtenir<InfoTableauNuée[]>(({ siPasVide }) =>
          constl.nuées.suivreTableaux({
            idNuée,
            f: siPasVide(),
          }),
        );

        const réf: InfoTableauNuée[] = [
          { id: idTableauTraducs, source: idNuée },
          { id: idTableauLangues, source: idNuée },
        ];
        expect(tableaux).to.have.deep.members(réf);
      });

      it("colonnes", async () => {
        const colonnes = await obtenir<InfoColonne[]>(({ si }) =>
          constl.nuées.tableaux.suivreColonnes({
            idStructure: idNuée,
            idTableau: idTableauTraducs,
            f: si((c) => c !== undefined && c.length > 1),
          }),
        );

        const réf: InfoColonne[] = [
          {
            id: idColonneClef,
            variable: idVarClef,
            index: true,
          },
          {
            id: idColonneLangue,
            variable: idVarLangue,
            index: true,
          },
          {
            id: idColonneTraduc,
            variable: idVarTraduc,
          },
        ];
        expect(colonnes).to.have.deep.members(réf);
      });
    });

    describe("génération de schéma", async () => {
      it("schéma complet", async () => {
        const schémaGénéré = await constl.nuées.créerSchémaDeNuée({
          idNuée,
          licence,
          licenceContenu,
        });

        const réf = Object.assign({}, schéma, {
          licence,
          licenceContenu,
          nuées: [idNuée],
        });
        for (const tableau of Object.values(réf.tableaux)) {
          for (const col of tableau.cols) {
            if (!Object.keys(col).includes("index")) {
              col.index = undefined;
            }
          }
        }

        expect(schémaGénéré).to.deep.equal(réf);
      });

      it("schéma de nuée avec ascendance", async () => {
        const idNuéeEnfant = await constl.nuées.créerNuée({ parent: idNuée });
        const schémaGénéré = await constl.nuées.créerSchémaDeNuée({
          idNuée: idNuéeEnfant,
          licence,
          licenceContenu,
        });

        expect(schémaGénéré).to.deep.equal(
          Object.assign({}, schéma, {
            licence,
            licenceContenu,
            nuées: [idNuéeEnfant],
          }),
        );
      });
    });
  });

  describe.skip("bds", function () {
    let idNuée: string;
    let idBd: string;

    beforeEach(async () => {
      idNuée = await constl.nuées.créerNuée();
      idBd = await constl.bds.créerBd({ licence: "ODbl-1_0" });
    });

    it("aucune bd pour commencer", async () => {
      const bds = await obtenir<string[]>(({ siDéfini }) =>
        constl.nuées.suivreBds({ idNuée, f: siDéfini() }),
      );

      expect(bds).to.be.empty();
    });

    it("nouvelle bd détectée", async () => {
      await constl.bds.rejoindreNuée({ idBd, idNuée });

      const bds = await obtenir<string[]>(({ siDéfini }) =>
        constl.nuées.suivreBds({ idNuée, f: siDéfini() }),
      );
      expect(bds).to.have.members([idBd]);
    });

    it("bd exclue si pas autorisée", async () => {
      await constl.bds.rejoindreNuée({ idBd, idNuée });
      obtenir(({ siPasVide }) =>
        constl.nuées.suivreBds({ idNuée, f: siPasVide() }),
      );

      await constl.nuées.bloquerCompte({ idNuée, idCompte: idsComptes[1] });

      const bds = await obtenir<string[]>(({ siVide }) =>
        constl.nuées.suivreBds({ idNuée, f: siVide() }),
      );
      expect(bds).to.be.empty();
    });

    it("filtres - par licence", async () => {
      await constl.bds.changerLicence({ idBd, licence: "ODC-BY-1_0" });

      // La bd est exclue même si enforcerAutorisation !== false et que nous sommes l'auteur
      const bds = await obtenir<string[]>(({ siVide }) =>
        constl.nuées.suivreBds({
          idNuée,
          f: siVide(),
          filtres: { licences: ["ODbl-1_0"] },
        }),
      );

      expect(bds).to.be.empty();
    });

    it("filtres - ignorer autorisation", async () => {
      await constl.nuées.modifierTypeAutorisation({
        idNuée,
        type: "par invitation",
      });
      const bds = await obtenir<string[]>(({ siPasVide }) =>
        constl.nuées.suivreBds({
          idNuée,
          f: siPasVide(),
          filtres: { ignorerAutorisation: true },
        }),
      );

      expect(bds).to.have.members([idBd]);
    });

    it("filtres - ne pas ignorer l'autorisation même pour mes données", async () => {
      await constl.nuées.modifierTypeAutorisation({
        idNuée,
        type: "par invitation",
      });
      const bds = await obtenir<string[]>(({ siDéfini }) =>
        constl.nuées.suivreBds({
          idNuée,
          f: siDéfini(),
          filtres: { ignorerAutorisation: false },
        }),
      );

      expect(bds).to.be.empty();
    });

    it("filtres - toujours inclure mes données même avec nuée indisponible", async () => {
      const idNuéeIndisponible =
        "/constl/nuée/orbitdb/zdpuAximNmZyUWXGCaLmwSEGDeWmuqfgaoogA7KNSa1B2DAAF";
      await constl.nuées.modifierTypeAutorisation({
        idNuée: idNuéeIndisponible,
        type: "par invitation",
      });

      const bds = await obtenir<string[]>(({ siPasVide }) =>
        constl.nuées.suivreBds({ idNuée: idNuéeIndisponible, f: siPasVide() }),
      );

      expect(bds).to.have.members([idBd]);
    });
  });

  describe.skip("données", function () {
    let idNuée: string;
    let idBd: string;
    let idBdPDDL: string;
    let idTableau: string;
    let idVariable: string;

    const idColonne = "précipitation";
    const éléments: DonnéesRangéeTableau[] = [
      { [idColonne]: 12 },
      { [idColonne]: -1 },
      { [idColonne]: 3 },
    ];

    let idsÉléments: string[];
    let idsÉlémentsPDDL: string[];

    let élémentsNuées: DonnéesRangéeNuée[];
    let élémentsNuéesPDDL: DonnéesRangéeNuée[];

    const idNuéeIndisponible =
      "/constl/nuées/orbitdb/zdpuAximNmZyUWXGCaLmwSEGDeWmuqfgaoogA7KNSa1B2DAAF";

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
      idTableau = await constl.nuées.ajouterTableau({ idNuée });
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuée,
        idTableau,
        idColonne,
        idVariable,
      });

      await constl.nuées.tableaux.ajouterRègle({
        idStructure: idNuée,
        idTableau,
        idColonne,
        règle: {
          type: "bornes",
          détails: {
            type: "fixe",
            op: ">=",
            val: 0,
          },
        },
      });

      const schéma = await constl.nuées.créerSchémaDeNuée({
        idNuée,
        licence: "ODbl-1_0",
      });
      idBd = await constl.bds.créerBdDeSchéma({ schéma });
      // Créer une différence avec les colonnes d'origine
      await constl.bds.tableaux.modifierIndexColonne({
        idStructure: idBd,
        idTableau,
        idColonne,
        index: true,
      });

      idsÉléments = await constl.bds.tableaux.ajouterÉléments({
        idStructure: idBd,
        idTableau,
        éléments,
      });

      élémentsNuées = éléments.map((élément, i) => ({
        idBd,
        données: { id: idsÉléments[i], données: élément },
      }));

      // La deuxième bd existe sur un autre compte
      idBdPDDL = await constls[1].bds.créerBdDeSchéma({ schéma });

      idsÉlémentsPDDL = await constls[1].bds.tableaux.ajouterÉléments({
        idStructure: idBdPDDL,
        idTableau,
        éléments,
      });

      élémentsNuéesPDDL = éléments.map((élément, i) => ({
        idBd: idBdPDDL,
        données: { id: idsÉlémentsPDDL[i], données: élément },
      }));

      // Ajouter une autre nuée (indisponible) aux bds
      await constl.bds.rejoindreNuée({ idBd, idNuée: idNuéeIndisponible });
      await constls[1].bds.rejoindreNuée({
        idBd: idBdPDDL,
        idNuée: idNuéeIndisponible,
      });
    });

    it("donnnées autorisées", async () => {
      const données = await obtenir<DonnéesRangéeNuée[]>(({ siPasVide }) =>
        constl.nuées.tableaux.suivreDonnées({
          idStructure: idNuée,
          idTableau,
          f: siPasVide(),
        }),
      );

      expect(données).to.have.deep.members([
        ...élémentsNuées,
        ...élémentsNuéesPDDL,
      ]);
    });

    it("filtrer bds", async () => {
      const données = await obtenir<DonnéesRangéeNuée[]>(({ siPasVide }) =>
        constl.nuées.tableaux.suivreDonnées({
          idStructure: idNuée,
          idTableau,
          filtresBds: { licences: ["PDDL"] },
          f: siPasVide(),
        }),
      );

      expect(données).to.have.deep.members(élémentsNuéesPDDL);
    });

    it("filtrer données - exclure différences tableaux", async () => {
      const données = await obtenir<DonnéesRangéeNuée[]>(({ siPasVide }) =>
        constl.nuées.tableaux.suivreDonnées({
          idStructure: idNuée,
          idTableau,
          filtresDonnées: { exclureAvecDifférencesTableaux: ["indexColonne"] },
          f: siPasVide(),
        }),
      );

      expect(données).to.have.deep.members(élémentsNuéesPDDL);
    });

    it("filtrer données - exclure erreurs données", async () => {
      const données = await obtenir<DonnéesRangéeNuée[]>(({ siPasVide }) =>
        constl.nuées.tableaux.suivreDonnées({
          idStructure: idNuée,
          idTableau,
          filtresDonnées: { exclureAvecErreursDonnées: true },
          f: siPasVide(),
        }),
      );

      const réf: DonnéesRangéeNuée[] = [
        ...élémentsNuées,
        ...élémentsNuéesPDDL,
      ].filter(({ données: { données } }) => {
        return (données[idColonne] as number) >= 0;
      });
      expect(données).to.have.deep.members(réf);
    });

    it("clefs selon variables", async () => {
      const données = await obtenir<DonnéesRangéeNuée[]>(({ siPasVide }) =>
        constl.nuées.tableaux.suivreDonnées({
          idStructure: idNuée,
          idTableau,
          clefsSelonVariables: true,
          f: siPasVide(),
        }),
      );

      const réf: DonnéesRangéeNuée[] = [
        ...élémentsNuées,
        ...élémentsNuéesPDDL,
      ].map(({ idBd, données: { id, données } }) => ({
        idBd,
        données: {
          id,
          données: {
            [idVariable]: données[idColonne],
          },
        },
      }));
      expect(données).to.have.deep.members(réf);
    });

    it("données locales même si nuée non disponible", async () => {
      const données = await obtenir<DonnéesRangéeNuée[]>(({ siPasVide }) =>
        constl.nuées.tableaux.suivreDonnées({
          idStructure: idNuéeIndisponible,
          idTableau,
          f: siPasVide(),
        }),
      );

      // Uniquement les données locales
      expect(données).to.have.deep.members(élémentsNuées);
    });

    it("données réseau sans vérification autorisation même si nuée non disponible", async () => {
      const données = await obtenir<DonnéesRangéeNuée[]>(({ siPasVide }) =>
        constl.nuées.tableaux.suivreDonnées({
          idStructure: idNuéeIndisponible,
          idTableau,
          filtresBds: { ignorerAutorisation: true },
          f: siPasVide(),
        }),
      );

      // Données locales et réseau
      expect(données).to.have.deep.members([
        ...élémentsNuéesPDDL,
        ...élémentsNuées,
      ]);
    });
  });

  describe("différences", function () {
    let idBd: string;
    let idNuée: string;

    before(async () => {
      idBd = await constl.bds.créerBd({ licence: "ODBl-1_0" });
      idNuée = await constl.nuées.créerNuée();
    });

    it("vide pour commencer", async () => {
      const différences = await obtenir(({ siVide }) =>
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siVide() }),
      );
      expect(différences).to.be.empty();
    });

    it("tableau manquant", async () => {
      const idTableau = await constl.nuées.ajouterTableau({ idNuée });
      const différences = await obtenir<DifférenceBds[]>(({ siPasVide }) =>
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siPasVide() }),
      );

      const réf: DifférenceBds[] = [
        {
          type: "tableauManquant",
          sévère: true,
          clefManquante: idTableau,
        },
      ];
      expect(différences).to.have.deep.members(réf);

      await constl.bds.ajouterTableau({ idBd, idTableau });
      const différencesAprès = await obtenir(({ siVide }) =>
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siVide() }),
      );
      expect(différencesAprès).to.be.empty();
    });

    it("tableau supplémentaire", async () => {
      const idTableau = await constl.bds.ajouterTableau({ idBd });
      const différences = await obtenir(({ siPasVide }) =>
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siPasVide() }),
      );

      const réf: DifférenceBds[] = [
        {
          type: "tableauSupplémentaire",
          sévère: false,
          clefExtra: idTableau,
        },
      ];
      expect(différences).to.have.deep.members(réf);

      await constl.bds.effacerTableau({ idBd, idTableau });
      const différencesAprès = await obtenir(({ siVide }) =>
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siVide() }),
      );
      expect(différencesAprès).to.be.empty();
    });

    it("différences tableau", async () => {
      const idTableau = await constl.nuées.ajouterTableau({ idNuée });
      await constl.bds.ajouterTableau({ idBd, idTableau });

      const idColonne = await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuée,
        idTableau,
      });
      const différences = await obtenir(({ siPasVide }) =>
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siPasVide() }),
      );

      const réf: DifférenceBds[] = [
        {
          type: "tableau",
          idTableau,
          sévère: true,
          différence: {
            type: "colonneManquante",
            idColonneManquante: idColonne,
            sévère: true,
          },
        },
      ];
      expect(différences).to.have.deep.members(réf);

      await constl.bds.tableaux.ajouterColonne({
        idStructure: idBd,
        idTableau,
        idColonne,
      });
      const différencesAprès = await obtenir(({ siVide }) =>
        constl.nuées.suivreDifférencesAvecBd({ idBd, idNuée, f: siVide() }),
      );
      expect(différencesAprès).to.be.empty();
    });
  });

  describe("copier", function () {
    let idNuéeSource: string;

    let idNuéeOrig: string;
    let idNuéeCopie: string;

    let idMotClef: string;
    let idVariable: string;
    let idTableau: string;
    let idColonne: string;

    let IMAGE: Uint8Array;
    let idImage: string;

    const réfNoms = {
      த: "மழை",
      हिं: "बारिश",
    };
    const réfDescrs = {
      த: "தினசரி மழை",
      हिं: "दैनिक बारिश",
    };
    const réfMétadonnées = { clef: true };

    const réfStatut: StatutDonnées = { statut: "interne" };

    const réfBloqués = ["pas chouette", "méchant", "pas gentil"].map(
      (id) => `/nébuleuse/compte/orbitdb/${id}`,
    );

    before(async () => {
      IMAGE = await obtRessourceTest({
        nomFichier: "logo.svg",
      });

      idNuéeSource = await constl.nuées.créerNuée();

      idNuéeOrig = await constl.nuées.créerNuée({
        parent: idNuéeSource,
        autorisation: "ouverte",
      });

      for (const méchant of réfBloqués) {
        await constl.nuées.bloquerCompte({
          idNuée: idNuéeSource,
          idCompte: méchant,
        });
      }

      await constl.nuées.sauvegarderNoms({
        idNuée: idNuéeOrig,
        noms: réfNoms,
      });
      await constl.nuées.sauvegarderDescriptions({
        idNuée: idNuéeOrig,
        descriptions: réfDescrs,
      });

      idMotClef = await constl.motsClefs.créerMotClef();
      await constl.nuées.ajouterMotsClefs({
        idNuée: idNuéeOrig,
        idsMotsClefs: idMotClef,
      });
      await constl.nuées.sauvegarderMétadonnées({
        idNuée: idNuéeOrig,
        métadonnées: réfMétadonnées,
      });
      idImage = await constl.nuées.sauvegarderImage({
        idNuée: idNuéeOrig,
        image: { contenu: IMAGE, nomFichier: "logo.svg" },
      });
      await constl.nuées.sauvegarderStatut({
        idNuée: idNuéeOrig,
        statut: réfStatut,
      });

      idTableau = await constl.nuées.ajouterTableau({ idNuée: idNuéeOrig });

      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      idColonne = await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuéeOrig,
        idTableau,
        idVariable,
      });
    });

    it("copier la nuée", async () => {
      idNuéeCopie = await constl.nuées.copierNuée({ idNuée: idNuéeOrig });
      expect(idNuéeCopie).to.be.a("string");
    });

    it("la nuée est ajouté à mes nuées", async () => {
      const nuées = await obtenir<string[]>(({ si }) =>
        constl.nuées.suivreNuées({ f: si((x) => !!x?.includes(idNuéeCopie)) }),
      );
      expect(nuées).to.include.members([idNuéeOrig, idNuéeCopie]);
    });

    it("les noms sont copiés", async () => {
      const noms = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.nuées.suivreNoms({ idNuée: idNuéeCopie, f: siPasVide() }),
      );
      expect(noms).to.deep.equal(réfNoms);
    });

    it("les descriptions sont copiées", async () => {
      const descrs = await obtenir<TraducsTexte>(({ siPasVide }) =>
        constl.nuées.suivreDescriptions({
          idNuée: idNuéeCopie,
          f: siPasVide(),
        }),
      );
      expect(descrs).to.deep.equal(réfDescrs);
    });

    it("les métadonnées sont copiées", async () => {
      const métadonnées = await obtenir<Métadonnées>(({ siPasVide }) =>
        constl.nuées.suivreMétadonnées({ idNuée: idNuéeCopie, f: siPasVide() }),
      );
      expect(métadonnées).to.deep.equal(réfMétadonnées);
    });

    it("les mots-clefs sont copiés", async () => {
      const motsClefs = await obtenir<ValeurAscendance<string>[]>(
        ({ siPasVide }) =>
          constl.nuées.suivreMotsClefs({ idNuée: idNuéeCopie, f: siPasVide() }),
      );
      expect(motsClefs).to.have.deep.members([
        { val: idMotClef, source: idNuéeCopie },
      ]);
    });

    it("le statut est copié", async () => {
      const statut = await obtenir<StatutDonnées | null>(({ si }) =>
        constl.nuées.suivreStatut({
          idNuée: idNuéeCopie,
          f: si((x) => x?.statut !== "active"),
        }),
      );
      expect(statut).to.deep.equal(réfStatut);
    });

    it("l'image est copiée", async () => {
      const image = await obtenir<{
        image: Uint8Array;
        idImage: string;
      } | null>(({ siDéfini }) =>
        constl.nuées.suivreImage({ idNuée: idNuéeCopie, f: siDéfini() }),
      );
      expect(image).to.deep.equal({ idImage, image: IMAGE });
    });

    it("les tableaux sont copiés", async () => {
      const tableaux = await obtenir<InfoTableauNuée[]>(({ siPasVide }) =>
        constl.nuées.suivreTableaux({ idNuée: idNuéeCopie, f: siPasVide() }),
      );
      expect(tableaux).to.have.deep.members([
        { id: idTableau, source: idNuéeCopie },
      ]);
    });

    it("les colonnes sont copiés", async () => {
      const colonnes = await obtenir<InfoColonne[]>(({ siPasVide }) =>
        constl.nuées.tableaux.suivreColonnes({
          idStructure: idNuéeCopie,
          idTableau,
          f: siPasVide(),
        }),
      );

      const réf: InfoColonne[] = [
        {
          id: idColonne,
          variable: idVariable,
        },
      ];
      expect(colonnes).to.have.deep.members(réf);
    });

    it("les variables sont copiées", async () => {
      const variables = await obtenir<string[]>(({ siPasVide }) =>
        constl.nuées.suivreVariables({ idNuée: idNuéeCopie, f: siPasVide() }),
      );
      expect(variables).to.have.members([idVariable]);
    });

    it("les autorisations sont copiées", async () => {
      const autorisation = await obtenir<AutorisationNuée>(({ siDéfini }) =>
        constl.nuées.suivreAutorisation({ idNuée: idNuéeCopie, f: siDéfini() }),
      );
      const réf: AutorisationNuée = {
        type: "ouverte",
        bloqués: réfBloqués,
      };
      expect(autorisation).to.deep.equal(réf);
    });

    it("l'ascendance est copiée", async () => {
      const ascendance = await obtenir<string[]>(({ siDéfini }) =>
        constl.nuées.suivreAscendants({ idNuée: idNuéeCopie, f: siDéfini() }),
      );
      expect(ascendance).to.have.deep.members([idNuéeSource]);
    });

    it("source copie établie", async () => {
      const copiéeDe = await obtenir<{ id?: string }>(({ siDéfini }) =>
        constl.nuées.suivreSource({ idNuée: idNuéeCopie, f: siDéfini() }),
      );
      expect(copiéeDe).to.deep.equal({ id: idNuéeOrig });
    });
  });

  describe("empreinte", function () {
    let idNuée: string;
    let idBd: string;
    let idTableau: string;
    let idVariable: string;
    let idColonne: string;

    let empreinte: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
      idVariable = await constl.variables.créerVariable({
        catégorie: "numérique",
      });

      idTableau = await constl.nuées.ajouterTableau({ idNuée });
      idColonne = await constl.nuées.tableaux.ajouterColonne({
        idStructure: idNuée,
        idTableau,
        idVariable,
      });
    });

    it("sans bds", async () => {
      empreinte = await obtenir<string>(({ siDéfini }) =>
        constl.nuées.suivreEmpreinteTête({
          idNuée,
          f: siDéfini(),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it.skip("ajout bds", async () => {
      const schéma = await constl.nuées.créerSchémaDeNuée({
        idNuée,
        licence: "ODBl-1_0",
      });
      idBd = await constl.bds.créerBdDeSchéma({
        schéma,
      });

      empreinte = await obtenir<string>(({ si }) =>
        constl.nuées.suivreEmpreinteTête({
          idNuée,
          f: si((x) => x !== undefined && x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it.skip("changement nom bds détecté", async () => {
      await constl.bds.sauvegarderNom({
        idBd,
        langue: "fra",
        nom: "Insectes de Montréal",
      });

      empreinte = await obtenir<string>(({ si }) =>
        constl.nuées.suivreEmpreinteTête({
          idNuée,
          f: si((x) => x !== undefined && x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it("changement nom nuée détecté", async () => {
      await constl.nuées.sauvegarderNom({
        idNuée,
        langue: "fra",
        nom: "Science citoyenne",
      });

      empreinte = await obtenir<string>(({ si }) =>
        constl.nuées.suivreEmpreinteTête({
          idNuée,
          f: si((x) => x !== undefined && x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it.skip("changement données bds détecté", async () => {
      await constl.bds.tableaux.ajouterÉléments({
        idStructure: idBd,
        idTableau,
        éléments: [{ [idColonne]: 2 }],
      });

      empreinte = await obtenir<string>(({ si }) =>
        constl.nuées.suivreEmpreinteTête({
          idNuée,
          f: si((x) => x !== undefined && x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });

    it.skip("changement noms variable détecté", async () => {
      await constl.variables.sauvegarderNom({
        idVariable,
        langue: "fra",
        nom: "Population observée",
      });

      empreinte = await obtenir<string>(({ si }) =>
        constl.nuées.suivreEmpreinteTête({
          idNuée,
          f: si((x) => x !== undefined && x !== empreinte),
        }),
      );
      expect(empreinte).to.be.a.not.empty("string");
    });
  });

  describe("ascendance", function () {
    let idNuée: string;

    beforeEach(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("vide si aucun parent", async () => {
      const ascendants = await obtenir(({ siDéfini }) =>
        constl.nuées.suivreAscendants({ idNuée, f: siDéfini() }),
      );
      expect(ascendants).to.be.empty();
    });

    it("ascendance immédiate", async () => {
      const idNuéeParent = await constl.nuées.créerNuée();

      await constl.nuées.préciserParent({ idNuée, idNuéeParent });
      const ascendants = await obtenir(({ siPasVide }) =>
        constl.nuées.suivreAscendants({ idNuée, f: siPasVide() }),
      );
      expect(ascendants).to.have.ordered.members([idNuéeParent]);
    });

    it("ascendance transitive", async () => {
      const idNuéeParent = await constl.nuées.créerNuée();
      const idNuéeGrandParent = await constl.nuées.créerNuée();

      await constl.nuées.préciserParent({ idNuée, idNuéeParent });
      await constl.nuées.préciserParent({
        idNuée: idNuéeParent,
        idNuéeParent: idNuéeGrandParent,
      });

      const ascendants = await obtenir<string[]>(({ si }) =>
        constl.nuées.suivreAscendants({
          idNuée,
          f: si((x) => !!x && x.length > 1),
        }),
      );
      expect(ascendants).to.have.ordered.members([
        idNuéeParent,
        idNuéeGrandParent,
      ]);
    });

    it("grand-parent enlevé avec parent", async () => {
      const idNuéeParent = await constl.nuées.créerNuée();
      const idNuéeGrandParent = await constl.nuées.créerNuée();

      await constl.nuées.préciserParent({ idNuée, idNuéeParent });
      await constl.nuées.préciserParent({
        idNuée: idNuéeParent,
        idNuéeParent: idNuéeGrandParent,
      });

      await obtenir(({ siPasVide }) =>
        constl.nuées.suivreAscendants({ idNuée, f: siPasVide() }),
      );
      await constl.nuées.enleverParent({ idNuée });

      const ascendants = await obtenir(({ siVide }) =>
        constl.nuées.suivreAscendants({ idNuée, f: siVide() }),
      );
      expect(ascendants).to.be.empty();
    });

    it("pas d'erreur si circulaire", async () => {
      const idNuéeParent = await constl.nuées.créerNuée();
      const idNuéeGrandParent = await constl.nuées.créerNuée();

      await constl.nuées.préciserParent({ idNuée, idNuéeParent });
      await constl.nuées.préciserParent({
        idNuée: idNuéeParent,
        idNuéeParent: idNuéeGrandParent,
      });
      await constl.nuées.préciserParent({
        idNuée: idNuéeGrandParent,
        idNuéeParent: idNuée,
      });

      const ascendants = await obtenir<string[]>(({ si }) =>
        constl.nuées.suivreAscendants({
          idNuée,
          f: si((x) => !!x && x.length >= 3),
        }),
      );

      expect(ascendants).to.have.ordered.members([
        idNuéeParent,
        idNuéeGrandParent,
        idNuée,
      ]);
    });
  });

  describe.skip("descendance", function () {
    let idNuée: string;

    beforeEach(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("vide si aucun descendant", async () => {
      const descendants = await obtenir<string[]>(({ siDéfini }) =>
        constl.nuées.suivreDescendants({ idNuée, f: siDéfini() }),
      );
      expect(descendants).to.be.empty();
    });

    it("descendance immédiate", async () => {
      const idNuéeEnfant = await constl.nuées.créerNuée({ parent: idNuée });

      const descendants = await obtenir<string[]>(({ siPasVide }) =>
        constl.nuées.suivreDescendants({ idNuée, f: siPasVide() }),
      );
      expect(descendants).to.have.members([idNuéeEnfant]);
    });

    it("descendance transitive", async () => {
      const idNuéeEnfant = await constl.nuées.créerNuée({ parent: idNuée });
      const idPetitEnfant = await constl.nuées.créerNuée({
        parent: idNuéeEnfant,
      });

      const descendants = await obtenir<string[]>(({ si }) =>
        constl.nuées.suivreDescendants({
          idNuée,
          f: si((x) => !!x && x.length >= 2),
        }),
      );
      expect(descendants).to.have.members([idNuéeEnfant, idPetitEnfant]);
    });

    it("petit-enfant enlevé avec enfant", async () => {
      const idNuéeEnfant = await constl.nuées.créerNuée({ parent: idNuée });
      await constl.nuées.créerNuée({ parent: idNuéeEnfant });

      await obtenir<string[]>(({ si }) =>
        constl.nuées.suivreDescendants({
          idNuée,
          f: si((x) => !!x && x.length >= 2),
        }),
      );

      await constl.nuées.enleverParent({ idNuée: idNuéeEnfant });

      const descendants = await obtenir<string[]>(({ siVide }) =>
        constl.nuées.suivreDescendants({ idNuée, f: siVide() }),
      );
      expect(descendants).to.be.empty();
    });

    it("pas d'erreur si récursif", async () => {
      const idNuéeEnfant = await constl.nuées.créerNuée({ parent: idNuée });
      const idPetitEnfant = await constl.nuées.créerNuée({
        parent: idNuéeEnfant,
      });

      await constl.nuées.préciserParent({
        idNuée,
        idNuéeParent: idPetitEnfant,
      });

      const descendants = await obtenir<string[]>(({ si }) =>
        constl.nuées.suivreDescendants({
          idNuée,
          f: si((x) => !!x && x.length >= 3),
        }),
      );
      expect(descendants).to.have.members([
        idNuéeEnfant,
        idPetitEnfant,
        idNuée,
      ]);
    });
  });

  describe("héritage", function () {
    describe("noms", function () {
      let idNuéeGrandParent: string;
      let idNuéeParent: string;
      let idNuée: string;

      before(async () => {
        idNuéeGrandParent = await constl.nuées.créerNuée();
        idNuéeParent = await constl.nuées.créerNuée({
          parent: idNuéeGrandParent,
        });
        idNuée = await constl.nuées.créerNuée({ parent: idNuéeParent });
      });

      it("noms ascendance", async () => {
        await constl.nuées.sauvegarderNoms({
          idNuée: idNuéeGrandParent,
          noms: { fra: "Science citoyenne", ctl: "Ciència ciutadana" },
        });
        const noms = await obtenir(({ siPasVide }) =>
          constl.nuées.suivreNoms({ idNuée, f: siPasVide() }),
        );

        expect(noms).to.deep.equal({
          fra: "Science citoyenne",
          ctl: "Ciència ciutadana",
        });
      });

      it("priorité noms ascendance immédiate", async () => {
        await constl.nuées.sauvegarderNoms({
          idNuée: idNuéeParent,
          noms: { ctl: "Projete de ciència ciutadana" },
        });
        const noms = await obtenir<TraducsTexte>(({ si }) =>
          constl.nuées.suivreNoms({
            idNuée,
            f: si(
              (x) =>
                !!x &&
                Object.keys(x).length === 2 &&
                !x.ctl.startsWith("Ciència"),
            ),
          }),
        );

        expect(noms).to.deep.equal({
          fra: "Science citoyenne",
          ctl: "Projete de ciència ciutadana",
        });
      });

      it("priorité noms nuée", async () => {
        await constl.nuées.sauvegarderNoms({
          idNuée,
          noms: { ctl: "Projete de ciència ciutadana hidrològica" },
        });
        const noms = await obtenir<TraducsTexte>(({ si }) =>
          constl.nuées.suivreNoms({
            idNuée,
            f: si(
              (x) =>
                !!x &&
                Object.keys(x).length === 2 &&
                !x.ctl.endsWith("ciutadana"),
            ),
          }),
        );

        expect(noms).to.deep.equal({
          fra: "Science citoyenne",
          ctl: "Projete de ciència ciutadana hidrològica",
        });
      });
    });

    describe("descriptions", function () {
      let idNuéeGrandParent: string;
      let idNuéeParent: string;
      let idNuée: string;

      before(async () => {
        idNuéeGrandParent = await constl.nuées.créerNuée();
        idNuéeParent = await constl.nuées.créerNuée({
          parent: idNuéeGrandParent,
        });
        idNuée = await constl.nuées.créerNuée({ parent: idNuéeParent });
      });

      it("descriptions ascendance", async () => {
        await constl.nuées.sauvegarderDescriptions({
          idNuée: idNuéeGrandParent,
          descriptions: { fra: "Science citoyenne", ctl: "Ciència ciutadana" },
        });
        const descriptions = await obtenir(({ siPasVide }) =>
          constl.nuées.suivreDescriptions({ idNuée, f: siPasVide() }),
        );

        expect(descriptions).to.deep.equal({
          fra: "Science citoyenne",
          ctl: "Ciència ciutadana",
        });
      });

      it("priorité descriptions ascendance immédiate", async () => {
        await constl.nuées.sauvegarderDescriptions({
          idNuée: idNuéeParent,
          descriptions: { ctl: "Projete de ciència ciutadana" },
        });
        const descriptions = await obtenir<TraducsTexte>(({ si }) =>
          constl.nuées.suivreDescriptions({
            idNuée,
            f: si(
              (x) =>
                !!x &&
                Object.keys(x).length === 2 &&
                !x.ctl.startsWith("Ciència"),
            ),
          }),
        );

        expect(descriptions).to.deep.equal({
          fra: "Science citoyenne",
          ctl: "Projete de ciència ciutadana",
        });
      });

      it("priorité descriptions nuée", async () => {
        await constl.nuées.sauvegarderDescriptions({
          idNuée,
          descriptions: { ctl: "Projete de ciència ciutadana hidrològica" },
        });
        const descriptions = await obtenir<TraducsTexte>(({ si }) =>
          constl.nuées.suivreDescriptions({
            idNuée,
            f: si(
              (x) =>
                !!x &&
                Object.keys(x).length === 2 &&
                !x.ctl.endsWith("ciutadana"),
            ),
          }),
        );

        expect(descriptions).to.deep.equal({
          fra: "Science citoyenne",
          ctl: "Projete de ciència ciutadana hidrològica",
        });
      });
    });

    describe("mots-clefs", function () {
      let idNuéeGrandParent: string;
      let idNuéeParent: string;
      let idNuée: string;

      let idMotClefEnvironnement: string;
      let idMotClefHydrologie: string;
      let idMotClefPotamologie: string;

      before(async () => {
        idNuéeGrandParent = await constl.nuées.créerNuée();
        idNuéeParent = await constl.nuées.créerNuée({
          parent: idNuéeGrandParent,
        });
        idNuée = await constl.nuées.créerNuée({ parent: idNuéeParent });

        idMotClefEnvironnement = await constl.motsClefs.créerMotClef();
        idMotClefHydrologie = await constl.motsClefs.créerMotClef();
        idMotClefPotamologie = await constl.motsClefs.créerMotClef();
      });

      it("mots-clefs ascendance", async () => {
        await constl.nuées.ajouterMotsClefs({
          idNuée: idNuéeGrandParent,
          idsMotsClefs: [idMotClefEnvironnement],
        });

        const motsClefs = await obtenir(({ siPasVide }) =>
          constl.nuées.suivreMotsClefs({ idNuée, f: siPasVide() }),
        );

        const réf: ValeurAscendance<string>[] = [
          { val: idMotClefEnvironnement, source: idNuéeGrandParent },
        ];
        expect(motsClefs).to.have.deep.members(réf);
      });

      it("mots-clefs ascendance immédiate", async () => {
        await constl.nuées.ajouterMotsClefs({
          idNuée: idNuéeParent,
          idsMotsClefs: [idMotClefEnvironnement],
        });
        await constl.nuées.ajouterMotsClefs({
          idNuée: idNuéeParent,
          idsMotsClefs: [idMotClefHydrologie],
        });

        const motsClefs = await obtenir<ValeurAscendance<string>[]>(({ si }) =>
          constl.nuées.suivreMotsClefs({
            idNuée,
            f: si((x) => !!x && x.length >= 2),
          }),
        );

        const réf: ValeurAscendance<string>[] = [
          { val: idMotClefEnvironnement, source: idNuéeParent },
          { val: idMotClefHydrologie, source: idNuéeParent },
        ];
        expect(motsClefs).to.have.deep.members(réf);
      });

      it("mots-clefs nuée", async () => {
        await constl.nuées.ajouterMotsClefs({
          idNuée,
          idsMotsClefs: [idMotClefPotamologie],
        });

        const motsClefs = await obtenir<ValeurAscendance<string>[]>(({ si }) =>
          constl.nuées.suivreMotsClefs({
            idNuée,
            f: si((x) => !!x && x.length >= 3),
          }),
        );

        const réf: ValeurAscendance<string>[] = [
          { val: idMotClefEnvironnement, source: idNuéeParent },
          { val: idMotClefHydrologie, source: idNuéeParent },
          { val: idMotClefPotamologie, source: idNuée },
        ];
        expect(motsClefs).to.have.deep.members(réf);
      });
    });

    describe("statut", function () {
      let idNuéeGrandParent: string;
      let idNuéeParent: string;
      let idNuée: string;

      before(async () => {
        idNuéeGrandParent = await constl.nuées.créerNuée();
        idNuéeParent = await constl.nuées.créerNuée({
          parent: idNuéeGrandParent,
        });
        idNuée = await constl.nuées.créerNuée({ parent: idNuéeParent });
      });

      it("statut ascendance", async () => {
        await constl.nuées.sauvegarderStatut({
          idNuée: idNuéeGrandParent,
          statut: { statut: "interne" },
        });

        const statut = await obtenir<StatutDonnées | undefined>(({ si }) =>
          constl.nuées.suivreStatut({
            idNuée,
            f: si((s) => s?.statut === "interne"),
          }),
        );

        const réf: StatutDonnées = { statut: "interne" };
        expect(statut).to.deep.equal(réf);
      });

      it("statut ascendance immédiate", async () => {
        await constl.nuées.sauvegarderStatut({
          idNuée: idNuéeParent,
          statut: { statut: "obsolète", idNouvelle: idNuéeParent },
        });

        const statut = await obtenir<StatutDonnées | undefined>(({ si }) =>
          constl.nuées.suivreStatut({
            idNuée,
            f: si((s) => s?.statut !== "interne" && s?.statut !== "active"),
          }),
        );

        const réf: StatutDonnées = {
          statut: "obsolète",
          idNouvelle: idNuéeParent,
        };
        expect(statut).to.deep.equal(réf);
      });

      it("statut nuée", async () => {
        await constl.nuées.sauvegarderStatut({
          idNuée,
          statut: { statut: "jouet" },
        });

        const statut = await obtenir<StatutDonnées | undefined>(({ si }) =>
          constl.nuées.suivreStatut({
            idNuée,
            f: si((s) => s?.statut === "jouet"),
          }),
        );

        const réf: StatutDonnées = { statut: "jouet" };
        expect(statut).to.deep.equal(réf);
      });
    });

    describe("tableaux", function () {
      let idNuéeGrandParent: string;
      let idNuéeParent: string;
      let idNuée: string;

      let idTableau1: string;
      let idTableau2: string;
      let idTableau3: string;

      before(async () => {
        idNuéeGrandParent = await constl.nuées.créerNuée();
        idNuéeParent = await constl.nuées.créerNuée({
          parent: idNuéeGrandParent,
        });
        idNuée = await constl.nuées.créerNuée({ parent: idNuéeParent });
      });

      it("tableaux ascendance", async () => {
        idTableau1 = await constl.nuées.ajouterTableau({
          idNuée: idNuéeGrandParent,
        });

        const tableaux = await obtenir(({ siPasVide }) =>
          constl.nuées.suivreTableaux({ idNuée, f: siPasVide() }),
        );

        const réf: InfoTableauNuée[] = [
          { id: idTableau1, source: idNuéeGrandParent },
        ];
        expect(tableaux).to.have.deep.members(réf);
      });

      it("tableaux ascendance immédiate", async () => {
        idTableau2 = await constl.nuées.ajouterTableau({
          idNuée: idNuéeParent,
        });

        const tableaux = await obtenir<InfoTableauNuée[]>(({ si }) =>
          constl.nuées.suivreTableaux({
            idNuée,
            f: si((x) => !!x && x.length >= 2),
          }),
        );

        const réf: InfoTableauNuée[] = [
          { id: idTableau1, source: idNuéeGrandParent },
          { id: idTableau2, source: idNuéeParent },
        ];
        expect(tableaux).to.have.deep.members(réf);
      });

      it("duplication tableaux dans l'ascendance", async () => {
        await constl.nuées.ajouterTableau({
          idNuée: idNuéeParent,
          idTableau: idTableau1,
        });

        const tableaux = await obtenir<InfoTableauNuée[]>(({ si }) =>
          constl.nuées.suivreTableaux({
            idNuée,
            f: si(
              (x) =>
                !!x &&
                x.length >= 2 &&
                !!x.every((x) => x.source === idNuéeParent),
            ),
          }),
        );

        const réf: InfoTableauNuée[] = [
          { id: idTableau1, source: idNuéeParent },
          { id: idTableau2, source: idNuéeParent },
        ];
        expect(tableaux).to.have.deep.members(réf);
      });

      it("tableaux nuée", async () => {
        idTableau3 = await constl.nuées.ajouterTableau({
          idNuée,
        });

        const tableaux = await obtenir<InfoTableauNuée[]>(({ si }) =>
          constl.nuées.suivreTableaux({
            idNuée,
            f: si((x) => !!x && x.length >= 3),
          }),
        );

        const réf: InfoTableauNuée[] = [
          { id: idTableau1, source: idNuéeParent },
          { id: idTableau2, source: idNuéeParent },
          { id: idTableau3, source: idNuée },
        ];
        expect(tableaux).to.have.deep.members(réf);
      });
    });

    describe("colonnes", function () {
      let idNuéeGrandParent: string;
      let idNuéeParent: string;
      let idNuée: string;

      let idTableau: string;

      let idVariable: string;

      let idColonne1: string;
      let idColonne2: string;
      let idColonne3: string;
      let idColonne4: string;

      before(async () => {
        idNuéeGrandParent = await constl.nuées.créerNuée();
        idNuéeParent = await constl.nuées.créerNuée({
          parent: idNuéeGrandParent,
        });
        idNuée = await constl.nuées.créerNuée({ parent: idNuéeParent });

        idTableau = await constl.nuées.ajouterTableau({
          idNuée: idNuéeGrandParent,
        });

        idVariable = await constl.variables.créerVariable({
          catégorie: "vidéo",
        });
      });

      it("colonnes ascendance", async () => {
        idColonne1 = await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuéeGrandParent,
          idTableau,
        });
        idColonne2 = await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuéeGrandParent,
          idTableau,
          idVariable,
          index: true,
        });

        const colonnes = await obtenir<InfoColonne[] | undefined>(({ si }) =>
          constl.nuées.tableaux.suivreColonnes({
            idStructure: idNuée,
            idTableau,
            f: si((x) => !!x && x.length > 1),
          }),
        );

        const réf: InfoColonne[] = [
          { id: idColonne1 },
          { id: idColonne2, variable: idVariable, index: true },
        ];
        expect(colonnes).to.have.deep.members(réf);

        const colonnesAvecSource = await obtenir<
          ValeurAscendance<InfoColonne>[]
        >(({ si }) =>
          constl.nuées.tableaux.suivreSourceColonnes({
            idStructure: idNuée,
            idTableau,
            f: si((x) => !!x && x.length > 1),
          }),
        );

        const réfSource: ValeurAscendance<InfoColonne>[] = [
          { source: idNuéeGrandParent, val: { id: idColonne1 } },
          {
            source: idNuéeGrandParent,
            val: { id: idColonne2, variable: idVariable, index: true },
          },
        ];
        expect(colonnesAvecSource).to.have.deep.members(réfSource);
      });

      it("colonnes ascendance immédiate", async () => {
        idColonne3 = await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuéeParent,
          idTableau,
        });

        const colonnes = await obtenir<InfoColonne[]>(({ si }) =>
          constl.nuées.tableaux.suivreColonnes({
            idStructure: idNuée,
            idTableau,
            f: si((x) => !!x && x.length >= 3),
          }),
        );

        const réf: InfoColonne[] = [
          { id: idColonne1 },
          { id: idColonne2, variable: idVariable, index: true },
          { id: idColonne3 },
        ];
        expect(colonnes).to.have.deep.members(réf);

        const colonnesAvecSource = await obtenir<
          ValeurAscendance<InfoColonne>[]
        >(({ si }) =>
          constl.nuées.tableaux.suivreSourceColonnes({
            idStructure: idNuée,
            idTableau,
            f: si((x) => !!x && x.length >= 2),
          }),
        );

        const réfSource: ValeurAscendance<InfoColonne>[] = [
          { source: idNuéeGrandParent, val: { id: idColonne1 } },
          {
            source: idNuéeGrandParent,
            val: { id: idColonne2, variable: idVariable, index: true },
          },
          { source: idNuéeParent, val: { id: idColonne3 } },
        ];
        expect(colonnesAvecSource).to.have.deep.members(réfSource);
      });

      it("duplication colonnes dans l'ascendance", async () => {
        await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuéeParent,
          idTableau,
          idColonne: idColonne1,
          index: true,
        });

        const colonnes = await obtenir<InfoColonne[]>(({ si }) =>
          constl.nuées.tableaux.suivreColonnes({
            idStructure: idNuée,
            idTableau,
            f: si(
              (x) =>
                !!x &&
                x.length >= 3 &&
                !!x.find((c) => c.id === idColonne1 && c.index),
            ),
          }),
        );

        const réf: InfoColonne[] = [
          { id: idColonne1, index: true },
          { id: idColonne2, variable: idVariable, index: true },
          { id: idColonne3 },
        ];
        expect(colonnes).to.have.deep.members(réf);

        const colonnesAvecSource = await obtenir<
          ValeurAscendance<InfoColonne>[]
        >(({ si }) =>
          constl.nuées.tableaux.suivreSourceColonnes({
            idStructure: idNuée,
            idTableau,
            f: si((x) => !!x && x.length >= 3),
          }),
        );

        const réfSource: ValeurAscendance<InfoColonne>[] = [
          { source: idNuéeParent, val: { id: idColonne1, index: true } },
          {
            source: idNuéeGrandParent,
            val: { id: idColonne2, variable: idVariable, index: true },
          },
          { source: idNuéeParent, val: { id: idColonne3 } },
        ];
        expect(colonnesAvecSource).to.have.deep.members(réfSource);
      });

      it("colonnes nuée", async () => {
        idColonne4 = await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuée,
          idTableau,
          index: true,
        });

        const colonnes = await obtenir<InfoColonne[]>(({ si }) =>
          constl.nuées.tableaux.suivreColonnes({
            idStructure: idNuée,
            idTableau,
            f: si(
              (x) =>
                !!x &&
                x.length >= 4 &&
                !!x.find((c) => c.id === idColonne1)?.index,
            ),
          }),
        );

        const réf: InfoColonne[] = [
          { id: idColonne1, index: true },
          { id: idColonne2, variable: idVariable, index: true },
          { id: idColonne3 },
          { id: idColonne4, index: true },
        ];
        expect(colonnes).to.have.deep.members(réf);

        const colonnesAvecSource = await obtenir<
          ValeurAscendance<InfoColonne>[]
        >(({ si }) =>
          constl.nuées.tableaux.suivreSourceColonnes({
            idStructure: idNuée,
            idTableau,
            f: si((x) => !!x && x.length >= 4),
          }),
        );

        const réfSource: ValeurAscendance<InfoColonne>[] = [
          { source: idNuéeParent, val: { id: idColonne1, index: true } },
          {
            source: idNuéeGrandParent,
            val: { id: idColonne2, variable: idVariable, index: true },
          },
          { source: idNuéeParent, val: { id: idColonne3 } },
          { source: idNuée, val: { id: idColonne4, index: true } },
        ];
        expect(colonnesAvecSource).to.have.deep.members(réfSource);
      });
    });

    describe("règles", function () {
      let idNuéeGrandParent: string;
      let idNuéeParent: string;
      let idNuée: string;

      let idTableau: string;
      let idColonne: string;

      let idRègleGrandParent: string;
      let idRègleParent: string;
      let idRègleNuée: string;

      const règleGrandParent: RègleBornes = {
        type: "bornes",
        détails: {
          type: "fixe",
          op: ">=",
          val: 0,
        },
      };

      const règleParent: RègleBornes = {
        type: "bornes",
        détails: {
          type: "fixe",
          op: "<=",
          val: 1000,
        },
      };

      const règleNuée: RègleBornes = {
        type: "bornes",
        détails: {
          type: "fixe",
          op: "<=",
          val: 500,
        },
      };

      before(async () => {
        idNuéeGrandParent = await constl.nuées.créerNuée();
        idNuéeParent = await constl.nuées.créerNuée({
          parent: idNuéeGrandParent,
        });
        idNuée = await constl.nuées.créerNuée({ parent: idNuéeParent });

        idTableau = await constl.nuées.ajouterTableau({
          idNuée: idNuéeGrandParent,
        });
        idColonne = await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuéeGrandParent,
          idTableau,
        });
      });

      it("rien pour commencer", async () => {
        const règles = await obtenir<RègleColonne[]>(({ siDéfini }) =>
          constl.nuées.tableaux.suivreRègles({
            idStructure: idNuée,
            idTableau,
            f: siDéfini(),
          }),
        );

        expect(règles).to.be.empty();
      });

      it("règles ascendance", async () => {
        idRègleGrandParent = await constl.nuées.tableaux.ajouterRègle({
          idStructure: idNuéeGrandParent,
          idTableau,
          idColonne,
          règle: règleGrandParent,
        });

        const règles = await obtenir<RègleColonne[]>(({ siPasVide }) =>
          constl.nuées.tableaux.suivreRègles({
            idStructure: idNuée,
            idTableau,
            f: siPasVide(),
          }),
        );

        const réf: RègleColonne[] = [
          {
            règle: { id: idRègleGrandParent, règle: règleGrandParent },
            source: {
              type: "tableau",
              idStructure: idNuéeGrandParent,
              idTableau,
            },
            colonne: idColonne,
          },
        ];
        expect(règles).to.have.deep.members(réf);
      });

      it("règles ascendance immédiate", async () => {
        idRègleParent = await constl.nuées.tableaux.ajouterRègle({
          idStructure: idNuéeParent,
          idTableau,
          idColonne,
          règle: règleParent,
        });

        const règles = await obtenir<RègleColonne[]>(({ si }) =>
          constl.nuées.tableaux.suivreRègles({
            idStructure: idNuée,
            idTableau,
            f: si((x) => !!x && x.length >= 2),
          }),
        );

        const réf: RègleColonne[] = [
          {
            règle: { id: idRègleGrandParent, règle: règleGrandParent },
            source: {
              type: "tableau",
              idStructure: idNuéeGrandParent,
              idTableau,
            },
            colonne: idColonne,
          },
          {
            règle: { id: idRègleParent, règle: règleParent },
            source: { type: "tableau", idStructure: idNuéeParent, idTableau },
            colonne: idColonne,
          },
        ];
        expect(règles).to.have.deep.members(réf);
      });

      it("règles nuée", async () => {
        idRègleNuée = await constl.nuées.tableaux.ajouterRègle({
          idStructure: idNuée,
          idTableau,
          idColonne,
          règle: règleNuée,
        });

        const règles = await obtenir<RègleColonne[]>(({ si }) =>
          constl.nuées.tableaux.suivreRègles({
            idStructure: idNuée,
            idTableau,
            f: si((x) => !!x && x.length >= 3),
          }),
        );

        const réf: RègleColonne[] = [
          {
            règle: { id: idRègleGrandParent, règle: règleGrandParent },
            source: {
              type: "tableau",
              idStructure: idNuéeGrandParent,
              idTableau,
            },
            colonne: idColonne,
          },
          {
            règle: { id: idRègleParent, règle: règleParent },
            source: { type: "tableau", idStructure: idNuéeParent, idTableau },
            colonne: idColonne,
          },
          {
            règle: { id: idRègleNuée, règle: règleNuée },
            source: { type: "tableau", idStructure: idNuée, idTableau },
            colonne: idColonne,
          },
        ];
        expect(règles).to.have.deep.members(réf);
      });

      it("règles variable", async () => {
        const idVariable = await constl.variables.créerVariable({
          catégorie: "numérique",
        });
        await constl.nuées.tableaux.modifierVariableColonne({
          idStructure: idNuéeGrandParent,
          idTableau,
          idColonne,
          idVariable,
        });

        // Donner une chance de se stabiliser pour s'assurer que la règle variable n'est pas dupliquée dans l'ascendance
        const stable = stabiliser(100);
        const règles = await obtenir<RègleColonne[]>(({ si }) =>
          constl.nuées.tableaux.suivreRègles({
            idStructure: idNuée,
            idTableau,
            f: stable(
              si((x) => !!x?.find((r) => r.source.type === "variable")),
            ),
          }),
        );

        const idRègleVariable = règles.find((r) => r.source.type === "variable")
          ?.règle.id as string;

        const réf: RègleColonne[] = [
          {
            règle: { id: idRègleGrandParent, règle: règleGrandParent },
            source: {
              type: "tableau",
              idStructure: idNuéeGrandParent,
              idTableau,
            },
            colonne: idColonne,
          },
          {
            règle: { id: idRègleParent, règle: règleParent },
            source: { type: "tableau", idStructure: idNuéeParent, idTableau },
            colonne: idColonne,
          },
          {
            règle: { id: idRègleNuée, règle: règleNuée },
            source: { type: "tableau", idStructure: idNuée, idTableau },
            colonne: idColonne,
          },
          {
            règle: {
              id: idRègleVariable,
              règle: {
                type: "catégorie",
                détails: {
                  catégorie: { type: "simple", catégorie: "numérique" },
                },
              },
            },
            source: { type: "variable", id: idVariable },
            colonne: idColonne,
          },
        ];
        expect(règles).to.have.deep.members(réf);
      });
    });

    describe("autorisations", function () {
      describe("nuée parent ouverte", function () {
        let idNuéeParent: string;
        let idNuée: string;

        let idBd: string;

        beforeEach(async () => {
          idNuéeParent = await constl.nuées.créerNuée({
            autorisation: "ouverte",
          });
          idNuée = await constl.nuées.créerNuée({ parent: idNuéeParent });

          idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });
        });

        it("autorisation héritée", async () => {
          await constl.nuées.bloquerCompte({
            idNuée: idNuéeParent,
            idCompte: idsComptes[1],
          });
          const autorisation = await obtenir<AutorisationNuée>(({ si }) =>
            constl.nuées.suivreAutorisation({
              idNuée,
              f: si((x) => x?.type === "ouverte" && x.bloqués.length > 0),
            }),
          );

          const réf: AutorisationNuée = {
            type: "ouverte",
            bloqués: [idsComptes[1]],
          };
          expect(autorisation).to.deep.equal(réf);
        });

        it("bloquer comptes ascendance immédiate", async () => {
          await constl.nuées.bloquerCompte({
            idNuée: idNuéeParent,
            idCompte: idsComptes[1],
          });

          const autorisée = await obtenir<boolean>(({ si }) =>
            constl.nuées.suivreAutorisationBd({
              idNuée,
              idBd,
              f: si((x) => x !== undefined && x !== true),
            }),
          );
          expect(autorisée).to.be.false();
        });

        it("bloquer comptes nuée", async () => {
          await constl.nuées.bloquerCompte({ idNuée, idCompte: idsComptes[1] });

          const autorisée = await obtenir<boolean>(({ si }) =>
            constl.nuées.suivreAutorisationBd({
              idNuée,
              idBd,
              f: si((x) => x !== undefined && x !== true),
            }),
          );
          expect(autorisée).to.be.false();
        });

        it("nuée enfant par invitation", async () => {
          await constl.nuées.modifierTypeAutorisation({
            idNuée,
            type: "par invitation",
          });

          const autorisée = await obtenir<boolean>(({ si }) =>
            constl.nuées.suivreAutorisationBd({
              idNuée,
              idBd,
              f: si((x) => x !== undefined && x !== true),
            }),
          );
          expect(autorisée).to.be.false();

          // On peut inviter des comptes sur la nuée enfant
          await constl.nuées.inviterCompte({ idNuée, idCompte: idsComptes[1] });

          const autoriséeAprèsInvitation = await obtenir<boolean>(({ si }) =>
            constl.nuées.suivreAutorisationBd({
              idNuée,
              idBd,
              f: si((x) => x !== undefined && x !== false),
            }),
          );
          expect(autoriséeAprèsInvitation).to.be.true();
        });
      });

      describe("par invitation", function () {
        let idNuéeParent: string;
        let idNuée: string;

        let idBd: string;

        beforeEach(async () => {
          idNuéeParent = await constl.nuées.créerNuée({
            autorisation: "par invitation",
          });
          idNuée = await constl.nuées.créerNuée({ parent: idNuéeParent });

          idBd = await constls[1].bds.créerBd({ licence: "ODbl-1_0" });
        });

        it("autorisation héritée", async () => {
          await constl.nuées.inviterCompte({
            idNuée: idNuéeParent,
            idCompte: idsComptes[1],
          });
          const autorisation = await obtenir<AutorisationNuée>(({ si }) =>
            constl.nuées.suivreAutorisation({
              idNuée,
              f: si(
                (x) => x?.type === "par invitation" && x.invités.length > 0,
              ),
            }),
          );

          const réf: AutorisationNuée = {
            type: "par invitation",
            invités: [idsComptes[1]],
          };
          expect(autorisation).to.deep.equal(réf);
        });

        it("inviter comptes ascendance immédiate", async () => {
          await constl.nuées.inviterCompte({
            idNuée: idNuéeParent,
            idCompte: idsComptes[1],
          });

          const autorisée = await obtenir<boolean>(({ siDéfini }) =>
            constl.nuées.suivreAutorisationBd({ idNuée, idBd, f: siDéfini() }),
          );
          expect(autorisée).to.be.true();
        });

        it("inviter comptes nuée", async () => {
          await constl.nuées.inviterCompte({ idNuée, idCompte: idsComptes[1] });

          const autorisée = await obtenir<boolean>(({ si }) =>
            constl.nuées.suivreAutorisationBd({
              idNuée,
              idBd,
              f: si((x) => x !== undefined && x !== false),
            }),
          );
          expect(autorisée).to.be.true();
        });

        it("nuée enfant ouverte", async () => {
          await constl.nuées.modifierTypeAutorisation({
            idNuée,
            type: "ouverte",
          });

          const autorisée = await obtenir<boolean>(({ si }) =>
            constl.nuées.suivreAutorisationBd({
              idNuée,
              idBd,
              f: si((x) => x !== undefined && x !== false),
            }),
          );
          expect(autorisée).to.be.true();

          // On peut bloquer des comptes sur la nuée enfant
          await constl.nuées.bloquerCompte({ idNuée, idCompte: idsComptes[1] });

          const autoriséeAprèsInvitation = await obtenir<boolean>(({ si }) =>
            constl.nuées.suivreAutorisationBd({
              idNuée,
              idBd,
              f: si((x) => x !== undefined && x !== true),
            }),
          );
          expect(autoriséeAprèsInvitation).to.be.false();
        });
      });
    });

    describe.skip("bds", function () {
      let idNuéeGrandParent: string;
      let idNuéeParent: string;
      let idNuée: string;
      let idNuéeSœure: string;
      let idNuéeEnfant: string;

      let idBdNuéeGrandParent: string;
      let idBdNuéeParent: string;
      let idBdNuée: string;
      let idBdNuéeSœure: string;
      let idBdNuéeEnfant: string;

      before(async () => {
        idNuéeGrandParent = await constl.nuées.créerNuée();
        idNuéeParent = await constl.nuées.créerNuée({
          parent: idNuéeGrandParent,
        });
        idNuée = await constl.nuées.créerNuée({ parent: idNuéeParent });
        idNuéeSœure = await constl.nuées.créerNuée({ parent: idNuéeParent });
        idNuéeEnfant = await constl.nuées.créerNuée({ parent: idNuée });

        const schémaGrandParent = await constl.nuées.créerSchémaDeNuée({
          idNuée: idNuéeGrandParent,
          licence: "ODbl-1_0",
        });
        idBdNuéeGrandParent = await constl.bds.créerBdDeSchéma({
          schéma: schémaGrandParent,
        });

        const schémaParent = await constl.nuées.créerSchémaDeNuée({
          idNuée: idNuéeParent,
          licence: "ODbl-1_0",
        });
        idBdNuéeParent = await constl.bds.créerBdDeSchéma({
          schéma: schémaParent,
        });

        const schéma = await constl.nuées.créerSchémaDeNuée({
          idNuée,
          licence: "ODbl-1_0",
        });
        idBdNuée = await constl.bds.créerBdDeSchéma({ schéma });

        const schémaSœure = await constl.nuées.créerSchémaDeNuée({
          idNuée: idNuéeSœure,
          licence: "ODbl-1_0",
        });
        idBdNuéeSœure = await constl.bds.créerBdDeSchéma({
          schéma: schémaSœure,
        });

        const schémaEnfant = await constl.nuées.créerSchémaDeNuée({
          idNuée: idNuéeEnfant,
          licence: "ODbl-1_0",
        });
        idBdNuéeEnfant = await constl.bds.créerBdDeSchéma({
          schéma: schémaEnfant,
        });
      });

      it("sans héritage", async () => {
        const bds = obtenir<string[]>(({ siPasVide }) =>
          constl.nuées.suivreBds({
            idNuée,
            f: siPasVide(),
            héritage: { ascendance: false, descendance: false },
          }),
        );

        expect(bds).to.have.members([idBdNuée]);
      });

      it("ascendance", async () => {
        const bds = obtenir<string[]>(({ siPasVide }) =>
          constl.nuées.suivreBds({
            idNuée,
            f: siPasVide(),
            héritage: { ascendance: true },
          }),
        );

        expect(bds).to.have.members([
          idBdNuée,
          idBdNuéeParent,
          idBdNuéeGrandParent,
        ]);
      });

      it("descendance", async () => {
        const bds = obtenir<string[]>(({ siPasVide }) =>
          constl.nuées.suivreBds({
            idNuée,
            f: siPasVide(),
            héritage: { descendance: true },
          }),
        );

        expect(bds).to.have.members([idBdNuée, idBdNuéeEnfant]);

        const bdsNuéeParent = obtenir<string[]>(({ siPasVide }) =>
          constl.nuées.suivreBds({
            idNuée: idNuéeParent,
            f: siPasVide(),
            héritage: { descendance: true },
          }),
        );

        expect(bdsNuéeParent).to.have.members([
          idBdNuéeParent,
          idBdNuée,
          idBdNuéeSœure,
          idBdNuéeEnfant,
        ]);
      });

      it("ascendance et descendance", async () => {
        const bds = obtenir<string[]>(({ siPasVide }) =>
          constl.nuées.suivreBds({
            idNuée,
            f: siPasVide(),
            héritage: { ascendance: true, descendance: true },
          }),
        );

        expect(bds).to.have.members([
          idBdNuée,
          idBdNuéeParent,
          idBdNuéeParent,
          idBdNuéeGrandParent,
        ]);
      });
    });

    describe.skip("données", function () {
      let idNuéeParent: string;
      let idNuée: string;
      let idNuéeEnfant: string;

      let idTableau: string;
      let idColonne: string;

      let idBdNuéeParent: string;
      let idBdNuée: string;
      let idBdNuéeEnfant: string;

      let élémentsPourNuéeParent: DonnéesRangéeNuée[];
      let élémentsPourNuée: DonnéesRangéeNuée[];
      let élémentsPourNuéeEnfant: DonnéesRangéeNuée[];

      before(async () => {
        idNuéeParent = await constl.nuées.créerNuée();
        idNuée = await constl.nuées.créerNuée({
          parent: idNuéeParent,
        });
        idNuéeEnfant = await constl.nuées.créerNuée({ parent: idNuée });

        idTableau = await constl.nuées.ajouterTableau({
          idNuée: idNuéeParent,
        });

        idColonne = await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuéeParent,
          idTableau,
        });

        const schémaParent = await constl.nuées.créerSchémaDeNuée({
          idNuée: idNuéeParent,
          licence: "ODbl-1_0",
        });
        idBdNuéeParent = await constl.bds.créerBdDeSchéma({
          schéma: schémaParent,
        });

        const schéma = await constl.nuées.créerSchémaDeNuée({
          idNuée,
          licence: "ODbl-1_0",
        });
        idBdNuée = await constl.bds.créerBdDeSchéma({ schéma });

        const schémaEnfant = await constl.nuées.créerSchémaDeNuée({
          idNuée: idNuéeEnfant,
          licence: "ODbl-1_0",
        });
        idBdNuéeEnfant = await constl.bds.créerBdDeSchéma({
          schéma: schémaEnfant,
        });

        const élémentsBdNuéeParent: ÉlémentDonnéesTableau[] = [
          {
            [idColonne]: 0,
          },
          {
            [idColonne]: 3,
          },
        ];
        const idsÉlémentsBdNuéeParent =
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBdNuéeParent,
            idTableau,
            éléments: élémentsBdNuéeParent,
          });
        élémentsPourNuéeParent = élémentsBdNuéeParent.map((élément, i) => ({
          idBd: idBdNuéeParent,
          données: { id: idsÉlémentsBdNuéeParent[i], données: élément },
        }));

        const élémentsBdNuée: ÉlémentDonnéesTableau[] = [
          {
            [idColonne]: 0,
          },
          {
            [idColonne]: 3,
          },
        ];
        const idsÉlémentsBdNuée = await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBdNuée,
          idTableau,
          éléments: élémentsBdNuée,
        });
        élémentsPourNuée = élémentsBdNuée.map((élément, i) => ({
          idBd: idBdNuée,
          données: { id: idsÉlémentsBdNuée[i], données: élément },
        }));

        const élémentsBdNuéeEnfant: ÉlémentDonnéesTableau[] = [
          {
            [idColonne]: 0,
          },
          {
            [idColonne]: 3,
          },
        ];
        const idsÉlémentsBdNuéeEnfant =
          await constl.bds.tableaux.ajouterÉléments({
            idStructure: idBdNuéeEnfant,
            idTableau,
            éléments: élémentsBdNuéeEnfant,
          });
        élémentsPourNuéeEnfant = élémentsBdNuéeEnfant.map((élément, i) => ({
          idBd: idBdNuéeEnfant,
          données: { id: idsÉlémentsBdNuéeEnfant[i], données: élément },
        }));
      });

      it("données nuée", async () => {
        const données = await obtenir<DonnéesRangéeNuée[]>(({ siPasVide }) =>
          constl.nuées.tableaux.suivreDonnées({
            idStructure: idNuée,
            idTableau,
            héritage: {},
            f: siPasVide(),
          }),
        );

        const réf: DonnéesRangéeNuée[] = élémentsPourNuée;
        expect(données).to.have.deep.members(réf);
      });

      it("données ascendance", async () => {
        const données = await obtenir<DonnéesRangéeNuée[]>(({ siPasVide }) =>
          constl.nuées.tableaux.suivreDonnées({
            idStructure: idNuée,
            idTableau,
            héritage: { ascendance: true },
            f: siPasVide(),
          }),
        );

        const réf: DonnéesRangéeNuée[] = [
          ...élémentsPourNuée,
          ...élémentsPourNuéeParent,
        ];
        expect(données).to.have.deep.members(réf);
      });

      it("données descendance", async () => {
        const données = await obtenir<DonnéesRangéeNuée[]>(({ siPasVide }) =>
          constl.nuées.tableaux.suivreDonnées({
            idStructure: idNuée,
            idTableau,
            héritage: { descendance: true },
            f: siPasVide(),
          }),
        );

        const réf: DonnéesRangéeNuée[] = [
          ...élémentsPourNuée,
          ...élémentsPourNuéeEnfant,
        ];
        expect(données).to.have.deep.members(réf);
      });

      it("données descendance et ascendance", async () => {
        const données = await obtenir<DonnéesRangéeNuée[]>(({ siPasVide }) =>
          constl.nuées.tableaux.suivreDonnées({
            idStructure: idNuée,
            idTableau,
            héritage: { descendance: true, ascendance: true },
            f: siPasVide(),
          }),
        );

        const réf: DonnéesRangéeNuée[] = [
          ...élémentsPourNuéeParent,
          ...élémentsPourNuée,
          ...élémentsPourNuéeEnfant,
        ];
        expect(données).to.have.deep.members(réf);
      });

      it("données locales même si nuée parent non disponible", async () => {
        const idNuéeIndisponible =
          "/constl/nuée/orbitdb/zdpuAximNmZyUWXGCaLmwSEGDeWmuqfgaoogA7KNSa1B2DAAF";
        await constl.nuées.préciserParent({
          idNuée: idNuéeParent,
          idNuéeParent: idNuéeIndisponible,
        });

        const données = await obtenir<DonnéesRangéeNuée[]>(({ siPasVide }) =>
          constl.nuées.tableaux.suivreDonnées({
            idStructure: idNuéeParent,
            idTableau,
            héritage: { descendance: true, ascendance: true },
            f: siPasVide(),
          }),
        );

        const réf: DonnéesRangéeNuée[] = [
          ...élémentsPourNuéeParent,
          ...élémentsPourNuée,
          ...élémentsPourNuéeEnfant,
        ];
        expect(données).to.have.deep.members(réf);
      });
    });
  });

  describe("score", function () {
    let idNuée: string;
    let idTableau: string;
    let idVarNumérique: string;
    let idVarChaîne: string;
    let idVarNumérique2: string;

    let idColNumérique: string;
    let idColNumérique2: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
      idTableau = await constl.nuées.ajouterTableau({ idNuée });

      idVarNumérique = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      idVarNumérique2 = await constl.variables.créerVariable({
        catégorie: "numérique",
      });
      idVarChaîne = await constl.variables.créerVariable({
        catégorie: "chaîneNonTraductible",
      });
    });

    describe("score couverture tests", function () {
      it("`undefined` lorsque aucune colonne", async () => {
        const score = await obtenir<ScoreNuée>(({ siDéfini }) =>
          constl.nuées.suivreScoreQualité({
            idNuée,
            f: siDéfini(),
          }),
        );
        expect(score.couverture).to.be.undefined();
      });

      it("ajout de colonnes", async () => {
        idColNumérique = await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuée,
          idTableau,
          idVariable: idVarNumérique,
        });
        idColNumérique2 = await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuée,
          idTableau,
          idVariable: idVarNumérique2,
        });
        await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuée,
          idTableau,
          idVariable: idVarChaîne,
        });
        const score = await obtenir<ScoreNuée>(({ si }) =>
          constl.nuées.suivreScoreQualité({
            idNuée,
            f: si((s) => s?.couverture !== undefined),
          }),
        );
        expect(score.couverture).to.equal(0);
      });

      it("ajout de règles", async () => {
        const règleNumérique: RègleBornes = {
          type: "bornes",
          détails: { type: "fixe", val: 0, op: ">=" },
        };
        await constl.nuées.tableaux.ajouterRègle({
          idStructure: idNuée,
          idTableau,
          idColonne: idColNumérique,
          règle: règleNumérique,
        });
        let score = await obtenir<ScoreNuée>(({ si }) =>
          constl.nuées.suivreScoreQualité({
            idNuée,
            f: si(
              (s) =>
                !!s && !!s.couverture && s.couverture > 0 && s.couverture < 1,
            ),
          }),
        );
        expect(score.couverture).to.equal(0.5);

        await constl.nuées.tableaux.ajouterRègle({
          idStructure: idNuée,
          idTableau,
          idColonne: idColNumérique2,
          règle: règleNumérique,
        });
        score = await obtenir<ScoreNuée>(({ si }) =>
          constl.nuées.suivreScoreQualité({
            idNuée,
            f: si((s) => !!s && !!s.couverture && s.couverture > 0.5),
          }),
        );
        expect(score.couverture).to.equal(1);
      });
    });

    describe("score infos", function () {
      it("0 pour commencer", async () => {
        const score = await obtenir<ScoreNuée>(({ si }) =>
          constl.nuées.suivreScoreQualité({
            idNuée,
            f: si((x) => x?.infos !== undefined),
          }),
        );
        expect(score.infos).to.equal(0);
      });

      it("ajout noms", async () => {
        await constl.nuées.sauvegarderNoms({
          idNuée,
          noms: { fra: "Science citoyenne" },
        });
        const score = await obtenir<ScoreNuée>(({ si }) =>
          constl.nuées.suivreScoreQualité({
            idNuée,
            f: si((s) => s?.infos !== undefined && s.infos > 0),
          }),
        );
        expect(score.infos).to.equal(0.5);
      });

      it("ajout descriptions", async () => {
        await constl.nuées.sauvegarderDescriptions({
          idNuée,
          descriptions: { fra: "Science citoyenne" },
        });
        const score = await obtenir<ScoreNuée>(({ si }) =>
          constl.nuées.suivreScoreQualité({
            idNuée,
            f: si((s) => s?.infos !== undefined && s.infos > 0.5),
          }),
        );
        expect(score.infos).to.equal(1);
      });
    });

    describe("score total", function () {
      it("calcul du score total", async () => {
        const score = await obtenir<ScoreNuée>(({ si }) =>
          constl.nuées.suivreScoreQualité({
            idNuée,
            f: si((x) => x !== undefined && !isNaN(x.total)),
          }),
        );
        const total = moyenne([score.accès, score.couverture, score.infos]);
        expect(score.total).to.equal(total);
      });
    });
  });

  describe("auteurs", function () {
    let idNuée: string;

    const accepté = (idCompte: string) => (auteurs?: InfoAuteur[]) =>
      !!auteurs?.find((a) => a.idCompte === idCompte && a.accepté);
    let compte1Accepté: (auteurs?: InfoAuteur[]) => boolean;
    let compte2Accepté: (auteurs?: InfoAuteur[]) => boolean;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();

      compte1Accepté = accepté(idsComptes[0]);
      compte2Accepté = accepté(idsComptes[1]);
    });

    it("compte créateur autorisé pour commencer", async () => {
      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
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
      await constl.nuées.confirmerPermission({ idNuée });
    });

    it("confirmer permission - compte non autorisé", async () => {
      await expect(
        constls[1].nuées.confirmerPermission({ idNuée }),
      ).to.eventually.be.rejectedWith("Permission de modification refusée");
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
      await constls[1].nuées.ajouterÀMesNuées({ idNuée });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
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
        constls[1].nuées.suivrePermission({ idObjet: idNuée, f: siDéfini() }),
      );

      // Modification de la nuée
      await constls[1].nuées.sauvegarderNom({
        idNuée,
        langue: "fra",
        nom: "Pédologie",
      });
      const noms = await obtenir(({ siPasVide }) =>
        constls[0].nuées.suivreNoms({ idNuée, f: siPasVide() }),
      );
      expect(noms).to.deep.equal({ fra: "Pédologie" });
    });

    it("promotion à modératrice", async () => {
      await constl.nuées.inviterAuteur({
        idNuée,
        idCompte: idsComptes[1],
        rôle: MODÉRATRICE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
          f: si(
            (x) =>
              !!x &&
              x.find((a) => a.idCompte === idsComptes[1])?.rôle ===
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
      await constl.nuées.inviterAuteur({
        idNuée,
        idCompte: compteHorsLigne,
        rôle: MEMBRE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
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

  describe.skip("exportation", function () {
    let idc: string;

    const idcIndisponible =
      "QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n/fichier.mp4";

    before(async () => {
      const octets = await obtRessourceTest({
        nomFichier: "logo.svg",
      });
      idc = await constl.services["hélia"].ajouterFichierÀSFIP({
        contenu: octets,
        nomFichier: "logo.svg",
      });
    });

    describe("suivi données exportation", function () {
      let idNuée: string;
      let idTableau1: string;
      let idTableau2: string;
      let idColFichier: string;
      let idBd: string;

      let schéma: SchémaBd;

      const nomNuéeFr = "mon projet de science citoyenne";
      const nomTableau1 = "Tableau 1";

      before(async () => {
        idNuée = await constl.nuées.créerNuée();
        idTableau1 = await constl.nuées.ajouterTableau({ idNuée });
        idTableau2 = await constl.nuées.ajouterTableau({ idNuée });

        idColFichier = await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuée,
          idTableau: idTableau1,
        });

        schéma = await constl.nuées.créerSchémaDeNuée({
          idNuée,
          licence: "ODbl-1_0",
        });
        idBd = await constl.bds.créerBdDeSchéma({ schéma });
      });

      it("noms nuée", async () => {
        const pDonnées = obtenir<DonnéesBdExportées>(({ si }) =>
          constl.nuées.suivreDonnéesExportation({
            idNuée,
            langues: ["fra"],
            f: si((x) => !!x && !idNuée.includes(x.nomBd)),
          }),
        );

        await constl.nuées.sauvegarderNom({
          idNuée,
          langue: "fra",
          nom: nomNuéeFr,
        });

        const données = await pDonnées;
        expect(données.nomBd).to.equal(nomNuéeFr);
      });

      it("tableaux", async () => {
        const données = await obtenir<DonnéesBdExportées>(({ si }) =>
          constl.nuées.suivreDonnéesExportation({
            idNuée,
            langues: ["fra"],
            f: si((x) => !!x && x.tableaux.length >= 2),
          }),
        );

        expect(
          données.tableaux.map((t) => t.nomTableau),
        ).to.have.ordered.members([idTableau1, idTableau2]);
      });

      it("noms tableaux", async () => {
        const pDonnées = obtenir<DonnéesBdExportées>(({ si }) =>
          constl.nuées.suivreDonnéesExportation({
            idNuée,
            langues: ["fra"],
            f: si(
              (x) =>
                !!x?.tableaux.map((t) => t.nomTableau).includes(nomTableau1),
            ),
          }),
        );

        await constl.nuées.tableaux.sauvegarderNoms({
          idStructure: idNuée,
          idTableau: idTableau1,
          noms: {
            fra: nomTableau1,
          },
        });

        const données = await pDonnées;
        expect(
          données.tableaux.map((t) => t.nomTableau),
        ).to.have.ordered.members([nomTableau1, idTableau2]);
      });

      it("données", async () => {
        const pDonnées = obtenir<DonnéesBdExportées>(({ si }) =>
          constl.nuées.suivreDonnéesExportation({
            idNuée,
            langues: ["fra"],
            f: si(
              (x) =>
                !!x?.tableaux.map((t) => t.nomTableau).includes(nomTableau1),
            ),
          }),
        );

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau: idTableau1,
          éléments: [
            {
              [idColFichier]: idc,
            },
          ],
        });

        const données = await pDonnées;
        expect(
          données.tableaux.find((t) => t.nomTableau === nomTableau1)?.données,
        ).to.deep.equal([
          {
            [idColFichier]: idc,
          },
        ]);
      });

      it("nuée non disponible", async () => {
        const idNuéeIndisponible =
          "/constl/nuée/orbitdb/zdpuAximNmZyUWXGCaLmwSEGDeWmuqfgaoogA7KNSa1B2DAAF";
        const schémaAvecNuéeIndisponible: SchémaBd = Object.assign({}, schéma, {
          nuées: [...(schéma.nuées || []), idNuéeIndisponible],
        });
        const idBdNuéeIndisponible = await constl.bds.créerBdDeSchéma({
          schéma: schémaAvecNuéeIndisponible,
        });

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBdNuéeIndisponible,
          idTableau: idTableau1,
          éléments: [
            {
              [idColFichier]: idc,
            },
          ],
        });

        const donnéesDeNuéeIndisponible = await obtenir<DonnéesBdExportées>(
          ({ siDéfini }) =>
            constl.nuées.suivreDonnéesExportation({
              idNuée: idNuéeIndisponible,
              langues: ["fra"],
              f: siDéfini(),
              idsTableaux: [idTableau1, idTableau2], // Nécessaire si la nuée n'est pas disponible
            }),
        );

        expect(
          donnéesDeNuéeIndisponible.tableaux.map((t) => t.nomTableau),
        ).to.have.ordered.members([idTableau1, idTableau2]);

        expect(
          donnéesDeNuéeIndisponible.tableaux[1].données,
        ).to.have.deep.members([
          {
            [idColFichier]: idc,
          },
        ]);
      });
    });

    describe("à document", function () {
      let idNuée: string;
      let idBd: string;
      let idTableau1: string;
      let idTableau2: string;

      let idColonneFichier: string;
      let idColonneNumérique: string;

      let données: DonnéesFichierBdExportées;

      const nomTableau1 = "Tableau 1";

      before(async () => {
        idNuée = await constl.nuées.créerNuée();
        idTableau1 = await constl.nuées.ajouterTableau({ idNuée });
        idTableau2 = await constl.nuées.ajouterTableau({ idNuée });

        await constl.nuées.tableaux.sauvegarderNoms({
          idStructure: idNuée,
          idTableau: idTableau1,
          noms: {
            fra: nomTableau1,
          },
        });

        idColonneFichier = await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuée,
          idTableau: idTableau1,
        });

        idColonneNumérique = await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuée,
          idTableau: idTableau2,
        });

        const schéma = await constl.nuées.créerSchémaDeNuée({
          idNuée,
          licence: "ODbl-1_0",
        });
        idBd = await constl.bds.créerBdDeSchéma({ schéma });

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau: idTableau1,
          éléments: [{ [idColonneFichier]: idc, [idColonneNumérique]: 123 }],
        });

        données = await constl.nuées.exporterDonnées({ idNuée });
      });

      it("nom document - spécifié", async () => {
        const donnéesAvecNom = await constl.nuées.exporterDonnées({
          idNuée,
          nomFichier: "mon fichier",
        });
        expect(donnéesAvecNom.nomFichier).to.equal("mon fichier");
      });

      it("nom document - non spécifié", async () => {
        expect(données.nomFichier).to.equal(enleverPréfixesEtOrbite(idNuée));
      });

      it("données - tableaux créés", async () => {
        expect(Array.isArray(données.docu.SheetNames));
        expect(données.docu.SheetNames).to.have.members([
          nomTableau1,
          idTableau2,
        ]);
      });

      it("données - fichiers SFIP", async () => {
        expect([...données.documentsMédias]).to.have.members([idc]);
      });

      it("exportable même si fichier indisponible", async () => {
        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau: idTableau1,
          éléments: [
            {
              [idColonneFichier]: idcIndisponible,
            },
          ],
        });

        const { documentsMédias } = await constl.nuées.exporterDonnées({
          idNuée,
          langues: ["fra"],
        });
        expect(documentsMédias).to.have.members([idc, idcIndisponible]);
      });

      it("exportable même si nuée indisponible", async () => {
        const schéma = await constl.nuées.créerSchémaDeNuée({
          idNuée,
          licence: "ODbl-1_0",
        });
        const idNuéeNExistePas =
          "/constl/nuée/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX"; // N'existe pas
        schéma.nuées = [idNuéeNExistePas];

        idBd = await constl.bds.créerBdDeSchéma({ schéma });
        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau: idTableau2,
          éléments: [
            {
              [idColonneNumérique]: 123,
            },
          ],
        });

        const { docu, nomFichier } = await constl.nuées.exporterDonnées({
          idNuée: idNuéeNExistePas,
          langues: ["fra"],
          idsTableaux: [idTableau2],
        });
        expect(docu.SheetNames).to.have.members([idTableau2]);
        expect(nomFichier).to.eq(enleverPréfixesEtOrbite(idNuéeNExistePas));
      });
    });

    describe("à fichier", function () {
      let idNuée: string;
      let idBd: string;
      let idTableau: string;
      let idColonne: string;

      let zip: JSZip;

      let dossier: string;
      let effacer: () => void;

      const nomTableauFr = "voici un tableau";
      const nomFichier = "mes données";

      before(async () => {
        ({ dossier, effacer } = await dossierTempo());

        idNuée = await constl.nuées.créerNuée();
        idTableau = await constl.nuées.ajouterTableau({ idNuée });

        await constl.nuées.tableaux.sauvegarderNom({
          idStructure: idNuée,
          idTableau,
          langue: "fra",
          nom: nomTableauFr,
        });

        idColonne = await constl.nuées.tableaux.ajouterColonne({
          idStructure: idNuée,
          idTableau,
        });

        const schéma = await constl.nuées.créerSchémaDeNuée({
          idNuée,
          licence: "ODbl-1_0",
        });
        idBd = await constl.bds.créerBdDeSchéma({ schéma });
        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments: [{ [idColonne]: idc }],
        });
      });

      after(async () => {
        if (effacer) effacer();
      });

      it("le fichier zip existe", async () => {
        if (isBrowser || isElectronRenderer) {
          await expect(
            constl.nuées.exporterÀFichier({
              idNuée,
              nomFichier,
              dossier,
              formatDocu: "ods",
            }),
          ).to.eventually.be.rejectedWith("showSaveFilePicker");
        } else {
          await constl.nuées.exporterÀFichier({
            idNuée,
            nomFichier,
            dossier,
            formatDocu: "ods",
          });

          const nomZip = join(dossier, nomFichier + ".zip");
          expect(existsSync(nomZip)).to.be.true();
          zip = await JSZip.loadAsync(readFileSync(nomZip));
        }
      });

      it("les données sont exportées", async () => {
        if (isBrowser || isElectronRenderer) return;
        const contenu = zip.files[nomFichier + ".ods"];
        expect(contenu).to.exist();
      });

      it("le dossier pour les données SFIP existe", async () => {
        if (isBrowser || isElectronRenderer) return;
        const contenu = zip.files["médias/"];
        expect(contenu?.dir).to.be.true();
      });

      it("les fichiers des médias existent", async () => {
        if (isBrowser || isElectronRenderer) return;
        const contenu = zip.files[["médias", idc.replace("/", "-")].join("/")];
        expect(contenu).to.exist();

        const contenuFichier =
          zip.files[["médias", idc.replace("/", "-")].join("/")];
        expect(contenuFichier).to.exist();
      });

      it("fichier des médias non disponible", async () => {
        if (isBrowser || isElectronRenderer) return;
        const nomFichierTest = "nuée avec documents indisponibles";

        await constl.bds.tableaux.ajouterÉléments({
          idStructure: idBd,
          idTableau,
          éléments: [{ [idColonne]: idcIndisponible }],
        });

        await constl.nuées.exporterÀFichier({
          idNuée,
          nomFichier: nomFichierTest,
          dossier,
          formatDocu: "ods",
        });

        const nomZip = join(dossier, nomFichierTest + ".zip");
        zip = await JSZip.loadAsync(readFileSync(nomZip));

        const contenu = zip.files[["médias", idc.replace("/", "-")].join("/")];
        expect(contenu).to.exist();

        const contenuIndisponible =
          zip.files[["médias", idcIndisponible.replace("/", "-")].join("/")];
        expect(contenuIndisponible).to.not.exist();
      });
    });
  });
});
