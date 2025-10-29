import { faisRien } from "@constl/utils-ipa";

export type ÉpingleFavoris =
  | ÉpingleVariable
  | ÉpingleMotClef
  | ÉpingleBd
  | ÉpingleNuée
  | ÉpingleProjet
  | ÉpingleCompte
  | ÉpingleProfil;

export type ÉpingleNuée = BaseÉpingleFavoris & {
  type: "nuée";
  données: ÉpingleBd;
};

export type ÉpingleProjet = BaseÉpingleFavoris & {
  type: "projet";
  bds: ÉpingleBd;
};

export type ÉpingleCompte = BaseÉpingleFavoris & {
  type: "compte";
  profil: ÉpingleProfil;
  favoris: typeDispositifs;
};
