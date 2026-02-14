import path from "path";
import { expect } from "aegir/chai";
import { isValidAddress } from "@orbitdb/core";
import {
  obtenirAdresseRelai,
  toutesConnectées,
  type ServicesLibp2pTest,
} from "@constl/utils-tests";
import {
  ServiceCompte,
  ServiceHélia,
  ServiceOrbite,
  ServiceStockage,
} from "@/v2/nébuleuse/index.js";
import { compilerSchémaCompte } from "@/v2/nébuleuse/services/compte/compte.js";
import { Appli } from "@/v2/nébuleuse/appli/appli.js";
import { ServiceDonnéesAppli } from "@/v2/nébuleuse/services/services.js";
import { ServiceJournal } from "@/v2/nébuleuse/services/journal.js";
import { MODÉRATRICE } from "@/v2/nébuleuse/services/compte/accès/consts.js";
import { schémaDispositifs } from "@/v2/nébuleuse/services/dispositifs.js";
import { schémaProfil } from "@/v2/nébuleuse/services/profil.js";
import { schémaRéseau } from "@/v2/nébuleuse/services/réseau.js";
import { ServiceDossier } from "@/v2/nébuleuse/services/dossier.js";
import { ServiceAppli } from "@/v2/nébuleuse/appli/index.js";
import { obtenir, attendreInvité, dossierTempoPropre } from "../../../utils.js";
import { ServiceLibp2pTest } from "../utils.js";
import { créerNébuleusesTest } from "../../utils.js";
import type {
  ConstructeursServicesAppli,
  OptionsAppli,
  OptionsCommunes,
  ServicesAppli,
} from "@/v2/nébuleuse/appli/appli.js";
import type { NébuleuseTest } from "../../utils.js";
import type { Rôle } from "@/v2/nébuleuse/services/compte/accès/types.js";
import type { StructureRéseau } from "@/v2/nébuleuse/services/réseau.js";
import type { StructureProfil } from "@/v2/nébuleuse/services/profil.js";
import type { StructureDispositifs } from "@/v2/nébuleuse/services/dispositifs.js";
import type { StructureNébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type { PartielRécursif, TraducsTexte } from "@/v2/types.js";
import type { ServicesNécessairesCompte } from "@/v2/nébuleuse/services/compte/compte.js";
import type { TypedNested } from "@constl/bohr-db";
import type { JSONSchemaType } from "ajv";
import type { Libp2p } from "@libp2p/interface";
import type { ServicesLibp2pNébuleuse } from "@/v2/nébuleuse/services/libp2p/libp2p.js";
import type { NestedValue } from "@orbitdb/nested-db";

const créerApplisTest = async <
  T extends { [clef: Exclude<string, "dossier">]: NestedValue },
  S extends ServicesAppli,
>({
  structure,
  services,
  n,
}: {
  structure: T;
  services: S;
  n: number;
}) => {
  type Services = ServicesNécessairesCompte & {
    // compte: ServiceCompte<T>;
  } & S;

  const { dossier, effacer } = await dossierTempoPropre();

  const applis: Appli<Services>[] = [];

  for (const i in [...Array(n).entries()]) {
    const appli = new Appli<Services>({
      services: {
        dossier: ServiceDossier,
        journal: ServiceJournal,
        stockage: ServiceStockage,
        libp2p: ServiceLibp2pTest,
        hélia: ServiceHélia<ServicesLibp2pTest>,
        orbite: ServiceOrbite<ServicesLibp2pTest>,
        compte: ServiceCompte<T>,
        ...services,
      } as ConstructeursServicesAppli<Services>,
      options: { services: { dossier: { dossier: path.join(dossier, i) } } },
    });
    const opts: OptionsAppli<ServicesNécessairesCompte & ServicesAppli> = {
      mode: "dév",
      services: {
        dossier: { dossier: "true" },
        a: { b: 2 },
      },
    };
    applis.push(appli);
  }

  await Promise.all(applis.map((c) => c.démarrer()));

  const libp2ps: Libp2p<ServicesLibp2pNébuleuse>[] = await Promise.all(
    applis.map(async (a) => await a.services.libp2p.libp2p()),
  );
  await toutesConnectées(libp2ps, { adresseRelai: obtenirAdresseRelai() });

  const fermer = async () => {
    await Promise.allSettled(applis.map((a) => a.fermer()));
    effacer();
  };

  return { applis, fermer };
};

describe.only("Service Compte", function () {
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
          dossier: ServiceDossier,
          journal: ServiceJournal,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia<ServicesLibp2pTest>,
          orbite: ServiceOrbite<ServicesLibp2pTest>,
          compte: ServiceCompte,
        },
        options: { services: { dossier: { dossier } } },
      });
      await appli.démarrer();
    });

    after(async () => {
      await appli.fermer();
      effacer();
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
          dossier: ServiceDossier,
          journal: ServiceJournal,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
          orbite: ServiceOrbite,
          compte: ServiceCompte,
        },
        options: { services: { dossier: { dossier } } },
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
          dossier: ServiceDossier,
          journal: ServiceJournal,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia<ServicesLibp2pTest>,
          orbite: ServiceOrbite<ServicesLibp2pTest>,
          compte: ServiceCompte<Record<string, never>>,
        },
        options: { services: { dossier: { dossier } } },
      });
      await appli.démarrer();
    });

    after(async () => {
      await appli.fermer();
      effacer();
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

    const schémaTest1: JSONSchemaType<PartielRécursif<{ a: number }>> = {
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
          compte: ServiceCompte;
        };
        options: OptionsCommunes;
      }) {
        super({
          clef: "test1",
          services,
          options: Object.assign({}, options, {
            schéma: schémaTest1,
          }),
        });
      }
    }

    const schémaTest2: JSONSchemaType<PartielRécursif<{ b: number }>> = {
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
          compte: ServiceCompte;
        };
        options: OptionsCommunes;
      }) {
        const optionsFinales = Object.assign({}, options, {
          schéma: schémaTest2,
        });
        super({
          clef: "test2",
          services,
          options: optionsFinales,
        });
      }
    }

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
      const { applis, fermer } = await créerApplisTest<StructureTest>({
        n: 2,
        services: {
          test1: ServiceTest1,
          test2: ServiceTest2,
        },
      });

      oublier = fermer;
      [appli, appli2] = applis;
    });

    after(async () => {
      await oublier();
    });

    it("compiler schéma compte", async () => {
      const serviceCompte = appli.services["compte"];
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
          f: si((bd) => bd?.address !== idCompte2),
        }),
      );

      await appli.services.compte.ajouterDispositif({
        idDispositif: await appli2.services.compte.obtIdDispositif(),
      });
      await appli2.services.compte.rejoindreCompte({
        idCompte,
      });

      const bd = await promesseValeur;
      expect(bd?.address).to.equal(idCompte);
    });
  });

  describe("gestion dispositifs", function () {
    let applis: NébuleuseTest[];
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
      comptes = nébuleuses.map((n) => n.services["compte"]);

      idsDispositifs = await Promise.all(
        comptes.map(async (compte) => await compte.obtIdDispositif()),
      );
      idsComptes = await Promise.all(
        comptes.map((compte) => compte.obtIdCompte()),
      );

      await nébuleuses[0].profil.sauvegarderNom({
        nom: "Julien Malard-Adam",
        langue: "fr",
      });
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
      const { bd: bd_orbite2, oublier } = await nébuleuses[1].services[
        "orbite"
      ].ouvrirBd({
        id: idObjet,
        type: "keyvalue",
      });
      await attendreInvité(
        bd_orbite2,
        await nébuleuses[1].services["compte"].obtIdDispositif(),
      );
      await bd_orbite2.put("a", 1);
      const val = await bd_orbite2.get("a");
      await oublier();

      expect(val).to.equal(1);
    });

    it("le nouveau dispositif suit le profil", async () => {
      const noms = await obtenir<TraducsTexte | undefined>(({ si }) =>
        nébuleuses[1].profil.suivreNoms({
          f: si((x) => !!x && Object.keys(x).includes("fr")),
        }),
      );

      expect(noms?.fr).to.equal("Julien Malard-Adam");
    });

    it("le nouveau dispositif peut modifier le compte", async () => {
      await nébuleuses[1].profil.sauvegarderNom({
        langue: "த",
        nom: "ம.-அதான் ஜூலீஎன்",
      });

      const pNoms = obtenir<TraducsTexte | undefined>(({ si }) =>
        nébuleuses[0].profil.suivreNoms({
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
