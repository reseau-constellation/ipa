import path from "path";
import { expect } from "aegir/chai";
import { isValidAddress } from "@orbitdb/core";
import {
  obtenirAdresseRelai,
  toutesConnectées,
  type ServicesLibp2pTest,
} from "@constl/utils-tests";
import { merge } from "lodash-es";
import { serviceCompte } from "@/v2/nébuleuse/services/compte/compte.js";
import { Appli } from "@/v2/nébuleuse/appli/appli.js";
import { ServiceDonnéesAppli } from "@/v2/nébuleuse/services/services.js";
import { serviceJournal } from "@/v2/nébuleuse/services/journal.js";
import { MODÉRATRICE } from "@/v2/nébuleuse/services/compte/accès/consts.js";
import { serviceDossier } from "@/v2/nébuleuse/services/dossier.js";
import { serviceHélia } from "@/v2/nébuleuse/services/hélia.js";
import { serviceOrbite } from "@/v2/nébuleuse/services/orbite/orbite.js";
import { serviceStockage } from "@/v2/nébuleuse/services/stockage.js";
import {
  schémaNébuleuse,
  type OptionsNébuleuse,
  type StructureNébuleuse,
} from "@/v2/nébuleuse/nébuleuse.js";
import { enleverPréfixes } from "@/v2/utils.js";
import { obtenir, attendreInvité, dossierTempoPropre } from "../../../utils.js";
import { serviceLibp2pTest } from "../utils.js";
import type { KeyValueDatabase } from "@orbitdb/core";
import type { ServiceCompte } from "@/v2/nébuleuse/index.js";
import type {
  ConstructeursServicesAppli,
  OptionsAppli,
  ServicesAppli,
} from "@/v2/nébuleuse/appli/appli.js";
import type { Rôle } from "@/v2/nébuleuse/services/compte/accès/types.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type { PartielRécursif } from "@/v2/types.js";
import type { ServicesNécessairesCompte } from "@/v2/nébuleuse/services/compte/compte.js";
import type { TypedNested } from "@constl/bohr-db";
import type { JSONSchemaType } from "ajv";
import type { Libp2p } from "@libp2p/interface";
import type { ServicesLibp2pNébuleuse } from "@/v2/nébuleuse/services/libp2p/libp2p.js";
import type { NestedValue } from "@orbitdb/nested-db";

const créerApplisTest = async <
  T extends { [clef: string]: NestedValue },
  S extends ServicesAppli,
>({
  options,
  services,
  n,
}: {
  options?: Omit<
    NonNullable<OptionsNébuleuse<T, ServicesLibp2pTest>["services"]>,
    "libp2p" | "dossier"
  >;
  services: ConstructeursServicesAppli<
    S,
    ServicesNécessairesCompte & { compte: ServiceCompte<T> }
  >;
  n: number;
}) => {
  type Services = ServicesNécessairesCompte & {
    compte: ServiceCompte<T>;
  } & S;

  const { dossier, effacer } = await dossierTempoPropre();

  const applis: Appli<Services>[] = [];

  for (const i in [...Array(n).entries()]) {
    const appli = new Appli<Services>({
      services: {
        dossier: serviceDossier({ dossier: path.join(dossier, i) }),
        journal: serviceJournal(options?.journal),
        stockage: serviceStockage(),
        libp2p: serviceLibp2pTest(),
        hélia: serviceHélia<ServicesLibp2pTest>(options?.hélia),
        orbite: serviceOrbite<ServicesLibp2pTest>(options?.orbite),
        compte: serviceCompte<T>({
          ...options?.compte,
          schéma: merge({}, schémaNébuleuse, options?.compte?.schéma || {}),
        }),
        ...services,
      } as ConstructeursServicesAppli<Services>,
    });

    applis.push(appli);
  }

  await Promise.all(applis.map((c) => c.démarrer()));

  const libp2ps: Libp2p<ServicesLibp2pNébuleuse>[] = await Promise.all(
    applis.map(async (a) => await a.services.libp2p.libp2p()),
  );
  await toutesConnectées(libp2ps, { adresseRelai: obtenirAdresseRelai() });

  const fermer = async () => {
    await Promise.allSettled(applis.map((a) => a.fermer()));
    effacer?.();
  };

  return { applis, fermer };
};

