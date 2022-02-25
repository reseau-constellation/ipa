import ClientConstellation from "@/client";
import {
  schémaFonctionOublier,
  schémaFonctionRecherche,
  schémaFonctionSuiviRecherche,
} from "@/utils";

import { similTexte, combinerRecherches, rechercherSelonId } from "./utils";

export const rechercherMotClefSelonNom = (
  nomMotClef: string
): schémaFonctionRecherche => {
  return async (
    client: ClientConstellation,
    idMotClef: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (noms: { [key: string]: string }) => {
      const corresp = similTexte(nomMotClef, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        fSuivreRecherche({
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.motsClefs!.suivreNomsMotClef(
      idMotClef,
      fSuivre
    );
    return fOublier;
  };
};

export const rechercherMotClefSelonTexte = (
  texte: string
): schémaFonctionRecherche => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
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
