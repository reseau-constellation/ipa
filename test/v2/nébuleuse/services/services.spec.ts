import { expect } from "aegir/chai";
import { créerOrbitesTest } from "@constl/utils-tests";
import { typedNested } from "@constl/bohr-db";
import { v4 as uuidv4 } from "uuid";
import { extraireHéliaEtLibp2p } from "@/v2/nébuleuse/nébuleuse.js";
import {
  ServiceDonnéesAppli,
  brancheBd,
} from "@/v2/nébuleuse/services/services.js";
import { ServiceAppli } from "@/v2/nébuleuse/appli/services.js";
import { créerNébuleusesTest } from "../utils.js";
import { obtenir } from "../../utils.js";
import type { ServicesNébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import type { NébuleuseTest } from "../utils.js";
import type { ServicesNécessairesDonnées } from "@/v2/nébuleuse/services/services.js";
import type { OptionsCommunes } from "@/v2/nébuleuse/appli/appli.js";
import type { OrbitDB } from "@orbitdb/core";
import type { Helia } from "helia";
import type { Libp2p } from "libp2p";
import type { ServicesLibp2pTest } from "@constl/utils-tests";
import type { TypedNested } from "@constl/bohr-db";
import type { JSONSchemaType } from "ajv";
import type { NestedDatabaseType } from "@orbitdb/nested-db";
import type { ServicesLibp2pNébuleuse } from "@/v2/nébuleuse/services/libp2p/libp2p.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type { PartielRécursif } from "@/v2/types.js";

const ERREUR_DUPLIQUÉS =
  "Un seul d'`orbite`, `hélia` ou `libp2p` peut être spécifié dans les options.";

describe.only("Services Nébuleuse", function () {
  describe("valider options", function () {
    let orbite: OrbitDB<ServicesLibp2pNébuleuse>;
    let hélia: Helia<Libp2p<ServicesLibp2pNébuleuse>>;
    let libp2p: Libp2p<ServicesLibp2pNébuleuse>;
    let fermer: () => Promise<void>;

    before(async () => {
      const test = await créerOrbitesTest({ n: 1 });
      ({ fermer } = test);

      orbite = test.orbites[0];
      hélia = orbite.ipfs;
      libp2p = hélia.libp2p;
    });

    after(async () => {
      if (fermer) await fermer();
    });

    it("orbite", () => {
      const { libp2p: libp2pRésolue, hélia: héliaRésolue } =
        extraireHéliaEtLibp2p({
          orbite: { orbite },
        });
      expect(libp2pRésolue).to.equal(libp2p);
      expect(héliaRésolue).to.equal(hélia);
    });

    it("hélia", () => {
      const { libp2p: libp2pRésolue, hélia: héliaRésolue } =
        extraireHéliaEtLibp2p({
          hélia: { hélia },
        });
      expect(libp2pRésolue).to.equal(libp2p);
      expect(héliaRésolue).to.equal(hélia);
    });

    it("libp2p", () => {
      const { libp2p: libp2pRésolue, hélia: héliaRésolue } =
        extraireHéliaEtLibp2p({
          libp2p: { libp2p },
        });
      expect(libp2pRésolue).to.equal(libp2p);
      expect(héliaRésolue).to.be.undefined();
    });

    it("erreur si dédoublement hélia + libp2p", () => {
      expect(() =>
        extraireHéliaEtLibp2p({
          libp2p: { libp2p },
          hélia: { hélia },
        }),
      ).to.throw(ERREUR_DUPLIQUÉS);
    });

    it("erreur si dédoublement orbite + libp2p", () => {
      expect(() =>
        extraireHéliaEtLibp2p({
          libp2p: { libp2p },
          orbite: { orbite },
        }),
      ).to.throw(ERREUR_DUPLIQUÉS);
    });

    it("erreur si dédoublement hélia + orbite", () => {
      expect(() =>
        extraireHéliaEtLibp2p({
          orbite: { orbite },
          hélia: { hélia },
        }),
      ).to.throw(ERREUR_DUPLIQUÉS);
    });
  });

  describe("services données", function () {
    describe("branche bd", function () {
      let orbite: OrbitDB;
      let orbites: OrbitDB[];
      let fermer: Oublier;

      type StructureB = { c: number; d: number; e: { f: number; g: number } };
      type Structure = { a: string; b: StructureB };
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
              e: {
                type: "object",
                properties: {
                  f: { type: "number", nullable: true },
                  g: { type: "number", nullable: true },
                },
                nullable: true,
                required: [],
              },
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
        if (fermer) await fermer();
      });

      beforeEach(async () => {
        const bdImbriquée = (await orbite.open(uuidv4(), {
          type: "nested",
        })) as NestedDatabaseType;
        bd = typedNested<Structure>({ db: bdImbriquée, schema: schéma });
      });

      it("`set` et `get`", async () => {
        const branche = brancheBd<StructureB, "b">({ bd, clef: "b" });

        await branche.set("c", 3);

        const valRacine = await bd.get("b");
        expect(valRacine).to.deep.equal({ c: 3 });

        const valBranche = await branche.get("c");
        expect(valBranche).to.equal(3);

        await branche.put("d", 5);
        expect(await branche.get("d")).to.equal(5);
      });

      it(`all`, async () => {
        const branche = brancheBd<StructureB, "b">({ bd, clef: "b" });

        await branche.set("c", 1);
        await branche.set("d", 2);
        const val = await branche.all();
        expect(val).to.deep.equal({ c: 1, d: 2 });
      });

      it(`insert`, async () => {
        const branche = brancheBd<StructureB, "b">({ bd, clef: "b" });

        await branche.insert("e", { f: 1 });
        await branche.insert("e", { g: 2 });

        const val = await branche.all();
        expect(val).to.deep.equal({ e: { f: 1, g: 2 } });
      });
    });

    describe("accès données service", function () {
      type StructureA = { a: number };
      type StructureB = { b: { c: number; d: number } };
      type Structure = {
        A: StructureA;
        B: StructureB;
      };

      const schémaStructureA: JSONSchemaType<PartielRécursif<StructureA>> = {
        type: "object",
        properties: {
          a: { type: "number", nullable: true },
        },
      };

      const schémaStructureB: JSONSchemaType<PartielRécursif<StructureB>> = {
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
      };

      let nébuleuse: NébuleuseTest<
        Structure,
        { A: ServiceDonnéesTestA; B: ServiceDonnéesTestB }
      >;
      let oublier: Oublier;

      class ServiceDonnéesTestA extends ServiceDonnéesAppli<"A", StructureA> {
        constructor({
          services,
          options,
        }: {
          services: ServicesNécessairesDonnées<{ A: StructureA }>;
          options: OptionsCommunes;
        }) {
          const optionsService = {
            ...options,
            schéma: schémaStructureA,
          };
          super({
            clef: "A",
            services,
            options: optionsService,
          });
        }
      }

      class ServiceDonnéesTestB extends ServiceDonnéesAppli<"B", StructureB> {
        constructor({
          services,
          options,
        }: {
          services: ServicesNécessairesDonnées<{ B: StructureB }>;
          options: OptionsCommunes;
        }) {
          super({
            clef: "B",
            services,
            options: {
              ...options,
              schéma: schémaStructureB,
            },
          });
        }
      }

      before(async () => {
        const { nébuleuses, fermer } = await créerNébuleusesTest<
          Structure,
          {
            A: ServiceDonnéesTestA;
            B: ServiceDonnéesTestB;
          }
        >({
          n: 1,
          services: {
            A: ServiceDonnéesTestA,
            B: ServiceDonnéesTestB,
          },
        });
        nébuleuse = nébuleuses[0];
        oublier = fermer;
      });

      after(async () => {
        if (oublier) await oublier();
      });

      it("accès bd branche", async () => {
        const bdA = await nébuleuse.services["A"].bd();
        await bdA.put("a", 3);

        const val = await bdA.get("a");
        expect(val).to.equal(3);
      });

      it("suivi bd branche", async () => {
        const bdB = await nébuleuse.services["B"].bd();

        await bdB.put("b/c", 1);
        const val = await obtenir<PartielRécursif<StructureB> | undefined>(
          ({ si }) =>
            nébuleuse.services["B"].suivreBd({
              f: si((x) => x?.b !== undefined),
            }),
        );

        expect(val).to.deep.equal({ b: { c: 1 } });
      });

      it("suivi bd branche avec clef", async () => {
        const bdB = await nébuleuse.services["B"].bd();

        await bdB.put("b/c", 2);
        const val = await obtenir<number | undefined>(({ si }) =>
          nébuleuse.services["B"].suivreBd({
            clef: "b/c",
            f: si((x) => x !== 1),
          }),
        );

        expect(val).to.deep.equal(2);
      });
    });

    describe("services aditionnels", function () {
      type StructureA = { a: number };
      type Structure = {
        A: StructureA;
      };

      const schémaStructureA: JSONSchemaType<PartielRécursif<StructureA>> = {
        type: "object",
        properties: {
          a: { type: "number", nullable: true },
        },
      };

      let nébuleuse: NébuleuseTest<
        Structure,
        { A: ServiceDonnéesTestA; autre: AutreService }
      >;
      let oublier: Oublier;

      class ServiceDonnéesTestA extends ServiceDonnéesAppli<
        "A",
        StructureA,
        AutresServices
      > {
        constructor({
          services,
          options,
        }: {
          services: ServicesNécessairesDonnées<{ A: StructureA }> &
            AutresServices;
          options: OptionsCommunes;
        }) {
          const optionsService = {
            ...options,
            schéma: schémaStructureA,
          };
          super({
            clef: "A",
            services,
            dépendances: ["autre"],
            options: optionsService,
          });
        }

        accéderAutreService() {
          return this.service("autre").valeur();
        }
      }

      class AutreService extends ServiceAppli<"autre"> {
        constructor({
          services,
          options,
        }: {
          services: ServicesNébuleuse;
          options: OptionsCommunes;
        }) {
          super({ clef: "autre", services, options });
        }

        valeur() {
          return 3;
        }
      }

      type AutresServices = { autre: AutreService };

      before(async () => {
        const { nébuleuses, fermer } = await créerNébuleusesTest<
          Structure,
          {
            A: ServiceDonnéesTestA;
            autre: AutreService;
          }
        >({
          n: 1,
          services: {
            A: ServiceDonnéesTestA,
            autre: AutreService,
          },
        });
        nébuleuse = nébuleuses[0];
        oublier = fermer;
      });

      after(async () => {
        if (oublier) await oublier();
      });

      it("accès autre service", async () => {
        expect(nébuleuse.services.A.accéderAutreService()).to.equal(3);
      });
    });
  });
});
