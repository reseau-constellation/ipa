import { typedNested } from "@constl/bohr-db";
import { TypedEmitter } from "tiny-typed-emitter";
import { suivreFonctionImbriquée, uneFois } from "@constl/utils-ipa";
import { isValidAddress } from "@orbitdb/core";
import { merge } from "ts-deepmerge";
import { ServiceAppli } from "@/v2/nébuleuse/appli/index.js";
import { ajouterPréfixes, enleverPréfixes } from "@/v2/utils.js";
import { cacheSuivi } from "../../cache.js";
import {
  CLEF_ID_COMPTE,
  CLEF_N_CHANGEMENT_COMPTES,
  MAX_TAILLE_IMAGE_SAUVEGARDER,
  MAX_TAILLE_IMAGE_VISUALISER,
} from "../consts.js";
import { appelerLorsque } from "../utils.js";
import {
  ContrôleurNébuleuse,
  MEMBRE,
  MODÉRATRICE,
  estContrôleurNébuleuse,
} from "./accès/index.js";
import type { OptionsAppli } from "../../appli/appli.js";
import type { PartielRécursif, RequisRécursif } from "@/v2/types.js";
import type { Oublier, Suivi } from "../../types.js";
import type {
  BdsOrbite,
  ServiceOrbite,
  ServicesNécessairesOrbite,
} from "../orbite/orbite.js";
import type { ServicesLibp2pNébuleuse } from "../libp2p/libp2p.js";
import type {
  AccèsDispositif,
  AccèsUtilisateur,
  OptionsContrôleurNébuleuse,
  Rôle,
} from "./accès/index.js";
import type { NestedDatabaseType, NestedValue } from "@orbitdb/nested-db";
import type { TypedNested } from "@constl/bohr-db";
import type { JSONSchemaType } from "ajv";

export type MesDispositifs = {
  idDispositif: string;
  statut: "invité" | "accepté";
}[];

export type ConstsCompte = {
  maxTailleImageSauvegarder: number;
  maxTailleImageVisualiser: number;
};

export type OptionsServiceCompte<T extends { [clef: string]: NestedValue }> = {
  consts?: ConstsCompte;
  schéma: JSONSchemaType<PartielRécursif<T>>;
};

const défautsConstsCompte: RequisRécursif<ConstsCompte> = {
  maxTailleImageSauvegarder: MAX_TAILLE_IMAGE_SAUVEGARDER,
  maxTailleImageVisualiser: MAX_TAILLE_IMAGE_VISUALISER,
};

export type ServicesNécessairesCompte =
  ServicesNécessairesOrbite<ServicesLibp2pNébuleuse> & {
    orbite: ServiceOrbite<ServicesLibp2pNébuleuse>;
  };

export type ÉvénementsCompte = {
  changementCompte: (args: { idCompte: string }) => void;
};

type RetourDémarrageCompte<T extends { [clef: string]: NestedValue }> = {
  idCompte: string;
  bd: TypedNested<T>;
  oublier: Oublier;
};

export class BaseServiceCompte<
  T extends { [clef: string]: NestedValue } = {
    [clef: string]: NestedValue;
  },
> extends ServiceAppli<
  "compte",
  ServicesNécessairesCompte,
  RetourDémarrageCompte<T>,
  Required<OptionsServiceCompte<T>>
