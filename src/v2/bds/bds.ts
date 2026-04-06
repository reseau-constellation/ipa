import {
  attendreStabilité,
  faisRien,
  ignorerNonDéfinis,
  suivreDeFonctionListe,
  suivreFonctionImbriquée,
  traduire,
  uneFois,
} from "@constl/utils-ipa";
import { v4 as uuidv4 } from "uuid";
import { utils as xlsxUtils } from "xlsx";
import { TimeoutController } from "timeout-abort-controller";
import PQueue from "p-queue";
import Base64 from "crypto-js/enc-base64url.js";
import md5 from "crypto-js/md5.js";
import { cacheSuivi } from "../nébuleuse/cache.js";
import {
  DISPOSITIFS_INSTALLÉS,
  TOUS_DISPOSITIFS,
  résoudreDéfauts,
} from "../nébuleuse/services/favoris.js";
import { schémaStatutDonnées, schémaTraducsTexte } from "../schémas.js";
import { schémaTableau } from "../tableaux.js";
import { stabiliser } from "../nébuleuse/utils.js";
import {
  ajouterPréfixes,
  définis,
  enleverPréfixes,
  enleverPréfixesEtOrbite,
  idcEtFichierValide,
  moyenne,
  sauvegarderDonnéesExportées,
} from "../utils.js";
import { RechercheBds } from "../recherche/bds.js";
import { ObjetConstellation } from "../objets.js";
import {
  statutComplet,
  type InfoAuteur,
  type Métadonnées,
  type PartielRécursif,
  type StatutDonnées,
  type TraducsTexte,
} from "../types.js";
import { TableauxBds } from "./tableaux.js";
import type { ServicesNécessairesObjet } from "../objets.js";
import type { Variables } from "../variables.js";
import type { OptionsAppli } from "../nébuleuse/appli/appli.js";
import type { Rôle } from "../nébuleuse/services/compte/accès/types.js";
import type xlsx from "xlsx";
import type { DagCborEncodable } from "@orbitdb/core";
import type { Oublier, Suivi } from "../nébuleuse/types.js";
import type {
  BaseÉpingleFavoris,
  DispositifsÉpingle,
  ÉpingleFavorisAvecId,
  ÉpingleFavorisBooléenniséeAvecId,
} from "../nébuleuse/services/favoris.js";
import type {
  StructureTableau,
  DifférenceTableaux,
  InfoColonne,
  InfoColonneAvecCatégorie,
  ScoreCouvertureTableau,
  ServicesNécessairesTableaux,
  DonnéesRangéeTableauAvecId,
} from "../tableaux.js";
import type { DonnéesFichierBdExportées } from "../utils.js";
import type { ErreurDonnée, RègleColonne } from "../règles.js";
import type { DonnéesTableauExportées } from "./tableaux.js";
import type { TypedNested } from "@constl/bohr-db";
import type { JSONSchemaType } from "ajv";
import type { MotsClefs } from "../motsClefs.js";
import type { AccesseurService } from "../recherche/types.js";
import type { ServicesNécessairesRechercheBds } from "../recherche/fonctions/bds.js";

// Types épingles

export type ÉpingleBd = {
  type: "bd";
  épingle: ContenuÉpingleBd;
};

export type ContenuÉpingleBd = BaseÉpingleFavoris & {
  données: {
    tableaux: DispositifsÉpingle;
    fichiers: DispositifsÉpingle;
  };
};

// Types différences

export type DifférenceBds =
  | DifférenceBDTableauSupplémentaire
  | DifférenceBDTableauManquant
  | DifférenceTableauxBds;

export type DifférenceBDTableauManquant = {
  type: "tableauManquant";
  sévère: true;
  clefManquante: string;
};

export type DifférenceBDTableauSupplémentaire = {
  type: "tableauSupplémentaire";
  sévère: false;
  clefExtra: string;
};

export type DifférenceTableauxBds<
  T extends DifférenceTableaux = DifférenceTableaux,
> = {
  type: "tableau";
  sévère: T["sévère"];
  idTableau: string;
  différence: T;
};

// Types données

export type DonnéesBdExportées = {
  nomBd: string;
  tableaux: DonnéesTableauExportées[];
};

// Types spécification

export type SchémaBd = {
  licence: string;
  licenceContenu?: string;
  métadonnées?: Métadonnées;
  clefUnique?: string;
  motsClefs?: string[];
  nuées?: string[];
  statut?: StatutDonnées;
  tableaux: {
    [idTableau: string]: SchémaTableau;
  };
};

export type SchémaTableau = {
  cols: {
    idColonne: string;
    idVariable?: string;
    index?: boolean;
  }[];
};

// Types score

export interface ScoreBd {
  accès?: number;
  couverture?: number;
  valide?: number;
  infos?: number;
  licence?: number;
  total: number;
}

// Types structure

export type StructureBd = {
  type: "bd";
  noms: TraducsTexte;
  descriptions: TraducsTexte;
  image: string;
  licence: string;
  licenceContenu: string;
  métadonnées: Métadonnées;
  clefUnique?: string;
  nuées: { [id: string]: null };
  statut: StatutDonnées;
  tableaux: { [clef: string]: StructureTableau };
  motsClefs: { [id: string]: null };
  copiéeDe: { id: string };
};

export const schémaBd: JSONSchemaType<PartielRécursif<StructureBd>> = {
  type: "object",
  properties: {
    type: { type: "string", nullable: true },
    noms: schémaTraducsTexte,
    descriptions: schémaTraducsTexte,
    image: { type: "string", nullable: true },
    licence: { type: "string", nullable: true },
    licenceContenu: { type: "string", nullable: true },
    métadonnées: {
      type: "object",
      additionalProperties: true,
      required: [],
      nullable: true,
    },
    motsClefs: {
      type: "object",
      nullable: true,
      additionalProperties: {
        type: "null",
        nullable: true,
      },
    },
    nuées: {
      type: "object",
      nullable: true,
      additionalProperties: {
        type: "null",
        nullable: true,
      },
    },
    statut: schémaStatutDonnées,
    clefUnique: { type: "string", nullable: true },
    tableaux: {
      type: "object",
      additionalProperties: schémaTableau,
      nullable: true,
    },
    copiéeDe: {
      type: "object",
      properties: {
        id: { type: "string", nullable: true },
      },
      nullable: true,
    },
  },
};

export type ServicesNécessairesBds = ServicesNécessairesObjet<"bds"> & {
  variables: Variables;
  motsClefs: MotsClefs;
};

export class Bds extends ObjetConstellation<
  "bds",
  StructureBd,
  ServicesNécessairesBds
