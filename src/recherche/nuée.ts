import type { ClientConstellation } from "@/client.js";
import type {
  schémaFonctionOublier,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuiviRecherche,
  infoRésultatTexte,
  infoRésultatRecherche,
} from "@/types.js";

import { rechercherVariablesSelonNom } from "@/recherche/variable.js";
import { rechercherMotsClefsSelonNom } from "@/recherche/motClef.js";
import {
  combinerRecherches,
  sousRecherche,
  rechercherSelonId,
  similTexte,
} from "@/recherche/utils.js";

export const rechercherNuéesSelonNom = (
  nomNuée: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (noms: { [key: string]: string }) => {
      const corresp = similTexte(nomNuée, noms);
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
    const fOublier = await client.nuées.suivreNomsNuée({ idNuée, f: fSuivre });
    return fOublier;
  };
};

export const rechercherNuéesSelonDescr = (
  descrNuée: string,
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>,
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (descrs: { [key: string]: string }) => {
      const corresp = similTexte(descrNuée, descrs);
      if (corresp) {
        const { score, clef, info } = corresp;
        fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "descr",
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.nuées.suivreDescriptionsNuée({
      idNuée,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherNuéesSelonIdVariable = (
  idVariable: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.nuées.suivreVariablesNuée({
        idNuée,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idVariable);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherNuéesSelonNomVariable = (
  nomVariable: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.nuées.suivreVariablesNuée({
        idNuée,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherVariablesSelonNom(nomVariable);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherNuéesSelonVariable = (
  texte: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ) => {
    return await combinerRecherches(
      {
        id: rechercherNuéesSelonIdVariable(texte),
        nom: rechercherNuéesSelonNomVariable(texte),
      },
      client,
      idNuée,
      fSuivreRecherche,
    );
  };
};

export const rechercherNuéesSelonIdMotClef = (
  idMotClef: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.nuées.suivreMotsClefsNuée({
        idNuée,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idMotClef);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherNuéesSelonNomMotClef = (
  nomMotClef: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void,
    ): Promise<schémaFonctionOublier> => {
      return await client.nuées.suivreMotsClefsNuée({
        idNuée,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherMotsClefsSelonNom(nomMotClef);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche,
    );
  };
};

export const rechercherNuéesSelonMotClef = (
  texte: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >,
  ) => {
    return await combinerRecherches(
      {
        id: rechercherNuéesSelonIdMotClef(texte),
        nom: rechercherNuéesSelonNomMotClef(texte),
      },
      client,
      idNuée,
      fSuivreRecherche,
    );
  };
};

export const rechercherNuéesSelonTexte = (
  texte: string,
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte> | infoRésultatTexte
> => {
  return async (
    client: ClientConstellation,
    idNuée: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte> | infoRésultatTexte
    >,
  ) => {
    return await combinerRecherches<
      infoRésultatRecherche<infoRésultatTexte> | infoRésultatTexte
    >(
      {
        nom: rechercherNuéesSelonNom(texte),
        descr: rechercherNuéesSelonDescr(texte),
        variables: rechercherNuéesSelonVariable(texte),
        motsClefs: rechercherNuéesSelonMotClef(texte),
        id: rechercherSelonId(texte),
      },
      client,
      idNuée,
      fSuivreRecherche,
    );
  };
};
