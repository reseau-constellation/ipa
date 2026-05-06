import { join } from "path";
import { expect } from "aegir/chai";
import { isElectronMain, isNode } from "wherearewe";
import { Appli } from "@/v2/nébuleuse/appli/appli.js";
import { serviceJournal } from "@/v2/nébuleuse/services/journal.js";
import { dossierTempoPropre } from "../../utils.js";
import type { ServiceJournal } from "@/v2/nébuleuse/services/journal.js";

describe("Journal", function () {
  if (isNode || isElectronMain)
    describe("écrire à un fichier", function () {
      let appli: Appli<{ journal: ServiceJournal }>;
      let journal: ServiceJournal;
      let dossier: string;
      let fichier: string;

      let effacer: () => void;

      before(async () => {
        ({ dossier, effacer } = await dossierTempoPropre());
        fichier = join(dossier, "journal.txt");
        appli = new Appli<{ journal: ServiceJournal }>({
          services: {
            journal: serviceJournal({ f: fichier }),
          },
        });
        await appli.démarrer();
        journal = appli.services["journal"];
      });

      after(async () => {
        await appli?.fermer();
        effacer?.();
      });

      it("écrire valeur", async () => {
        await journal.écrire({message: "a"});
        await journal.écrire({message: "b"});

        const fs = await import("fs");
        expect(fs.existsSync(fichier)).to.be.true();
        expect(new TextDecoder().decode(fs.readFileSync(fichier))).to.equal(
          "a\nb\n",
        );
      });
    });

  describe("fonction personnalisée", function () {
    let appli: Appli<{ journal: ServiceJournal }>;
    let journal: ServiceJournal;

    let val = "";

    before(async () => {
      appli = new Appli<{ journal: ServiceJournal }>({
        services: {
          journal: serviceJournal({
            f: (m) => {
              val += m;
            },
          }),
        },
      });
      await appli.démarrer();
      journal = appli.services["journal"];
    });

    after(async () => {
      await appli?.fermer();
    });

    it("écrire valeur", async () => {
      await journal.écrire({message: "a"});
      await journal.écrire({message: "b"});

      expect(val).to.equal("a\nb\n");
    });
  });
});
