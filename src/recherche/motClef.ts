import type { default as ClientConstellation } from "@/client.js";
import type {
  schémaFonctionOublier,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuiviRecherche,
  infoRésultatTexte,
} from "@/types.js";

import {
  similTexte,
  combinerRecherches,
  rechercherSelonId,
} from "@/recherche/utils.js";

export const rechercherMotsClefsSelonNom = (
  nomMotClef: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idMotClef: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = async (noms: { [key: string]: string }) => {
      const corresp = similTexte(nomMotClef, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        return await fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        return await fSuivreRecherche();
      }
    };
    const fOublier = await client.motsClefs.suivreNomsMotClef({
      idMotClef,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherMotsClefsSelonDescr = (
  desrcMotClef: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idMotClef: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = async (noms: { [key: string]: string }) => {
      const corresp = similTexte(desrcMotClef, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        return await fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "descr",
        });
      } else {
        return await fSuivreRecherche();
      }
    };
    const fOublier = await client.motsClefs.suivreDescriptionsMotClef({
      idMotClef,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherMotsClefsSelonTexte = (
  texte: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const fRechercherNoms = rechercherMotsClefsSelonNom(texte);
    const fRechercherDescr = rechercherMotsClefsSelonDescr(texte);
    const fRechercherId = rechercherSelonId(texte);

    return await combinerRecherches(
      { noms: fRechercherNoms, id: fRechercherId, descr: fRechercherDescr },
      client,
      idCompte,
      fSuivreRecherche,
    );
  };
};
