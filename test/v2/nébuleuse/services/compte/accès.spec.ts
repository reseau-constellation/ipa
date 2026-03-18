import { expect } from "aegir/chai";
import { v4 as uuidv4 } from "uuid";
import { créerOrbitesTest } from "@constl/utils-tests";
import { obtenir } from "@constl/utils-ipa";
import {
  ContrôleurNébuleuse,
  MEMBRE,
  MODÉRATRICE,
} from "@/v2/nébuleuse/services/compte/accès/index.js";
import { préparerOrbite } from "@/v2/nébuleuse/services/orbite/orbite.js";
import { attendreQue } from "../../../appli/utils/fonctions.js";
import { attendreInvité, peutÉcrire } from "../../../utils.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type {
  AccèsDispositif,
  AccèsUtilisateur,
  InstanceContrôleurNébuleuse,
} from "@/v2/nébuleuse/services/compte/accès/index.js";
import type { KeyValueDatabase, OrbitDB } from "@orbitdb/core";

describe.only("Accès", function () {
  before(async () => {
    préparerOrbite();
  });

  describe("par identités orbite", function () {
    let orbites: OrbitDB[];
    let orbite1: OrbitDB;
    let orbite2: OrbitDB;
    let orbite3: OrbitDB;
    let orbite4: OrbitDB;

    let fermer: Oublier;
    let bd: KeyValueDatabase;
    let accès: InstanceContrôleurNébuleuse;

    before(async () => {
      ({ fermer, orbites } = await créerOrbitesTest({ n: 4 }));
      [orbite1, orbite2, orbite3, orbite4] = orbites;
    });

    after(async () => {
      if (fermer) await fermer();
    });

    beforeEach(async () => {
      bd = (await orbite1.open(uuidv4(), {
        AccessController: ContrôleurNébuleuse(),
        type: "keyvalue",
      })) as KeyValueDatabase;
      accès = bd.access as InstanceContrôleurNébuleuse;
    });

    afterEach(async () => {
      await bd?.close();
    });

    it("la créatrice est une modératrice", async () => {
      expect(await accès.estUneModératrice(orbite1.identity.id)).to.be.true();
      expect(await accès.estAutorisé(orbite1.identity.id)).to.be.true();
    });

    it("les autres ne sont pas des modératrices", async () => {
      expect(await accès.estUneModératrice(orbite2.identity.id)).to.be.false();
      expect(await accès.estAutorisé(orbite2.identity.id)).to.be.false();
    });

    it("ajout d'un membre", async () => {
      await accès.autoriser(MEMBRE, orbite2.identity.id);

      // Effectué sur l'instance originale
      await attendreInvité(bd, orbite2.identity.id);

      const membre = await accès.estUnMembre(orbite2.identity.id);
      expect(membre).to.be.true();

      const modératrice = await accès.estUneModératrice(orbite2.identity.id);
      expect(modératrice).to.be.false();

      // Effectué sur l'instance ajoutée
      const bdSurOrbite2 = (await orbite2.open(bd.address)) as KeyValueDatabase;
      const accès2 = bdSurOrbite2.access as InstanceContrôleurNébuleuse;

      await attendreInvité(bdSurOrbite2, orbite2.identity.id);

      const membreSurBd2 = await accès2.estUnMembre(orbite2.identity.id);
      expect(membreSurBd2).to.be.true();

      const modératriceSurBd2 = await accès2.estUneModératrice(
        orbite2.identity.id,
      );
      expect(modératriceSurBd2).to.be.false();

      const autorisé = await peutÉcrire(bdSurOrbite2);
      expect(autorisé).to.be.true();
    });

    it("promotion d'un membre à une modératrice", async () => {
      await accès.autoriser(MEMBRE, orbite2.identity.id);

      await attendreInvité(bd, orbite2.identity.id);
      await accès.autoriser(MODÉRATRICE, orbite2.identity.id);
      await attendreQue(() => accès.estUneModératrice(orbite2.identity.id));

      // Effectué sur l'instance originale
      const membre = await accès.estUnMembre(orbite2.identity.id);
      expect(membre).to.be.true();

      const modératrice = await accès.estUneModératrice(orbite2.identity.id);
      expect(modératrice).to.be.true();

      // Effectué sur l'instance ajoutée
      const bdSurOrbite2 = (await orbite2.open(bd.address)) as KeyValueDatabase;
      const accès2 = bdSurOrbite2.access as InstanceContrôleurNébuleuse;

      await attendreInvité(bdSurOrbite2, orbite2.identity.id);

      const membreSurBd2 = await accès2.estUnMembre(orbite2.identity.id);
      expect(membreSurBd2).to.be.true();

      const modératriceSurBd2 = await accès2.estUneModératrice(
        orbite2.identity.id,
      );
      expect(modératriceSurBd2).to.be.true();
    });

    it("erreur - un membre ne peut pas inviter d'autres membres", async () => {
      await accès.autoriser(MEMBRE, orbite2.identity.id);
      const bdSurOrbite2 = await orbite2.open(bd.address);
      const accès2 = bdSurOrbite2.access as InstanceContrôleurNébuleuse;

      await expect(
        accès2.autoriser(MEMBRE, orbite3.identity.id),
      ).to.eventually.be.rejectedWith(
        `Le rôle ${MEMBRE} ne peut pas être octroyé à ${orbite3.identity.id}.`,
      );
    });

    it("une modératrice peut ajouter un membre", async () => {
      await accès.autoriser(MODÉRATRICE, orbite2.identity.id);

      const bdSurOrbite2 = await orbite2.open(bd.address);
      const accès2 = bdSurOrbite2.access as InstanceContrôleurNébuleuse;
      await attendreQue(() => accès2.estUneModératrice(orbite2.identity.id));

      await accès2.autoriser(MEMBRE, orbite3.identity.id);

      const bdSurOrbite3 = (await orbite3.open(bd.address)) as KeyValueDatabase;
      await attendreInvité(bdSurOrbite3, orbite3.identity.id);

      const autorisé = await peutÉcrire(bdSurOrbite3);
      expect(autorisé).to.be.true();
    });

    it("une modératrice peut ajouter une autre modératrice", async () => {
      await accès.autoriser(MODÉRATRICE, orbite2.identity.id);

      const bdSurOrbite2 = await orbite2.open(bd.address);
      const accès2 = bdSurOrbite2.access as InstanceContrôleurNébuleuse;
      await attendreQue(() => accès2.estUneModératrice(orbite2.identity.id));

      await accès2.autoriser(MODÉRATRICE, orbite3.identity.id);

      const bdSurOrbite3 = (await orbite3.open(bd.address)) as KeyValueDatabase;

      await attendreInvité(bdSurOrbite3, orbite3.identity.id);

      const modératrice = await (
        bdSurOrbite3.access as InstanceContrôleurNébuleuse
      ).estUneModératrice(orbite3.identity.id);
      expect(modératrice).to.be.true();
    });

    it("utilisateurs autorisés", async () => {
      const promesseUtilisateurs = obtenir<AccèsUtilisateur[]>(({ siDéfini }) =>
        accès.suivreUtilisateursAutorisés(siDéfini()),
      );
      await accès.autoriser(MEMBRE, orbite2.identity.id);

      const autorisés = await promesseUtilisateurs;

      expect(autorisés).to.be.empty();
      expect(accès.utilisateursAutorisés()).to.be.empty();
    });

    it("dispositifs autorisés", async () => {
      const promesseUtilisateurs = obtenir<AccèsDispositif[]>(({ si }) =>
        accès.suivreDispositifsAutorisées(si((x) => x.length > 1)),
      );
      await accès.autoriser(MEMBRE, orbite2.identity.id);

      const autorisés = await promesseUtilisateurs;
      const réf: AccèsDispositif[] = [
        {
          rôle: MODÉRATRICE,
          idDispositif: orbite1.identity.id,
        },
        {
          rôle: MEMBRE,
          idDispositif: orbite2.identity.id,
        },
      ];

      expect(autorisés).to.have.deep.members(réf);
      expect(await accès.dispositifsAutorisés()).to.have.deep.members(réf);
    });

    it("erreur si rôle invalide", async () => {
      await expect(
        // @ts-expect-error On fait exprès
        accès.autoriser("MAUVAIS RÔLE", orbite2.identity.id),
      ).to.eventually.be.rejectedWith("n'existe pas");
    });

    it("erreur d'ajout si utilisateur non autorisé", async () => {
      const bdSurOrbite2 = await orbite2.open(bd.address);
      const accès2 = bdSurOrbite2.access as InstanceContrôleurNébuleuse;

      await expect(
        accès2.autoriser(MEMBRE, orbite3.identity.id),
      ).to.eventually.be.rejectedWith(
        `Le rôle ${MEMBRE} ne peut pas être octroyé à ${orbite3.identity.id}.`,
      );
    });

    it("multiples bds partageant le même contrôleur", async () => {
      const adresseContrôleur1 = accès.address;
      const bd2 = await orbite1.open(uuidv4(), {
        type: "keyvalue",
        AccessController: ContrôleurNébuleuse({
          écriture: adresseContrôleur1,
        }),
      });

      // Fermerture d'une des bases de données
      await bd.close();

      // Le contrôleur de l'autre fonctionne toujours
      await (bd2.access as InstanceContrôleurNébuleuse).autoriser(
        MEMBRE,
        orbite2.identity.id,
      );

      const bd2SurOrbite2 = (await orbite2.open(
        bd2.address,
      )) as KeyValueDatabase;
      // On attend que les permissions se propagent
      await attendreInvité(bd2SurOrbite2, orbite2.identity.id);
      await bd2SurOrbite2.set("a", 1);

      expect(await bd2SurOrbite2.get("a")).to.equal(1);
      await bd2.close();
    });

    it("invitations transitives après fermeture de la bd", async () => {
      let dernière = orbite1;
      for (const orbite of [orbite2, orbite3, orbite4]) {
        const bdLocale = await dernière.open(bd.address);
        const accèsLocal = bdLocale.access as InstanceContrôleurNébuleuse;
        await attendreQue(() =>
          accèsLocal.estUneModératrice(dernière.identity.id),
        );

        await (bdLocale.access as InstanceContrôleurNébuleuse).autoriser(
          MODÉRATRICE,
          orbite.identity.id,
        );
        dernière = orbite;
      }

      // Attendre que la base de donées originale reçoive la dernière modification
      await obtenir<AccèsDispositif[]>(({ si }) =>
        (bd.access as InstanceContrôleurNébuleuse).suivreDispositifsAutorisées(
          si((x) => !!x.find((d) => d.idDispositif === orbite4.identity.id)),
        ),
      );

      await bd.close();
      bd = (await orbite1.open(bd.address, {
        type: "keyvalue",
      })) as KeyValueDatabase;

      const accès = bd.access as InstanceContrôleurNébuleuse;
      for (const o of [orbite1, orbite2, orbite3, orbite4]) {
        const estAutorisé = await accès.estAutorisé(o.identity.id);
        expect(estAutorisé).to.be.true();
      }
    });
  });

  describe("par identité utilisateur", function () {
    let orbites: OrbitDB[];
    let orbite1: OrbitDB;
    let orbite2: OrbitDB;
    let orbite3: OrbitDB;

    let idCompte1: string;
    let idCompte2: string;

    let fermer: Oublier;
    let bd: KeyValueDatabase;
    let accès: InstanceContrôleurNébuleuse;

    before(async () => {
      ({ fermer, orbites } = await créerOrbitesTest({ n: 3 }));
      [orbite1, orbite2, orbite3] = orbites;
    });

    after(async () => {
      if (fermer) await fermer();
    });

    beforeEach(async () => {
      idCompte1 = (
        await orbite1.open(uuidv4(), {
          AccessController: ContrôleurNébuleuse(),
          type: "keyvalue",
        })
      ).address;
      idCompte2 = (
        await orbite2.open(uuidv4(), {
          AccessController: ContrôleurNébuleuse(),
          type: "keyvalue",
        })
      ).address;

      bd = (await orbite1.open(uuidv4(), {
        AccessController: ContrôleurNébuleuse({ écriture: idCompte1 }),
        type: "keyvalue",
      })) as KeyValueDatabase;
      accès = bd.access as InstanceContrôleurNébuleuse;
    });

    afterEach(async () => {
      await bd?.close();
    });

    it("la créatrice est une modératrice", async () => {
      expect(await accès.estUneModératrice(idCompte1)).to.be.true();
      expect(await accès.estUneModératrice(orbite1.identity.id)).to.be.true();

      expect(await accès.estAutorisé(orbite1.identity.id)).to.be.true();
      expect(await accès.estAutorisé(idCompte1)).to.be.true();
    });

    it("les autres ne sont pas des modératrices", async () => {
      expect(await accès.estUneModératrice(orbite2.identity.id)).to.be.false();
      expect(await accès.estAutorisé(orbite2.identity.id)).to.be.false();

      expect(await accès.estUneModératrice(idCompte2)).to.be.false();
      expect(await accès.estAutorisé(idCompte2)).to.be.false();
    });

    it("ajout d'un membre", async () => {
      await accès.autoriser(MEMBRE, idCompte2);

      // Effectué sur l'instance originale
      const membre = await accès.estUnMembre(idCompte2);
      expect(membre).to.be.true();

      const modératrice = await accès.estUneModératrice(idCompte2);
      expect(modératrice).to.be.false();

      // Effectué sur l'instance ajoutée
      const bdSurOrbite2 = (await orbite2.open(bd.address)) as KeyValueDatabase;
      const accès2 = bdSurOrbite2.access as InstanceContrôleurNébuleuse;
      await attendreInvité(bdSurOrbite2, idCompte2);

      const membreSurBd2 = await accès2.estUnMembre(idCompte2);
      expect(membreSurBd2).to.be.true();

      const modératriceSurBd2 = await accès2.estUneModératrice(idCompte2);
      expect(modératriceSurBd2).to.be.false();

      const autorisé = await peutÉcrire(bdSurOrbite2);
      expect(autorisé).to.be.true();
    });

    it("promotion d'un membre à une modératrice", async () => {
      await accès.autoriser(MEMBRE, idCompte2);

      await attendreInvité(bd, idCompte2);
      await accès.autoriser(MODÉRATRICE, idCompte2);
      await attendreQue(() => accès.estUneModératrice(idCompte2));

      // Effectué sur l'instance originale
      const membre = await accès.estUnMembre(idCompte2);
      expect(membre).to.be.true();

      const modératrice = await accès.estUneModératrice(idCompte2);
      expect(modératrice).to.be.true();

      // Effectué sur l'instance ajoutée
      const bdSurOrbite2 = (await orbite2.open(bd.address)) as KeyValueDatabase;
      const accès2 = bdSurOrbite2.access as InstanceContrôleurNébuleuse;

      await attendreInvité(bdSurOrbite2, idCompte2);

      const membreSurBd2 = await accès2.estUnMembre(idCompte2);
      expect(membreSurBd2).to.be.false();

      const modératriceSurBd2 = await accès2.estUneModératrice(idCompte2);
      expect(modératriceSurBd2).to.be.true();
    });

    it("erreur - un membre ne peut pas inviter d'autres membres", async () => {
      await accès.autoriser(MEMBRE, idCompte2);

      const bdSurOrbite2 = await orbite2.open(bd.address);
      await attendreInvité(bdSurOrbite2, idCompte2);

      const accès2 = bdSurOrbite2.access as InstanceContrôleurNébuleuse;

      await expect(
        accès2.autoriser(MEMBRE, orbite3.identity.id),
      ).to.eventually.be.rejectedWith(
        `Le rôle ${MEMBRE} ne peut pas être octroyé à ${orbite3.identity.id}.`,
      );
    });

    it("une modératrice peut ajouter un membre", async () => {
      await accès.autoriser(MODÉRATRICE, idCompte2);

      const bdSurOrbite2 = await orbite2.open(bd.address);
      const accès2 = bdSurOrbite2.access as InstanceContrôleurNébuleuse;
      await attendreQue(() => accès2.estUneModératrice(orbite2.identity.id));

      await accès2.autoriser(MEMBRE, orbite3.identity.id);
      const bdSurOrbite3 = (await orbite3.open(bd.address)) as KeyValueDatabase;
      await attendreInvité(bdSurOrbite3, orbite3.identity.id);

      const autorisé = await peutÉcrire(bdSurOrbite3);
      expect(autorisé).to.be.true();
    });

    it("un membre peut ajouter son propre dispositif", async () => {
      await accès.autoriser(MEMBRE, idCompte2);

      const bdSurOrbite2 = await orbite2.open(bd.address);
      await attendreInvité(bdSurOrbite2, orbite2.identity.id);

      const compte2 = await orbite2.open(idCompte2);
      const accèsCompte2 = compte2.access as InstanceContrôleurNébuleuse;
      await accèsCompte2.autoriser(MODÉRATRICE, orbite3.identity.id);

      const bdSurOrbite3 = (await orbite3.open(bd.address)) as KeyValueDatabase;
      await attendreInvité(bdSurOrbite3, orbite3.identity.id);

      const autorisé = await peutÉcrire(bdSurOrbite3);
      expect(autorisé).to.be.true();
    });

    it("utilisateurs autorisés", async () => {
      const promesseUtilisateurs = obtenir<AccèsUtilisateur[]>(({ si }) =>
        accès.suivreUtilisateursAutorisés(si((x) => x.length > 1)),
      );
      await accès.autoriser(MEMBRE, idCompte2);

      const autorisés = await promesseUtilisateurs;

      const réf: AccèsUtilisateur[] = [
        {
          idCompte: idCompte1,
          rôle: MODÉRATRICE,
        },
        {
          idCompte: idCompte2,
          rôle: MEMBRE,
        },
      ];

      const réfDispositifs: AccèsDispositif[] = [
        {
          idDispositif: orbite1.identity.id,
          rôle: MODÉRATRICE,
        },
        {
          idDispositif: orbite2.identity.id,
          rôle: MEMBRE,
        },
      ];

      expect(autorisés).to.have.deep.members(réf);
      expect(await accès.dispositifsAutorisés()).to.have.deep.members(
        réfDispositifs,
      );
    });

    it("dispositifs autorisés", async () => {
      const promesseUtilisateurs = obtenir<AccèsDispositif[]>(({ si }) =>
        accès.suivreDispositifsAutorisées(si((x) => x.length > 1)),
      );
      await accès.autoriser(MEMBRE, idCompte2);

      const autorisés = await promesseUtilisateurs;
      const réf: AccèsDispositif[] = [
        {
          rôle: MODÉRATRICE,
          idDispositif: orbite1.identity.id,
        },
        {
          rôle: MEMBRE,
          idDispositif: orbite2.identity.id,
        },
      ];

      expect(autorisés).to.have.deep.members(réf);
      expect(await accès.dispositifsAutorisés()).to.have.deep.members(réf);
    });

    it("erreur si rôle invalide", async () => {
      await expect(
        // @ts-expect-error On fait exprès
        accès.autoriser("MAUVAIS RÔLE", idCompte2),
      ).to.eventually.be.rejectedWith("n'existe pas");
    });
  });
});
