import fs from "fs";
import { join } from "path";
import { OrbitDB } from "@orbitdb/core";
import { expect } from "aegir/chai";
import { Helia } from "helia";
import { Libp2p, Libp2pOptions, createLibp2p, isLibp2p } from "libp2p";
import {
  OptionsDéfautLibp2pNavigateur,
  OptionsDéfautLibp2pNode,
  ServicesLibp2pTest,
  créerOrbitesTest,
} from "@constl/utils-tests";
import { isBrowser, isNode } from "wherearewe";
import {
  fromString as uint8ArrayFromString,
  toString as uint8ArrayToString,
} from "uint8arrays";

import { IDBDatastore } from "datastore-idb";
import { FsDatastore } from "datastore-fs";
import { privateKeyFromRaw } from "@libp2p/crypto/keys";
import { PrivateKey } from "@libp2p/interface";
import { multiaddr } from "@multiformats/multiaddr";
import { obtenirOptionsLibp2p } from "@/v2/crabe/services/libp2p/config/config.js";
import { ServiceStockage } from "@/v2/crabe/index.js";
import {
  ServiceLibp2p,
  ServicesLibp2pCrabe,
  ServicesNécessairesLibp2p,
  extraireLibp2pDesOptions,
} from "@/v2/crabe/services/libp2p/libp2p.js";
import { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import { ServicesLibp2pCrabeDéfaut } from "@/v2/crabe/services/libp2p/config/utils.js";
import { dossierTempoPropre } from "../../utils.js";
import {
  ServiceLibp2pTest,
  obtenirOptionsLibp2pLocal,
  obtenirOptionsLibp2pTest,
} from "./utils.js";

describe.only("Service Libp2p", function () {
  describe("options", function () {
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

    after(async () => await fermer());

    it("extraire Libp2p - Orbite", () => {
      const val = extraireLibp2pDesOptions({
        services: {
          orbite: { orbite },
        },
      });
      expect(isLibp2p(val)).to.be.true();
    });

    it("extraire Libp2p - Hélia", () => {
      const val = extraireLibp2pDesOptions({
        services: {
          hélia: { hélia },
        },
      });
      expect(isLibp2p(val)).to.be.true();
    });

    it("extraire Libp2p - Libp2p", () => {
      const val = extraireLibp2pDesOptions({
        services: {
          libp2p: { libp2p },
        },
      });
      expect(isLibp2p(val)).to.be.true();
    });

    it("extraire Libp2p - absent", () => {
      const val = extraireLibp2pDesOptions({});
      expect(val).to.be.undefined();
    });
  });

  describe("demarrage", function () {
    let nébuleuse: Nébuleuse<ServicesNécessairesLibp2p>;
    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    this.afterEach(async () => {
      await nébuleuse.fermer();
      effacer();
    });

    it("libp2p démarre", async () => {
      nébuleuse = new Nébuleuse<ServicesNécessairesLibp2p>({
        services: {
          libp2p: ServiceLibp2pTest,
          stockage: ServiceStockage,
        },
        options: {
          dossier,
        },
      });
      await nébuleuse.démarrer();

      const serviceLibp2p = nébuleuse.services["libp2p"];
      const libp2p = await serviceLibp2p.libp2p();

      expect(isLibp2p(libp2p)).to.be.true();
      expect(libp2p.status).to.equal("started");
    });

    it("persistence identité", async () => {
      nébuleuse = new Nébuleuse<ServicesNécessairesLibp2p>({
        services: {
          libp2p: ServiceLibp2pTest,
          stockage: ServiceStockage,
        },
        options: {
          dossier,
        },
      });
      await nébuleuse.démarrer();

      const libp2p = await nébuleuse.services["libp2p"].libp2p();
      const id = libp2p.peerId.toString();

      await nébuleuse.fermer();
      nébuleuse = new Nébuleuse<ServicesNécessairesLibp2p>({
        services: {
          libp2p: ServiceLibp2pTest,
          stockage: ServiceStockage,
        },
        options: {
          dossier,
        },
      });
      await nébuleuse.démarrer();

      const nouveauLibp2p = await nébuleuse.services["libp2p"].libp2p();
      expect(id).to.equal(nouveauLibp2p.peerId.toString());
    });
  });

  describe("fermer", function () {
    let nébuleuse: Nébuleuse<ServicesNécessairesLibp2p>;
    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    afterEach(async () => {
      if (nébuleuse.estDémarrée) await nébuleuse.fermer();
      effacer();
    });

    it("libp2p fermé si endogène", async () => {
      nébuleuse = new Nébuleuse<ServicesNécessairesLibp2p>({
        services: {
          libp2p: ServiceLibp2pTest,
          stockage: ServiceStockage,
        },
        options: {
          dossier,
        },
      });
      await nébuleuse.démarrer();

      const serviceLibp2p = nébuleuse.services["libp2p"];
      const libp2p = await serviceLibp2p.libp2p();
      await nébuleuse.fermer();

      expect(libp2p.status).to.equal("stopped");
    });

    it("libp2p non fermé si exogène", async () => {
      const libp2pOriginal = await createLibp2p(
        isBrowser ? OptionsDéfautLibp2pNavigateur() : OptionsDéfautLibp2pNode(),
      );

      nébuleuse = new Nébuleuse<ServicesNécessairesLibp2p>({
        services: {
          // On n'a pas besoin de ServiceLibp2pTest parce que `libp2p` est externe
          libp2p: ServiceLibp2p,
          stockage: ServiceStockage,
        },
        options: {
          dossier,
          services: {
            libp2p: { libp2p: libp2pOriginal },
          },
        },
      });
      await nébuleuse.démarrer();

      const serviceLibp2p = nébuleuse.services["libp2p"];
      const libp2p = await serviceLibp2p.libp2p();
      await nébuleuse.fermer();

      expect(libp2p.status).to.equal("started");
      await libp2p.stop();
    });
  });

  describe("configuration", function () {
    describe("obtenir configuration", function () {
      let dossier: string;
      let effacer: () => void;

      beforeEach(async () => {
        ({ dossier, effacer } = await dossierTempoPropre());
      });

      afterEach(async () => {
        effacer();
      });

      it("dossier configuration priorisé", async () => {
        const dossier1 = join(dossier, "un", "dossier");
        const dossier2 = join(dossier, "un", "autre", "dossier");

        const générateur = obtenirOptionsLibp2p({ dossier: dossier1 });
        const options = await générateur({ dossier: dossier2 });

        if (isBrowser) {
          expect((options.datastore as IDBDatastore)["location"]).to.equal(
            dossier1,
          );
        } else {
          expect((options.datastore as FsDatastore)["path"]).to.equal(dossier1);
        }
      });

      it("clef privée configuration", async () => {
        // Utilisé pour fournir une clef privée externe
        const texteClefPrivée =
          "d9GNJt37AWXVa1D6R2Hl920vkAVmkcWHZp9wpDybKj83ieBThCjIPh5rbu+GIYYSHg9l8tF9hpnTJ2byXfA6bQ";
        const clefPrivée = privateKeyFromRaw(
          uint8ArrayFromString(texteClefPrivée, "base64"),
        );
        const générateur = obtenirOptionsLibp2p({ clefPrivée });
        const options = await générateur({
          dossier: join(dossier, "un", "dossier"),
        });

        expect(options.privateKey).to.exist();
        const clefPrivéeFinale = uint8ArrayToString(
          options.privateKey!.raw,
          "base64",
        );
        expect(clefPrivéeFinale).to.equal(texteClefPrivée);
      });

      it("clef privée générateur", async () => {
        // Utilisé pour fournir une clef privée sauvegardée par l'application
        const texteClefPrivée =
          "d9GNJt37AWXVa1D6R2Hl920vkAVmkcWHZp9wpDybKj83ieBThCjIPh5rbu+GIYYSHg9l8tF9hpnTJ2byXfA6bQ";
        const clefPrivée = privateKeyFromRaw(
          uint8ArrayFromString(texteClefPrivée, "base64"),
        );

        const générateur = obtenirOptionsLibp2p();
        const options = await générateur({
          dossier: join(dossier, "un", "dossier"),
          clefPrivée,
        });

        expect(options.privateKey).to.exist();
        const clefPrivéeFinale = uint8ArrayToString(
          options.privateKey!.raw,
          "base64",
        );
        expect(clefPrivéeFinale).to.equal(texteClefPrivée);
      });

      it("clef privée configuration priorisée", async () => {
        // On priorise la clef privée fournie de manière externe à celle sauvegardée par l'application
        const texteClefPrivée1 =
          "d9GNJt37AWXVa1D6R2Hl920vkAVmkcWHZp9wpDybKj83ieBThCjIPh5rbu+GIYYSHg9l8tF9hpnTJ2byXfA6bQ";
        const texteClefPrivée2 =
          "obBlEikoGtavEidoelb9xnQ5WCTwBAK4I63iO9EBEYmviXZOOMnCuJtDu3LGt46CeGRZ9+trDlORCA10GHuffw";

        const clefPrivée = privateKeyFromRaw(
          uint8ArrayFromString(texteClefPrivée1, "base64"),
        );
        const clefPrivée2 = privateKeyFromRaw(
          uint8ArrayFromString(texteClefPrivée2, "base64"),
        );

        const générateur = obtenirOptionsLibp2p({ clefPrivée });
        const options = await générateur({
          dossier: join(dossier, "un", "dossier"),
          clefPrivée: clefPrivée2,
        });

        expect(options.privateKey).to.exist();
        const clefPrivéeFinale = uint8ArrayToString(
          options.privateKey!.raw,
          "base64",
        );
        expect(clefPrivéeFinale).to.equal(texteClefPrivée1);
      });

      it("domaines", async () => {
        const générateur = obtenirOptionsLibp2p({
          domaines: ["mon.domaine.ca", "என்.ஆள்கள.பெயர்.இந்தியா"],
        });
        const options = await générateur({
          dossier: join(dossier, "un", "dossier"),
        });

        // On n'annonce un domaine dns que sur Node.js
        if (isNode) {
          expect(
            options.addresses?.announce?.some((a) =>
              a.includes("mon.domaine.ca"),
            ),
          );
          expect(
            options.addresses?.announce?.some((a) =>
              a.includes("என்.ஆள்கள.பெயர்.இந்தியா"),
            ),
          );
        } else {
          expect(options.addresses?.announce).to.be.undefined();
        }
      });
    });

    describe("options nébuleuse", function () {
      let nébuleuse: Nébuleuse<
        ServicesNécessairesLibp2p<ServicesLibp2pCrabeDéfaut>
      >;
      let dossier: string;
      let effacer: () => void;

      beforeEach(async () => {
        ({ dossier, effacer } = await dossierTempoPropre());
      });

      afterEach(async () => {
        if (nébuleuse) await nébuleuse.fermer();
        effacer();
      });

      it("dossier dans options nébuleuse", async () => {
        const dossierNébuleuse = join(dossier, "mon", "dossier");
        nébuleuse = new Nébuleuse<
          ServicesNécessairesLibp2p<ServicesLibp2pCrabeDéfaut>
        >({
          services: {
            stockage: ServiceStockage,
            libp2p: ServiceLibp2p,
          },
          options: {
            dossier: dossierNébuleuse,
            services: {
              libp2p: {
                libp2p: obtenirOptionsLibp2pLocal(),
              },
            },
          },
        });

        await nébuleuse.démarrer();

        if (!isBrowser) {
          // le dossier racine devrait exister
          expect(fs.existsSync(dossierNébuleuse)).to.be.true();

          // libp2p est initialisée dans un sousdossier 'libp2p' dans le dossier racine
          expect(fs.existsSync(join(dossierNébuleuse, "libp2p"))).to.be.true();
        }
      });

      it("dossier dans options libp2p", async () => {
        const dossierLibp2p = join(dossier, "mon", "dossier");
        const optionsLibp2p = obtenirOptionsLibp2pLocal({
          dossier: dossierLibp2p,
        });
        nébuleuse = new Nébuleuse<
          ServicesNécessairesLibp2p<ServicesLibp2pCrabeDéfaut>
        >({
          services: {
            stockage: ServiceStockage,
            libp2p: ServiceLibp2p,
          },
          options: {
            services: {
              libp2p: {
                libp2p: optionsLibp2p,
              },
            },
          },
        });

        await nébuleuse.démarrer();

        if (!isBrowser) {
          expect(fs.existsSync(dossierLibp2p)).to.be.true();
        }
      });

      it("prioriser dossier dans options libp2p", async () => {
        const dossierNébuleuse = join(dossier, "mon", "dossier");
        const dossierLibp2p = join(dossier, "un", "autre", "dossier");

        const optionsLibp2p = obtenirOptionsLibp2pLocal({
          dossier: dossierLibp2p,
        });

        nébuleuse = new Nébuleuse<
          ServicesNécessairesLibp2p<ServicesLibp2pCrabeDéfaut>
        >({
          services: {
            stockage: ServiceStockage,
            libp2p: ServiceLibp2p,
          },
          options: {
            dossier: dossierNébuleuse,
            services: {
              libp2p: {
                libp2p: optionsLibp2p,
              },
            },
          },
        });

        await nébuleuse.démarrer();

        if (!isBrowser) {
          // libp2p initialisée dans son dossier spécifique
          expect(fs.existsSync(dossierLibp2p)).to.be.true();
          expect(fs.existsSync(join(dossierNébuleuse, "libp2p"))).to.be.false();
        }
      });

      it("configuration externe - domaines", async () => {
        const optionsLibp2p = obtenirOptionsLibp2p({
          domaines: ["mon.domaine.ca"],
        });

        const clefPrivée = privateKeyFromRaw(
          uint8ArrayFromString(
            "d9GNJt37AWXVa1D6R2Hl920vkAVmkcWHZp9wpDybKj83ieBThCjIPh5rbu+GIYYSHg9l8tF9hpnTJ2byXfA6bQ",
            "base64",
          ),
        );

        const adressesÉcouteDomaine = (
          await optionsLibp2p({ dossier, clefPrivée })
        ).addresses?.announce?.filter((a) =>
          multiaddr(a)
            .getComponents()
            .find(
              (c) => c.name.includes("dns") && c.value === "mon.domaine.ca",
            ),
        );

        if (isNode) {
          expect(adressesÉcouteDomaine).to.not.be.empty();
        } else {
          expect(adressesÉcouteDomaine).to.be.undefined();
        }
      });

      it("configuration externe - modifications services", async () => {
        class ServiceLibp2pTest {
          test(): string {
            return "message test";
          }
        }
        type ServicesLibp2pTestModifiés = ServicesLibp2pTest & {
          test: ServiceLibp2pTest;
        };
        const optionsLibp2p = async ({
          clefPrivée,
        }: {
          clefPrivée?: PrivateKey;
        }) => {
          const optionsDéfaut = await obtenirOptionsLibp2pTest()({
            clefPrivée,
          });
          const mesOptions: Libp2pOptions<ServicesLibp2pTestModifiés> = {
            ...optionsDéfaut,
            services: {
              ...optionsDéfaut.services!,
              test: () => new ServiceLibp2pTest(),
            },
          };
          return mesOptions;
        };

        const nébuleuse = new Nébuleuse<
          ServicesNécessairesLibp2p<ServicesLibp2pTestModifiés>
        >({
          services: {
            stockage: ServiceStockage,
            // On n'a pas besoin de ServiceLibp2pTest parce que `libp2p` est externe
            libp2p: ServiceLibp2p,
          },
          options: {
            dossier,
            services: {
              libp2p: {
                libp2p: optionsLibp2p,
              },
            },
          },
        });
        await nébuleuse.démarrer();

        const libp2p = await nébuleuse.services["libp2p"].libp2p();
        const résultatTest = libp2p.services["test"].test();
        expect(résultatTest).to.equal("message test");
      });

      it("configuration externe - pairs par défaut", async () => {
        const pairParDéfaut =
          "/dns4/mon.relai.libp2p.ca/tcp/443/wss/p2p/12D3KooWGVYEgCLYwMSa1hDFW93fiCxhN2V2QUuMGCEfmG5ZuM9m";
        const optionsLibp2p = obtenirOptionsLibp2p({
          pairsParDéfaut: [pairParDéfaut],
        });

        nébuleuse = new Nébuleuse<
          ServicesNécessairesLibp2p<ServicesLibp2pCrabeDéfaut>
        >({
          services: {
            stockage: ServiceStockage,
            // On n'a pas besoin de ServiceLibp2pTest parce que `pairParDéfaut` est spécifié
            libp2p: ServiceLibp2p,
          },
          options: {
            dossier,
            services: {
              libp2p: {
                libp2p: optionsLibp2p,
              },
            },
          },
        });
        await nébuleuse.démarrer();

        const libp2p = await nébuleuse.services.libp2p.libp2p();
        const pairsÀReconnecter = libp2p.services.reconnecteur["liste"];

        expect(
          pairsÀReconnecter
            .map((p) => p.multiaddrs)
            .flat()
            .map((m) => m.toString()),
        ).to.include(pairParDéfaut);
      });

      it("libp2p externe", async () => {
        const libp2pOriginal = await createLibp2p(
          isBrowser
            ? OptionsDéfautLibp2pNavigateur()
            : OptionsDéfautLibp2pNode(),
        );
        const nébuleuse = new Nébuleuse<
          ServicesNécessairesLibp2p<ServicesLibp2pTest>
        >({
          services: {
            stockage: ServiceStockage,
            // On n'a pas besoin de ServiceLibp2pTest parce que `libp2p` est externe
            libp2p: ServiceLibp2p,
          },
          options: {
            services: {
              libp2p: {
                libp2p: libp2pOriginal,
              },
            },
          },
        });
        await nébuleuse.démarrer();

        const clefOriginale =
          libp2pOriginal.services["obtClefPrivée"].obtenirClef();
        const clefRéelle = (
          await nébuleuse.services["libp2p"].libp2p()
        ).services["obtClefPrivée"].obtenirClef();

        await nébuleuse.fermer();
        expect(uint8ArrayToString(clefOriginale.raw)).to.equal(
          uint8ArrayToString(clefRéelle.raw),
        );
      });
    });
  });
});