> {
  tableaux: TableauxBds;
  recherche: RechercheBds;

  schémaObjet: JSONSchemaType<PartielRécursif<StructureBd>> = schémaBd;

  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesBds;
    options: OptionsAppli;
  }) {
    super({
      clef: "bds",
      services,
      dépendances: [
        "variables",
        "motsClefs",
        "favoris",
        "compte",
        "orbite",
        "hélia",
        "stockage",
      ],
      options,
    });

    const accesseurService = ((clef) =>
      clef === "bds" ? this : this.service(clef)) as AccesseurService<
      ServicesNécessairesRechercheBds & ServicesNécessairesTableaux
    >;

    this.tableaux = new TableauxBds({
      service: accesseurService,
    });
    this.recherche = new RechercheBds({
      bds: this,
      service: accesseurService,
    });

    const favoris = this.service("favoris");
    favoris.inscrireRésolution({
      clef: "bd",
      résolution: this.suivreRésolutionÉpingle.bind(this),
    });
  }

  // Création et gestion

  @cacheSuivi
  async suivreBds({
    f,
    idCompte,
  }: {
    f: Suivi<string[] | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    return await this.suivreObjets({ f, idCompte });
  }

  async créerBd({
    licence,
    licenceContenu,
    épingler = true,
  }: {
    licence: string;
    licenceContenu?: string;
    épingler?: boolean;
  }): Promise<string> {
    const compte = this.service("compte");

    const { bd, oublier: oublierBd } = await compte.créerObjet({
      type: "nested",
    });
    const idBd = this.ajouterProtocole(bd.address);
    const { bd: bdBd, oublier } = await this.ouvrirBd({ idBd });

    await this.ajouterÀMesBds({ idBd, épingler });

    await bdBd.insert({
      type: "bd",
      licence,
      licenceContenu,
      statut: { statut: "active" },
    });

    await oublierBd();
    await oublier();
    return idBd;
  }

  async effacerBd({ idBd }: { idBd: string }): Promise<void> {
    const orbite = this.service("orbite");

    // D'abord effacer l'entrée dans notre liste de BDs
    await this.enleverDeMesBds({ idBd });

    await this.désépingler({ idBd });

    // aussi effacer les tableaux
    const tableaux = await uneFois<string[]>((f) =>
      this.suivreTableaux({
        idBd,
        f,
      }),
    );

    await Promise.all(
      tableaux.map(
        async (idTableau) =>
          await this.tableaux.effacerTableau({ idStructure: idBd, idTableau }),
      ),
    );

    // enfin, effacer la BD elle-même
    await orbite.effacerBd({ id: this.àIdOrbite(idBd) });
  }

  async ajouterÀMesBds({
    idBd,
    épingler = true,
  }: {
    idBd: string;
    épingler?: boolean;
  }): Promise<void> {
    if (épingler) await this.épingler({ idBd });
    return await this.ajouterÀMesObjets({ idObjet: idBd });
  }

  async enleverDeMesBds({ idBd }: { idBd: string }): Promise<void> {
    return await this.enleverDeMesObjets({ idObjet: idBd });
  }

  async créerSchémaDeBd({ idBd }: { idBd: string }): Promise<SchémaBd> {
    const licence = (await uneFois<string | null | undefined>(
      (f) => this.suivreLicence({ idBd, f }),
      (x) => !!x,
    )) as string;
    const licenceContenu =
      (await uneFois<string | null | undefined>((f) =>
        this.suivreLicenceContenu({ idBd, f }),
      )) || undefined;

    const métadonnées = await uneFois<Métadonnées>((f) =>
      this.suivreMétadonnées({ idBd, f }),
    );

    const motsClefs = await uneFois<string[]>((f) =>
      this.suivreMotsClefs({ idBd, f }),
    );
    const statut = await uneFois<PartielRécursif<StatutDonnées> | undefined>(
      (f) => this.suivreStatut({ idBd, f }),
    );
    const nuées = await uneFois<string[]>((f) => this.suivreNuées({ idBd, f }));
    const clefUnique = await uneFois<string | undefined>((f) =>
      this.suivreClefUnique({ idBd, f }),
    );

    const idsTableaux = await uneFois<string[]>((f) =>
      this.suivreTableaux({ idBd, f }),
    );

    const tableaux: {
      idTableau: string;
      tableau: SchémaBd["tableaux"][string];
    }[] = await Promise.all(
      idsTableaux.map(async (idTableau) => {
        const infoCols = await uneFois<InfoColonne[]>((f) =>
          this.tableaux.suivreColonnes({
            idStructure: idBd,
            idTableau,
            f: ignorerNonDéfinis(f),
          }),
        );
        const cols = infoCols.map((col) => ({
          idColonne: col.id,
          idVariable: col.variable,
          index: col.index,
        }));
        return {
          idTableau,
          tableau: {
            cols,
          },
        };
      }),
    );

    const schéma: SchémaBd = {
      clefUnique,
      licence,
      licenceContenu,
      métadonnées,
      motsClefs,
      nuées,
      tableaux: Object.fromEntries(
        tableaux.map((t) => [t.idTableau, t.tableau]),
      ),
    };

    if (statutComplet(statut)) schéma.statut = statut;

    return schéma;
  }

  async créerBdDeSchéma({
    schéma,
    épingler = true,
  }: {
    schéma: SchémaBd;
    épingler?: boolean;
  }): Promise<string> {
    const {
      métadonnées,
      tableaux,
      motsClefs,
      nuées,
      licence,
      licenceContenu,
      statut,
      clefUnique,
    } = schéma;

    const idBd = await this.créerBd({
      licence,
      licenceContenu,
      épingler,
    });

    if (métadonnées) {
      await this.sauvegarderMétadonnées({ idBd, métadonnées });
    }

    if (motsClefs) {
      await this.ajouterMotsClefs({ idBd, idsMotsClefs: motsClefs });
    }

    if (nuées) {
      await Promise.all(
        nuées.map((idNuée) => this.rejoindreNuée({ idBd, idNuée })),
      );
    }

    if (statut) {
      await this.sauvegarderStatut({ idBd, statut });
    }

    for (const [idTableau, { cols }] of Object.entries(tableaux)) {
      await this.ajouterTableau({ idBd, idTableau });

      for (const c of cols) {
        const { idColonne, idVariable, index } = c;
        await this.tableaux.ajouterColonne({
          idStructure: idBd,
          idTableau,
          idVariable,
          idColonne,
        });
        if (index) {
          await this.tableaux.modifierIndexColonne({
            idStructure: idBd,
            idTableau,
            idColonne,
            index: true,
          });
        }
      }
    }

    if (clefUnique) {
      await this.ajouterClefUnique({ idBd, clefUnique });
    }

    return idBd;
  }

  async ouvrirBd({
    idBd,
  }: {
    idBd: string;
  }): Promise<{ bd: TypedNested<StructureBd>; oublier: Oublier }> {
    const { objet: bd, oublier } = await this.ouvrirObjet({ idObjet: idBd });
    return { bd, oublier };
  }

  async copierBd({
    idBd,
    copierDonnées = true,
  }: {
    idBd: string;
    copierDonnées?: boolean;
  }): Promise<string> {
    const { bd, oublier } = await this.ouvrirBd({ idBd });
    const licence = await bd.get("licence");
    const licenceContenu = await bd.get("licenceContenu");
    if (!licence)
      throw new Error(`Aucune licence trouvée sur la BD source ${idBd}.`);

    const idNouvelleBd = await this.créerBd({
      licence,
      licenceContenu,
    });

    const métadonnées = await bd.get("métadonnées");
    if (métadonnées) {
      await this.sauvegarderMétadonnées({ idBd: idNouvelleBd, métadonnées });
    }

    const noms = await bd.get("noms");
    if (noms) {
      await this.sauvegarderNoms({ idBd: idNouvelleBd, noms });
    }

    const descriptions = await bd.get("descriptions");
    if (descriptions) {
      await this.sauvegarderDescriptions({
        idBd: idNouvelleBd,
        descriptions,
      });
    }

    const motsClefs = await bd.get("motsClefs");
    if (motsClefs)
      await this.ajouterMotsClefs({
        idBd: idNouvelleBd,
        idsMotsClefs: Object.keys(motsClefs),
      });

    const nuées = await bd.get("nuées");
    if (nuées) {
      for (const idNuée of Object.keys(nuées)) {
        await this.rejoindreNuée({
          idBd: idNouvelleBd,
          idNuée,
        });
      }
    }

    const tableaux = await uneFois<string[]>((f) =>
      this.suivreTableaux({ idBd, f }),
    );
    for (const idTableau of tableaux) {
      await this.tableaux.copierTableau({
        idStructure: idBd,
        idTableau,
        idStructureDestinataire: idNouvelleBd,
        copierDonnées,
      });
    }

    const statut = await bd.get("statut");
    if (statut)
      await this.sauvegarderStatut({
        idBd: idNouvelleBd,
        statut,
      });

    const { bd: nouvelleBd, oublier: oublierNouvelle } = await this.ouvrirBd({
      idBd: idNouvelleBd,
    });

    const image = await bd.get("image");
    if (image) await nouvelleBd.set(`image`, image);

    await nouvelleBd.set("copiéeDe", { id: idBd });

    await Promise.allSettled([oublier(), oublierNouvelle()]);
    return idNouvelleBd;
  }

  @cacheSuivi
  async suivreSource({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<{ id?: string } | undefined>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idBd,
      f: (bd) => f(bd.copiéeDe),
    });
  }

  // Accès

  async inviterAuteur({
    idBd,
    idCompte,
    rôle,
  }: {
    idBd: string;
    idCompte: string;
    rôle: Rôle;
  }): Promise<void> {
    return await this.donnerAccèsObjet({
      idObjet: idBd,
      identité: idCompte,
      rôle,
    });
  }

  async suivreAuteurs({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<InfoAuteur[]>;
  }): Promise<Oublier> {
    return await this.suivreAuteursObjet({ idObjet: idBd, f });
  }

  async confirmerPermission({ idBd }: { idBd: string }): Promise<void> {
    const compte = this.service("compte");

    if (!(await compte.permission({ idObjet: this.àIdOrbite(idBd) })))
      throw new Error(
        `Permission de modification refusée pour la base de données ${idBd}.`,
      );
  }

  // Épingles

  async épingler({
    idBd,
    options = {},
  }: {
    idBd: string;
    options?: PartielRécursif<ContenuÉpingleBd>;
  }) {
    const favoris = this.service("favoris");

    const épingle: ContenuÉpingleBd = résoudreDéfauts(options, {
      base: TOUS_DISPOSITIFS,
      données: {
        tableaux: TOUS_DISPOSITIFS,
        fichiers: DISPOSITIFS_INSTALLÉS,
      },
    });

    await favoris.épinglerFavori({
      idObjet: idBd,
      épingle: { type: "bd", épingle },
    });
  }

  async désépingler({ idBd }: { idBd: string }): Promise<void> {
    const favoris = this.service("favoris");

    await favoris.désépinglerFavori({ idObjet: idBd });
  }

  async suivreÉpingle({
    idBd,
    f,
    idCompte,
  }: {
    idBd: string;
    f: Suivi<ÉpingleBd | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const favoris = this.service("favoris");
    return await favoris.suivreFavoris({
      idCompte,
      f: async (épingles) => {
        const épingleBd = épingles?.find(({ idObjet, épingle }) => {
          return idObjet === idBd && épingle.type === "bd"
            ? épingle
            : undefined;
        }) as ÉpingleFavorisAvecId<ContenuÉpingleBd> | undefined;
        await f(épingleBd?.épingle as ÉpingleBd);
      },
    });
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
  }: {
    épingle: ÉpingleFavorisBooléenniséeAvecId<ÉpingleBd>;
    f: Suivi<Set<string>>;
  }): Promise<Oublier> {
    const info: {
      base?: (string | undefined)[];
      données?: (string | undefined)[];
      fichiers?: (string | undefined)[];
    } = {};

    const fFinale = async () => {
      return await f(
        new Set(
          Object.values(info)
            .flat()
            .filter((x): x is string => !!x),
        ),
      );
    };

    const fsOublier: Oublier[] = [];
    if (épingle.épingle.épingle.base) {
      const oublierBase = await this.suivreObjet({
        idObjet: épingle.idObjet,
        f: async (bd) => {
          try {
            info.base = [this.àIdOrbite(épingle.idObjet), bd.image];
          } catch {
            return; // Si la structure n'est pas valide.
          }
          await fFinale();
        },
      });
      fsOublier.push(oublierBase);
    }

    // Données des tableaux
    if (épingle.épingle.épingle.données?.tableaux) {
      const oublierTableaux = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }) => {
          return await this.suivreTableaux({
            idBd: épingle.idObjet,
            f: (tbx) => fSuivreRacine(tbx || []),
          });
        },
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: Suivi<string | undefined>;
        }) => {
          return await this.tableaux.suivreIdDonnées({
            idStructure: épingle.idObjet,
            idTableau: id,
            f: fSuivreBranche,
          });
        },
        f: async (données: string[]) => {
          info.données = données;
          await fFinale();
        },
      });
      fsOublier.push(oublierTableaux);
    }

    // Fichiers présents dans les données
    if (épingle.épingle.épingle.données?.fichiers) {
      const oublierDonnées = await suivreDeFonctionListe({
        fListe: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (éléments: string[]) => Promise<void>;
        }) => {
          return await this.suivreTableaux({
            idBd: épingle.idObjet,
            f: (tbx) => fSuivreRacine(tbx || []),
          });
        },
        fBranche: async ({
          id,
          fSuivreBranche,
        }: {
          id: string;
          fSuivreBranche: Suivi<DonnéesRangéeTableauAvecId[]>;
        }) => {
          return await this.tableaux.suivreDonnées({
            idStructure: épingle.idObjet,
            idTableau: id,
            f: fSuivreBranche,
          });
        },
        f: async (données: DonnéesRangéeTableauAvecId[]) => {
          const idcs = données
            .map((file) =>
              Object.values(file.données)
                .filter(
                  (v) =>
                    (typeof v === "string" && idcEtFichierValide(v)) ||
                    (Array.isArray(v) &&
                      v.every(
                        (x) => typeof x === "string" && idcEtFichierValide(x),
                      )),
                )
                .flat(),
            )
            .flat() as string[];
          info.fichiers = idcs;
          await fFinale();
        },
      });
      fsOublier.push(oublierDonnées);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  // Noms

  async sauvegarderNoms({
    idBd,
    noms,
  }: {
    idBd: string;
    noms: TraducsTexte;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });

    await bd.insert("noms", noms);
    await oublier();
  }

  async sauvegarderNom({
    idBd,
    langue,
    nom,
  }: {
    idBd: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set(`noms/${langue}`, nom);
    await oublier();
  }

  async effacerNom({
    idBd,
    langue,
  }: {
    idBd: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.del(`noms/${langue}`);
    await oublier();
  }

  @cacheSuivi
  async suivreNoms({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<TraducsTexte>;
  }): Promise<Oublier> {
    return this.suivreObjet({
      idObjet: idBd,
      f: async (bd) => await f(définis(bd.noms || {})),
    });
  }

  // Descriptions

  async sauvegarderDescriptions({
    idBd,
    descriptions,
  }: {
    idBd: string;
    descriptions: TraducsTexte;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.insert("descriptions", descriptions);
    await oublier();
  }

  async sauvegarderDescription({
    idBd,
    langue,
    description,
  }: {
    idBd: string;
    langue: string;
    description: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set(`descriptions/${langue}`, description);
    await oublier();
  }

  async effacerDescription({
    idBd,
    langue,
  }: {
    idBd: string;
    langue: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.del(`descriptions/${langue}`);
    await oublier();
  }

  @cacheSuivi
  async suivreDescriptions({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<TraducsTexte>;
  }): Promise<Oublier> {
    return this.suivreObjet({
      idObjet: idBd,
      f: async (bd) => await f(définis(bd.descriptions || {})),
    });
  }

  // Image

  async sauvegarderImage({
    idBd,
    image,
  }: {
    idBd: string;
    image: { contenu: Uint8Array; nomFichier: string };
  }): Promise<string> {
    const hélia = this.service("hélia");
    const compte = this.service("compte");

    const { sauvegarder: maxTailleImage } = await compte.maxTailleImages();

    if (image.contenu.byteLength > maxTailleImage) {
      throw new Error("Taille maximale excédée");
    }

    const idImage = await hélia.ajouterFichierÀSFIP(image);

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set("image", idImage);
    await oublier();

    return idImage;
  }

  async effacerImage({ idBd }: { idBd: string }): Promise<void> {
    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.del("image");
    await oublier();
  }

  @cacheSuivi
  async suivreImage({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<{ image: Uint8Array; idImage: string } | null>;
  }): Promise<Oublier> {
    const hélia = this.service("hélia");
    const compte = this.service("compte");

    const { visualiser: maxTailleImage } = await compte.maxTailleImages();

    return await this.suivreObjet({
      idObjet: idBd,
      f: async (bd) => {
        const idImage = bd.image;
        if (!idImage) {
          return await f(null);
        } else {
          const image = await hélia.obtFichierDeSFIP({
            id: idImage,
            max: maxTailleImage,
          });
          return await f(image ? { image, idImage } : null);
        }
      },
    });
  }

  // Métadonnées

  async sauvegarderMétadonnées({
    idBd,
    métadonnées,
  }: {
    idBd: string;
    métadonnées: Métadonnées;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });

    await bd.insert("métadonnées", métadonnées);
    await oublier();
  }

  async sauvegarderMétadonnée({
    idBd,
    clef,
    valeur,
  }: {
    idBd: string;
    clef: string;
    valeur: DagCborEncodable;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set(`métadonnées/${clef}`, valeur);
    await oublier();
  }

  async effacerMétadonnée({
    idBd,
    clef,
  }: {
    idBd: string;
    clef: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.del(`métadonnées/${clef}`);
    await oublier();
  }

  @cacheSuivi
  async suivreMétadonnées({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<Métadonnées>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idBd,
      f: async (bd) => await f(définis(bd.métadonnées || {})),
    });
  }

  // Statut

  async sauvegarderStatut({
    idBd,
    statut,
  }: {
    idBd: string;
    statut: StatutDonnées;
  }): Promise<void> {
    const { bd, oublier } = await this.ouvrirBd({ idBd });
    bd.set("statut", statut);
    await oublier();
  }

  async suivreStatut({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<PartielRécursif<StatutDonnées> | undefined>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idBd,
      f: async (bd) => await f(bd.statut),
    });
  }

  // Licences

  async changerLicence({
    idBd,
    licence,
  }: {
    idBd: string;
    licence: string;
  }): Promise<void> {
    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.set("licence", licence);
    await oublier();
  }

  async changerLicenceContenu({
    idBd,
    licenceContenu,
  }: {
    idBd: string;
    licenceContenu?: string;
  }): Promise<void> {
    const { bd, oublier } = await this.ouvrirBd({ idBd });

    if (licenceContenu) {
      await bd.set("licenceContenu", licenceContenu);
    } else {
      await bd.del("licenceContenu");
    }
    await oublier();
  }

  @cacheSuivi
  async suivreLicence({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string | null | undefined>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idBd,
      f: async (bd) => await f(bd ? bd.licence || null : undefined),
    });
  }

  @cacheSuivi
  async suivreLicenceContenu({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string | null | undefined>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idBd,
      f: async (bd) => await f(bd ? bd.licenceContenu || null : undefined),
    });
  }

  // Mots-clefs

  async ajouterMotsClefs({
    idBd,
    idsMotsClefs,
  }: {
    idBd: string;
    idsMotsClefs: string | string[];
  }): Promise<void> {
    const motsClefs = this.service("motsClefs");

    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];

    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });

    for (const id of idsMotsClefs) {
      await bd.put(`motsClefs/${motsClefs.enleverProtocole(id)}`, null);
    }
    await oublier();
  }

  async effacerMotClef({
    idBd,
    idMotClef,
  }: {
    idBd: string;
    idMotClef: string;
  }): Promise<void> {
    const motsClefs = this.service("motsClefs");

    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });

    await bd.del(`motsClefs/${motsClefs.enleverProtocole(idMotClef)}`);

    await oublier();
  }

  @cacheSuivi
  async suivreMotsClefs({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const motsClefs = this.service("motsClefs");

    return await this.suivreObjet({
      idObjet: idBd,
      f: (bd) =>
        f(
          Object.keys(bd.motsClefs || {}).map((id) =>
            motsClefs.ajouterProtocole(id),
          ),
        ),
    });
  }

  // Tableaux

  async ajouterTableau({
    idBd,
    idTableau,
  }: {
    idBd: string;
    idTableau?: string;
  }): Promise<string> {
    await this.confirmerPermission({ idBd });

    idTableau = idTableau || uuidv4();
    return await this.tableaux.créerTableau({ idStructure: idBd, idTableau });
  }

  async effacerTableau({
    idBd,
    idTableau,
  }: {
    idBd: string;
    idTableau: string;
  }): Promise<void> {
    // L'interface du tableau s'occupe de tout !
    await this.tableaux.effacerTableau({ idStructure: idBd, idTableau });
  }

  @cacheSuivi
  async suivreTableaux({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idBd,
      f: (bd) => f(Object.keys(bd.tableaux || {})),
    });
  }

  // Variables

  @cacheSuivi
  async suivreVariables({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreTableaux({
        idBd,
        f: fSuivreRacine,
      });
    };

    const fBranche = async ({
      id: idTableau,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: Suivi<string[]>;
    }): Promise<Oublier> => {
      return await this.tableaux.suivreVariables({
        idStructure: idBd,
        idTableau,
        f: fSuivreBranche,
      });
    };

    return await suivreDeFonctionListe({
      fListe,
      f: async (variables: string[]) => await f(variables || []),
      fBranche,
    });
  }

  // Nuées

  async rejoindreNuée({
    idBd,
    idNuée,
  }: {
    idBd: string;
    idNuée: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.put(`nuées/${enleverPréfixesEtOrbite(idNuée)}`, null);

    await oublier();
  }

  async quitterNuée({
    idBd,
    idNuée,
  }: {
    idBd: string;
    idNuée: string;
  }): Promise<void> {
    await this.confirmerPermission({ idBd });

    const { bd, oublier } = await this.ouvrirBd({ idBd });
    await bd.del(`nuées/${enleverPréfixesEtOrbite(idNuée)}`);

    await oublier();
  }

  @cacheSuivi
  async suivreNuées({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string[]>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idBd,
      f: (bd) =>
        f(
          Object.keys(bd.nuées || {}).map((id) =>
            ajouterPréfixes(id, "/constl/nuées"),
          ),
        ),
    });
  }

  // Comparaisons

  @cacheSuivi
  async suivreDifférencesAvecBd({
    idBd,
    idBdRéf,
    f,
  }: {
    idBd: string;
    idBdRéf: string;
    f: Suivi<DifférenceBds[]>;
  }): Promise<Oublier> {
    const différences: {
      tableauxManquants?: string[];
      tableauxSupplémentaires?: string[];
      différencesTableaux?: { id: string; différence: DifférenceTableaux }[];
    } = {};

    const fFinale = async () => {
      const différencesTableauxManquants: DifférenceBDTableauManquant[] = (
        différences.tableauxManquants || []
      ).map((t) => ({
        type: "tableauManquant",
        sévère: true,
        clefManquante: t,
      }));

      const différencesTableauxSupplémentaires: DifférenceBDTableauSupplémentaire[] =
        (différences.tableauxSupplémentaires || []).map((t) => ({
          type: "tableauSupplémentaire",
          sévère: false,
          clefExtra: t,
        }));

      const différencesTableauxBds: DifférenceTableauxBds[] = (
        différences.différencesTableaux || []
      ).map(({ id, différence }) => ({
        type: "tableau",
        idTableau: id,
        différence: différence,
        sévère: différence.sévère,
      }));

      return await f([
        ...différencesTableauxManquants,
        ...différencesTableauxSupplémentaires,
        ...différencesTableauxBds,
      ]);
    };

    return await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }) => {
        const tableaux: { base?: string[]; réf?: string[] } = {};

        const fTableaux = async () => {
          if (!tableaux.base || !tableaux.réf) {
            différences.tableauxManquants = [];
            différences.tableauxSupplémentaires = [];
            différences.différencesTableaux = [];
            await fFinale();
            return;
          }
          différences.tableauxManquants = tableaux.réf.filter(
            (t) => !tableaux.base?.includes(t),
          );
          différences.tableauxSupplémentaires = tableaux.base.filter(
            (t) => !tableaux.réf?.includes(t),
          );
          await fFinale();

          const communs = tableaux.réf.filter((t) =>
            tableaux.base?.includes(t),
          );
          return await fSuivreRacine(communs);
        };

        const oublierTableaux = await this.suivreTableaux({
          idBd: idBd,
          f: async (x) => {
            tableaux.base = x;
            await fTableaux();
          },
        });
        const oublierTableauxRéf = await this.suivreTableaux({
          idBd: idBdRéf,
          f: async (x) => {
            tableaux.réf = x;
            await fTableaux();
          },
        });
        return async () => {
          await oublierTableaux();
          await oublierTableauxRéf();
        };
      },
      fBranche: async ({ id: tableau, fSuivreBranche }) => {
        return await this.tableaux.suivreDifférencesAvecTableau({
          tableau: {
            idStructure: idBd,
            idTableau: tableau,
          },
          tableauRéf: {
            idStructure: idBdRéf,
            idTableau: tableau,
          },
          f: async (différences) =>
            await fSuivreBranche(
              différences.map((différence) => ({ id: tableau, différence })),
            ),
        });
      },
      f: async (
        différencesTableaux: { id: string; différence: DifférenceTableaux }[],
      ) => {
        différences.différencesTableaux = différencesTableaux;
        await fFinale();
      },
    });
  }

  // Combiner

  async combinerBds({
    idBdDestinataire,
    idBdSource,
    patience = 100,
  }: {
    idBdDestinataire: string;
    idBdSource: string;
    patience?: number;
  }): Promise<void> {
    const tableauxSource = await uneFois<string[]>(
      (f) => this.suivreTableaux({ idBd: idBdSource, f }),
      attendreStabilité(patience),
    );
    const tableauxDestinataire = await uneFois<string[]>(
      (f) => this.suivreTableaux({ idBd: idBdDestinataire, f }),
      attendreStabilité(patience),
    );
    const communs = tableauxSource.filter((t) =>
      tableauxDestinataire.includes(t),
    );

    await Promise.all(
      communs.map(async (idTableau) => {
        await this.tableaux.combinerDonnées({
          de: { idStructure: idBdSource, idTableau },
          à: { idStructure: idBdDestinataire, idTableau },
          patience,
        });
      }),
    );
  }

  // Bds uniques

  @cacheSuivi
  async suivreClefUnique({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string | undefined>;
  }): Promise<Oublier> {
    return await this.suivreObjet({
      idObjet: idBd,
      f: async (bd) => await f(bd.clefUnique),
    });
  }

  @cacheSuivi
  async suivreBdUnique({
    schéma,
    f,
  }: {
    schéma: SchémaBd;
    f: Suivi<string>;
  }): Promise<Oublier> {
    const stockage = this.service("stockage");
    const orbite = this.service("orbite");

    const { clefUnique } = schéma;
    if (!clefUnique)
      throw new Error("Le schéma doit contenir la propriété `clefUnique`.");

    const clefStockageLocal = "bdUnique : " + clefUnique;

    // On peut mettre la queue ici car `@cacheSuivi` assure que cette fonction ne sera appellée
    // qu'une seule fois en même temps
    const queue = new PQueue({ concurrency: 1 });

    const déjàCombinées = new Set();

    const tâche = (bds: string[]): (() => Promise<void>) => {
      return async () => {
        let idBd: string;

        // À faire - s'assurer que ceci n'est pas possible
        if (!stockage.estDémarré) throw new Error("Constellation fermée.");

        let idBdLocale = await stockage.obtenirItem(clefStockageLocal);
        if (idBdLocale) {
          const crono = new TimeoutController(1000);
          try {
            // S'assurer que la bd est disponible localement
            const { oublier: oublierBdOrbite } = await orbite.ouvrirBd({
              id: this.àIdOrbite(idBdLocale),
              signal: crono.signal,
            });
            await oublierBdOrbite();

            // S'assurer qu'elle est toujours d'intérêt
            const { bd, oublier } = await this.ouvrirBd({ idBd: idBdLocale });
            if ((await bd.get("clefUnique")) !== clefUnique) idBdLocale = null;
            await oublier();
          } catch (e) {
            if (e.toString().includes("AbortError")) {
              idBdLocale = null;
            } else {
              throw e;
            }
          }
        }

        switch (bds.length) {
          case 0: {
            if (idBdLocale) {
              idBd = idBdLocale;
            } else {
              idBd = await this.créerBdDeSchéma({ schéma });
              await stockage.sauvegarderItem({
                clef: clefStockageLocal,
                valeur: idBd,
              });
            }
            break;
          }
          default: {
            if (idBdLocale) bds = [...new Set([...bds, idBdLocale])];
            idBd = bds.sort()[0];
            await stockage.sauvegarderItem({
              clef: clefStockageLocal,
              valeur: idBd,
            });

            for (const bd of bds.slice(1)) {
              if (déjàCombinées.has(bd)) continue;

              déjàCombinées.add(bd);
              await this.combinerBds({
                idBdDestinataire: idBd,
                idBdSource: bd,
              });
              await this.effacerBd({ idBd: bd });
            }

            break;
          }
        }

        await f(idBd);
      };
    };

    const stabilité = stabiliser();
    const oublier = await suivreDeFonctionListe({
      fListe: ({ fSuivreRacine }: { fSuivreRacine: Suivi<string[]> }) =>
        this.suivreBds({ f: ignorerNonDéfinis(fSuivreRacine) }),
      fBranche: async ({ id, fSuivreBranche }) => {
        return await this.suivreObjet({
          idObjet: id,
          f: async (bd) =>
            await fSuivreBranche(bd.clefUnique === clefUnique ? id : undefined),
        });
      },
      f: stabilité(async (bds: string[]) => {
        queue.add(tâche(bds));
      }),
    });

    return async () => {
      await oublier();
      await queue.onIdle();
    };
  }

  async obtenirBdUnique({ schéma }: { schéma: SchémaBd }): Promise<string> {
    const orbite = this.service("orbite");

    const bdUniqueValide = async (idBd: string): Promise<boolean> => {
      const crono = new TimeoutController(1000);
      try {
        // S'assurer que la bd est disponible localement
        const { oublier: oublierBdOrbite } = await orbite.ouvrirBd({
          id: this.àIdOrbite(idBd),
          signal: crono.signal,
        });
        await oublierBdOrbite();

        // S'assurer qu'elle est toujours d'intérêt
        const { bd, oublier } = await this.ouvrirBd({ idBd });
        if ((await bd.get("clefUnique")) !== schéma.clefUnique) {
          await oublier();
          return false;
        }
        await oublier();
      } catch {
        return false;
      }
      return true;
    };
    return await uneFois(
      async (fSuivi: Suivi<string>) => {
        return await this.suivreBdUnique({
          schéma,
          f: fSuivi,
        });
      },
      async (idBd) => {
        // Il faut vérifier que la bd est toujours valide en raison de la cache sur `this.suivreBdUnique`
        return idBd !== undefined && bdUniqueValide(idBd);
      },
    );
  }

  @cacheSuivi
  async suivreDonnéesBdUnique({
    schéma,
    idTableau,
    f,
  }: {
    schéma: SchémaBd;
    idTableau: string;
    f: Suivi<DonnéesRangéeTableauAvecId[]>;
  }): Promise<Oublier> {
    const fFinale = async (données?: DonnéesRangéeTableauAvecId[]) => {
      return await f(données || []);
    };

    const fSuivreDonnéesDeTableau = async ({
      id: idBd,
      fSuivre,
    }: {
      id: string;
      fSuivre: Suivi<DonnéesRangéeTableauAvecId[]>;
    }): Promise<Oublier> => {
      return await this.tableaux.suivreDonnées({
        idStructure: idBd,
        idTableau,
        f: fSuivre,
      });
    };

    const fSuivreIdBd = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: Suivi<string>;
    }): Promise<Oublier> => {
      return await this.suivreBdUnique({
        schéma,
        f: ignorerNonDéfinis(fSuivreRacine),
      });
    };

    return await suivreFonctionImbriquée({
      fRacine: fSuivreIdBd,
      fSuivre: fSuivreDonnéesDeTableau,
      f: fFinale,
    });
  }

  async ajouterClefUnique({
    idBd,
    clefUnique,
  }: {
    idBd: string;
    clefUnique: string;
  }) {
    const { bd, oublier } = await this.ouvrirBd({ idBd });

    await bd.set("clefUnique", clefUnique);

    await oublier();
  }

  // Empreintes

  async suivreEmpreinteTête({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<string>;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    const empreintes: {
      tableaux?: string[];
      variables?: string[];
      bd?: string;
    } = {};
    const fFinale = async () => {
      const texte = [
        empreintes.bd,
        ...(empreintes.tableaux || []),
        ...(empreintes.variables || []),
      ]
        .toSorted()
        .join("/");
      await f(Base64.stringify(md5(texte)));
    };

    const oublierEmpreinteBd = await orbite.suivreEmpreinteTêteBd({
      idBd: this.àIdOrbite(idBd),
      f: async (x) => {
        empreintes.bd = x;
        await fFinale();
      },
    });

    const oublierEmpreintesTableaux = await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }) =>
        await this.suivreTableaux({ idBd, f: fSuivreRacine }),
      fBranche: async ({
        id: idTableau,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: Suivi<string>;
      }) =>
        await this.tableaux.suivreEmpreinteTête({
          idStructure: idBd,
          idTableau,
          f: fSuivreBranche,
        }),
      f: async (x: string[]) => {
        empreintes.tableaux = x;
        await fFinale();
      },
    });

    const oublierEmpreinteVariables = await suivreDeFonctionListe({
      fListe: async ({ fSuivreRacine }) =>
        await this.suivreVariables({ idBd, f: fSuivreRacine }),
      fBranche: async ({ id: idVariable, fSuivreBranche }) =>
        await orbite.suivreEmpreinteTêteBd({
          idBd: enleverPréfixes(idVariable),
          f: fSuivreBranche,
        }),
      f: async (x: string[]) => {
        empreintes.variables = x;
        await fFinale();
      },
    });

    return async () => {
      await oublierEmpreintesTableaux();
      await oublierEmpreinteVariables();
      await oublierEmpreinteBd();
    };
  }

  // Qualité

  @cacheSuivi
  async suivreScoreAccès({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<number | undefined>;
  }): Promise<Oublier> {
    // À faire
    f(Number.parseInt(idBd));
    return faisRien;
  }

  @cacheSuivi
  async suivreScoreInfos({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<number | undefined>;
  }): Promise<Oublier> {
    const rés: {
      noms: TraducsTexte;
      descriptions: TraducsTexte;
    } = {
      noms: {},
      descriptions: {},
    };
    const fFinale = async () => {
      const scores = [
        Object.keys(rés.noms).length ? 1 : 0,
        Object.keys(rés.descriptions).length ? 1 : 0,
      ];

      const qualité = moyenne(scores);
      await f(qualité);
    };
    const oublierNoms = await this.suivreNoms({
      idBd,
      f: (noms) => {
        rés.noms = noms;
        fFinale();
      },
    });

    const oublierDescr = await this.suivreDescriptions({
      idBd,
      f: (descriptions) => {
        rés.descriptions = descriptions;
        fFinale();
      },
    });

    const oublier = async () => {
      await oublierNoms();
      await oublierDescr();
    };

    return oublier;
  }

  @cacheSuivi
  async suivreScoreCouverture({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<number | undefined>;
  }): Promise<Oublier> {
    const fFinale = async (branches: ScoreCouvertureTableau[]) => {
      const numérateur = branches.reduce(
        (a: number, b: ScoreCouvertureTableau) => a + b.numérateur,
        0,
      );
      const dénominateur = branches.reduce(
        (a: number, b: ScoreCouvertureTableau) => a + b.dénominateur,
        0,
      );
      await f(dénominateur === 0 ? undefined : numérateur / dénominateur);
    };

    const fBranche = async ({
      id: idTableau,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: Suivi<ScoreCouvertureTableau>;
    }): Promise<Oublier> => {
      return await this.tableaux.suivreScoreCouverture({
        idStructure: idBd,
        idTableau,
        f: fSuivreBranche,
      });
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreTableaux({
        idBd,
        f: (tableaux) => fSuivreRacine(tableaux),
      });
    };

    return await suivreDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  @cacheSuivi
  async suivreScoreValide({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<number | undefined>;
  }): Promise<Oublier> {
    type ScoreCouvertureTableau = { numérateur: number; dénominateur: number };

    const fFinale = async (branches: ScoreCouvertureTableau[]) => {
      const numérateur = branches.reduce(
        (a: number, b: ScoreCouvertureTableau) => a + b.numérateur,
        0,
      );
      const dénominateur = branches.reduce(
        (a: number, b: ScoreCouvertureTableau) => a + b.dénominateur,
        0,
      );
      await f(dénominateur === 0 ? undefined : numérateur / dénominateur);
    };

    const fBranche = async ({
      id: idTableau,
      fSuivreBranche,
    }: {
      id: string;
      fSuivreBranche: Suivi<ScoreCouvertureTableau>;
    }): Promise<Oublier> => {
      const info: {
        données?: DonnéesRangéeTableauAvecId[];
        cols?: InfoColonneAvecCatégorie[];
        règles?: RègleColonne[];
        erreurs?: ErreurDonnée[];
      } = {};

      const fFinaleBranche = () => {
        const { données, erreurs, cols, règles } = info;
        if (
          données !== undefined &&
          erreurs !== undefined &&
          cols !== undefined
        ) {
          const colsÉligibles = cols.filter(
            (c) =>
              c.catégorie?.catégorie === "numérique" ||
              règles?.some((r) => r.colonne === c.id),
          );

          const déjàVus: { id: string; idColonne: string }[] = [];
          const nCellulesÉrronnées = erreurs.filter((x) => {
            const déjàVu = déjàVus.find(
              (y) => y.id === x.id && y.idColonne === x.erreur.colonne,
            );
            if (déjàVu) {
              return false;
            } else {
              déjàVus.push({ id: x.id, idColonne: x.erreur.colonne });
              return true;
            }
          }).length;

          const dénominateur = données
            .map(
              (d) =>
                colsÉligibles.filter((c) => d.données[c.id] !== undefined)
                  .length,
            )
            .reduce((a, b) => a + b, 0);

          const numérateur = dénominateur - nCellulesÉrronnées;

          fSuivreBranche({ numérateur, dénominateur });
        }
      };

      const oublierDonnées = await this.tableaux.suivreDonnées({
        idStructure: idBd,
        idTableau,
        f: (données) => {
          info.données = données;
          fFinaleBranche();
        },
      });

      const oublierErreurs = await this.tableaux.suivreValidDonnées({
        idStructure: idBd,
        idTableau,
        f: (erreurs) => {
          info.erreurs = erreurs;
          fFinaleBranche();
        },
      });

      const oublierColonnes = await this.tableaux.suivreCatégoriesColonnes({
        idStructure: idBd,
        idTableau,
        f: (cols) => {
          info.cols = cols;
          fFinaleBranche();
        },
      });

      return async () => {
        await oublierDonnées();
        await oublierErreurs();
        await oublierColonnes();
      };
    };

    const fListe = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (éléments: string[]) => Promise<void>;
    }): Promise<Oublier> => {
      return await this.suivreTableaux({
        idBd,
        f: (tableaux) => fSuivreRacine(tableaux),
      });
    };

    return await suivreDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  @cacheSuivi
  async suivreScoreQualité({
    idBd,
    f,
  }: {
    idBd: string;
    f: Suivi<ScoreBd>;
  }): Promise<Oublier> {
    const info: {
      accès?: number;
      couverture?: number;
      valide?: number;
      infos?: number;
      licence?: number;
    } = {};

    const fFinale = async () => {
      const { accès, couverture, valide, infos, licence } = info;
      const score: ScoreBd = {
        // Score impitoyable de 0 pour les bds sans licence
        total: licence ? moyenne([accès, couverture, valide, infos]) : 0,
        accès,
        couverture,
        valide,
        infos,
        licence,
      };
      await f(score);
    };

    const oublierAccès = await this.suivreScoreAccès({
      idBd,
      f: async (accès) => {
        info.accès = accès;
        await fFinale();
      },
    });

    const oublierCouverture = await this.suivreScoreCouverture({
      idBd,
      f: async (couverture) => {
        info.couverture = couverture;
        await fFinale();
      },
    });

    const oublierValide = await this.suivreScoreValide({
      idBd,
      f: async (valide) => {
        info.valide = valide;
        await fFinale();
      },
    });

    const oublierInfos = await this.suivreScoreInfos({
      idBd,
      f: async (infos) => {
        info.infos = infos;
        await fFinale();
      },
    });

    const oublierLicence = await this.suivreLicence({
      idBd,
      f: async (licence) => {
        info.licence = licence ? 1 : 0;
        await fFinale();
      },
    });

    return async () => {
      await oublierAccès();
      await oublierCouverture();
      await oublierValide();
      await oublierInfos();
      await oublierLicence();
    };
  }

  // Exportations

  async suivreDonnéesExportation({
    idBd,
    langues,
    f,
  }: {
    idBd: string;
    langues?: string[];
    f: Suivi<DonnéesBdExportées>;
  }): Promise<Oublier> {
    const info: {
      nomsBd?: TraducsTexte;
      données?: DonnéesTableauExportées[];
    } = {};
    const fsOublier: Oublier[] = [];

    const fFinale = async () => {
      const { nomsBd, données } = info;
      if (!données) return;

      const idCourt = enleverPréfixesEtOrbite(idBd);
      const nomBd =
        nomsBd && langues ? traduire(nomsBd, langues) || idCourt : idCourt;
      await f({
        nomBd,
        tableaux: données,
      });
    };

    const oublierDonnées = await suivreDeFonctionListe({
      fListe: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (éléments: string[]) => Promise<void>;
      }) => {
        return await this.suivreTableaux({
          idBd,
          f: ignorerNonDéfinis(fSuivreRacine),
        });
      },
      f: async (données: DonnéesTableauExportées[]) => {
        info.données = données;
        await fFinale();
      },
      fBranche: async ({
        id,
        fSuivreBranche,
      }: {
        id: string;
        fSuivreBranche: Suivi<DonnéesTableauExportées>;
      }): Promise<Oublier> => {
        return await this.tableaux.suivreDonnéesExportation({
          idStructure: idBd,
          idTableau: id,
          langues,
          f: async (données) => {
            return await fSuivreBranche(données);
          },
        });
      },
    });
    fsOublier.push(oublierDonnées);

    if (langues) {
      const oublierNomsBd = await this.suivreNoms({
        idBd,
        f: async (noms) => {
          info.nomsBd = noms;
          await fFinale();
        },
      });
      fsOublier.push(oublierNomsBd);
    }

    return async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    };
  }

  async exporterDonnées({
    idBd,
    langues,
    nomFichier,
    patience = 500,
  }: {
    idBd: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
  }): Promise<DonnéesFichierBdExportées> {
    const docu = xlsxUtils.book_new();

    const données = await uneFois(
      async (fSuivi: Suivi<DonnéesBdExportées>): Promise<Oublier> => {
        return await this.suivreDonnéesExportation({
          idBd,
          langues,
          f: fSuivi,
        });
      },
      attendreStabilité(patience),
    );

    nomFichier = nomFichier || données.nomBd;

    const documentsMédias = new Set<string>();

    for (const tableau of données.tableaux) {
      tableau.documentsMédias.forEach((x) => documentsMédias.add(x));

      /* Créer le tableau */
      const tableauXLSX = xlsxUtils.json_to_sheet(tableau.données);

      /* Ajouter la feuille au document. XLSX n'accepte pas les noms de colonne > 31 caractères */
      xlsxUtils.book_append_sheet(
        docu,
        tableauXLSX,
        tableau.nomTableau.slice(0, 30),
      );
    }
    return { docu, documentsMédias, nomFichier };
  }

  async exporterÀFichier({
    idBd,
    langues,
    nomFichier,
    patience = 500,
    formatDocu,
    dossier = "",
    inclureDocuments = true,
    dossierMédias,
  }: {
    idBd: string;
    langues?: string[];
    nomFichier?: string;
    patience?: number;
    formatDocu: xlsx.BookType | "xls";
    dossier?: string;
    inclureDocuments?: boolean;
    dossierMédias?: string;
  }): Promise<string> {
    const donnéesExportées = await this.exporterDonnées({
      idBd,
      langues,
      nomFichier,
      patience,
    });

    const hélia = this.service("hélia");
    return await sauvegarderDonnéesExportées({
      données: donnéesExportées,
      formatDocu,
      obtItérableAsyncSFIP: hélia.obtItérableAsyncSFIP.bind(hélia),
      dossier,
      inclureDocuments,
      dossierMédias,
    });
  }
}
