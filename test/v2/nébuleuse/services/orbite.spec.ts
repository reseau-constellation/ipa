import {
  OptionsDéfautLibp2pNavigateur,
  OptionsDéfautLibp2pNode,
  créerOrbitesTest,
  que,
} from "@constl/utils-tests";
import {
  IPFSAccessController,
  createOrbitDB,
  isValidAddress,
} from "@orbitdb/core";
import { expect } from "aegir/chai";
import { createHelia } from "helia";
import { createLibp2p } from "libp2p";
import { isBrowser } from "wherearewe";
import { v4 as uuidv4 } from "uuid";
import { toObject } from "@orbitdb/nested-db";
import { Appli } from "@/v2/appli/appli.js";
import {
  ServiceLibp2p,
  ServiceHélia,
  ServiceStockage,
  ServiceOrbite,
} from "@/v2/nébuleuse/index.js";
import {
  ORIGINALE,
  mandatOrbite,
} from "@/v2/nébuleuse/services/orbite/mandat.js";
import { ServiceJournal } from "@/v2/nébuleuse/services/journal.js";
import { obtenir, dossierTempoPropre } from "../../utils.js";
import { attendreQue } from "../../appli/utils/fonctions.js";
import { ServiceLibp2pTest } from "./utils.js";
import type { Oublier } from "@/v2/nébuleuse/types.js";
import type { ServicesNécessairesOrbite } from "@/v2/nébuleuse/services/orbite/orbite.js";
import type { NestedObjectToMap } from "@orbitdb/nested-db";
import type { JSONSchemaType } from "ajv";
import type { BaseDatabase, KeyValueDatabase, OrbitDB } from "@orbitdb/core";
import type { ServicesLibp2pTest } from "@constl/utils-tests";

describe.only("Mandataire OrbitDB", function () {
  let orbites: OrbitDB<ServicesLibp2pTest>[];
  let fermer: Oublier;

  const mêmeBd = (bd1: BaseDatabase, bd2: BaseDatabase): boolean => {
    // @ts-expect-error Les mandataires des bds orbite ont la propriété `ORIGINALE`
    return bd1[ORIGINALE] === bd2[ORIGINALE];
  };

  before(async () => {
    ({ orbites, fermer } = await créerOrbitesTest({ n: 2 }));
  });

  after(async () => {
    if (fermer) await fermer();
  });

  it("condition concurrence sans mandataire", async () => {
    // Si un jour ce test ne passe plus, c'est que OrbitDB réglé le problème et que le mandataire n'est plus nécessaire !
    const idBd = (
      await orbites[0].open("bd test" + uuidv4(), { type: "keyvalue" })
    ).address;

    await expect(
      Promise.all([orbites[1].open(idBd), orbites[1].open(idBd)]),
    ).to.eventually.be.rejected();
  });

  it("sans concurrence avec le mandataire", async () => {
    const idBd = (
      await orbites[0].open("bd test" + uuidv4(), { type: "keyvalue" })
    ).address;
    const mandat = mandatOrbite(orbites[1]);
    const bd1 = await mandat.open(idBd);
    const bd2 = await mandat.open(idBd);

    expect(mêmeBd(bd1, bd2)).to.be.true();
  });

  it("pas de concurrence avec le mandataire", async () => {
    const idBd = (
      await orbites[0].open("bd test" + uuidv4(), { type: "keyvalue" })
    ).address;
    const mandat = mandatOrbite(orbites[1]);
    const [bd1, bd2] = await Promise.all([
      mandat.open(idBd),
      mandat.open(idBd),
    ]);

    expect(mêmeBd(bd1, bd2)).to.be.true();
  });

  it("multiples instances du mandataire", async () => {
    const idBd = (
      await orbites[0].open("bd test" + uuidv4(), { type: "keyvalue" })
    ).address;

    // Ici on appelle le mandataire séparément sur la même base de données
    const [bd1, bd2] = await Promise.all([
      mandatOrbite(orbites[1]).open(idBd),
      mandatOrbite(orbites[1]).open(idBd),
    ]);

    expect(mêmeBd(bd1, bd2)).to.be.true();
  });

  it("fermeture bd", async () => {
    const idBd = (
      await orbites[0].open("bd test" + uuidv4(), {
        type: "keyvalue",
        AccessController: IPFSAccessController({
          write: [orbites[0].identity.id, orbites[1].identity.id],
        }),
      })
    ).address;

    const mandat = mandatOrbite(orbites[1]);
    const [bd1, bd2] = (await Promise.all([
      mandat.open(idBd),
      mandat.open(idBd),
    ])) as [KeyValueDatabase, KeyValueDatabase];
    await bd1.close();

    // Toujours ouverte
    await bd1.put("a", 1);
    await bd2.put("b", 2);

    await bd2.close();

    // Bien fermée
    await expect(bd1.put("c", 3)).to.eventually.be.rejected();
    await expect(bd2.put("c", 3)).to.eventually.be.rejected();
  });

  it("réouvrir bd", async () => {
    const idBd = (
      await orbites[0].open("bd test" + uuidv4(), { type: "keyvalue" })
    ).address;

    const mandat = mandatOrbite(orbites[0]);
    const bd = (await mandat.open(idBd)) as KeyValueDatabase;
    await bd.put("a", 1);

    // Fermer
    await bd.close();

    // Bien fermée
    await expect(bd.put("a", 0)).to.eventually.be.rejected();

    // Réouvrir
    const bdRéouverte = (await mandat.open(idBd)) as KeyValueDatabase;

    // Bien ouverte
    await bdRéouverte.put("b", 2);
    const val = await bdRéouverte.all();

    expect(
      val.map((é) => ({ key: é.key, value: é.value })),
    ).to.have.deep.members([
      { key: "a", value: 1 },
      { key: "b", value: 2 },
    ]);
  });

  it("effacer bd", async () => {
    const bd = (await orbites[0].open("bd test" + uuidv4(), {
      type: "keyvalue",
      AccessController: IPFSAccessController({
        write: [orbites[0].identity.id, orbites[1].identity.id],
      }),
    })) as KeyValueDatabase;

    const idBd = bd.address;
    await bd.put("a", 1);

    const mandat = mandatOrbite(orbites[1]);
    const [bd1, bd2] = (await Promise.all([
      mandat.open(idBd),
      mandat.open(idBd),
    ])) as [KeyValueDatabase, KeyValueDatabase];

    await attendreQue(
      async () => (await bd1.all()).length > 0 && (await bd2.all()).length > 0,
    );
    await bd.close();

    await bd1.drop();

    // Bien fermée
    expect((await bd1.all()).length).to.equal(0);
    expect((await bd2.all()).length).to.equal(0);
  });
});

