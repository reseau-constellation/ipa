import { expect } from "chai";
import { v4 as uuidv4 } from "uuid";
import { step } from "mocha-steps";
import assert from "assert";

import { MEMBRE, MODÉRATEUR } from "@/accès/consts"; // "../../src/ipa/acces/consts";
import { enregistrerContrôleurs } from "@/accès";
import ContrôleurConstellation from "@/accès/cntrlConstellation";

import OrbitDB from "orbit-db";
import KeyValueStore from "orbit-db-kvstore";

import { testAPIs, config } from "../sfipTest";
import { peutÉcrire, attendreSync, générerOrbites } from "../utils";

Object.keys(testAPIs).forEach((API) => {
  describe("Contrôleur Constellation", function () {
    this.timeout(config.timeout);

    let fOublierOrbites: () => Promise<void>;
    let orbites: OrbitDB[];
    let orbitdb1: OrbitDB,
      orbitdb2: OrbitDB,
      orbitdb3: OrbitDB,
      orbitdb4: OrbitDB;

    before(async () => {
      ({ fOublier: fOublierOrbites, orbites } = await générerOrbites(4, API));
      [orbitdb1, orbitdb2, orbitdb3, orbitdb4] = orbites;
      enregistrerContrôleurs();
    });

    after(async () => {
      if (fOublierOrbites) await fOublierOrbites();
    });

    describe("Accès utilisateur", function () {
      describe("Accès par id Orbite", function () {
        let bd: KeyValueStore;

        before(async () => {
          bd = await orbitdb1.kvstore(uuidv4(), {
            accessController: {
              type: "controlleur-constellation",
              premierMod: orbitdb1.identity.id,
            },
          });
          await bd.load();
        });

        it("Le premier mod peut écrire à la BD", async () => {
          const autorisé = await peutÉcrire(bd);
          expect(autorisé).to.be.true;
        });

        it("Quelqu'un d'autre ne peut pas écrire à la BD", async () => {
          const bdOrbite2 = (await orbitdb2.open(bd.id)) as KeyValueStore;
          await bdOrbite2.load();
          await attendreSync(bdOrbite2);

          const autorisé = await peutÉcrire(bdOrbite2);

          await bdOrbite2.close();
          expect(autorisé).to.be.false;
        });

        it("...mais on peut l'inviter !", async () => {
          await bd.access.grant(MEMBRE, orbitdb2.identity.id);

          const bdOrbite2 = (await orbitdb2.open(bd.id)) as KeyValueStore;
          await bdOrbite2.load();

          const autorisé = await peutÉcrire(bdOrbite2, orbitdb2);

          await bdOrbite2.close();
          expect(autorisé).to.be.true;
        });

        after(async () => {
          await bd.close();
        });
      });

      describe("Accès par id BD racine", function () {
        let bdRacine: KeyValueStore;
        let bdRacine2: KeyValueStore;
        let bd: KeyValueStore;
        let bdOrbite2: KeyValueStore;

        before(async () => {
          bdRacine = await orbitdb1.kvstore(uuidv4(), {
            accessController: {
              type: "controlleur-constellation",
              premierMod: orbitdb1.identity.id,
            },
          });
          await bdRacine.load();

          bdRacine2 = await orbitdb2.kvstore(uuidv4(), {
            accessController: {
              type: "controlleur-constellation",
              premierMod: orbitdb2.identity.id,
            },
          });
          await bdRacine2.load();

          bd = await orbitdb1.kvstore(uuidv4(), {
            accessController: {
              type: "controlleur-constellation",
              premierMod: bdRacine.id,
            },
          });
          await bd.load();
        });

        step("Le premier mod peut écrire à la BD", async () => {
          const autorisé = await peutÉcrire(bd);
          expect(autorisé).to.be.true;
        });

        step("Quelqu'un d'autre ne peut pas écrire à la BD", async () => {
          bdOrbite2 = (await orbitdb2.open(bd.id)) as KeyValueStore;
          await bdOrbite2.load();
          attendreSync(bdOrbite2);

          const autorisé = await peutÉcrire(bdOrbite2);
          expect(autorisé).to.be.false;
        });

        step("...mais on peut toujours l'inviter !", async () => {
          await bd.access.grant(MEMBRE, bdRacine2.id);

          const autorisé = await peutÉcrire(bdOrbite2, orbitdb2);

          expect(autorisé).to.be.true;
        });

        step("Un membre ne peut pas inviter d'autres personnes", async () => {
          await assert.rejects(
            bdOrbite2.access.grant(MEMBRE, orbitdb3.identity.id)
          );
        });

        step("Mais un membre peut s'inviter lui-même", async () => {
          await bdRacine2.access.grant(MODÉRATEUR, orbitdb3.identity.id);

          const bdOrbite3 = (await orbitdb3.open(bd.id)) as KeyValueStore;
          await bdOrbite3.load();

          const autorisé = await peutÉcrire(bdOrbite3, orbitdb3);

          await bdOrbite3.close();
          expect(autorisé).to.be.true;
        });
        step("On peut inviter un modérateur", async () => {
          const accès = bd.access as ContrôleurConstellation;
          await accès.grant(MODÉRATEUR, bdRacine2.id);
          const estUnMod = await accès.estUnModérateur(orbitdb2.identity.id);
          expect(estUnMod).to.be.true;
        });

        step("Un modérateur peut inviter d'autres membres", async () => {
          const accès = bdOrbite2.access as ContrôleurConstellation;
          await accès.grant(MEMBRE, orbitdb4.identity.id);

          const bdOrbite4 = (await orbitdb4.open(bd.id)) as KeyValueStore;
          await bdOrbite4.load();

          const autorisé = await peutÉcrire(bdOrbite4, orbitdb4);

          await bdOrbite4.close();
          expect(autorisé).to.be.true;
        });

        step("Un modérateur peut inviter d'autres modérateurs", async () => {
          const accès = bdOrbite2.access as ContrôleurConstellation;
          await accès.grant(MODÉRATEUR, orbitdb4.identity.id);

          const estUnMod = await accès.estUnModérateur(orbitdb4.identity.id);
          expect(estUnMod).to.be.true;
        });

        step("Invitations transitives lors de bd.load()", async () => {
          await bd.close();
          bd = (await orbitdb1.open(bd.id)) as KeyValueStore;
          await bd.load();

          const accès = bd.access as ContrôleurConstellation;
          for (const o of [orbitdb1, orbitdb2, orbitdb3, orbitdb4]) {
            const estAutorisé = await accès.estAutorisé(o.identity.id);
            expect(estAutorisé).to.be.true;
          }
        });

        after(async () => {
          await bd.close();
          if (bdOrbite2) await bdOrbite2.close();
        });
      });
    });
  });
});