> {
  événements: TypedEmitter<
    {
      démarré: (args: RetourDémarrageCompte<T>) => void;
    } & ÉvénementsCompte
  >;

  constructor({
    services,
    options,
  }: {
    services: ServicesNécessairesCompte;
    options: OptionsServiceCompte<T> & OptionsAppli;
  }) {
    const consts = merge({}, options.consts || {}, défautsConstsCompte);

    super({
      clef: "compte",
      services,
      dépendances: ["orbite", "libp2p", "stockage"],
      options: { ...options, consts },
    });

    this.événements = new TypedEmitter();
  }

  async démarrer() {
    const { idCompte, bd, oublier } = await this.initialiserBdCompte();

    const bdTypée = typedNested({
      db: bd,
      schema: this.options.schéma,
    });
    this.estDémarré = { idCompte, bd: bdTypée, oublier };
    return await super.démarrer();
  }

  async fermer() {
    const { oublier } = await this.démarré();
    await oublier();
    await super.fermer();
  }

  async initialiserBdCompte(): Promise<{
    idCompte: string;
    bd: NestedDatabaseType;
    oublier: Oublier;
  }> {
    let idCompte = await this.service("stockage").obtenirItem(CLEF_ID_COMPTE);

    if (idCompte) {
      const { bd, oublier } = await this.service("orbite").ouvrirBd({
        id: enleverPréfixes(idCompte),
        type: "nested",
      });

      return { idCompte, bd, oublier };
    }

    const orbite = this.service("orbite");
    const { bd, oublier } = await orbite.créerBd({ type: "nested" });
    idCompte = ajouterPréfixes(bd.address, "/nébuleuse/compte");

    await this.service("stockage").sauvegarderItem({
      clef: CLEF_ID_COMPTE,
      valeur: idCompte,
    });
    return { idCompte, bd, oublier };
  }

  // Accès configuration
  async maxTailleImages(): Promise<{
    visualiser: number;
    sauvegarder: number;
  }> {
    return {
      sauvegarder: this.options.consts.maxTailleImageSauvegarder,
      visualiser: this.options.consts.maxTailleImageVisualiser,
    };
  }

  // Gestion compte

  async obtIdCompte(): Promise<string> {
    const { idCompte } = await this.démarré();
    return idCompte;
  }

  async obtIdLibp2p(): Promise<string> {
    const libp2p = await this.service("libp2p").libp2p();
    return libp2p.peerId.toString();
  }

  async obtIdDispositif(): Promise<string> {
    // L'identifiant du dispositif est déterminé par l'instance d'OrbitDB
    return await this.service("orbite").obtIdDispositif();
  }

  @cacheSuivi
  async suivreIdCompte({ f }: { f: Suivi<string> }): Promise<Oublier> {
    const oublier = appelerLorsque({
      émetteur: this.événements,
      événement: "changementCompte",
      f: async ({ idCompte }) => await f(idCompte),
    });

    await f(await this.obtIdCompte());
    return oublier;
  }

  idCompteValide(id: string): boolean {
    return (
      id.startsWith("/nébuleuse/compte") &&
      isValidAddress(id.replace("/nébuleuse/compte", ""))
    );
  }

  // Dispositifs

  @cacheSuivi
  async suivreMesDispositifs({ f }: { f: Suivi<string[]> }): Promise<Oublier> {
    const bd = await this.bd();
    if (estContrôleurNébuleuse(bd.access))
      return await bd.access.suivreDispositifsAutorisées((x) =>
        f(x.map((d) => d.idDispositif)),
      );
    else
      throw new Error(
        `Gestionnaire d'accès OrbitDB ${bd.access.type} non reconnnu.`,
      );
  }

  async ajouterDispositif({
    idDispositif,
  }: {
    idDispositif: string;
  }): Promise<void> {
    const bd = await this.bd();

    if (estContrôleurNébuleuse(bd.access))
      await bd.access.autoriser(MODÉRATRICE, idDispositif);
    else
      throw new Error(
        `Gestionnaire d'accès OrbitDB ${bd.access.type} non reconnnu.`,
      );
  }

  async rejoindreCompte({
    idCompte,
    signal,
  }: {
    idCompte: string;
    signal?: AbortSignal;
  }): Promise<void> {
    if (!this.idCompteValide(idCompte)) {
      throw new Error(`Adresse compte "${idCompte}" non valide`);
    }

    // Attendre de recevoir la permission d'écrire au nouveau compte
    const { bd: bdNouveauCompte, oublier } = await this.service(
      "orbite",
    ).ouvrirBd({ id: enleverPréfixes(idCompte), type: "nested", signal });

    const accès = bdNouveauCompte.access;
    if (!estContrôleurNébuleuse(accès)) {
      await oublier();
      throw new Error(
        `Gestionnaire d'accès OrbitDB ${bdNouveauCompte.access.type} non reconnu.`,
      );
    }

    const moi = await this.obtIdDispositif();

    await uneFois<AccèsDispositif[]>(
      async (f) => accès.suivreDispositifsAutorisées(f),
      (autorisés) => !!autorisés?.find((a) => a.idDispositif === moi),
    );

    // On sauvegarde le nouvel identifiant de compte
    const stockage = this.service("stockage");
    stockage.sauvegarderItem({ clef: CLEF_ID_COMPTE, valeur: idCompte });

    // Là on peut y aller
    await this.démarrer();
    await oublier();

    // On garde compte du nombre de changements de compte
    // afin de pouvoir, dans `réseau.ts`, ignorer les anciens changements qui peuvent
    // toujours se propager à travers le réseau
    const texteNChangementsCompte = await stockage.obtenirItem(
      CLEF_N_CHANGEMENT_COMPTES,
    );
    const nChangementsCompte = Number(texteNChangementsCompte) || 0;
    await stockage.sauvegarderItem({
      clef: CLEF_N_CHANGEMENT_COMPTES,
      valeur: (nChangementsCompte + 1).toString(),
    });
    this.événements.emit("changementCompte", { idCompte });
  }

  // Données compte

  async bd(): Promise<TypedNested<T>> {
    const { bd } = await this.démarré();

    return bd;
  }

  async suivreBd({
    f,
    idCompte,
    signal,
  }: {
    f: Suivi<TypedNested<T> | undefined>;
    idCompte?: string;
    signal?: AbortSignal;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");

    if (idCompte) {
      return await orbite.suivreBdEmboîtéeTypée<T>({
        id: enleverPréfixes(idCompte),
        schéma: this.options.schéma,
        f,
        signal,
      });
    } else {
      return await suivreFonctionImbriquée<TypedNested<T>>({
        fRacine: async ({ fSuivreRacine }) =>
          await this.suivreIdCompte({ f: fSuivreRacine }),
        f,
        fSuivre: async ({ id, fSuivre }) =>
          await orbite.suivreBdEmboîtéeTypée({
            id: enleverPréfixes(id),
            schéma: this.options.schéma,
            f: fSuivre,
            signal,
          }),
        journal: async (m) =>
          await this.service("journal").écrire(m.toString()),
      });
    }
  }

  async permission({
    idObjet,
  }: {
    idObjet: string;
  }): Promise<Rôle | undefined> {
    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: idObjet,
    });

    if (estContrôleurNébuleuse(bd.access)) {
      const monCompte = await this.obtIdCompte();
      const accès = bd.access;
      const rôle = (await accès.utilisateursAutorisés()).find(
        (x) => x.idCompte === enleverPréfixes(monCompte),
      )?.rôle;
      await oublier();
      return rôle;
    } else {
      await oublier();
      throw new Error(`Type d'accès ${bd.access.type} non reconnu.`);
    }
  }

  async suivrePermission({
    idObjet,
    f,
    idCompte,
  }: {
    idObjet: string;
    f: Suivi<Rôle | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    let monCompte: string | undefined = undefined;
    let utilisateurs: AccèsUtilisateur[] | undefined = undefined;

    const fFinale = async () => {
      await f(
        utilisateurs?.find((x) => x.idCompte === (idCompte || monCompte))?.rôle,
      );
    };

    const oublierAutorisations = await this.suivreAutorisations({
      idObjet,
      f: async (utilis: AccèsUtilisateur[]) => {
        utilisateurs = utilis;
        await fFinale();
      },
    });

    const oublierIdCompte = await this.suivreIdCompte({
      f: async (id) => {
        monCompte = id;
        await fFinale();
      },
    });

    return async () => {
      await Promise.all([oublierAutorisations(), oublierIdCompte()]);
    };
  }

  async suivreAutorisations({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: Suivi<AccèsUtilisateur[]>;
  }): Promise<Oublier> {
    const { bd, oublier: oublierBd } = await this.service("orbite").ouvrirBd({
      id: enleverPréfixes(idObjet),
    });
    const accès = bd.access;
    if (!estContrôleurNébuleuse(accès)) {
      await oublierBd();
      throw new Error(`Type d'accès ${bd.access.type} non reconnu.`);
    }

    const oublierAccès = await accès.suivreUtilisateursAutorisés((autorisés) =>
      f(
        autorisés.map((x) => ({
          rôle: x.rôle,
          idCompte: ajouterPréfixes(x.idCompte, "/nébuleuse/compte"),
        })),
      ),
    );

    return async () => {
      await Promise.all([oublierAccès(), oublierBd()]);
    };
  }

  async créerObjet<T extends keyof BdsOrbite>({
    type,
    optionsAccès,
    nom,
  }: {
    type: T;
    optionsAccès?: OptionsContrôleurNébuleuse;
    nom?: string;
  }) {
    const serviceOrbite = this.service("orbite");
    optionsAccès = optionsAccès || {
      écriture: enleverPréfixes(await this.obtIdCompte()),
    };

    return await serviceOrbite.créerBd({
      type,
      nom,
      options: {
        AccessController: ContrôleurNébuleuse(optionsAccès),
      },
    });
  }

  async donnerAccèsObjet({
    idObjet,
    identité,
    rôle = MEMBRE,
  }: {
    idObjet: string;
    identité: string;
    rôle: Rôle;
  }): Promise<void> {
    identité = enleverPréfixes(identité);

    if (!isValidAddress(identité)) {
      throw new Error(`Identité "${identité}" non valide.`);
    }

    const orbite = this.service("orbite");
    const { bd, oublier } = await orbite.ouvrirBd({ id: idObjet });
    const accès = bd.access;

    if (!estContrôleurNébuleuse(accès)) {
      await oublier();
      throw new Error(`Contrôleur d'accès non reconnu : ${accès.type}`);
    }
    await accès.autoriser(rôle, identité);

    await oublier();
  }
}

/*
Ci-dessous, on exclut les options de l'objet pour éviter des erreurs de type dans les
dans les constructers d'autres services qui dépendent de `ServiceCompte`
*/
export type ServiceCompte<
  T extends { [clef: string]: NestedValue } = {
    [clef: string]: NestedValue;
  },
> = Omit<BaseServiceCompte<T>, "options"> & {
  options: OptionsAppli & Omit<OptionsServiceCompte<T>, "schéma">;
};

export const serviceCompte =
  <T extends { [clef: string]: NestedValue }>(
    optionsCompte: OptionsServiceCompte<T>,
  ) =>
  ({
    options,
    services,
  }: {
    options: OptionsAppli;
    services: ServicesNécessairesCompte;
  }): ServiceCompte<T> => {
    return new BaseServiceCompte<T>({
      services,
      options: { ...optionsCompte, ...options },
    }) as ServiceCompte<T>;
  };
