import ClientConstellation from "@/client.js";
import {
  schémaFonctionOublier,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuiviRecherche,
  infoRésultatTexte,
} from "@/utils/index.js";

import { similTexte, combinerRecherches, rechercherSelonId } from "@/recherche/utils.js";

export const rechercherMotClefSelonNom = (
  nomMotClef: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idMotClef: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (noms: { [key: string]: string }) => {
      const corresp = similTexte(nomMotClef, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.motsClefs!.suivreNomsMotClef({
      id: idMotClef,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherMotClefSelonTexte = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fRechercherNoms = rechercherMotClefSelonNom(texte);
    const fRechercherId = rechercherSelonId(texte);

    return await combinerRecherches(
      { noms: fRechercherNoms, id: fRechercherId },
      client,
      idCompte,
      fSuivreRecherche
    );
  };
};
