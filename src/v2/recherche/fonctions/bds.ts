import { ignorerNonDéfinis } from "@constl/utils-ipa";
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
  InfoRésultatRecherche,
  InfoRésultatTexte,
  InfoRésultatVide,
  SuiviRecherche,
  SuivreObjectifRecherche,
} from "@/v2/recherche/types.js";
import type { TraducsTexte } from "@/v2/types.js";

export const rechercherBdsSelonNom = (
  nomBd: string,
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
    const fSuivre = async (noms: TraducsTexte) => {
      const corresp = similTexte({ texte: nomBd, possibilités: noms });
      if (corresp) {
        const { score, clef, info } = corresp;
        return await f({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        return await f();
      }
    };
    const oublier = await constl.bds.suivreNoms({
      idBd: idObjet,
      f: ignorerNonDéfinis(fSuivre),
    });
    return oublier;
  };
};

export const rechercherBdsSelonDescription = (
  descrBd: string,
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
    const fSuivre = async (descrs: { [key: string]: string }) => {
      const corresp = similTexte({ texte: descrBd, possibilités: descrs });
      if (corresp) {
        const { score, clef, info } = corresp;
        return await f({
          type: "résultat",
          score,
          clef,
          info,
          de: "descriptions",
        });
      } else {
        return await f();
      }
    };
    const oublier = await constl.bds.suivreDescriptions({
      idBd: idObjet,
      f: ignorerNonDéfinis(fSuivre),
    });
    return oublier;
  };
};

export const rechercherBdsSelonIdVariable = (
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
      return await constl.bds.suivreVariables({
        idBd: idObjet,
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

export const rechercherBdsSelonNomVariable = (
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
      return await constl.bds.suivreVariables({
        idBd: idObjet,
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

export const rechercherBdsSelonVariable = (
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
        id: rechercherBdsSelonIdVariable(texte),
        nom: rechercherBdsSelonNomVariable(texte),
      },
      constl,
      idObjet,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherBdsSelonIdMotClef = (
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
      return await constl.bds.suivreMotsClefs({
        idBd: idObjet,
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

export const rechercherBdsSelonNomMotClef = (
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
      return await constl.bds.suivreMotsClefs({
        idBd: idObjet,
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

export const rechercherBdsSelonMotClef = (
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
        id: rechercherBdsSelonIdMotClef(texte),
        nom: rechercherBdsSelonNomMotClef(texte),
      },
      constl,
      idObjet,
      fSuivreRecherche: f,
    });
  };
};

export const rechercherBdsSelonTexte = (
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
        nom: rechercherBdsSelonNom(texte),
        descriptions: rechercherBdsSelonDescription(texte),
        variables: rechercherBdsSelonVariable(texte),
        motsClefs: rechercherBdsSelonMotClef(texte),
        id: rechercherSelonId(texte),
        vide: rechercherTousSiVide(texte),
      },
      constl,
      idObjet,
      fSuivreRecherche: f,
    });
  };
};
