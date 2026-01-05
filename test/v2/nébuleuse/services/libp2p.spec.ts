import fs from "fs";
import { join } from "path";
import { expect } from "aegir/chai";
import { createLibp2p, isLibp2p } from "libp2p";
import {
  OptionsDéfautLibp2pNavigateur,
  OptionsDéfautLibp2pNode,
} from "@constl/utils-tests";
import { isBrowser, isNode } from "wherearewe";
import {
  fromString as uint8ArrayFromString,
  toString as uint8ArrayToString,
} from "uint8arrays";

import { privateKeyFromRaw } from "@libp2p/crypto/keys";
import { multiaddr } from "@multiformats/multiaddr";
import { obtenirOptionsLibp2p } from "@/v2/nébuleuse/services/libp2p/config/config.js";
import { ServiceStockage } from "@/v2/nébuleuse/index.js";
import { ServiceLibp2p } from "@/v2/nébuleuse/services/libp2p/libp2p.js";
import { Appli } from "@/v2/nébuleuse/appli/appli.js";
import { ServiceDossier } from "@/v2/nébuleuse/services/dossier.js";
import { dossierTempoPropre, obtenir } from "../../utils.js";
import {
  ServiceLibp2pTest,
  obtenirOptionsLibp2pLocal,
  obtenirOptionsLibp2pTest,
} from "./utils.js";
import type { ServicesLibp2pNébuleuseDéfaut } from "@/v2/nébuleuse/services/libp2p/config/utils.js";
import type { ServicesNécessairesLibp2p } from "@/v2/nébuleuse/services/libp2p/libp2p.js";
import type { PrivateKey } from "@libp2p/interface";
import type { FsDatastore } from "datastore-fs";
import type { IDBDatastore } from "datastore-idb";
import type { ServicesLibp2pTest } from "@constl/utils-tests";
import type { Libp2pOptions } from "libp2p";

