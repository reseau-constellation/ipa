import { v4 as uuidv4 } from "uuid";

import { MEMBRE, MODÉRATEUR } from "@/accès/consts.js";

import { type OrbitDB } from "@orbitdb/core";

import { orbite } from "@constl/utils-tests";

import { isNode, isElectronMain } from "wherearewe";
import { expect } from "aegir/chai";
import type { KeyValue } from "@orbitdb/core";
import { ContrôleurConstellation as générerContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import { enregistrerContrôleurs } from "@/accès/index.js";

type TypeContrôleurConstellation = Awaited<
  ReturnType<ReturnType<typeof générerContrôleurConstellation>>
>;

const attendreEstUnMod = (
  accès: TypeContrôleurConstellation,
  idOrbite: string,
) => {
  return new Promise<void>((résoudre) => {
    const fTesterModérateur = async () => {
      if (await accès.estUnModérateur(idOrbite)) {
        clearInterval(intervale);
        résoudre();
      }
    };
    const intervale = setInterval(fTesterModérateur, 200);
    fTesterModérateur();
  });
};

describe("Contrôleur Constellation", function () {
  if (isNode || isElectronMain) {
    describe("Accès utilisateur", function () {
      describe("Accès par id Orbite", function () {
        let fOublierOrbites: () => Promise<void>;
        let orbites: OrbitDB[];
        let orbitdb1: OrbitDB, orbitdb2: OrbitDB;
        let bd: KeyValue;

        before(async () => {
          enregistrerContrôleurs();
          ({ fOublier: fOublierOrbites, orbites } =
            await orbite.créerOrbiteTest({ n: 2 }));
          [orbitdb1, orbitdb2] = orbites;

          bd = (await orbitdb1.open(uuidv4(), {
            type: "keyvalue",
            AccessController: générerContrôleurConstellation({
              write: orbitdb1.identity.id,
            }),
          })) as unknown as KeyValue;
        });

        after(async () => {
          await bd.close();
          if (fOublierOrbites) await fOublierOrbites();
        });

        it("Le premier mod peut écrire à la BD", async () => {
          const autorisé = await orbite.peutÉcrire(bd, orbitdb1);
          expect(autorisé).to.be.true();
        });

        it("Quelqu'un d'autre ne peut pas écrire à la BD", async () => {
          const bdOrbite2 = (await orbitdb2.open(bd.address, {
            type: "keyvalue",
          })) as unknown as KeyValue;

          const autorisé = await orbite.peutÉcrire(bdOrbite2);

          await bdOrbite2.close();
          expect(autorisé).to.be.false();
        });

        it("...mais on peut l'inviter !", async () => {
          await (bd.access as TypeContrôleurConstellation).grant(
            MEMBRE,
            orbitdb2.identity.id,
          );

          const bdOrbite2 = (await orbitdb2.open(
            bd.address,
          )) as unknown as KeyValue;

          const autorisé = await orbite.peutÉcrire(bdOrbite2, orbitdb2);

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

        let bdRacine: KeyValue;
        let bdRacine2: KeyValue;
        let bd: KeyValue;
        let bdOrbite2: KeyValue;

        before(async () => {
          enregistrerContrôleurs();
          ({ fOublier: fOublierOrbites, orbites } =
            await orbite.créerOrbiteTest({ n: 4 }));
          [orbitdb1, orbitdb2, orbitdb3, orbitdb4] = orbites;

          bdRacine = (await orbitdb1.open(uuidv4(), {
            type: "keyvalue",
            AccessController: générerContrôleurConstellation({
              write: orbitdb1.identity.id,
            }),
          })) as unknown as KeyValue;

          bdRacine2 = (await orbitdb2.open(uuidv4(), {
            type: "keyvalue",
            AccessController: générerContrôleurConstellation({
              write: orbitdb2.identity.id,
            }),
          })) as unknown as KeyValue;

          bd = (await orbitdb1.open(uuidv4(), {
            type: "keyvalue",
            AccessController: générerContrôleurConstellation({
              write: bdRacine.address,
            }),
          })) as unknown as KeyValue;
        });

        after(async () => {
          await bd.close();
          if (bdOrbite2) await bdOrbite2.close();
          if (fOublierOrbites) await fOublierOrbites();
        });

        it("Le premier mod peut écrire à la BD", async () => {
          const autorisé = await orbite.peutÉcrire(bd);
          expect(autorisé).to.be.true();
        });

        it("Quelqu'un d'autre ne peut pas écrire à la BD", async () => {
          bdOrbite2 = (await orbitdb2.open(bd.address)) as unknown as KeyValue;

          const autorisé = await orbite.peutÉcrire(bdOrbite2);
          expect(autorisé).to.be.false();
        });

        it("...mais on peut toujours l'inviter !", async () => {
          await (bd.access as TypeContrôleurConstellation).grant(
            MEMBRE,
            bdRacine2.address,
          );

          const autorisé = await orbite.peutÉcrire(bdOrbite2, orbitdb2);

          expect(autorisé).to.be.true();
        });

        it("Un membre ne peut pas inviter d'autres personnes", async () => {
          await expect(
            (bdOrbite2.access as TypeContrôleurConstellation).grant(
              MEMBRE,
              orbitdb3.identity.id,
            ),
          ).rejected();
        });

        it("Mais un membre peut s'inviter lui-même", async () => {
          await (bdRacine2.access as TypeContrôleurConstellation).grant(
            MODÉRATEUR,
            orbitdb3.identity.id,
          );

          const bdOrbite3 = (await orbitdb3.open(bd.address, {
            type: "keyvalue",
          })) as unknown as KeyValue;

          const autorisé = await orbite.peutÉcrire(bdOrbite3, orbitdb3);

          await bdOrbite3.close();

          expect(autorisé).to.be.true();
        });

        it("On peut inviter un modérateur", async () => {
          const accès = bd.access as TypeContrôleurConstellation;
          await accès.grant(MODÉRATEUR, bdRacine2.address);
          await attendreEstUnMod(accès, orbitdb2.identity.id);

          const estUnMod = await accès.estUnModérateur(orbitdb2.identity.id);
          expect(estUnMod).to.be.true();
        });

        it("Un modérateur peut inviter d'autres membres", async () => {
          const accès = bdOrbite2.access as TypeContrôleurConstellation;
          await accès.grant(MEMBRE, orbitdb4.identity.id);

          const bdOrbite4 = (await orbitdb4.open(bd.address, {
            type: "keyvalue",
          })) as unknown as KeyValue;

          const autorisé = await orbite.peutÉcrire(bdOrbite4, orbitdb4);

          await bdOrbite4.close();
          expect(autorisé).to.be.true();
        });

        it("Un modérateur peut inviter d'autres modérateurs", async () => {
          const accès = bdOrbite2.access as TypeContrôleurConstellation;
          await accès.grant(MODÉRATEUR, orbitdb4.identity.id);

          await attendreEstUnMod(accès, orbitdb4.identity.id);
          const estUnMod = await accès.estUnModérateur(orbitdb4.identity.id);
          expect(estUnMod).to.be.true();
        });

        it("Invitations transitives après fermeture de la bd", async () => {
          await bd.close();
          bd = (await orbitdb1.open(bd.address, {
            type: "keyvalue",
          })) as unknown as KeyValue;

          const accès = bd.access as TypeContrôleurConstellation;
          for (const o of [orbitdb1, orbitdb2, orbitdb3, orbitdb4]) {
            const estAutorisé = await accès.estAutorisé(o.identity.id);
            expect(estAutorisé).to.be.true();
          }
        });
      });
    });
  }
});
