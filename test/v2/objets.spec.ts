import { expect } from "aegir/chai";
import { isValidAddress } from "@orbitdb/core";
import {
  MEMBRE,
  MODÉRATRICE,
} from "@/v2/nébuleuse/services/compte/accès/index.js";
import { ObjetConstellation, schémaServiceObjet } from "@/v2/objets.js";
import { CONFIANCE_DE_COAUTEUR } from "@/v2/nébuleuse/services/consts.js";
import { obtenir } from "./utils.js";
import { créerNébuleusesTest } from "./nébuleuse/utils.js";
import type {
  ServicesNécessairesObjet,
  StructureServiceObjet,
} from "@/v2/objets.js";
import type { Nébuleuse, ServiceCompte } from "@/v2/nébuleuse/index.js";
import type { InfoAuteur, PartielRécursif } from "@/v2/types.js";
import type { JSONSchemaType } from "ajv";
import type { TypedNested } from "@constl/bohr-db";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type { RelationImmédiate } from "@/v2/nébuleuse/services/réseau.js";
import type { OptionsAppli } from "@/v2/nébuleuse/appli/appli.js";

describe.only("Objets", function () {
  let fermer: () => Promise<void>;
  let nébuleuses: Nébuleuse<
    { objetTest: StructureServiceObjet },
    { objetTest: ServiceObjetTest }
  >[];
  let nébuleuse: Nébuleuse<
    { objetTest: StructureServiceObjet },
    { objetTest: ServiceObjetTest }
  >;
  let compte: ServiceCompte;
  let serviceObjetTest: ServiceObjetTest;

  let idsComptes: string[];

  type StructureObjet = { a: number };

  const protocole = "objetTest" as const;
  const schémaObjetTest: JSONSchemaType<PartielRécursif<StructureObjet>> & {
    nullable: true;
  } = {
    type: "object",
    properties: {
      a: {
        type: "number",
        nullable: true,
      },
    },
    required: [],
    nullable: true,
  };

  class ServiceObjetTest extends ObjetConstellation<
    typeof protocole,
    StructureObjet,
    ServicesNécessairesObjet<typeof protocole>
  > {
    schémaObjet = schémaObjetTest;

    constructor({
      services,
      options,
    }: {
      services: ServicesNécessairesObjet<typeof protocole>;
      options: OptionsAppli;
    }) {
      super({
        clef: protocole,
        services,
        dépendances: [],
        options,
      });
    }

    async créerObjet(): Promise<string> {
      const compte = this.service("compte");
      const { bd, oublier: oublierBd } = await compte.créerObjet({
        type: "nested",
      });
      const idObjet = bd.address;
      await oublierBd();

      return this.ajouterProtocole(idObjet);
    }
  }

  before("préparer constls", async () => {
    ({ fermer, nébuleuses } = await créerNébuleusesTest<
      { objetTest: StructureServiceObjet },
      { objetTest: ServiceObjetTest }
    >({
      n: 2,
      services: {
        objetTest: ({ options, services }) =>
          new ServiceObjetTest({ options, services }),
      },
      options: {
        services: {
          compte: {
            schéma: {
              type: "object",
              properties: { [protocole]: schémaServiceObjet },
              nullable: true,
            },
          },
        },
      },
    }));
    nébuleuse = nébuleuses[0];
    compte = nébuleuse.compte;
    serviceObjetTest = nébuleuse.services.objetTest;

    idsComptes = await Promise.all(
      nébuleuses.map((c) => c.compte.obtIdCompte()),
    );
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("protocoles", function () {
    const racine = "zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX";
    it("ajouter protocole", async () => {
      const adresse = nébuleuse.services.objetTest.ajouterProtocole(racine);
      expect(adresse).to.equal(`/constl/${protocole}/orbitdb/${racine}`);
    });

    it("ajouter protocole - orbite existe déjà", async () => {
      const adresse = nébuleuse.services.objetTest.ajouterProtocole(
        `/orbitdb/${racine}`,
      );
      expect(adresse).to.equal(`/constl/${protocole}/orbitdb/${racine}`);
    });

    it("ajouter protocole - existe déjà", async () => {
      const adresse = nébuleuse.services.objetTest.ajouterProtocole(
        `/constl/${protocole}/orbitdb/${racine}`,
      );
      expect(adresse).to.equal(`/constl/${protocole}/orbitdb/${racine}`);
    });

    it("enlever protocole", async () => {
      const adresse = nébuleuse.services.objetTest.enleverProtocole(
        `/constl/${protocole}/orbitdb/${racine}`,
      );
      expect(adresse).to.equal(racine);
    });

    it("enlever protocole - avec uniquement orbite", async () => {
      const adresse = nébuleuse.services.objetTest.enleverProtocole(
        `/orbitdb/${racine}`,
      );
      expect(adresse).to.equal(racine);
    });

    it("enlever protocole - déjà enlevé", async () => {
      const adresse = nébuleuse.services.objetTest.enleverProtocole(racine);
      expect(adresse).to.equal(racine);
    });

    it("identifiant valide", async () => {
      const valide = nébuleuse.services.objetTest.identifiantValide(
        `/constl/${protocole}/orbitdb/${racine}`,
      );
      expect(valide).to.be.true();
    });

    it("identifiant valide - sans protocole", async () => {
      const valide = nébuleuse.services.objetTest.identifiantValide(
        `/orbitdb/${racine}`,
      );
      expect(valide).to.be.false();
    });

    it("identifiant valide - sans orbite", async () => {
      const valide = nébuleuse.services.objetTest.identifiantValide(
        `${racine}`,
      );
      expect(valide).to.be.false();
    });
  });

  describe("mes objets", function () {
    let idObjet: string;

    it("vide pour commencer", async () => {
      const mesObjets = await obtenir(({ siDéfini }) =>
        nébuleuse.services.objetTest.suivreObjets({
          f: siDéfini(),
        }),
      );
      expect(mesObjets).to.be.empty();
    });

    it("ajouter à mes objets", async () => {
      idObjet = await nébuleuse.services.objetTest.créerObjet();
      await nébuleuse.services.objetTest.ajouterÀMesObjets({ idObjet });

      const mesObjets = await obtenir(({ siPasVide }) =>
        nébuleuse.services.objetTest.suivreObjets({
          f: siPasVide(),
        }),
      );
      expect(mesObjets).to.deep.equal([idObjet]);
    });

    it("enlever de mes objets", async () => {
      await nébuleuse.services.objetTest.enleverDeMesObjets({ idObjet });

      const mesObjets = await obtenir(({ siVide }) =>
        nébuleuse.services.objetTest.suivreObjets({
          f: siVide(),
        }),
      );
      expect(mesObjets).to.be.empty();
    });
  });

  describe("objet", function () {
    let idObjet: string;
    let objet: TypedNested<StructureObjet>;
    let oublier: Oublier;

    before(async () => {
      idObjet = await nébuleuse.services.objetTest.créerObjet();
    });

    after(async () => {
      if (oublier) await oublier();
    });

    it("ouvrir objet", async () => {
      ({ objet, oublier } = await nébuleuse.services.objetTest.ouvrirObjet({
        idObjet,
      }));
      expect(isValidAddress(objet.address)).to.be.true();
    });

    it("suivre objet", async () => {
      const promesseDonnéesObjet = obtenir<PartielRécursif<StructureObjet>>(
        ({ siPasVide }) =>
          nébuleuse.services.objetTest.suivreObjet({ idObjet, f: siPasVide() }),
      );
      await objet.put("a", 2);

      const donnéesObjet = await promesseDonnéesObjet;
      expect(donnéesObjet).to.deep.equal({ a: 2 });
    });
  });

  describe("auteurs", function () {
    let idObjet: string;

    before(async () => {
      idObjet = await nébuleuse.services.objetTest.créerObjet();
      await nébuleuse.services.objetTest.ajouterÀMesObjets({ idObjet });
    });

    it("compte créateur autorisé pour commencer", async () => {
      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        serviceObjetTest.suivreAuteursObjet({
          idObjet,
          f: si((x) => !!x?.find((a) => a.accepté)),
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
      await serviceObjetTest.donnerAccèsObjet({
        idObjet,
        identité: idsComptes[1],
        rôle: MEMBRE,
      });
      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        serviceObjetTest.suivreAuteursObjet({
          idObjet,
          f: si(
            (x) =>
              !!x &&
              x.length > 1 &&
              !!x.find((a) => a.idCompte === idsComptes[0])?.accepté,
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
          accepté: false,
          rôle: MEMBRE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });

    it("acceptation invitation", async () => {
      await nébuleuses[1].services.objetTest.ajouterÀMesObjets({ idObjet });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        serviceObjetTest.suivreAuteursObjet({
          idObjet,
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

    it("modification par le nouvel auteur", async () => {
      await obtenir(({ siDéfini }) =>
        nébuleuses[1].compte.suivrePermission({
          idObjet: serviceObjetTest.àIdOrbite(idObjet),
          f: siDéfini(),
        }),
      );

      // Modification de l'objet
      const { objet, oublier } =
        await nébuleuses[1].services.objetTest.ouvrirObjet({ idObjet });
      await objet.put("a", 1);

      const données = await obtenir(({ siPasVide }) =>
        serviceObjetTest.suivreObjet({ idObjet, f: siPasVide() }),
      );
      await oublier();
      expect(données).to.deep.equal({ a: 1 });
    });

    it("promotion à modératrice", async () => {
      await serviceObjetTest.donnerAccèsObjet({
        idObjet,
        identité: idsComptes[1],
        rôle: MODÉRATRICE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        serviceObjetTest.suivreAuteursObjet({
          idObjet,
          f: si(
            (x) =>
              !!x &&
              x.find((a) => a.idCompte === idsComptes[1])?.rôle === MODÉRATRICE &&
              x.every(a=>a.accepté),
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

        await serviceObjetTest.donnerAccèsObjet({
        idObjet,
        identité: compteHorsLigne,
        rôle: MEMBRE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        serviceObjetTest.suivreAuteursObjet({
          idObjet,
          f: si((x) => !!x?.find((a) => a.idCompte === compteHorsLigne) && x.reduce((a, b)=> Number(b.accepté) + a, 0) === 2),
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

  describe("confiance", function () {
    let idObjet: string;

    before(async () => {
      idObjet = await nébuleuse.services.objetTest.créerObjet();
    });

    it("de coauteurs", async () => {
      const promesseRelations = obtenir<RelationImmédiate[]>(({ si }) =>
        nébuleuse.services.objetTest.résolutionConfiance({
          de: idsComptes[0],
          f: si(x=>!!x && x.length > 1),
        }),
      );
      await serviceObjetTest.donnerAccèsObjet({
        idObjet,
        identité: idsComptes[1],
        rôle: MEMBRE,
      });
      const relations = await promesseRelations;

      const réf: RelationImmédiate[] = [
        {
          idCompte: idsComptes[0],
          confiance: CONFIANCE_DE_COAUTEUR,
        },
        {
          idCompte: idsComptes[1],
          confiance: CONFIANCE_DE_COAUTEUR,
        },
      ];
      expect(relations).to.deep.equal(réf);
    });
  });
});
