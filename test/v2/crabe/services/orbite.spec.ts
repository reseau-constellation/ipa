import {
  OptionsDéfautLibp2pNavigateur,
  OptionsDéfautLibp2pNode,
  ServicesLibp2pTest,
  créerOrbitesTest,
  dossierTempo,
  que,
} from "@constl/utils-tests";
import {
  BaseDatabase,
  IPFSAccessController,
  KeyValueDatabase,
  OrbitDB,
  createOrbitDB,
} from "@orbitdb/core";
import { expect } from "aegir/chai";
import { createHelia } from "helia";
import { createLibp2p } from "libp2p";
import { isBrowser } from "wherearewe";
import { v4 as uuidv4 } from "uuid";
import { adresseOrbiteValide } from "@constl/utils-ipa";
import { JSONSchemaType } from "ajv";
import { NestedObjectToMap, toObject } from "@orbitdb/nested-db";
import { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import { ServicesNécessairesOrbite } from "@/v2/crabe/services/orbite/orbite.js";
import {
  ServiceLibp2p,
  ServiceHélia,
  ServiceStockage,
  ServiceOrbite,
} from "@/v2/crabe/index.js";
import { Oublier } from "@/v2/crabe/types.js";
import { ORIGINALE, mandatOrbite } from "@/v2/crabe/services/orbite/mandat.js";
import { ServiceJournal } from "@/v2/crabe/services/journal.js";
import { obtenir } from "../../../utils/utils.js";
import { ServiceLibp2pTest } from "./utils.js";
import { attendreQue } from "../../nébuleuse/utils/fonctions.js";

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
    await fermer();
  });

  it("condition concurrence sans mandataire", async () => {
    // Si un jour ce test ne passe plus, c'est que OrbitDB réglé le problème et que le mandataire n'est plus nécessaire !
    const idBd = (
      await orbites[0].open("bd test" + uuidv4(), { type: "keyvalue" })
    ).address;

    await expect(Promise.all([
      orbites[1].open(idBd),
      orbites[1].open(idBd),
    ])).to.eventually.be.rejected();

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
    const bd = (
      await orbites[0].open("bd test" + uuidv4(), {
        type: "keyvalue",
        AccessController: IPFSAccessController({
          write: [orbites[0].identity.id, orbites[1].identity.id],
        }),
      })
    ) as KeyValueDatabase;

    const idBd = bd.address;
    await bd.put("a", 1);

    const mandat = mandatOrbite(orbites[1]);
    const [bd1, bd2] = (await Promise.all([
      mandat.open(idBd),
      mandat.open(idBd),
    ])) as [KeyValueDatabase, KeyValueDatabase];

    await attendreQue(async () => (await bd1.all()).length > 0 && (await bd2.all()).length > 0)

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
    let nébuleuse: Nébuleuse<ServicesNécessairesOrbite>;

    before(async () => {
      ({ dossier, effacer } = await dossierTempo());
    });

    after(async () => {
      await nébuleuse.fermer();
      effacer();
    });

    it("orbite démarre", async () => {
      nébuleuse = new Nébuleuse<ServicesNécessairesOrbite>({
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
      await nébuleuse.démarrer();

      const serviceOrbite = nébuleuse.services["orbite"];
      const orbite = await serviceOrbite.orbite();

      expect(orbite).to.exist();
    });
  });

  describe("fermer", function () {
    let nébuleuse: Nébuleuse<ServicesNécessairesOrbite>;

    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempo());
    });

    afterEach(async () => {
      await nébuleuse.fermer();
      effacer();
    });

    it("orbite fermé si endogène", async () => {
      nébuleuse = new Nébuleuse<ServicesNécessairesOrbite>({
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
      await nébuleuse.démarrer();

      const serviceOrbite = nébuleuse.services["orbite"];
      const orbite = await serviceOrbite.orbite();
      await nébuleuse.fermer();

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

      nébuleuse = new Nébuleuse<ServicesNécessairesOrbite>({
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
      await nébuleuse.démarrer();

      const serviceOrbite = nébuleuse.services["orbite"];
      const orbite = await serviceOrbite.orbite();
      await nébuleuse.fermer();

      expect(orbite.ipfs.libp2p.status).to.equal("started");
      await orbite.stop();
      await orbite.ipfs.stop();
    });
  });

  describe("bds", function () {
    let dossier: string;
    let effacer: () => void;

    let nébuleuse: Nébuleuse<ServicesNécessairesOrbite>;

    before(async () => {
      ({ dossier, effacer } = await dossierTempo());
      nébuleuse = new Nébuleuse<ServicesNécessairesOrbite>({
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
      await nébuleuse.démarrer();
    });

    after(async () => {
      await nébuleuse.fermer();
      effacer();
    });

    it("créer bd", async () => {
      const orbite = nébuleuse.services["orbite"];
      const { bd, oublier } = await orbite.créerBd({ type: "keyvalue" });
      await oublier();

      expect(adresseOrbiteValide(bd.address)).to.be.true();
    });

    it("ouvrir bd", async () => {
      const orbite = nébuleuse.services["orbite"];

      const { bd, oublier } = await orbite.créerBd({ type: "keyvalue" });

      await bd.put("a", 2);
      const val = await bd.get("a");

      await oublier();

      expect(val).to.equal(2);
    });

    it("erreur ouverture si mauvais type", async () => {
      const orbite = nébuleuse.services["orbite"];

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
      const orbite = nébuleuse.services["orbite"];

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
      const orbite = nébuleuse.services["orbite"];

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
      const orbite = nébuleuse.services["orbite"];

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
      const orbite = nébuleuse.services["orbite"];

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
      const orbite = nébuleuse.services["orbite"];

      const { bd, oublier } = await orbite.créerBd({ type: "keyvalue" });
      const idBd = bd.address;
      
      await bd.put("a", 2);
      
      await oublier();

      await orbite.effacerBd({ id: idBd });
      
      const { bd: bdRouverte, oublier: roublier } = await orbite.ouvrirBd({ id: idBd, type: "keyvalue" });
      const valeurs = await bdRouverte.all()
      expect(valeurs.length).to.equal(0);
      
      await roublier();
    });
  });

  describe("fermeture", function () {
    let dossier: string;
    let effacer: () => void;

    let nébuleuse: Nébuleuse<ServicesNécessairesOrbite>;

    before(async () => {
      ({ dossier, effacer } = await dossierTempo());
      nébuleuse = new Nébuleuse<ServicesNécessairesOrbite>({
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
      await nébuleuse.démarrer();
    });

    after(async () => {
      await nébuleuse.fermer();
      effacer();
    });

    it("erreur ouverture si annulée", async () => {
      const orbite = nébuleuse.services["orbite"];
      await nébuleuse.fermer();

      await orbite.créerBd({ type: "keyvalue" });
    });
  });
});

