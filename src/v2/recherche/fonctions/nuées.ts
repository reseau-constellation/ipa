import { rechercherVariablesSelonNom } from "@/v2/recherche/fonctions/variables.js";
import {
  combinerRecherches,
  rechercherSelonId,
  rechercherTousSiVide,
  similTexte,
  sousRecherche,
} from "@/v2/recherche/fonctions/utils.js";
import { rechercherMotsClefsSelonNom } from "./motsClefs.js";
import type { Oublier } from "@/v2/crabe/types.js";
import type { Constellation } from "@/v2/index.js";
import type {
  SuivreObjectifRecherche,
  InfoRésultatTexte,
  SuiviRecherche,
  InfoRésultatRecherche,
  InfoRésultatVide,
} from "../types.js";

export const rechercherNuéesSelonNom = (
  nomNuée: string,
): SuivreObjectifRecherche<InfoRésultatTexte> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = (noms: { [key: string]: string }) => {
      const corresp = similTexte({ texte: nomNuée, possibilités: noms });
      if (corresp) {
        const { score, clef, info } = corresp;
        f({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        f();
      }
    };
    const fOublier = await constl.nuées.suivreNoms({
      idNuée: idObjet,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherNuéesSelonDescription = (
  descriptionNuée: string,
): SuivreObjectifRecherche<InfoRésultatTexte> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatTexte>;
  }): Promise<Oublier> => {
    const fSuivre = (descriptions: { [key: string]: string }) => {
      const corresp = similTexte({
        texte: descriptionNuée,
        possibilités: descriptions,
      });
      if (corresp) {
        const { score, clef, info } = corresp;
        f({
          type: "résultat",
          score,
          clef,
          info,
          de: "descr",
        });
      } else {
        f();
      }
    };
    const fOublier = await constl.nuées.suivreDescriptions({
      idNuée: idObjet,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherNuéesSelonIdVariable = (
  idVariable: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await constl.nuées.suivreVariables({
        idNuée: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idVariable);

    return await sousRecherche({
      de: "variable",
      fListe,
      fRechercher,
      constl,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherNuéesSelonNomVariable = (
  nomVariable: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await constl.nuées.suivreVariables({
        idNuée: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherVariablesSelonNom(nomVariable);

    return await sousRecherche({
      de: "variable",
      fListe,
      fRechercher,
      constl,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherNuéesSelonVariable = (
  texte: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }) => {
    return await combinerRecherches({
      fsRecherche: {
        id: rechercherNuéesSelonIdVariable(texte),
        nom: rechercherNuéesSelonNomVariable(texte),
      },
      constl,
      idObjet,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherNuéesSelonIdMotClef = (
  idMotClef: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await constl.nuées.suivreMotsClefs({
        idNuée: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idMotClef);

    return await sousRecherche({
      de: "motClef",
      fListe,
      fRechercher,
      constl,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherNuéesSelonNomMotClef = (
  nomMotClef: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }): Promise<Oublier> => {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (idsVariables: string[]) => void;
    }): Promise<Oublier> => {
      return await constl.nuées.suivreMotsClefs({
        idNuée: idObjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherMotsClefsSelonNom(nomMotClef);

    return await sousRecherche({
      de: "motClef",
      fListe,
      fRechercher,
      constl,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherNuéesSelonMotClef = (
  texte: string,
): SuivreObjectifRecherche<InfoRésultatRecherche<InfoRésultatTexte>> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<InfoRésultatRecherche<InfoRésultatTexte>>;
  }) => {
    return await combinerRecherches({
      fsRecherche: {
        id: rechercherNuéesSelonIdMotClef(texte),
        nom: rechercherNuéesSelonNomMotClef(texte),
      },
      constl,
      idObjet,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherNuéesSelonTexte = (
  texte: string,
): SuivreObjectifRecherche<
  | InfoRésultatRecherche<InfoRésultatTexte>
  | InfoRésultatTexte
  | InfoRésultatVide
> => {
  return async ({
    constl,
    idObjet,
    f,
  }: {
    constl: Constellation;
    idObjet: string;
    f: SuiviRecherche<
      | InfoRésultatRecherche<InfoRésultatTexte>
      | InfoRésultatTexte
      | InfoRésultatVide
    >;
  }) => {
    return await combinerRecherches<
      | InfoRésultatRecherche<InfoRésultatTexte>
      | InfoRésultatTexte
      | InfoRésultatVide
    >({
      fsRecherche: {
        nom: rechercherNuéesSelonNom(texte),
        descr: rechercherNuéesSelonDescription(texte),
        variables: rechercherNuéesSelonVariable(texte),
        motsClefs: rechercherNuéesSelonMotClef(texte),
        id: rechercherSelonId(texte),
        tous: rechercherTousSiVide(texte),
      },
      constl,
      idObjet,
      fSuivreRecherche: f,
    });
  };
};
