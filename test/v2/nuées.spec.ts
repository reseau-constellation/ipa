import { expect } from "aegir/chai";
import { MEMBRE, MODÉRATRICE } from "@/v2/crabe/services/compte/accès/index.js";
import { obtenir, créerConstellationsTest } from "./utils.js";
import type { InfoAuteur } from "@/v2/types.js";
import type { Constellation } from "@/v2/index.js";
import type { Oublier } from "@/v2/crabe/types.js";

describe("Nuées", function () {
  let fermer: Oublier;
  let constls: Constellation[];
  let constl: Constellation;

  let idsComptes: string[];

  before(async () => {
    ({ fermer, constls } = await créerConstellationsTest({
      n: 2,
    }));
    constl = constls[0];
    idsComptes = await Promise.all(constls.map((c) => c.compte.obtIdCompte()));
  });

  after(async () => {
    if (fermer) await fermer();
  });

  describe("autorisations", function () {
    it("nuée ouverte - tous peuvent écrire");
    it("nuée ouverte - bloquer compte");
    it("nuée ouverte - débloquer compte");
    it("nuée par invitation - compte créateur peut écrire");
    it("nuée par invitation - compte membre peut écrire");
    it("nuée par invitation - les autres ne peuvent pas écrire");
    it("nuée par invitation - inviter compte");
    it("nuée par invitation - désinviter compte");

    it("convertir à ouverte");
    it("reconvertir à par invitation - invités persistent");

    it("convertir à par invitation");
    it("reconvertir à ouverte - bloqués persistent");

    it("erreur nuée ouverte - bloquer compte créateur nuée");
    it("erreur nuée ouverte - bloquer compte créateur nuée");
    it("erreur nuée par invitation - désinviter compte membre nuée");
    it("erreur nuée par invitation - désinviter compte membre nuée");
  });

  describe("auteurs", function () {
    let idNuée: string;

    before(async () => {
      idNuée = await constl.nuées.créerNuée();
    });

    it("compte créateur autorisé pour commencer", async () => {
      const auteurs = await obtenir<InfoAuteur[]>(({ siPasVide }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
          f: siPasVide(),
        }),
      );
      const réf: InfoAuteur[] = [
        {
          idCompte: idsComptes[0],
          accepté: true,
          rôle: MODÉRATRICE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });

    it("inviter compte", async () => {
      await constl.nuées.inviterAuteur({
        idNuée,
        idCompte: idsComptes[1],
        rôle: MEMBRE,
      });
      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
          f: si((x) => !!x && x.length > 1),
        }),
      );
      const réf: InfoAuteur[] = [
        {
          idCompte: idsComptes[0],
          accepté: true,
          rôle: MODÉRATRICE,
        },
        {
          idCompte: idsComptes[1],
          accepté: false,
          rôle: MEMBRE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });

    it("acceptation invitation", async () => {
      await constls[1].nuées.ajouterÀMesNuées({ idNuée });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
          f: si((x) => !!x?.find((a) => a.idCompte === idsComptes[1])?.accepté),
        }),
      );
      const réf: InfoAuteur[] = [
        {
          idCompte: idsComptes[0],
          accepté: true,
          rôle: MODÉRATRICE,
        },
        {
          idCompte: idsComptes[1],
          accepté: true,
          rôle: MEMBRE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });

    it("inviter compte hors ligne", async () => {
      const compteHorsLigne =
        "/orbitdb/zdpuAsiATt21PFpiHj8qLX7X7kN3bgozZmhEVswGncZYVHidX";
      await constl.nuées.inviterAuteur({
        idNuée,
        idCompte: compteHorsLigne,
        rôle: MEMBRE,
      });

      const auteurs = await obtenir<InfoAuteur[]>(({ si }) =>
        constl.nuées.suivreAuteurs({
          idNuée,
          f: si((x) => !!x?.find((a) => a.idCompte === compteHorsLigne)),
        }),
      );
      const réf: InfoAuteur[] = [
        {
          idCompte: idsComptes[0],
          accepté: true,
          rôle: MODÉRATRICE,
        },
        {
          idCompte: idsComptes[1],
          accepté: true,
          rôle: MEMBRE,
        },
        {
          idCompte: compteHorsLigne,
          accepté: false,
          rôle: MEMBRE,
        },
      ];
      expect(auteurs).to.deep.equal(réf);
    });
  });
});
