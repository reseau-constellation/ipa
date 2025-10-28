import { expect } from "aegir/chai";
import { ServicesLibp2pTest, dossierTempo } from "@constl/utils-tests";
import { NestedObjectToMap, NestedValueObject } from "@orbitdb/nested-db";
import { adresseOrbiteValide } from "@constl/utils-ipa";
import { TypedNested } from "@constl/bohr-db";
import {
  ServiceCompte,
  ServiceHélia,
  ServiceOrbite,
  ServiceStockage,
} from "@/v2/crabe/index.js";
import {
  ServicesNécessairesCompte,
  compilerSchémaCompte,
} from "@/v2/crabe/services/compte/compte.js";
import { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import { ServiceDonnéesNébuleuse } from "@/v2/crabe/services/services.js";
import { PartielRécursif } from "@/v2/types.js";
import { ServiceJournal } from "@/v2/crabe/services/journal.js";
import { MODÉRATRICE } from "@/v2/crabe/services/compte/accès/consts.js";
import { Oublier } from "@/v2/crabe/types.js";
import { StructureCrabe } from "@/v2/crabe/crabe.js";
import {
  StructureDispositifs,
  schémaDispositifs,
} from "@/v2/crabe/services/dispositifs.js";
import { StructureProfil, schémaProfil } from "@/v2/crabe/services/profil.js";
import { StructureRéseau, schémaRéseau } from "@/v2/crabe/services/réseau.js";
import { mapÀObjet } from "@/v2/crabe/utils.js";
import { obtenir } from "../../../../utils/utils.js";
import { ServiceLibp2pTest } from "../utils.js";
import { CrabeTest, créerCrabesTest } from "../../utils.js";
import { attendreInvité } from "./../../../utils.js";
import type { JSONSchemaType } from "ajv";

describe.only("Service Compte", function () {
  describe("gestion compte", async () => {
    let nébuleuse: Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempo());
      nébuleuse = new Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>({
        services: {
          journal: ServiceJournal,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
          orbite: ServiceOrbite,
          compte: ServiceCompte,
        },
        options: {
          dossier,
        },
      });
      await nébuleuse.démarrer();
    });

    after(async () => {
      await nébuleuse.fermer();
      effacer();
    });

    it("obtenir id libp2p", async () => {
      const idLibp2p = await nébuleuse.services.compte.obtIdLibp2p();
      expect(idLibp2p).to.be.a("string");
    });

    it("obtenir id dispositif", async () => {
      const idDispositif = await nébuleuse.services.compte.obtIdDispositif();
      expect(idDispositif).to.be.a("string");
    });

    it("obtenir id compte", async () => {
      const idCompte = await nébuleuse.services.compte.obtIdCompte();
      expect(idCompte).to.be.a("string");
    });

    it("persistence id compte lorsque redémarré", async () => {
      const idCompte = await nébuleuse.services.compte.obtIdCompte();

      await nébuleuse.fermer();
      nébuleuse = new Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>({
        services: {
          journal: ServiceJournal,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
          orbite: ServiceOrbite,
          compte: ServiceCompte,
        },
        options: {
          dossier,
        },
      });
      await nébuleuse.démarrer();

      const nouvelIdCompte = await nébuleuse.services.compte.obtIdCompte();
      expect(nouvelIdCompte).to.equal(idCompte);
    });

    it("suivre id compte", async () => {
      const serviceCompte = nébuleuse.services["compte"];
      const idCompte = await obtenir<string>(({ siDéfini }) =>
        serviceCompte.suivreIdCompte({ f: siDéfini() }),
      );
      expect(idCompte).to.equal(await nébuleuse.services.compte.obtIdCompte());
    });
  });

  describe("structure compte vide", function () {
    let nébuleuse: Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempo());
      nébuleuse = new Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>({
        services: {
          journal: ServiceJournal,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
          orbite: ServiceOrbite,
          compte: ServiceCompte,
        },
        options: {
          dossier,
        },
      });
      await nébuleuse.démarrer();
    });

    after(async () => {
      await nébuleuse.fermer();
      effacer();
    });

    it("erreur lors d'accès données", async () => {
      const bd = await nébuleuse.services["compte"].bd();

      // @ts-expect-error La structure est vide
      expect(bd.set("données", 1)).to.eventually.be.rejectedWith(
        "Unsupported key",
      );
    });
  });

  describe("structure compte", function () {
    type StructureTest = { test1: { a: number }; test2: { b: number } };

    class ServiceTest1 extends ServiceDonnéesNébuleuse<
      "test1",
      { a: number },
      ServicesLibp2pTest
    > {
      constructor({
        nébuleuse,
      }: {
        nébuleuse: CrabeTest<StructureTest, ServicesDonnéesTest>;
      }) {
        super({
          clef: "test1",
          nébuleuse,
          options: {
            schéma: {
              type: "object",
              properties: { a: { type: "number", nullable: true } },
              nullable: true,
            },
          },
        });
      }
    }

    class ServiceTest2 extends ServiceDonnéesNébuleuse<
      "test2",
      { b: number },
      ServicesLibp2pTest
    > {
      constructor({
        nébuleuse,
      }: {
        nébuleuse: Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>;
      }) {
        super({
          clef: "test2",
          nébuleuse,
          options: {
            schéma: {
              type: "object",
              properties: { b: { type: "number", nullable: true } },
              nullable: true,
            },
          },
        });
      }
    }

    type ServicesDonnéesTest = {
      test1: ServiceTest1;
      test2: ServiceTest2;
    };

    let nébuleuse: CrabeTest<StructureTest, ServicesDonnéesTest>;
    let nébuleuse2: CrabeTest<StructureTest, ServicesDonnéesTest>;

    let oublier: Oublier;

    before(async () => {
      const { crabes, fermer } = await créerCrabesTest<
        StructureTest,
        ServicesDonnéesTest
      >({
        n: 2,
        services: {
          journal: ServiceJournal,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia<ServicesLibp2pTest>,
          orbite: ServiceOrbite<ServicesLibp2pTest>,
          compte: ServiceCompte<
            { test1: { a: number }; test2: { b: number } } & {
              [clef: string]: NestedValueObject;
            },
            ServicesLibp2pTest
          >,
          test1: ServiceTest1,
          test2: ServiceTest2,
        },
      });

      oublier = fermer;
      [nébuleuse, nébuleuse2] = crabes;
    });

    after(async () => {
      await oublier();
    });

    it("compiler schéma compte", async () => {
      const serviceCompte = nébuleuse.services["compte"];
      const schéma = compilerSchémaCompte(serviceCompte);

      const réf: JSONSchemaType<
        PartielRécursif<
          StructureTest & { profil: StructureProfil } & {
            dispositifs: StructureDispositifs;
          } & { réseau: StructureRéseau }
        >
      > = {
        type: "object",
        properties: {
          dispositifs: schémaDispositifs,
          profil: schémaProfil,
          réseau: schémaRéseau,
          test1: {
            type: "object",
            properties: { a: { type: "number", nullable: true } },
            nullable: true,
          },
          test2: {
            type: "object",
            properties: { b: { type: "number", nullable: true } },
            nullable: true,
          },
        },
      };

      expect(schéma).to.deep.equal(réf);
    });

    it("structure des services reflétés dans la structure du compte", async () => {
      const bd = await nébuleuse.services.compte.bd();

      await bd.set("test1/a", 1);
      const valeur = await bd.get("test1");

      expect(mapÀObjet(valeur)).to.deep.equal({ a: 1 });
    });

    it("suivi bd compte", async () => {
      const bd = await nébuleuse.services.compte.bd();
      const promesseValeur = obtenir<
        TypedNested<StructureCrabe & StructureTest> | undefined
      >(({ si }) =>
        nébuleuse.services.compte.suivreBd({
          f: si(async (x) => !!x && !!(await x.all()).get("test1")?.get("a")),
        }),
      );

      await bd.put("test1/a", 2);
      await promesseValeur;

      expect(mapÀObjet(await bd.all())).to.deep.equal({ test1: { a: 2 } });
    });

    it("suivi bd compte lorsque le compte change d'identité", async () => {
      const idCompte = await nébuleuse.services.compte.obtIdCompte();
      const idCompte2 = await nébuleuse2.services.compte.obtIdCompte();

      const promesseValeur = obtenir<
        TypedNested<StructureCrabe & StructureTest> | undefined
      >(({ si }) =>
        nébuleuse2.services.compte.suivreBd({
          f: si((bd) => bd?.address !== idCompte2),
        }),
      );

      await nébuleuse.services.compte.ajouterDispositif({
        idDispositif: await nébuleuse2.services.compte.obtIdDispositif(),
      });
      await nébuleuse2.services.compte.rejoindreCompte({
        idCompte,
      });

      const bd = await promesseValeur;
      expect(bd?.address).to.equal(idCompte);
    });
  });

  describe("gestion dispositifs", function () {
    let crabes: CrabeTest[];
    let comptes: ServiceCompte[];
    let fermer: () => Promise<void>;

    let idObjet: string;

    let idsDispositifs: string[];
    let idsComptes: string[];

    before(async () => {
      ({ crabes, fermer } = await créerCrabesTest({
        n: 2,
        services: {
          journal: ServiceJournal,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia<ServicesLibp2pTest>,
          orbite: ServiceOrbite<ServicesLibp2pTest>,
          compte: ServiceCompte<
            NestedObjectToMap<NestedValueObject>,
            ServicesLibp2pTest
          >,
        },
      }));
      comptes = crabes.map((n) => n.services["compte"]);

      idsDispositifs = await Promise.all(
        comptes.map(async (compte) => await compte.obtIdDispositif()),
      );
      idsComptes = await Promise.all(
        comptes.map((compte) => compte.obtIdCompte()),
      );
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("le dispositif initial est présent", async () => {
      const mesDispositifs = await obtenir<string[]>(({ siPasVide }) =>
        comptes[0].suivreMesDispositifs({
          f: siPasVide(),
        }),
      );

      expect(mesDispositifs).to.have.members([idsDispositifs[0]]);
    });

    it("créer objet", async () => {
      const { bd, oublier } = await comptes[0].créerObjet({
        type: "keyvalue",
      });
      idObjet = bd.address;
      await oublier();
      expect(adresseOrbiteValide(idObjet)).to.be.true();
    });

    it("permission initiale objet", async () => {
      const permission = await comptes[0].permission({ idObjet });
      expect(permission).to.equal(MODÉRATRICE);

      const permissionSurSecondDispositif = await comptes[1].permission({
        idObjet,
      });
      expect(permissionSurSecondDispositif).to.equal(undefined);
    });

    it("les dispositifs sont mis à jour", async () => {
      await comptes[0].ajouterDispositif({
        idDispositif: await comptes[1].obtIdDispositif(),
      });

      const mesDispositifs = await obtenir<string[]>(({ si }) =>
        comptes[0].suivreMesDispositifs({
          f: si((x) => !!x && x.length > 1),
        }),
      );

      expect(mesDispositifs).to.have.members([
        idsDispositifs[0],
        idsDispositifs[1],
      ]);
    });

    it("le nouveau dispositif a bien rejoint le compte", async () => {
      await comptes[1].rejoindreCompte({
        idCompte: await comptes[0].obtIdCompte(),
      });
      const nouvelIdCompte = await obtenir(({ si }) =>
        comptes[1].suivreIdCompte({
          f: si((id) => id !== idsComptes[1]),
        }),
      );
      expect(nouvelIdCompte).to.equal(idsComptes[0]);
    });

    it("l'id du dispositif ne change pas", async () => {
      const idDispositifAprès = await comptes[1].obtIdDispositif();
      expect(idDispositifAprès).to.equal(idsDispositifs[1]);
    });

    it("permission objet mise à jour", async () => {
      const permission = await comptes[0].permission({ idObjet });
      expect(permission).to.equal(MODÉRATRICE);

      const permissionSurSecondDispositif = await comptes[1].permission({
        idObjet,
      });
      expect(permissionSurSecondDispositif).to.equal(MODÉRATRICE);
    });

    it("suivre permission objet", async () => {
      const permission = await obtenir(({ siDéfini }) =>
        comptes[0].suivrePermission({ idObjet, f: siDéfini() }),
      );
      expect(permission).to.equal(MODÉRATRICE);
    });

    it("le nouveau dispositif peut modifier les objets crées par le compte", async () => {
      const { bd: bd_orbite2, oublier } = await crabes[1].services[
        "orbite"
      ].ouvrirBd({
        id: idObjet,
        type: "keyvalue",
      });
      await attendreInvité(
        bd_orbite2,
        await crabes[1].services["compte"].obtIdDispositif(),
      );
      await bd_orbite2.put("a", 1);
      const val = await bd_orbite2.get("a");
      await oublier();

      expect(val).to.equal(1);
    });
  });
});