describe.only("Service Orbite", function () {
  describe("démarrer", function () {
    let dossier: string;
    let effacer: () => void;
    let appli: Appli<ServicesNécessairesOrbite>;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    after(async () => {
      await appli.fermer();
      effacer();
    });

    it("orbite démarre", async () => {
      appli = new Appli<ServicesNécessairesOrbite>({
        services: {
          journal: ServiceJournal,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
          stockage: ServiceStockage,
          orbite: ServiceOrbite,
        },
        options: {
          dossier,
        },
      });
      await appli.démarrer();

      const serviceOrbite = appli.services["orbite"];
      const orbite = await serviceOrbite.orbite();

      expect(orbite).to.exist();
    });
  });

  describe("fermer", function () {
    let appli: Appli<ServicesNécessairesOrbite>;

    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    afterEach(async () => {
      await appli.fermer();
      effacer();
    });

    it("orbite fermé si endogène", async () => {
      appli = new Appli<ServicesNécessairesOrbite>({
        services: {
          journal: ServiceJournal,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
          stockage: ServiceStockage,
          orbite: ServiceOrbite,
        },
        options: {
          dossier,
        },
      });
      await appli.démarrer();

      const serviceOrbite = appli.services["orbite"];
      const orbite = await serviceOrbite.orbite();
      await appli.fermer();

      expect(orbite.ipfs.libp2p.status).to.equal("stopped");
    });

    it("orbite non fermé si exogène", async () => {
      const libp2p = await createLibp2p(
        isBrowser ? OptionsDéfautLibp2pNavigateur() : OptionsDéfautLibp2pNode(),
      );
      const hélia = await createHelia({ libp2p });
      const orbiteOriginale = await createOrbitDB({
        ipfs: hélia,
        directory: dossier,
      });

      appli = new Appli<ServicesNécessairesOrbite>({
        services: {
          journal: ServiceJournal,
          // On n'a pas besoin de ServiceLibp2pTest parce que `libp2p` est externe
          libp2p: ServiceLibp2p,
          hélia: ServiceHélia,
          stockage: ServiceStockage,
          orbite: ServiceOrbite,
        },
        options: {
          dossier,
          services: {
            orbite: {
              orbite: orbiteOriginale,
            },
          },
        },
      });
      await appli.démarrer();

      const serviceOrbite = appli.services["orbite"];
      const orbite = await serviceOrbite.orbite();
      await appli.fermer();

      expect(orbite.ipfs.libp2p.status).to.equal("started");
      await orbite.stop();
      await orbite.ipfs.stop();
    });
  });

  describe("bds", function () {
    let dossier: string;
    let effacer: () => void;

    let appli: Appli<ServicesNécessairesOrbite>;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      appli = new Appli<ServicesNécessairesOrbite>({
        services: {
          journal: ServiceJournal,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
          stockage: ServiceStockage,
          orbite: ServiceOrbite,
        },
        options: {
          dossier,
        },
      });
      await appli.démarrer();
    });

    after(async () => {
      await appli.fermer();
      effacer();
    });

    it("créer bd", async () => {
      const orbite = appli.services["orbite"];
      const { bd, oublier } = await orbite.créerBd({ type: "keyvalue" });
      await oublier();

      expect(isValidAddress(bd.address)).to.be.true();
    });

    it("ouvrir bd", async () => {
      const orbite = appli.services["orbite"];

      const { bd, oublier } = await orbite.créerBd({ type: "keyvalue" });

      await bd.put("a", 2);
      const val = await bd.get("a");

      await oublier();

      expect(val).to.equal(2);
    });

    it("erreur ouverture si mauvais type", async () => {
      const orbite = appli.services["orbite"];

      const { bd, oublier } = await orbite.créerBd({ type: "keyvalue" });
      const idBd = bd.address;
      await oublier();

      await expect(
        orbite.ouvrirBd({ id: idBd, type: "feed" }),
      ).to.eventually.be.rejectedWith(
        "La bd est de type keyvalue et non feed.",
      );
    });

    it("suivre bd", async () => {
      const orbite = appli.services["orbite"];

      const { bd, oublier } = await orbite.créerBd({ type: "keyvalue" });
      const idBd = bd.address;

      await bd.put("a", 2);

      const val = await obtenir<KeyValueDatabase>(({ siDéfini }) =>
        orbite.suivreBd({ id: idBd, type: "keyvalue", f: siDéfini() }),
      );
      await oublier();

      expect(await val.get("a")).to.equal(2);
    });

    it("erreur suivi bd si mauvais type", async () => {
      const orbite = appli.services["orbite"];

      const { bd, oublier } = await orbite.créerBd({ type: "keyvalue" });
      const idBd = bd.address;
      await oublier();

      await expect(
        orbite.suivreBd({ id: idBd, type: "feed", f: console.log }),
      ).to.eventually.be.rejectedWith(
        "La bd est de type keyvalue et non feed.",
      );
    });

    it("suivre bd typée", async () => {
      const orbite = appli.services["orbite"];

      const { bd, oublier } = await orbite.créerBd({ type: "keyvalue" });
      const idBd = bd.address;

      const schéma: JSONSchemaType<{ a?: number }> = {
        type: "object",
        properties: { a: { type: "number", nullable: true } },
      };

      let a: number | undefined = undefined;
      const oublierTypée = await orbite.suivreBdTypée({
        id: idBd,
        type: "keyvalue",
        schéma,
        f: async (bd) => {
          a = await bd.get("a");
        },
      });

      await bd.put("a", 2);
      await que(() => a !== undefined);

      await oublier();
      await oublierTypée();

      expect(a).to.equal(2);
    });

    it("suivre données bd", async () => {
      const orbite = appli.services["orbite"];

      const { bd, oublier } = await orbite.créerBd({ type: "nested" });
      const idBd = bd.address;

      await bd.put("a", 2);
      await oublier();

      const schéma: JSONSchemaType<{ a?: number }> = {
        type: "object",
        properties: { a: { type: "number", nullable: true } },
      };

      const val = await obtenir<NestedObjectToMap<{ a?: number }>>(
        ({ siDéfini }) =>
          orbite.suivreDonnéesBd({
            id: idBd,
            type: "nested",
            schéma,
            f: siDéfini(),
          }),
      );

      expect(toObject(val)).to.deep.equal({ a: 2 });
    });

    it("effacer bd", async () => {
      const orbite = appli.services["orbite"];

      const { bd, oublier } = await orbite.créerBd({ type: "keyvalue" });
      const idBd = bd.address;

      await bd.put("a", 2);

      await oublier();

      await orbite.effacerBd({ id: idBd });

      const { bd: bdRouverte, oublier: roublier } = await orbite.ouvrirBd({
        id: idBd,
        type: "keyvalue",
      });
      const valeurs = await bdRouverte.all();
      expect(valeurs.length).to.equal(0);

      await roublier();
    });

    it("suivre empreinte tête bd", async () => {
      const orbite = appli.services["orbite"];

      const { bd, oublier } = await orbite.créerBd({ type: "keyvalue" });
      const idBd = bd.address;

      const tête = await obtenir<string>(({ siDéfini }) =>
        orbite.suivreEmpreinteTêteBd({ idBd, f: siDéfini() }),
      );
      expect(tête).to.equal("");

      await bd.put("a", 1);

      const pTêteMaintenant = obtenir<string>(({ si }) =>
        orbite.suivreEmpreinteTêteBd({ idBd, f: si((t) => t !== tête) }),
      );

      const têteMaintenant = await pTêteMaintenant;
      await oublier();

      expect(têteMaintenant.length).to.be.greaterThan(0);
    });

    it("appliquer fonction orbite", async () => {
      const orbite = appli.services["orbite"];

      const { bd, oublier } = await orbite.créerBd({ type: "keyvalue" });
      const résultat = await orbite.appliquerFonctionBdOrbite<
        KeyValueDatabase,
        "put"
      >({
        idBd: bd.address,
        fonction: "put",
        args: ["a", 2],
      });
      const données = await bd.all();

      await oublier();

      expect(données).to.deep.equal({ a: 2 });
      expect(typeof résultat).to.equal("string");
    });
  });

  describe("signatures", function () {
    let dossier: string;
    let effacer: () => void;

    let appli: Appli<ServicesNécessairesOrbite>;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      appli = new Appli<ServicesNécessairesOrbite>({
        services: {
          journal: ServiceJournal,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
          stockage: ServiceStockage,
          orbite: ServiceOrbite,
        },
        options: {
          dossier,
        },
      });
      await appli.démarrer();
    });

    after(async () => {
      await appli.fermer();
      effacer();
    });

    it("signature valide", async () => {
      const orbite = appli.services["orbite"];

      const message = "Je suis un message";
      const signature = await orbite.signer({ message });
      const valide = await orbite.vérifierSignature({ signature, message });
      expect(valide).to.be.true();
    });

    it("signature invalide pour un autre message", async () => {
      const orbite = appli.services["orbite"];

      const message = "Je suis un message";
      const autreMessage = "Je suis un message!";
      const signature = await orbite.signer({ message });
      const valide = await orbite.vérifierSignature({
        signature,
        message: autreMessage,
      });
      expect(valide).to.be.false();
    });

    it("signature invalide si clef publique absente", async () => {
      const orbite = appli.services["orbite"];

      const message = "Je suis un message";
      const signature = await orbite.signer({ message });

      const valide = await orbite.vérifierSignature({
        // @ts-expect-error On fait exprès d'exclure la clef publique
        signature: { signature: signature.signature },
        message,
      });
      expect(valide).to.be.false();
    });
  });

  describe("fermeture", function () {
    let dossier: string;
    let effacer: () => void;

    let appli: Appli<ServicesNécessairesOrbite>;

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      appli = new Appli<ServicesNécessairesOrbite>({
        services: {
          journal: ServiceJournal,
          libp2p: ServiceLibp2pTest,
          hélia: ServiceHélia,
          stockage: ServiceStockage,
          orbite: ServiceOrbite,
        },
        options: {
          dossier,
        },
      });
      await appli.démarrer();
    });

    after(async () => {
      await appli.fermer();
      effacer();
    });

    it("erreur ouverture si annulée", async () => {
      const orbite = appli.services["orbite"];
      await appli.fermer();

      await expect(
        orbite.créerBd({ type: "keyvalue" }),
      ).to.eventually.be.rejectedWith("Service orbite déjà fermé.");
    });
  });
});
