import { KeyValueDatabase, OrbitDB } from "@orbitdb/core";
import { expect } from "aegir/chai";
import { v4 as uuidv4 } from "uuid";
import { créerOrbitesTest } from "@constl/utils-tests";
import { obtenir } from "@constl/utils-ipa";
import {
  AccèsDispositif,
  AccèsUtilisateur,
  ContrôleurConstellation,
  InstanceContrôleurConstellation,
  MEMBRE,
  MODÉRATRICE,
} from "@/v2/crabe/services/compte/accès/index.js";
import { Oublier } from "@/v2/crabe/types.js";
import { attendreInvité, peutÉcrire } from "./../../../utils.js";
import { attendreQue } from "../../../nébuleuse/utils/fonctions.js";

describe.only("Accès", function () {
  describe("par identités orbite", function () {
    let orbites: OrbitDB[];
    let orbite1: OrbitDB;
    let orbite2: OrbitDB;
    let orbite3: OrbitDB;
    let orbite4: OrbitDB;

    let fermer: Oublier;
    let bd: KeyValueDatabase;
    let accès: InstanceContrôleurConstellation;

    before(async () => {
      ({ fermer, orbites } = await créerOrbitesTest({ n: 4 }));
      [orbite1, orbite2, orbite3, orbite4] = orbites;
    });

    after(async () => {
      await fermer();
    });

    beforeEach(async () => {
      bd = (await orbite1.open(uuidv4(), {
        AccessController: ContrôleurConstellation(),
        type: "keyvalue",
      })) as KeyValueDatabase;
      accès = bd.access as InstanceContrôleurConstellation;
    });

    afterEach(async () => {
      await bd?.close();
    });

    it("la créatrice est une modératrice", async () => {
      expect(await accès.estUneModératrice(orbite1.identity.id)).to.be.true();
      expect(await accès.estAutorisé(orbite1.identity.id)).to.be.true();
    });

    it("les autres ne sont pas des modératrice", async () => {
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
      const accès2 = bdSurOrbite2.access as InstanceContrôleurConstellation;
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

    it("erreur - un membre ne peut pas inviter d'autres membres", async () => {
      await accès.autoriser(MEMBRE, orbite2.identity.id);
      const bdSurOrbite2 = await orbite2.open(bd.address);
      const accès2 = bdSurOrbite2.access as InstanceContrôleurConstellation;

      await expect(
        accès2.autoriser(MEMBRE, orbite3.identity.id),
      ).to.eventually.be.rejectedWith(
        `Le rôle ${MEMBRE} ne peut pas être octroyé à ${orbite3.identity.id}.`,
      );
    });

    it("une modératrice peut ajouter un membre", async () => {
      await accès.autoriser(MODÉRATRICE, orbite2.identity.id);

      const bdSurOrbite2 = await orbite2.open(bd.address);
      const accès2 = bdSurOrbite2.access as InstanceContrôleurConstellation;

      await accès2.autoriser(MEMBRE, orbite3.identity.id);

      const bdSurOrbite3 = (await orbite3.open(bd.address)) as KeyValueDatabase;

      await attendreInvité(bdSurOrbite3, orbite3.identity.id);

      const autorisé = await peutÉcrire(bdSurOrbite3);
      expect(autorisé).to.be.true();
    });

    it("une modératrice peut ajouter une autre modératrice", async () => {
      await accès.autoriser(MODÉRATRICE, orbite2.identity.id);

      const bdSurOrbite2 = await orbite2.open(bd.address);
      const accès2 = bdSurOrbite2.access as InstanceContrôleurConstellation;

      await accès2.autoriser(MODÉRATRICE, orbite3.identity.id);

      const bdSurOrbite3 = (await orbite3.open(bd.address)) as KeyValueDatabase;

      await attendreInvité(bdSurOrbite3, orbite3.identity.id);

      const modératrice = await (
        bdSurOrbite3.access as InstanceContrôleurConstellation
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
      expect(await accès.utilisateursAutorisés()).to.be.empty();
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
      const accès2 = bdSurOrbite2.access as InstanceContrôleurConstellation;

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
        AccessController: ContrôleurConstellation({
          écriture: adresseContrôleur1,
        }),
      });

      // Fermerture d'une des bases de données
      await bd.close();

      // Le contrôleur de l'autre fonctionne toujours
      await (bd2.access as InstanceContrôleurConstellation).autoriser(
        MEMBRE,
        orbite2.identity.id,
      );

      const bd2SurOrbite2 = (await orbite2.open(
        bd2.address,
      )) as KeyValueDatabase;
      // On attend que les permissions se propagent
      await attendreInvité(bd2SurOrbite2, orbite2.identity.id)
      await bd2SurOrbite2.set("a", 1);

      expect(await bd2SurOrbite2.get("a")).to.equal(1);
      await bd2.close();
    });

    it("Invitations transitives après fermeture de la bd", async () => {
      let dernière = orbite1;
      for (const orbite of [orbite2, orbite3, orbite4]) {
        const bdLocale = await dernière.open(bd.address);
        await (bdLocale.access as InstanceContrôleurConstellation).autoriser(
          MODÉRATRICE,
          orbite.identity.id,
        );
        dernière = orbite;
      }

      // Attendre que la base de donées originale reçoive la dernière modification
      await obtenir<AccèsDispositif[]>(({ si }) =>
        (bd.access as InstanceContrôleurConstellation).suivreDispositifsAutorisées(
          si((x) => !!x.find((d) => d.idDispositif === orbite4.identity.id)),
        ),
      );

      await bd.close();
      bd = (await orbite1.open(bd.address, {
        type: "keyvalue",
      })) as KeyValueDatabase;

      const accès = bd.access as InstanceContrôleurConstellation;
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
    let accès: InstanceContrôleurConstellation;

    before(async () => {
      ({ fermer, orbites } = await créerOrbitesTest({ n: 3 }));
      [orbite1, orbite2, orbite3] = orbites;
    });

    after(async () => {
      await fermer();
    });

    beforeEach(async () => {
      idCompte1 = (
        await orbite1.open(uuidv4(), {
          AccessController: ContrôleurConstellation(),
          type: "keyvalue",
        })
      ).address;
      idCompte2 = (
        await orbite2.open(uuidv4(), {
          AccessController: ContrôleurConstellation(),
          type: "keyvalue",
        })
      ).address;
      console.log({idCompte1, idCompte2})

      bd = (await orbite1.open(uuidv4(), {
        AccessController: ContrôleurConstellation({ écriture: idCompte1 }),
        type: "keyvalue",
      })) as KeyValueDatabase;
      accès = bd.access as InstanceContrôleurConstellation;
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

    it("les autres ne sont pas des modératrice", async () => {
      expect(await accès.estUneModératrice(orbite2.identity.id)).to.be.false();
      expect(await accès.estAutorisé(orbite2.identity.id)).to.be.false();

      expect(await accès.estUneModératrice(idCompte2)).to.be.false();
      expect(await accès.estAutorisé(idCompte2)).to.be.false();
    });

    it("ajout d'un membre", async () => {
      await accès.autoriser(MEMBRE, idCompte2);
      console.log("membre autorisé")

      // Effectué sur l'instance originale
      const membre = await accès.estUnMembre(idCompte2);
      expect(membre).to.be.true();

      const modératrice = await accès.estUneModératrice(idCompte2);
      expect(modératrice).to.be.false();

      // Effectué sur l'instance ajoutée
      const bdSurOrbite2 = (await orbite2.open(bd.address)) as KeyValueDatabase;
      const accès2 = bdSurOrbite2.access as InstanceContrôleurConstellation;
      await attendreInvité(bdSurOrbite2, idCompte2);
      console.log("accès sur bd2 détecté")

      const membreSurBd2 = await accès2.estUnMembre(idCompte2);
      expect(membreSurBd2).to.be.true();

      const modératriceSurBd2 = await accès2.estUneModératrice(idCompte2);
      expect(modératriceSurBd2).to.be.false();

      const autorisé = await peutÉcrire(bdSurOrbite2);
      console.log("peut êcrire")
      expect(autorisé).to.be.true();
    });

    it("erreur - un membre ne peut pas inviter d'autres membres", async () => {
      await accès.autoriser(MEMBRE, idCompte2);

      const bdSurOrbite2 = await orbite2.open(bd.address);
      await attendreInvité(bdSurOrbite2, idCompte2);

      const accès2 = bdSurOrbite2.access as InstanceContrôleurConstellation;

      await expect(
        accès2.autoriser(MEMBRE, orbite3.identity.id),
      ).to.eventually.be.rejectedWith(
        `Le rôle ${MEMBRE} ne peut pas être octroyé à ${orbite3.identity.id}.`,
      );
    });

    it("une modératrice peut ajouter un membre", async () => {
      await accès.autoriser(MODÉRATRICE, idCompte2);
      console.log("ici 1")
      
      const bdSurOrbite2 = await orbite2.open(bd.address);
      const accès2 = bdSurOrbite2.access as InstanceContrôleurConstellation;
      await attendreQue(() => accès2.estUneModératrice(orbite2.identity.id))
      console.log("ici 2")

      await accès2.autoriser(MEMBRE, orbite3.identity.id);
      console.log("ici 2.1")
      const bdSurOrbite3 = (await orbite3.open(bd.address)) as KeyValueDatabase;
      console.log("ici 2.2")
      await attendreInvité(bdSurOrbite3, orbite3.identity.id);
      console.log("ici 3")
      const autorisé = await peutÉcrire(bdSurOrbite3);
      expect(autorisé).to.be.true();
    });

    it("un membre peut ajouter son propre dispositif", async () => {
      await accès.autoriser(MEMBRE, idCompte2);
      console.log("dispo membre ici 0")

      const bdSurOrbite2 = await orbite2.open(bd.address);
      await attendreInvité(bdSurOrbite2, orbite2.identity.id);
      console.log("dispo membre ici 1")

      const compte2 = await orbite2.open(idCompte2);
      const accèsCompte2 = compte2.access as InstanceContrôleurConstellation;
      await accèsCompte2.autoriser(MODÉRATRICE, orbite3.identity.id);
      console.log("dispo membre ici 2")

      const bdSurOrbite3 = (await orbite3.open(bd.address)) as KeyValueDatabase;
      await attendreInvité(bdSurOrbite3, orbite3.identity.id);
      console.log("dispo membre ici 3")

      const autorisé = await peutÉcrire(bdSurOrbite3);
      console.log("dispo membre ici 4")
      expect(autorisé).to.be.true();
    });

    it("utilisateurs autorisés", async () => {
      console.log("utilisateurs autorisés ici 0")
      const promesseUtilisateurs = obtenir<AccèsUtilisateur[]>(({ si }) =>
        accès.suivreUtilisateursAutorisés(si((x) => x.length > 1)),
      );
      await accès.autoriser(MEMBRE, idCompte2);
      console.log("utilisateurs autorisés ici 1")
      
      const autorisés = await promesseUtilisateurs;
      console.log("utilisateurs autorisés ici 2")
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
        }
      ]

      expect(autorisés).to.have.deep.members(réf);
      expect(await accès.dispositifsAutorisés()).to.have.deep.members(réfDispositifs);
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
