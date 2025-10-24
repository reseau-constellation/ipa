import { OrbitDB } from "@orbitdb/core";
import { expect } from "aegir/chai";
import { Helia } from "helia";
import { Libp2p } from "libp2p";
import { ServicesLibp2pTest, créerOrbitesTest } from "@constl/utils-tests";
import { TypedNested, typedNested } from "@constl/bohr-db";
import { v4 as uuidv4 } from "uuid";
import { JSONSchemaType } from "ajv";
import { NestedDatabaseType } from "@orbitdb/nested-db";
import { obtenir } from "@constl/utils-ipa";
import { ServicesLibp2pCrabe } from "@/v2/crabe/services/libp2p/libp2p.js";
import { Crabe, validerOptionsServicesCrabe } from "@/v2/crabe/crabe.js";
import { Oublier } from "@/v2/crabe/types.js";
import {
  ServiceDonnéesNébuleuse,
  ServiceDonnéesNébuleuse,
  brancheBd,
} from "@/v2/crabe/services/services.js";
import { PartielRécursif } from "@/v2/types.js";
import { mapÀObjet } from "@/v2/crabe/utils.js";
import { Nébuleuse } from "@/v2/nébuleuse/index.js";
import { ServicesNécessairesCompte } from "@/v2/crabe/services/compte/index.js";
import { créerCrabesTest } from "../utils.js";

const ERREUR_DUPLIQUÉS =
  "Un seul d'`orbite`, `hélia` ou `libp2p` peut être spécifié dans les options.";

describe.only("Services Crabe", function () {
  describe("valider options", function () {
    let orbite: OrbitDB<ServicesLibp2pCrabe>;
    let hélia: Helia<Libp2p<ServicesLibp2pCrabe>>;
    let libp2p: Libp2p<ServicesLibp2pCrabe>;
    let fermer: () => Promise<void>;

    before(async () => {
      const test = await créerOrbitesTest({ n: 1 });
      ({ fermer } = test);

      orbite = test.orbites[0];
      hélia = orbite.ipfs;
      libp2p = hélia.libp2p;
    });

    after(async () => {
      await fermer();
    });

    it("orbite", () => {
      validerOptionsServicesCrabe({
        services: {
          orbite: { orbite },
        },
      });
    });

    it("hélia", () => {
      validerOptionsServicesCrabe({
        services: {
          hélia: { hélia },
        },
      });
    });

    it("libp2p", () => {
      validerOptionsServicesCrabe({
        services: {
          libp2p: { libp2p },
        },
      });
    });

    it("erreur si dédoublement hélia + libp2p", () => {
      expect(() =>
        validerOptionsServicesCrabe({
          services: {
            libp2p: { libp2p },
            hélia: { hélia },
          },
        }),
      ).to.throw(ERREUR_DUPLIQUÉS);
    });

    it("erreur si dédoublement orbite + libp2p", () => {
      expect(() =>
        validerOptionsServicesCrabe({
          services: {
            libp2p: { libp2p },
            orbite: { orbite },
          },
        }),
      ).to.throw(ERREUR_DUPLIQUÉS);
    });

    it("erreur si dédoublement hélia + orbite", () => {
      expect(() =>
        validerOptionsServicesCrabe({
          services: {
            orbite: { orbite },
            hélia: { hélia },
          },
        }),
      ).to.throw(ERREUR_DUPLIQUÉS);
    });
  });

  describe("services données", function () {
    describe("branche bd", function () {
      let orbite: OrbitDB;
      let orbites: OrbitDB[];
      let fermer: Oublier;

      type Structure = { a: string; b: { c: number; d: number } };
      let bd: TypedNested<Structure>;

      const schéma: JSONSchemaType<PartielRécursif<Structure>> = {
        type: "object",
        properties: {
          a: { type: "string", nullable: true },
          b: {
            type: "object",
            properties: {
              c: { type: "number", nullable: true },
              d: { type: "number", nullable: true },
            },
            nullable: true,
            required: [],
          },
        },
        required: [],
      };

      before(async () => {
        ({ orbites, fermer } = await créerOrbitesTest({ n: 1 }));
        orbite = orbites[0];
      });
      after(async () => {
        await fermer();
      });

      beforeEach(async () => {
        const bdImbriquée = (await orbite.open(uuidv4(), {
          type: "nested",
        })) as NestedDatabaseType;
        bd = typedNested<Structure>({ db: bdImbriquée, schema: schéma });
      });

      it("`set` et `get`", async () => {
        const branche = brancheBd({ bd, clef: "b" });

        await branche.set("c", 3);

        const valRacine = await bd.get("b");
        expect(mapÀObjet(valRacine)).to.deep.equal({ c: 3 });

        const valBranche = await branche.get("c");
        expect(valBranche).to.equal(3);

        await branche.put("d", 5);
        expect(await branche.get("d")).to.equal(5);
      });

      it(`all`, async () => {
        const branche = brancheBd({ bd, clef: "b" });

        await branche.set("c", 1);
        await branche.set("d", 2);
        const val = await branche.all();
        expect(mapÀObjet(val)).to.deep.equal({ c: 1, d: 2 });
      });

      it(`move`, async () => {
        const branche = brancheBd({ bd, clef: "b" });

        await branche.set("c", 1);
        await branche.set("d", 2);
        await branche.move("c", 1);

        const val = await branche.all();
        expect([...val.keys()]).to.deep.equal(["d", "c"]);
      });
    });

    describe("accès données service", function () {
      type StructureA = { a: number };
      type StructureB = { b: { c: number; d: number } };
      type Structure = {
        a: StructureA;
        b: StructureB;
      };

      let crabe: Crabe<Structure>;
      let oublier: Oublier;

      class ServiceDonnéesTestA extends ServiceDonnéesNébuleuse<
        "A",
        StructureA
      > {
        constructor({
          nébuleuse,
        }: {
          nébuleuse: Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>;
        }) {
          super({
            clef: "A",
            nébuleuse,
            options: {
              schéma: {
                type: "object",
                properties: {
                  a: { type: "number", nullable: true },
                },
              },
            },
          });
        }
      }
      class ServiceDonnéesTestB extends ServiceDonnéesNébuleuse<
        "B",
        StructureB
      > {
        constructor({
          nébuleuse,
        }: {
          nébuleuse: Nébuleuse<ServicesNécessairesCompte<ServicesLibp2pTest>>;
        }) {
          super({
            clef: "B",
            nébuleuse,
            options: {
              schéma: {
                type: "object",
                properties: {
                  b: {
                    type: "object",
                    nullable: true,
                    properties: {
                      c: { type: "number", nullable: true },
                      d: { type: "number", nullable: true },
                    },
                  },
                },
              },
            },
          });
        }
      }

      before(async () => {
        const { crabes, fermer } = await créerCrabesTest<Structure>({
          n: 1,
          services: {
            donnéesA: ServiceDonnéesTestA,
            donnéesB: ServiceDonnéesTestB,
          },
        });
        crabe = crabes[0];
        oublier = fermer;
      });

      after(async () => {
        if (oublier) await oublier();
      });

      it("accès bd branche", async () => {
        const bdA = await crabe.services["donnéesA"].bd();
        await bdA.put("a", 3);

        const val = await bdA.get("a");
        expect(val).to.equal(3);
      });

      it("suivi bd branche", async () => {
        const bdB = await crabe.services["donnéesB"].bd();

        await bdB.put("b/c", 1);
        const val = await obtenir(({ siDéfini }) =>
          bdB.suivreBd({ f: siDéfini() }),
        );

        expect(val).to.equal(1);
      });
    });
  });
});
