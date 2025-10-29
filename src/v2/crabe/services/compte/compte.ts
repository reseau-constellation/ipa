import { JSONSchemaType } from "ajv";
import { merge } from "lodash-es";
import { TypedNested, typedNested } from "@constl/bohr-db";
import { NestedObjectToMap, NestedValueObject } from "@orbitdb/nested-db";
import { TypedEmitter } from "tiny-typed-emitter";
import {
  adresseOrbiteValide,
  suivreFonctionImbriquée,
  uneFois,
} from "@constl/utils-ipa";
import { Nébuleuse, ServiceNébuleuse } from "@/v2/nébuleuse/index.js";
import { PartielRécursif, RequisRécursif } from "@/v2/types.js";
import { cacheSuivi } from "@/décorateursCache.js";
import { Oublier, Suivi } from "../../types.js";
import { ServiceDonnéesNébuleuse } from "../services.js";
import { BdsOrbite, ServicesNécessairesOrbite } from "../orbite/orbite.js";
import { ServicesLibp2pCrabe } from "../libp2p/libp2p.js";
import {
  CLEF_ID_COMPTE,
  CLEF_N_CHANGEMENT_COMPTES,
  MAX_TAILLE_IMAGE_SAUVEGARDER,
  MAX_TAILLE_IMAGE_VISUALISER,
} from "../consts.js";
import { appelerLorsque } from "../utils.js";
import {
  AccèsDispositif,
  AccèsUtilisateur,
  ContrôleurConstellation,
  MEMBRE,
  MODÉRATRICE,
  OptionsContrôleurConstellation,
  Rôle,
  estContrôleurConstellation,
} from "./accès/index.js";

export type MesDispositifs = {
  idDispositif: string;
  statut: "invité" | "accepté";
}[];

export type ConstsCompte = {
  maxTailleImageSauvegarder: number;
  maxTailleImageVisualiser: number;
};

export type OptionsCompte = {
  consts: ConstsCompte;
};

const défautsConstsCompte: RequisRécursif<ConstsCompte> = {
  maxTailleImageSauvegarder: MAX_TAILLE_IMAGE_SAUVEGARDER,
  maxTailleImageVisualiser: MAX_TAILLE_IMAGE_VISUALISER,
};

export type SchémaDeStructureCompte<
  T extends { [clef: string]: NestedValueObject },
> = JSONSchemaType<PartielRécursif<T>>;
export type SchémaCompte<T> =
  T extends ServicesDonnées<infer S, infer _L> ? S : never;

export type ServicesNécessairesCompte<
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> = ServicesNécessairesOrbite<L> & {
  compte: ServiceCompte<{ [clef: string]: NestedValueObject }, L>;
};

export const compilerSchémaCompte = <
  T extends { [clef: string]: NestedValueObject },
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
>(
  compte: ServiceCompte<T, L>,
): SchémaDeStructureCompte<T> => {
  const schéma: SchémaDeStructureCompte<T> = {
    type: "object",
    properties: {},
  };
  for (const s of Object.values(compte.nébuleuse.services)) {
    if (s instanceof ServiceDonnéesNébuleuse) {
      schéma.properties[s.clef] = s.schéma;
    }
  }

  return schéma;
};

export type ServicesDonnées<
  T extends { [clef: string]: NestedValueObject },
  L extends ServicesLibp2pCrabe,
> = {
  [clef in Extract<keyof T, "string">]: ServiceDonnéesNébuleuse<
    clef,
    T[clef],
    L
  >;
};

export type ÉvénementsCompte = {
  changementCompte: (args: { idCompte: string }) => void;
};

export class ServiceCompte<
  T extends { [clef: string]: NestedValueObject } = {
    [clef: string]: NestedValueObject;
  },
  L extends ServicesLibp2pCrabe = ServicesLibp2pCrabe,
> extends ServiceNébuleuse<
  "compte",
  ServicesNécessairesCompte<L>,
  { idCompte: string; bd: TypedNested<T>; oublier: Oublier },
  OptionsCompte
