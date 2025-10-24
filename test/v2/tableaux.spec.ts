import { obtenir } from "@constl/utils-ipa";
import { créerConstellationsTest } from "@constl/utils-tests";
import { expect } from "aegir/chai";
import { MEMBRE } from "@/v2/crabe/services/compte/accès/consts.js";
import { Rôle } from "@/v2/crabe/services/compte/accès/types.js";
import { Constellation, créerConstellation } from "@/v2/index.js";
import { TraducsTexte } from "@/v2/types.js";

describe("Tableaux", function () {
  let fermer: () => Promise<void>;
  let constls: Constellation[];

  before(async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 2,
      créerConstellation,
    }));
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("accès", function () {
    it("l'accès suit l'accès à la structure originale", async () => {
      const idBd = await constls[0].bds.créerBd({ licence: "ODBl-1_0" });
      const idTableau = await constls[0].tableaux.créerTableau({
        idStructure: idBd,
      });

      await constls[0].compte.donnerAccèsObjet({
        idObjet: idBd,
        identité: await constls[1].compte.obtIdCompte(),
        rôle: MEMBRE,
      });

      // Vérifier la permission
      const permission = await obtenir<Rôle>(({ siDéfini }) =>
        constls[1].compte.suivrePermission({
          idObjet: idTableau,
          f: siDéfini(),
        }),
      );
      expect(permission).to.equal(MEMBRE);

      // Vérifier que l'édition des données fonctionne
      await constls[1].tableaux.sauvegarderNomTableau({
        idTableau,
        langue: "fr",
        nom: "mon tableau",
      });

      const noms = await obtenir<TraducsTexte | undefined>(({ siPasVide }) =>
        constls[0].tableaux.suivreNomsTableau({ idTableau, f: siPasVide() }),
      );
      expect(noms).to.deep.equal({
        fr: "mon tableau",
      });
    });
  });
});
