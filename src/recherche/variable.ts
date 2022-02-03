import ClientConstellation from "@/client";
import {
  schémaFonctionOublier,
  schémaFonctionRecherche,
  schémaFonctionSuiviRecherche,
} from "@/utils"

import {
  similTexte,
  combinerRecherches,
  rechercherSelonId,
 } from "./utils";


export const rechercherVariableSelonNom = (
  nom: string
): schémaFonctionRecherche => {
  return async (
    client: ClientConstellation,
    idVariable: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (nomsVariable: {[key: string]: string}) => {
      const résultat = similTexte(nom, nomsVariable)
      if (résultat) {
        const { score, clef, info } = résultat
        fSuivreRecherche({
          score,
          de: "nom",
          clef,
          info,
        });
      } else {
        fSuivreRecherche();
      }

    }
    const fOublier = await client.variables!.suivreNomsVariable(idVariable, fSuivre);
    return fOublier;
  }
}


export const rechercherVariableSelonTexte = (
  texte: string
): schémaFonctionRecherche => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche
  ): Promise<schémaFonctionOublier> => {

    const fRechercherNoms = rechercherVariableSelonNom(texte);
    const fRechercherId = rechercherSelonId(texte);

    return await combinerRecherches(
      { noms: fRechercherNoms, id: fRechercherId },
      client,
      idCompte,
      fSuivreRecherche
    )
  }
}