describe("Service Compte", function () {
  describe("gestion compte", async () => {
    let appli: Appli<ServicesNécessairesCompte & { compte: ServiceCompte }>;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      appli = new Appli<
        ServicesNécessairesCompte & {
          compte: ServiceCompte;
        }
      >({
        services: {
          dossier: serviceDossier({ dossier }),
          journal: serviceJournal(),
          stockage: serviceStockage(),
          libp2p: serviceLibp2pTest(),
          hélia: serviceHélia<ServicesLibp2pTest>(),
          orbite: serviceOrbite<ServicesLibp2pTest>(),
          compte: serviceCompte<{
            [clef: string]: NestedValue;
          }>({
            schéma: { type: "object" } as JSONSchemaType<
              PartielRécursif<{
                [clef: string]: NestedValue;
              }>
            >,
          }),
        },
      });
      await appli.démarrer();
    });

    after(async () => {
      await appli?.fermer();
      effacer?.();
    });

    it("obtenir id libp2p", async () => {
      const idLibp2p = await appli.services.compte.obtIdLibp2p();
      expect(idLibp2p).to.be.a("string");
    });

    it("obtenir id dispositif", async () => {
      const idDispositif = await appli.services.compte.obtIdDispositif();
      expect(idDispositif).to.be.a("string");
    });

    it("obtenir id compte", async () => {
      const idCompte = await appli.services.compte.obtIdCompte();
      expect(idCompte).to.be.a("string");
    });

    it("persistence id compte lorsque redémarré", async () => {
      const idCompte = await appli.services.compte.obtIdCompte();

      await appli.fermer();
      appli = new Appli<
        ServicesNécessairesCompte & {
          compte: ServiceCompte;
        }
      >({
        services: {
          dossier: serviceDossier({ dossier }),
          journal: serviceJournal(),
          stockage: serviceStockage(),
          libp2p: serviceLibp2pTest(),
          hélia: serviceHélia(),
          orbite: serviceOrbite(),
          compte: serviceCompte({ schéma: { type: "object" } }),
        },
      });
      await appli.démarrer();

      const nouvelIdCompte = await appli.services.compte.obtIdCompte();
      expect(nouvelIdCompte).to.equal(idCompte);
    });

    it("suivre id compte", async () => {
      const serviceCompte = appli.services["compte"];
      const idCompte = await obtenir<string>(({ siDéfini }) =>
        serviceCompte.suivreIdCompte({ f: siDéfini() }),
      );
      expect(idCompte).to.equal(await appli.services.compte.obtIdCompte());
    });
  });

  describe("structure compte vide", function () {
    let appli: Appli<
      ServicesNécessairesCompte & {
        compte: ServiceCompte<Record<string, never>>;
      }
    >;
    let dossier: string;
    let effacer: () => void;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      appli = new Appli<
        ServicesNécessairesCompte & {
          compte: ServiceCompte<Record<string, never>>;
        }
      >({
        services: {
          dossier: serviceDossier({ dossier }),
          journal: serviceJournal(),
          stockage: serviceStockage(),
          libp2p: serviceLibp2pTest(),
          hélia: serviceHélia(),
          orbite: serviceOrbite(),
          compte: serviceCompte<Record<string, never>>({
            schéma: { type: "object" },
          }),
        },
      });
      await appli.démarrer();
    });

    after(async () => {
      await appli?.fermer();
      effacer?.();
    });

    it("erreur lors d'accès données", async () => {
      const bd = await appli.services["compte"].bd();

      // @ts-expect-error La structure est vide
      expect(bd.set("données", 1)).to.eventually.be.rejectedWith(
        "Unsupported key",
      );
    });
  });

  describe("structure compte", function () {
    type StructureTest = { test1: { a: number }; test2: { b: number } };

    const schémaTest1: JSONSchemaType<PartielRécursif<{ a: number }>> & {
      nullable: true;
    } = {
      type: "object",
      properties: { a: { type: "number", nullable: true } },
      nullable: true,
    };

    class ServiceTest1 extends ServiceDonnéesAppli<"test1", { a: number }> {
      constructor({
        services,
        options,
      }: {
        services: ServicesNécessairesCompte & {
          compte: ServiceCompte<StructureTest>;
        };
        options: OptionsAppli;
      }) {
        super({
          clef: "test1",
          services,
          options,
        });
      }
    }

    const schémaTest2: JSONSchemaType<PartielRécursif<{ b: number }>> & {
      nullable: true;
    } = {
      type: "object",
      properties: { b: { type: "number", nullable: true } },
      nullable: true,
    };

    class ServiceTest2 extends ServiceDonnéesAppli<"test2", { b: number }> {
      constructor({
        services,
        options,
      }: {
        services: ServicesNécessairesCompte & {
          compte: ServiceCompte<StructureTest>;
        };
        options: OptionsAppli;
      }) {
        super({
          clef: "test2",
          services,
          options,
        });
      }
    }

    const schéma: JSONSchemaType<PartielRécursif<StructureTest>> = {
      type: "object",
      properties: {
        test1: schémaTest1,
        test2: schémaTest2,
      },
    };

    let appli: Appli<
      ServicesNécessairesCompte & { compte: ServiceCompte<StructureTest> } & {
        test1: ServiceTest1;
        test2: ServiceTest2;
      }
    >;
    let appli2: Appli<
      ServicesNécessairesCompte & { compte: ServiceCompte<StructureTest> } & {
        test1: ServiceTest1;
        test2: ServiceTest2;
      }
    >;

    let oublier: Oublier;

    before(async () => {
      const { applis, fermer } = await créerApplisTest<
        StructureTest,
        { test1: ServiceTest1; test2: ServiceTest2 }
      >({
        n: 2,
        services: {
          test1: ({ options, services }) =>
            new ServiceTest1({ options, services }),
          test2: ({ options, services }) =>
            new ServiceTest2({ options, services }),
        },
        options: {
          compte: { schéma },
        },
      });

      oublier = fermer;
      [appli, appli2] = applis;
    });

    after(async () => {
      await oublier();
    });

    it("structure des services reflétés dans la structure du compte", async () => {
      const bd = await appli.services.compte.bd();

      await bd.set("test1/a", 1);
      const valeur = await bd.get("test1");

      expect(valeur).to.deep.equal({ a: 1 });
    });

    it("suivi bd compte", async () => {
      const bd = await appli.services.compte.bd();
      const promesseValeur = obtenir<
        TypedNested<StructureNébuleuse & StructureTest> | undefined
      >(({ si }) =>
        appli.services.compte.suivreBd({
          f: si(async (x) => !!x && !!(await x.all())["test1"]?.["a"]),
        }),
      );

      await bd.put("test1/a", 2);
      await promesseValeur;

      expect(await bd.all()).to.deep.equal({ test1: { a: 2 } });
    });

    it("modifier données à travers service données", async () => {
      const bd = await appli.services.compte.bd();
      const promesseValeur = obtenir<
        TypedNested<StructureNébuleuse & StructureTest> | undefined
      >(({ si }) =>
        appli.services.compte.suivreBd({
          f: si(async (x) => !!x && !!(await x.all())["test2"]?.["b"]),
        }),
      );

      const bdService2 = await appli.services.test2.bd();
      await bdService2.put("b", 3);
      await promesseValeur;

      expect(await bd.all()).to.deep.equal({
        test1: { a: 2 },
        test2: { b: 3 },
      });
    });

    it("erreur pour mauvaise clef", async () => {
      const bd = await appli.services.compte.bd();

      // @ts-expect-error  Clef inexistante dans la structure
      await expect(bd.set("n/existe/pas", 1)).to.eventually.be.rejectedWith(
        "Unsupported key n/existe/pas.",
      );

      await expect(
        // @ts-expect-error Service inexistant
        bd.set("service/inexistant", 1),
      ).to.eventually.be.rejectedWith("Unsupported key service/inexistant.");
    });

    it("suivi bd compte lorsque le compte change d'identité", async () => {
      const idCompte = await appli.services.compte.obtIdCompte();
      const idCompte2 = await appli2.services.compte.obtIdCompte();

      const promesseValeur = obtenir<
        TypedNested<StructureNébuleuse & StructureTest> | undefined
      >(({ si }) =>
        appli2.services.compte.suivreBd({
          f: si((bd) => bd?.address !== enleverPréfixes(idCompte2)),
        }),
      );

      await appli.services.compte.ajouterDispositif({
        idDispositif: await appli2.services.compte.obtIdDispositif(),
      });
      await appli2.services.compte.rejoindreCompte({
        idCompte,
      });

      const bd = await promesseValeur;
      expect(bd?.address).to.equal(enleverPréfixes(idCompte));
    });
  });

  describe("gestion dispositifs", function () {
    let applis: Appli<ServicesNécessairesCompte & { compte: ServiceCompte }>[];
    let comptes: ServiceCompte<{ [clef: string]: NestedValue }>[];
    let fermer: () => Promise<void>;

    let idObjet: string;

    let idsDispositifs: string[];
    let idsComptes: string[];

    before(async () => {
      ({ applis, fermer } = await créerApplisTest({
        n: 3,
        services: {},
      }));
      comptes = applis.map((a) => a.services["compte"]);

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
      expect(isValidAddress(idObjet)).to.be.true();
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

    it("suivre autorisations objet", async () => {
      const autorisations = await obtenir<{ idCompte: string; rôle: Rôle }[]>(
        ({ siDéfini }) =>
          comptes[0].suivreAutorisations({ idObjet, f: siDéfini() }),
      );

      const réf = [
        {
          idCompte: idsComptes[0],
          rôle: MODÉRATRICE,
        },
      ];
      expect(autorisations).to.deep.equal(réf);
    });

    it("le nouveau dispositif peut modifier les objets crées par le compte", async () => {
      const { bd: bd_orbite2, oublier } = await applis[1].services[
        "orbite"
      ].ouvrirBd({
        id: idObjet,
        type: "keyvalue",
      });
      await attendreInvité(
        bd_orbite2,
        await applis[1].services["compte"].obtIdDispositif(),
      );
      await bd_orbite2.put("a", 1);
      const val = await bd_orbite2.get("a");
      await oublier();

      expect(val).to.equal(1);
    });

    it("l'ancien dispositif peut modifier les objets crées par le nouveau dispositif", async () => {
      const { bd, oublier } = await comptes[1].créerObjet({
        type: "keyvalue",
      });
      const idObjet = bd.address;

      const { bd: bdSurDispositif1, oublier: oublierSurDispositif1 } =
        await applis[0].services["orbite"].ouvrirBd({
          id: idObjet,
          type: "keyvalue",
        });

      await attendreInvité(
        bdSurDispositif1,
        await comptes[0].obtIdDispositif(),
      );
      await bdSurDispositif1.put("a", 1);
      const valSurDispositif1 = await bdSurDispositif1.get("a");

      await obtenir<KeyValueDatabase>(({ si }) =>
        applis[1].services["orbite"].suivreBd({
          id: idObjet,
          type: "keyvalue",
          f: si(async (x) => !!(await x?.get("a"))),
        }),
      );
      const valSurDispositif2 = await bd.get("a");

      await oublier();
      await oublierSurDispositif1();

      expect(valSurDispositif1).to.equal(valSurDispositif2).to.equal(1);
    });

    it.skip("une partie tierce reconnaît l'ajout du dispositif", async () => {
      const dispositifs = await obtenir(({ si }) =>
        applis[2].services["compte"].suivreDispositifs({
          idCompte: idsComptes[0],
          f: si((dispositifs) => !!dispositifs && dispositifs.length > 1),
        }),
      );
      expect(dispositifs).to.have.members([
        idsDispositifs[0],
        idsDispositifs[1],
      ]);
    });

    it("une partie tierce accepte les données modifiées par le nouveau dispositif", async () => {
      const bd = await obtenir<KeyValueDatabase>(({ si }) =>
        applis[2].services["orbite"].suivreBd({
          id: idObjet,
          type: "keyvalue",
          f: si(async (x) => !!(await x?.get("a"))),
        }),
      );

      const val = await bd.get("a");
      expect(val).to.equal(1);
    });
  });
});
