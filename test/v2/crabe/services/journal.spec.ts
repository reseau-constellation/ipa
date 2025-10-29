import { join } from "path";
import { expect } from "aegir/chai";
import { isElectronMain, isNode } from "wherearewe";
import { Nébuleuse } from "@/v2/nébuleuse/nébuleuse.js";
import { ServiceJournal } from "@/v2/crabe/services/journal.js";
import { dossierTempoPropre } from "../../utils.js";

describe.only("Journal", function () {
  if (isNode || isElectronMain)
    describe("écrire à un fichier", function () {
      let nébuleuse: Nébuleuse<{ journal: ServiceJournal }>;
      let journal: ServiceJournal;
      let dossier: string;
      let fichier: string;

      let effacer: () => void;

      before(async () => {
        ({ dossier, effacer } = await dossierTempoPropre());
        fichier = join(dossier, "journal.txt");
        nébuleuse = new Nébuleuse<{ journal: ServiceJournal }>({
          services: {
            journal: ServiceJournal,
          },
          options: {
            dossier,
            services: {
              journal: { f: fichier },
            },
          },
        });
        await nébuleuse.démarrer();
        journal = nébuleuse.services["journal"];
      });

      after(async () => {
        await nébuleuse.fermer();
        effacer();
      });

      it("écrire valeur", async () => {
        await journal.écrire("a");
        await journal.écrire("b");

        const fs = await import("fs");
        expect(fs.existsSync(fichier)).to.be.true();
        expect(new TextDecoder().decode(fs.readFileSync(fichier))).to.equal(
          "a\nb\n",
        );
      });
    });

  describe("fonction personnalisée", function () {
    let nébuleuse: Nébuleuse<{ journal: ServiceJournal }>;
    let journal: ServiceJournal;
    let dossier: string;
    let effacer: () => void;

    let val = "";

    before(async () => {
      ({ dossier, effacer } = await dossierTempoPropre());
      nébuleuse = new Nébuleuse<{ journal: ServiceJournal }>({
        services: {
          journal: ServiceJournal,
        },
        options: {
          dossier,
          services: {
            journal: {
              f: (m) => {
                val += m;
              },
            },
          },
        },
      });
      await nébuleuse.démarrer();
      journal = nébuleuse.services["journal"];
    });

    after(async () => {
      await nébuleuse.fermer();
      effacer();
    });

    it("écrire valeur", async () => {
      await journal.écrire("a");
      await journal.écrire("b");

      expect(val).to.equal("a\nb\n");
    });
  });
});