describe.only("Service Libp2p", function () {
  describe("demarrage", function () {
    let appli: Appli<ServicesNécessairesLibp2p & { libp2p: ServiceLibp2pTest }>;
    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    this.afterEach(async () => {
      await appli.fermer();
      effacer();
    });

    it("libp2p démarre", async () => {
      appli = new Appli<
        ServicesNécessairesLibp2p & { libp2p: ServiceLibp2pTest }
      >({
        services: {
          dossier: ServiceDossier,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
        },
        options: {
          services: { dossier: { dossier } },
        },
      });
      await appli.démarrer();

      const serviceLibp2p = appli.services["libp2p"];
      const libp2p = await serviceLibp2p.libp2p();

      expect(isLibp2p(libp2p)).to.be.true();
      expect(libp2p.status).to.equal("started");
    });

    it("persistence identité", async () => {
      appli = new Appli<
        ServicesNécessairesLibp2p & { libp2p: ServiceLibp2pTest }
      >({
        services: {
          dossier: ServiceDossier,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
        },
        options: {
          services: { dossier: { dossier } },
        },
      });
      await appli.démarrer();

      const libp2p = await appli.services["libp2p"].libp2p();
      const id = libp2p.peerId.toString();

      await appli.fermer();
      appli = new Appli<
        ServicesNécessairesLibp2p & { libp2p: ServiceLibp2pTest }
      >({
        services: {
          dossier: ServiceDossier,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
        },
        options: {
          services: { dossier: { dossier } },
        },
      });
      await appli.démarrer();

      const nouveauLibp2p = await appli.services["libp2p"].libp2p();
      expect(id).to.equal(nouveauLibp2p.peerId.toString());
    });
  });

  describe("fermer", function () {
    let appli: Appli<ServicesNécessairesLibp2p & { libp2p: ServiceLibp2p }>;
    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
    });

    afterEach(async () => {
      if (appli.estDémarrée) await appli.fermer();
      effacer();
    });

    it("libp2p fermée si endogène", async () => {
      appli = new Appli<
        ServicesNécessairesLibp2p & { libp2p: ServiceLibp2pTest }
      >({
        services: {
          dossier: ServiceDossier,
          stockage: ServiceStockage,
          libp2p: ServiceLibp2pTest,
        },
        options: {
          services: { dossier: { dossier } },
        },
      });
      await appli.démarrer();

      const serviceLibp2p = appli.services["libp2p"];
      const libp2p = await serviceLibp2p.libp2p();
      await appli.fermer();

      expect(libp2p.status).to.equal("stopped");
    });

    it("libp2p non fermée si exogène", async () => {
      const libp2pOriginal = await createLibp2p(
        isBrowser ? OptionsDéfautLibp2pNavigateur() : OptionsDéfautLibp2pNode(),
      );
      appli = new Appli<
        ServicesNécessairesLibp2p & { libp2p: ServiceLibp2pTest }
      >({
        services: {
          dossier: ServiceDossier,
          stockage: ServiceStockage,
          // On n'a pas besoin de ServiceLibp2pTest parce que `libp2p` est externe
          libp2p: ServiceLibp2p,
        },
        options: {
          services: {
            dossier: { dossier },
            libp2p: { libp2p: libp2pOriginal },
          },
        },
      });

      await appli.démarrer();

      const serviceLibp2p = appli.services["libp2p"];
      const libp2p = await serviceLibp2p.libp2p();
      await appli.fermer();

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

    describe("options appli", function () {
      let appli: Appli<
        ServicesNécessairesLibp2p & {
          libp2p: ServiceLibp2p<ServicesLibp2pNébuleuseDéfaut>;
        }
      >;
      let dossier: string;
      let effacer: () => void;

      beforeEach(async () => {
        ({ dossier, effacer } = await dossierTempoPropre());
      });

      afterEach(async () => {
        if (appli) await appli.fermer();
        effacer();
      });

      it("dossier dans options appli", async () => {
        const dossierAppli = join(dossier, "mon", "dossier");
        appli = new Appli<
          ServicesNécessairesLibp2p & {
            libp2p: ServiceLibp2p<ServicesLibp2pNébuleuseDéfaut>;
          }
        >({
          services: {
            dossier: ServiceDossier,
            stockage: ServiceStockage,
            libp2p: ServiceLibp2p,
          },
          options: {
            services: {
              dossier: { dossier: dossierAppli },
              libp2p: {
                libp2p: obtenirOptionsLibp2pLocal(),
              },
            },
          },
        });

        await appli.démarrer();

        if (!isBrowser) {
          // le dossier racine devrait exister
          expect(fs.existsSync(dossierAppli)).to.be.true();

          // libp2p est initialisée dans un sousdossier 'libp2p' dans le dossier racine
          expect(fs.existsSync(join(dossierAppli, "libp2p"))).to.be.true();
        }
      });

      it("prioriser dossier dans options libp2p", async () => {
        const dossierAppli = join(dossier, "mon", "dossier");
        const dossierLibp2p = join(dossier, "un", "autre", "dossier");

        const optionsLibp2p = obtenirOptionsLibp2pLocal({
          dossier: dossierLibp2p,
        });

        appli = new Appli<
          ServicesNécessairesLibp2p & {
            libp2p: ServiceLibp2p<ServicesLibp2pNébuleuseDéfaut>;
          }
        >({
          services: {
            dossier: ServiceDossier,
            stockage: ServiceStockage,
            libp2p: ServiceLibp2p<ServicesLibp2pNébuleuseDéfaut>,
          },
          options: {
            services: {
              dossier: { dossier: dossierAppli },
              libp2p: {
                libp2p: optionsLibp2p,
              },
            },
          },
        });

        await appli.démarrer();

        if (!isBrowser) {
          // libp2p initialisée dans son dossier spécifique
          expect(fs.existsSync(dossierLibp2p)).to.be.true();
          expect(fs.existsSync(join(dossierAppli, "libp2p"))).to.be.false();
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

        const appli = new Appli<
          ServicesNécessairesLibp2p & {
            libp2p: ServiceLibp2p<ServicesLibp2pTestModifiés>;
          }
        >({
          services: {
            dossier: ServiceDossier,
            stockage: ServiceStockage,
            // On n'a pas besoin de ServiceLibp2pTest parce que `libp2p` est externe
            libp2p: ServiceLibp2p,
          },
          options: {
            services: {
              dossier: { dossier },
              libp2p: {
                libp2p: optionsLibp2p,
              },
            },
          },
        });
        await appli.démarrer();

        const libp2p = await appli.services["libp2p"].libp2p();
        const résultatTest = libp2p.services["test"].test();
        expect(résultatTest).to.equal("message test");
      });

      it("configuration externe - pairs par défaut", async () => {
        const pairParDéfaut =
          "/dns4/mon.relai.libp2p.ca/tcp/443/wss/p2p/12D3KooWGVYEgCLYwMSa1hDFW93fiCxhN2V2QUuMGCEfmG5ZuM9m";
        const optionsLibp2p = obtenirOptionsLibp2p({
          pairsParDéfaut: [pairParDéfaut],
        });

        appli = new Appli<
          ServicesNécessairesLibp2p & {
            libp2p: ServiceLibp2p<ServicesLibp2pNébuleuseDéfaut>;
          }
        >({
          services: {
            dossier: ServiceDossier,
            stockage: ServiceStockage,
            // On n'a pas besoin de ServiceLibp2pTest parce que `pairParDéfaut` est spécifié
            libp2p: ServiceLibp2p,
          },
          options: {
            services: {
              dossier: { dossier },
              libp2p: {
                libp2p: optionsLibp2p,
              },
            },
          },
        });
        await appli.démarrer();

        const libp2p = await appli.services.libp2p.libp2p();
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
        const appli = new Appli<
          ServicesNécessairesLibp2p & {
            libp2p: ServiceLibp2p<ServicesLibp2pTest>;
          }
        >({
          services: {
            dossier: ServiceDossier,
            stockage: ServiceStockage,
            // On n'a pas besoin de ServiceLibp2pTest parce que `libp2p` est externe
            libp2p: ServiceLibp2p,
          },
          options: {
            services: {
              dossier: { dossier },
              libp2p: {
                libp2p: libp2pOriginal,
              },
            },
          },
        });
        await appli.démarrer();

        const clefOriginale =
          libp2pOriginal.services["obtClefPrivée"].obtenirClef();
        const clefRéelle = (await appli.services["libp2p"].libp2p()).services[
          "obtClefPrivée"
        ].obtenirClef();

        await appli.fermer();
        expect(uint8ArrayToString(clefOriginale.raw)).to.equal(
          uint8ArrayToString(clefRéelle.raw),
        );
      });
    });
  });

  describe("addresses", function () {
    let appli: Appli<ServicesNécessairesLibp2p & { libp2p: ServiceLibp2p }>;
    let dossier: string;
    let effacer: () => void;

    beforeEach(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      appli = new Appli<ServicesNécessairesLibp2p & { libp2p: ServiceLibp2p }>({
        services: {
          dossier: ServiceDossier,
          libp2p: ServiceLibp2pTest,
          stockage: ServiceStockage,
        },
        options: {
          services: {
            dossier: { dossier },
          },
        },
      });
      await appli.démarrer();
    });

    afterEach(async () => {
      if (appli.estDémarrée) await appli.fermer();
      effacer();
    });

    it("suivi", async () => {
      const libp2p = appli.services["libp2p"];
      const idPair = (await libp2p.libp2p()).peerId.toString();
      const adresses = await obtenir<string[]>(({ siPasVide }) =>
        libp2p.suivreMesAdresses({ f: siPasVide() }),
      );

      expect(adresses.every((adresse) => adresse.includes(idPair)));
    });
  });
});
