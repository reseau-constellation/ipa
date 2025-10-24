import { expect } from "aegir/chai";
import { ServicesLibp2pTest, dossierTempo } from "@constl/utils-tests";
import { NestedValueObject } from "@orbitdb/nested-db";
import { adresseOrbiteValide } from "@constl/utils-ipa";
import { TypedNested, TypedNested } from "@constl/bohr-db";
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
import { obtenir } from "test/utils/utils.js";
import { ServiceLibp2pTest } from "../utils.js";
import { créerNébuleusesTest } from "./../../../nébuleuse/utils/nébuleuse.js";
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
      const idCompte = obtenir<string>(({ siDéfini }) =>
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
      // @ts-expect-error La structure est vide
      expect(bd.put("données", 1)).to.eventually.be.rejectedWith(
        "Unsupported key",
      );
    });
  });

  describe("structure compte", function () {
    class ServiceTest1 extends ServiceDonnéesNébuleuse<
      "test1",
      { a: number },
      ServicesLibp2pTest
    > {
      constructor({
        nébuleuse,
      }: {
        nébuleuse: Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>;
      }) {
        super({
          clef: "test1",
          nébuleuse,
          options: {
            schéma: {
              type: "object",
              properties: { a: { type: "number", nullable: true } },
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
            },
          },
        });
      }
    }

    type ServicesDonnéesTest = {
      test1: ServiceTest1;
      test2: ServiceTest2;
    };

    let nébuleuse: Nébuleuse<
      ServicesNécessairesCompte<ServicesLibp2pTest> & ServicesDonnéesTest
    >;
    let nébuleuse2: Nébuleuse<
      ServicesNécessairesCompte<ServicesLibp2pTest> & ServicesDonnéesTest
    >;

    let oublier: Oublier;

    before(async () => {
      const { nébuleuses, fermer } = await créerNébuleusesTest({
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
      [nébuleuse, nébuleuse2] = nébuleuses;
    });

    after(async () => {
      await oublier();
    });

    it("compiler schéma compte", async () => {
      const serviceCompte = nébuleuse.services["compte"];
      const schéma = compilerSchémaCompte(serviceCompte);

      const réf: JSONSchemaType<PartielRécursif<{ a: number; b: number }>> = {
        type: "object",
        properties: {
          a: { type: "number", nullable: true },
          b: { type: "number", nullable: true },
        },
        required: [],
      };

      expect(schéma).to.deep.equal(réf);
    });

    it("structure des services reflétés dans la structure du compte", async () => {
      const bd = await nébuleuse.services.compte.bd();

      await bd.set("test1/a", 1);
      const valeur = await bd.get("test1");

      expect(valeur).to.deep.equal({ a: 1 });
    });

    it("suivi bd compte", async () => {
      const bd = await nébuleuse.services.compte.bd();
      const promesseValeur = obtenir<
        TypedNested<{ test1: { a: number; b: number } }> | undefined
      >(({ si }) =>
        nébuleuse.services.compte.suivreBd({
          f: si(async (x) => !!x && !!(await x.all()).get("test1")?.get("a")),
        }),
      );

      await bd.put("test1/a", 2);
      const valeur = await promesseValeur;

      expect(valeur).to.deep.equal({ test1: { a: 1 } });
    });

    it("suivi bd compte lorsque le compte change d'identité", async () => {
      const idCompte = await nébuleuse.services.compte.obtIdCompte();
      const idCompte2 = await nébuleuse2.services.compte.obtIdCompte();

      const promesseValeur = obtenir<
        TypedNested<{ test1: { a: number; b: number } }> | undefined
      >(({ si }) =>
        nébuleuse.services.compte.suivreBd({
          f: si((bd) => bd?.address !== idCompte2),
        }),
      );

      await nébuleuse2.services.compte.rejoindreCompte({
        idCompte,
      });

      const nouvelIdBd = await promesseValeur;
      expect(nouvelIdBd).to.equal(idCompte);
    });
  });

  describe("gestion dispositifs", function () {
    let nébuleuses: Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>[];
    let comptes: ServiceCompte[];
    let fermer: () => Promise<void>;

    let idsDispositifs: string[];
    let idsComptes: string[];

    before(async () => {
      ({ nébuleuses, fermer } = await créerNébuleusesTest<
        ServicesNécessairesCompte<ServicesLibp2pTest>
      >({
        n: 2,
        services: {
          journal: ServiceJournal,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
          orbite: ServiceOrbite,
          compte: ServiceCompte,
        },
      }));
      comptes = nébuleuses.map((n) => n.services["compte"]);
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

    describe("ajouter dispositif manuellement", function () {
      let idBd: string;

      before(async () => {
        const { bd, oublier } = await comptes[0].créerObjet({
          type: "keyvalue",
        });
        idBd = bd.address;
        await oublier();
        await comptes[0].ajouterDispositif({
          idDispositif: await comptes[1].obtIdDispositif(),
        });
      });

      it("les dispositifs sont mis à jour", async () => {
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

      it("le nouveau dispositif peut modifier les donnnées du compte", async () => {
        const { bd: bd_orbite2, oublier } = await nébuleuses[1].services[
          "orbite"
        ].ouvrirBd({
          id: idBd,
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
    });

    describe("données orbite", function () {
      let idObjet: string;

      it("créer objet", async () => {
        const { bd, oublier } = await comptes[0].créerObjet({
          type: "keyvalue",
        });
        idObjet = bd.address;
        await oublier();
        expect(adresseOrbiteValide(idObjet)).to.be.true();
      });

      it("obtenir permission objet", async () => {
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
    });
  });
});
