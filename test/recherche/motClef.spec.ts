import type { default as ClientConstellation } from "@/client.js";
import type {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatTexte,
} from "@/utils/index.js";
import {
  rechercherMotsClefsSelonNom,
  rechercherMotsClefsSelonTexte,
} from "@/recherche/motClef.js";

import { générerClients } from "@/utilsTests/client.js";
import { AttendreRésultat } from "@/utilsTests/attente.js";

import { expect } from "aegir/chai";

describe("Rechercher mots clefs", function () {
  let fOublierClients: () => Promise<void>;
  let clients: ClientConstellation[];
  let client: ClientConstellation;

  before(async () => {
    ({ fOublier: fOublierClients, clients } = await générerClients(1));
    client = clients[0];
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Selon nom", function () {
    let idMotClef: string;
    let fOublier: schémaFonctionOublier;
    const résultat = new AttendreRésultat<résultatObjectifRecherche<infoRésultatTexte>>();

    before(async () => {
      idMotClef = await client.motsClefs!.créerMotClef();

      const fRecherche = rechercherMotsClefsSelonNom("hydrologie");
      fOublier = await fRecherche(client, idMotClef, (r) => (résultat.mettreÀJour(r)));
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand le mot-clef n'a pas de nom", async () => {
      expect(résultat.val).to.be.undefined();
    });
    it("Pas de résultat si le mot-clef n'a vraiment rien à voir", async () => {
      await client.motsClefs!.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          த: "நீரியல்",
        },
      });
      expect(résultat.val).to.be.undefined();
    });
    it("Résultat si le mot-clef est presque exacte", async () => {
      await client.motsClefs!.sauvegarderNomsMotClef({
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
      await client.motsClefs!.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "hydrologie",
        },
      });

      const val = await résultat.attendreQue(x=>x.score > 0.5)
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
    const résultatId = new AttendreRésultat<résultatObjectifRecherche<infoRésultatTexte>>;
    const résultatNom = new AttendreRésultat<résultatObjectifRecherche<infoRésultatTexte>>;

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idMotClef = await client.motsClefs!.créerMotClef();

      const fRechercheNom = rechercherMotsClefsSelonTexte("hydrologie");
      fsOublier.push(
        await fRechercheNom(client, idMotClef, (r) => (résultatNom.mettreÀJour(r)))
      );

      const fRechercheId = rechercherMotsClefsSelonTexte(idMotClef.slice(0, 15));
      fsOublier.push(
        await fRechercheId(client, idMotClef, (r) => (résultatId.mettreÀJour(r)))
      );

      await client.motsClefs!.sauvegarderNomsMotClef({
        idMotClef,
        noms: {
          fr: "hydrologie",
        },
      });
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
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
