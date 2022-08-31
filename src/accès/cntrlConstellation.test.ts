import { v4 as uuidv4 } from "uuid";
import assert from "assert";

import { MEMBRE, MODÉRATEUR } from "@/accès/consts";
import ContrôleurConstellation from "@/accès/cntrlConstellation";

import OrbitDB from "orbit-db";
import KeyValueStore from "orbit-db-kvstore";

import { peutÉcrire, attendreSync, générerOrbites } from "@/utilsTests";
import { config } from "@/utilsTests/sfipTest";

describe("Contrôleur Constellation", function () {
  let fOublierOrbites: () => Promise<void>;
  let orbites: OrbitDB[];
  let orbitdb1: OrbitDB,
    orbitdb2: OrbitDB,
    orbitdb3: OrbitDB,
    orbitdb4: OrbitDB;

  beforeAll(async () => {
    ({ fOublier: fOublierOrbites, orbites } = await générerOrbites(4));
    [orbitdb1, orbitdb2, orbitdb3, orbitdb4] = orbites;
  }, config.patienceInit);

  afterAll(async () => {
    if (fOublierOrbites) await fOublierOrbites();
  });

  describe("Accès utilisateur", function () {
    describe("Accès par id Orbite", function () {
      let bd: KeyValueStore<number>;

      beforeAll(async () => {
        bd = await orbitdb1.kvstore(uuidv4(), {
          accessController: {
            type: "controlleur-constellation",
            //@ts-ignore
            premierMod: orbitdb1.identity.id,
          },
        });
        await bd.load();
      }, config.timeout);

      test("Le premier mod peut écrire à la BD", async () => {
        const autorisé = await peutÉcrire(bd);
        expect(autorisé).toBe(true);
      });

      test("Quelqu'un d'autre ne peut pas écrire à la BD", async () => {
        const bdOrbite2 = (await orbitdb2.open(bd.id)) as KeyValueStore<number>;
        await bdOrbite2.load();
        await attendreSync(bdOrbite2);

        const autorisé = await peutÉcrire(bdOrbite2);

        await bdOrbite2.close();
        expect(autorisé).toBe(false);
      });

      test("...mais on peut l'inviter !", async () => {
        await bd.access.grant(MEMBRE, orbitdb2.identity.id);

        const bdOrbite2 = (await orbitdb2.open(bd.id)) as KeyValueStore<number>;
        await bdOrbite2.load();

        const autorisé = await peutÉcrire(bdOrbite2, orbitdb2);

        await bdOrbite2.close();
        expect(autorisé).toBe(true);
      });

      afterAll(async () => {
        await bd.close();
      });
    });

    describe("Accès par id BD racine", function () {
      let bdRacine: KeyValueStore<string>;
      let bdRacine2: KeyValueStore<string>;
      let bd: KeyValueStore<number>;
      let bdOrbite2: KeyValueStore<number>;

      beforeAll(async () => {
        bdRacine = await orbitdb1.kvstore(uuidv4(), {
          accessController: {
            type: "controlleur-constellation",
            //@ts-ignore
            premierMod: orbitdb1.identity.id,
          },
        });
        await bdRacine.load();

        bdRacine2 = await orbitdb2.kvstore(uuidv4(), {
          accessController: {
            type: "controlleur-constellation",
            //@ts-ignore
            premierMod: orbitdb2.identity.id,
          },
        });
        await bdRacine2.load();

        bd = await orbitdb1.kvstore(uuidv4(), {
          accessController: {
            type: "controlleur-constellation",
            //@ts-ignore
            premierMod: bdRacine.id,
          },
        });
        await bd.load();
      }, config.timeout);

      test("Le premier mod peut écrire à la BD", async () => {
        const autorisé = await peutÉcrire(bd);
        expect(autorisé).toBe(true);
      });

      test("Quelqu'un d'autre ne peut pas écrire à la BD", async () => {
        bdOrbite2 = (await orbitdb2.open(bd.id)) as KeyValueStore<number>;
        await bdOrbite2.load();
        attendreSync(bdOrbite2);

        const autorisé = await peutÉcrire(bdOrbite2);
        expect(autorisé).toBe(false);
      });

      test("...mais on peut toujours l'inviter !", async () => {
        await bd.access.grant(MEMBRE, bdRacine2.id);

        const autorisé = await peutÉcrire(bdOrbite2, orbitdb2);

        expect(autorisé).toBe(true);
      });

      test("Un membre ne peut pas inviter d'autres personnes", async () => {
        await assert.rejects(
          bdOrbite2.access.grant(MEMBRE, orbitdb3.identity.id)
        );
      });

      test("Mais un membre peut s'inviter lui-même", async () => {
        await bdRacine2.access.grant(MODÉRATEUR, orbitdb3.identity.id);

        const bdOrbite3 = (await orbitdb3.open(bd.id)) as KeyValueStore<number>;
        await bdOrbite3.load();

        const autorisé = await peutÉcrire(bdOrbite3, orbitdb3);

        await bdOrbite3.close();
        expect(autorisé).toBe(true);
      });
      test("On peut inviter un modérateur", async () => {
        const accès = bd.access as unknown as ContrôleurConstellation;
        await accès.grant(MODÉRATEUR, bdRacine2.id);
        const estUnMod = await accès.estUnModérateur(orbitdb2.identity.id);
        expect(estUnMod).toBe(true);
      });

      test("Un modérateur peut inviter d'autres membres", async () => {
        const accès = bdOrbite2.access as unknown as ContrôleurConstellation;
        await accès.grant(MEMBRE, orbitdb4.identity.id);

        const bdOrbite4 = (await orbitdb4.open(bd.id)) as KeyValueStore<number>;
        await bdOrbite4.load();

        const autorisé = await peutÉcrire(bdOrbite4, orbitdb4);

        await bdOrbite4.close();
        expect(autorisé).toBe(true);
      });

      test("Un modérateur peut inviter d'autres modérateurs", async () => {
        const accès = bdOrbite2.access as unknown as ContrôleurConstellation;
        await accès.grant(MODÉRATEUR, orbitdb4.identity.id);

        const estUnMod = await accès.estUnModérateur(orbitdb4.identity.id);
        expect(estUnMod).toBe(true);
      });

      test("Invitations transitives lors de bd.load()", async () => {
        await bd.close();
        bd = (await orbitdb1.open(bd.id)) as KeyValueStore<number>;
        await bd.load();

        const accès = bd.access as unknown as ContrôleurConstellation;
        for (const o of [orbitdb1, orbitdb2, orbitdb3, orbitdb4]) {
          const estAutorisé = await accès.estAutorisé(o.identity.id);
          expect(estAutorisé).toBe(true);
        }
      });

      afterAll(async () => {
        await bd.close();
        if (bdOrbite2) await bdOrbite2.close();
      });
    });
  });
});
