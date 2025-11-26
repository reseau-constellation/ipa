import { attente as utilsTestAttente } from "@constl/utils-tests";

import { expect } from "aegir/chai";
import { générerconstlsInternes } from "../../ressources/utils.js";
import type {
  InfoRésultatTexte,
  InfoRésultatVide,
  RésultatObjectifRecherche,
  schémaFonctionOublier,
} from "@/types.js";
import type { Constellation } from "@/constl.js";
import {
  rechercherMotsClefsSelonNom,
  rechercherMotsClefsSelonTexte,
} from "@/recherche/motClef.js";

describe("Rechercher mots clefs", function () {
  let fermer: Oublier;
  let constls: Constellation[];
  let constl: Constellation;

  before(async () => {
    ({ fermer, constls } = await générerconstlsInternes({
      n: 1,
    }));
    constl = constls[0];
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("Selon nom", function () {
    let idMotClef: string;
    const résultat = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatTexte>
    >();

    before(async () => {
      idMotClef = await constl.motsClefs.créerMotClef();

      const recherche = rechercherMotsClefsSelonNom("hydrologie");
      fOublier = await recherche(constl, idMotClef, async (r) =>
        résultat.mettreÀJour(r),
      );
    });

    it("Pas de résultat quand le mot-clef n'a pas de nom", async () => {
      expect(résultat.val).to.be.undefined();
    });
    it("Pas de résultat si le mot-clef n'a vraiment rien à voir", async () => {
      await constl.motsClefs.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          த: "நீரியல்",
        },
      });
      expect(résultat.val).to.be.undefined();
    });
    it("Résultat si le mot-clef est presque exacte", async () => {
      await constl.motsClefs.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "Sciences hydrologiques",
        },
      });

      const val = await résultat.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "nom",
        info: {
          type: "texte",
          début: 9,
          fin: 19,
          texte: "Sciences hydrologiques",
        },
        score: 0.5,
      });
    });
    it("Résultat si le mot-clef est exacte", async () => {
      await constl.motsClefs.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "hydrologie",
        },
      });

      const val = await résultat.attendreQue((x) => x.score > 0.5);
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 10,
          texte: "hydrologie",
        },
        score: 1,
      });
    });
  });

  describe("Selon texte", function () {
    let idMotClef: string;
    const résultatId = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatTexte | InfoRésultatVide>
    >();
    const résultatNom = new utilsTestAttente.AttendreRésultat<
      RésultatObjectifRecherche<InfoRésultatTexte | InfoRésultatVide>
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idMotClef = await constl.motsClefs.créerMotClef();

      const rechercheNom = rechercherMotsClefsSelonTexte("hydrologie");
      fsOublier.push(
        await rechercheNom(constl, idMotClef, async (r) =>
          résultatNom.mettreÀJour(r),
        ),
      );

      const rechercheId = rechercherMotsClefsSelonTexte(idMotClef.slice(0, 15));
      fsOublier.push(
        await rechercheId(constl, idMotClef, async (r) =>
          résultatId.mettreÀJour(r),
        ),
      );

      await constl.motsClefs.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "hydrologie",
        },
      });
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("Résultat nom détecté", async () => {
      const val = await résultatNom.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 10,
          texte: "hydrologie",
        },
        score: 1,
      });
    });
    it("Résultat id détecté", async () => {
      const val = await résultatId.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        de: "id",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: idMotClef,
        },
        score: 1,
      });
    });
  });
});