> {
  événements: TypedEmitter<
    {
      démarré: (args: {
        idCompte: string;
        bd: TypedNested<T>;
        oublier: Oublier;
      }) => void;
    } & ÉvénementsCompte
  >;

  constructor({
    nébuleuse,
    options,
  }: {
    nébuleuse: Nébuleuse<ServicesNécessairesCompte<L>>;
    options?: PartielRécursif<OptionsCompte>;
  }) {
    super({
      clef: "compte",
      nébuleuse,
      dépendances: ["orbite", "libp2p", "stockage"],
      options: merge(options, { consts: défautsConstsCompte }),
    });

    this.événements = new TypedEmitter();
  }

  async démarrer() {
    const { idCompte } = await this.initialiserIdCompte();

    const { bd, oublier } = await this.service("orbite").ouvrirBd({
      id: idCompte,
      type: "nested",
    });

    const bdTypée = typedNested({
      db: bd,
      schema: compilerSchémaCompte(this),
    });
    this.estDémarré = { idCompte, bd: bdTypée, oublier };
    return await super.démarrer();
  }

  async fermer() {
    const { oublier } = await this.démarré();
    await oublier();
    await super.fermer();
  }

  async initialiserIdCompte(): Promise<{ idCompte: string }> {
    let idCompte = await this.service("stockage").obtenirItem(CLEF_ID_COMPTE);

    if (!idCompte) {
      const orbite = this.service("orbite");
      const { bd, oublier } = await orbite.créerBd({ type: "nested" });
      idCompte = bd.address;
      await oublier();

      await this.service("stockage").sauvegarderItem(CLEF_ID_COMPTE, idCompte);
    }

    return { idCompte };
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
    const orbite = await this.service("orbite").orbite();
    return orbite.identity.id;
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

  // Dispositifs

  @cacheSuivi
  async suivreMesDispositifs({ f }: { f: Suivi<string[]> }): Promise<Oublier> {
    const bd = await this.bd();
    if (estContrôleurConstellation(bd.access))
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

    if (estContrôleurConstellation(bd.access))
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
    if (!adresseOrbiteValide(idCompte)) {
      throw new Error(`Adresse compte "${idCompte}" non valide`);
    }

    // Attendre de recevoir la permission d'écrire au nouveau compte
    const { bd: bdNouveauCompte, oublier } = await this.service(
      "orbite",
    ).ouvrirBd({ id: idCompte, type: "nested", signal });

    const accès = bdNouveauCompte.access;
    if (!estContrôleurConstellation(accès))
      throw new Error(
        `Gestionnaire d'accès OrbitDB ${bdNouveauCompte.access.type} non reconnu.`,
      );

    const moi = await this.obtIdDispositif();

    await uneFois<AccèsDispositif[]>(
      async (f) => accès.suivreDispositifsAutorisées(f),
      (autorisés) => !!autorisés?.find((a) => a.idDispositif === moi),
    );
    await oublier();

    // Là on peut y aller
    const estDémarré = await this.démarré();
    estDémarré.idCompte = idCompte;

    // On sauvegarde le nouvel identifiant de compte
    const stockage = this.service("stockage");
    stockage.sauvegarderItem(CLEF_ID_COMPTE, idCompte);

    // On garde compte du nombre de changements de compte
    // afin de pouvoir, dans `réseau.ts`, ignorer les anciens changements qui peuvent
    // toujours se propager à travers le réseau
    const texteNChangementsCompte = await stockage.obtenirItem(
      CLEF_N_CHANGEMENT_COMPTES,
    );
    const nChangementsCompte = Number(texteNChangementsCompte) || 0;
    await stockage.sauvegarderItem(
      CLEF_N_CHANGEMENT_COMPTES,
      (nChangementsCompte + 1).toString(),
    );
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
  }: {
    f: Suivi<TypedNested<T> | undefined>;
    idCompte?: string;
  }): Promise<Oublier> {
    const orbite = this.service("orbite");
    const schéma = compilerSchémaCompte(this);

    if (idCompte) {
      return await orbite.suivreBdTypée({
        id: idCompte,
        type: "nested",
        schéma,
        f,
      });
    } else {
      return await suivreFonctionImbriquée<TypedNested<T>>({
        fRacine: async ({ fSuivreRacine }) =>
          await this.suivreIdCompte({ f: fSuivreRacine }),
        f,
        fSuivre: async ({ id, fSuivreBd }) =>
          await orbite.suivreBdTypée({
            id,
            type: "nested",
            schéma,
            f: fSuivreBd,
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

    if (estContrôleurConstellation(bd.access)) {
      const monCompte = await this.obtIdCompte();
      const accès = bd.access;
      const rôle = (await accès.utilisateursAutorisés())
        .find((x) => x.idCompte === monCompte)?.rôle;
      await oublier();
      return rôle;
    } else {
      throw new Error(`Type d'accès ${bd.access} non reconnu.`);
    }
  }

  async suivrePermission({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: Suivi<Rôle | undefined>;
  }): Promise<Oublier> {
    const { bd, oublier: oublierBd } = await this.service("orbite").ouvrirBd({
      id: idObjet,
    });
    const accès = bd.access;
    if (!estContrôleurConstellation(accès))
      throw new Error(`Type d'accès ${bd.access} non reconnu.`);

    let monCompte: string | undefined = undefined;
    let utilisateurs: AccèsUtilisateur[] | undefined = undefined;

    const fFinale = async () => {
      console.log({ monCompte, utilisateurs });
      await f(utilisateurs?.find((x) => x.idCompte === monCompte)?.rôle);
    };

    const oublierAccès = await accès.suivreUtilisateursAutorisés(
      async (utilis: AccèsUtilisateur[]) => {
        utilisateurs = utilis;
        await fFinale();
      },
    );

    const oublierIdCompte = await this.suivreIdCompte({
      f: async (id) => {
        monCompte = id;
        await fFinale();
      },
    });

    return async () => {
      await Promise.all([oublierAccès(), oublierIdCompte(), oublierBd()]);
    };
  }

  async créerObjet<T extends keyof BdsOrbite>({
    type,
    optionsAccès,
    nom,
  }: {
    type: T;
    optionsAccès?: OptionsContrôleurConstellation;
    nom?: string;
  }) {
    const serviceOrbite = this.service("orbite");
    optionsAccès = optionsAccès || { écriture: await this.obtIdCompte() };

    return await serviceOrbite.créerBd({
      type,
      nom,
      options: {
        AccessController: ContrôleurConstellation(optionsAccès),
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
    if (!adresseOrbiteValide(identité)) {
      throw new Error(`Identité "${identité}" non valide.`);
    }

    const orbite = this.service("orbite");
    const { bd, oublier } = await orbite.ouvrirBd({ id: idObjet });
    const accès = bd.access;

    if (!estContrôleurConstellation(accès))
      throw new Error(`Contrôleur d'accès non reconnu : ${accès.type}`);
    await accès.autoriser(rôle, identité);

    await oublier();
  }
}
