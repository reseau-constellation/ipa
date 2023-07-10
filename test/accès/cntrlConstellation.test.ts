import { v4 as uuidv4 } from "uuid";

import { MEMBRE, MODÉRATEUR } from "@/accès/consts.js";
import type { default as ContrôleurConstellation } from "@/accès/cntrlConstellation.js";

import type OrbitDB from "orbit-db";
import type KeyValueStore from "orbit-db-kvstore";

import { peutÉcrire, attendreSync } from "@/utilsTests/index.js";
import { générerOrbites } from "@/utilsTests/client.js";

import { isNode, isElectronMain } from "wherearewe";
import { expect } from "aegir/chai";

describe("Contrôleur Constellation", function () {
  if (isNode || isElectronMain) {
    describe("Accès utilisateur", function () {
      describe("Accès par id Orbite", function () {
        let fOublierOrbites: () => Promise<void>;
        let orbites: OrbitDB[];
        let orbitdb1: OrbitDB, orbitdb2: OrbitDB;
        let bd: KeyValueStore<number>;

        before(async () => {
          ({ fOublier: fOublierOrbites, orbites } = await générerOrbites(2));
          [orbitdb1, orbitdb2] = orbites;

          bd = await orbitdb1.kvstore(uuidv4(), {
            accessController: {
              type: "controlleur-constellation",
              // @ts-expect-error Contrôleur personalisé
              premierMod: orbitdb1.identity.id,
            },
          });
          await bd.load();
        });

        after(async () => {
          await bd.close();
          if (fOublierOrbites) await fOublierOrbites();
        });

        it("Le premier mod peut écrire à la BD", async () => {
          const autorisé = await peutÉcrire(bd);
          expect(autorisé).to.be.true();
        });

        it("Quelqu'un d'autre ne peut pas écrire à la BD", async () => {
          const bdOrbite2 = (await orbitdb2.open(
            bd.id
          )) as KeyValueStore<number>;
          await bdOrbite2.load();

          const autorisé = await peutÉcrire(bdOrbite2);

          await bdOrbite2.close();
          expect(autorisé).to.be.false();
        });

        it("...mais on peut l'inviter !", async () => {
          await bd.access.grant(MEMBRE, orbitdb2.identity.id);

          const bdOrbite2 = (await orbitdb2.open(
            bd.id
          )) as KeyValueStore<number>;
          await bdOrbite2.load();

          const autorisé = await peutÉcrire(bdOrbite2, orbitdb2);

          await bdOrbite2.close();
          expect(autorisé).to.be.true();
        });
      });

      describe("Accès par id BD racine", function () {
        let fOublierOrbites: () => Promise<void>;
        let orbites: OrbitDB[];
        let orbitdb1: OrbitDB,
          orbitdb2: OrbitDB,
          orbitdb3: OrbitDB,
          orbitdb4: OrbitDB;

        let bdRacine: KeyValueStore<string>;
        let bdRacine2: KeyValueStore<string>;
        let bd: KeyValueStore<number>;
        let bdOrbite2: KeyValueStore<number>;

        before(async () => {
          ({ fOublier: fOublierOrbites, orbites } = await générerOrbites(4));
          [orbitdb1, orbitdb2, orbitdb3, orbitdb4] = orbites;

          bdRacine = await orbitdb1.kvstore(uuidv4(), {
            accessController: {
              type: "controlleur-constellation",
              // @ts-expect-error Contrôleur personalisé
              premierMod: orbitdb1.identity.id,
            },
          });
          await bdRacine.load();

          bdRacine2 = await orbitdb2.kvstore(uuidv4(), {
            accessController: {
              type: "controlleur-constellation",
              // @ts-expect-error Contrôleur personalisé
              premierMod: orbitdb2.identity.id,
            },
          });
          await bdRacine2.load();

          bd = await orbitdb1.kvstore(uuidv4(), {
            accessController: {
              type: "controlleur-constellation",
              // @ts-expect-error Contrôleur personalisé
              premierMod: bdRacine.id,
            },
          });
          await bd.load();
        });

        after(async () => {
          await bd.close();
          if (bdOrbite2) await bdOrbite2.close();
          if (fOublierOrbites) await fOublierOrbites();
        });

        it("Le premier mod peut écrire à la BD", async () => {
          const autorisé = await peutÉcrire(bd);
          expect(autorisé).to.be.true();
        });

        it("Quelqu'un d'autre ne peut pas écrire à la BD", async () => {
          bdOrbite2 = (await orbitdb2.open(bd.id)) as KeyValueStore<number>;
          await bdOrbite2.load();
          attendreSync(bdOrbite2);

          const autorisé = await peutÉcrire(bdOrbite2);
          expect(autorisé).to.be.false();
        });

        it("...mais on peut toujours l'inviter !", async () => {
          await bd.access.grant(MEMBRE, bdRacine2.id);

          const autorisé = await peutÉcrire(bdOrbite2, orbitdb2);

          expect(autorisé).to.be.true();
        });

        it("Un membre ne peut pas inviter d'autres personnes", async () => {
          await expect(() =>
            bdOrbite2.access.grant(MEMBRE, orbitdb3.identity.id)
          ).rejected();
        });

        it("Mais un membre peut s'inviter lui-même", async () => {
          // await tousConnecter([orbitdb1._ipfs, orbitdb2._ipfs, orbitdb3._ipfs, orbitdb4._ipfs])
          await bdRacine2.access.grant(MODÉRATEUR, orbitdb3.identity.id);

          const bdOrbite3 = (await orbitdb3.open(
            bd.id
          )) as KeyValueStore<number>;
          await bdOrbite3.load();

          const autorisé = await peutÉcrire(bdOrbite3, orbitdb3);

          await bdOrbite3.close();
          expect(autorisé).to.be.true();
        });

        it("On peut inviter un modérateur", async () => {
          const accès = bd.access as unknown as ContrôleurConstellation;
          await accès.grant(MODÉRATEUR, bdRacine2.id);
          const estUnMod = await accès.estUnModérateur(orbitdb2.identity.id);
          expect(estUnMod).to.be.true();
        });

        it("Un modérateur peut inviter d'autres membres", async () => {
          const accès = bdOrbite2.access as unknown as ContrôleurConstellation;
          await accès.grant(MEMBRE, orbitdb4.identity.id);

          const bdOrbite4 = (await orbitdb4.open(
            bd.id
          )) as KeyValueStore<number>;
          await bdOrbite4.load();

          const autorisé = await peutÉcrire(bdOrbite4, orbitdb4);

          await bdOrbite4.close();
          expect(autorisé).to.be.true();
        });

        it("Un modérateur peut inviter d'autres modérateurs", async () => {
          const accès = bdOrbite2.access as unknown as ContrôleurConstellation;
          await accès.grant(MODÉRATEUR, orbitdb4.identity.id);

          const estUnMod = await accès.estUnModérateur(orbitdb4.identity.id);
          expect(estUnMod).to.be.true();
        });

        it("Invitations transitives lors de bd.load()", async () => {
          await bd.close();
          bd = (await orbitdb1.open(bd.id)) as KeyValueStore<number>;
          await bd.load();

          const accès = bd.access as unknown as ContrôleurConstellation;
          for (const o of [orbitdb1, orbitdb2, orbitdb3, orbitdb4]) {
            const estAutorisé = await accès.estAutorisé(o.identity.id);
            expect(estAutorisé).to.be.true();
          }
        });
      });
    });
  }
});
