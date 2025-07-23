import { TypedEmitter } from "tiny-typed-emitter";

type ÉvénementsNébuleuse = {
  démarrée: () => void;
};
export type ConstructeurServiceNébuleuse<
  T,
  S extends ServicesNébuleuse,
> = new (args: { nébuleuse: Nébuleuse<S> }) => T;

export type ServicesNébuleuse = {
  [clef: string]: ServiceNébuleuse<typeof clef>;
};

export type ConstructeursServicesNébuleuse<T extends ServicesNébuleuse> = {
  [clef in keyof T]: ConstructeurServiceNébuleuse<T[clef], T>;
};

export class Nébuleuse<S extends ServicesNébuleuse = ServicesNébuleuse> {
  services: S;
  événements: TypedEmitter<ÉvénementsNébuleuse>;
  estDémarrée: boolean;

  constructor({
    services,
  }: { services?: ConstructeursServicesNébuleuse<S> } = {}) {
    services = services ?? ({} as ConstructeursServicesNébuleuse<S>);
    this.services = Object.fromEntries(
      Object.entries(services).map(([clef, service]) => [
        clef,
        new service({ nébuleuse: this }),
      ]),
    ) as S;

    this.estDémarrée = false;
    this.événements = new TypedEmitter<ÉvénementsNébuleuse>();
  }

  // Cycle de vie

  async démarrée(): Promise<void> {
    if (this.estDémarrée) return;
    return new Promise((résoudre) =>
      this.événements.once("démarrée", résoudre),
    );
  }

  async démarrer() {
    await this.démarrerServices();

    this.estDémarrée = true;
    this.événements.emit("démarrée");
  }
  async démarrerServices() {
    const servicesÀDémarrer = Object.values(this.services).filter(
      (s) => !s.estDémarré,
    );
    if (!servicesÀDémarrer.length) return;

    const prêtsÀDémarrer = servicesÀDémarrer.filter((s) =>
      s.dépendances.every((d) => this.services[d].estDémarré),
    );

    if (!prêtsÀDémarrer.length)
      throw new Error(
        `Dépendances circulaires ou non-existantes parmi ${servicesÀDémarrer.map((s) => s.type).join(", ")}.`,
      );

    await Promise.all(prêtsÀDémarrer.map((s) => s.démarrer()));

    await this.démarrerServices();
  }

  async fermer() {
    await this.démarrée(); // S'assure que tout (y compris les services) sont bien initialisés
    await this.fermerServices();
    this.estDémarrée = false;
  }

  async fermerServices() {
    // Cette fonction suppose que nous sommes sûrs qu'aucun service est en cours de démarrage
    const servicesÀFermer = Object.values(this.services).filter(
      (s) => s.estDémarré,
    );
    if (!servicesÀFermer.length) return;

    const prêtsÀFermer = servicesÀFermer.filter(
      (s) => !servicesÀFermer.some((d) => d.dépendances.includes(s.type)),
    );

    if (!prêtsÀFermer.length)
      throw new Error(
        `Dépendances circulaires parmi ${servicesÀFermer.map((s) => s.type).join(", ")}.`,
      );

    await Promise.all(prêtsÀFermer.map((s) => s.fermer()));

    await this.fermerServices();
  }
}

type ÉvénementsServiceNébuleuse<Démarré = true> = {
  démarré: (args: Démarré) => void;
};

export class ServiceNébuleuse<
  T extends string,
  S extends ServicesNébuleuse = ServicesNébuleuse,
  RetourDémarré = unknown,
> {
  type: T;
  nébuleuse: Nébuleuse<S>;
  dépendances: (keyof S)[];

  événements: TypedEmitter<ÉvénementsServiceNébuleuse<RetourDémarré>>;
  estDémarré: RetourDémarré | false;

  constructor({
    type,
    nébuleuse,
    dépendances = [],
  }: {
    type: T;
    nébuleuse: Nébuleuse<S>;
    dépendances?: (keyof S)[];
  }) {
    this.type = type;
    this.nébuleuse = nébuleuse;
    this.dépendances = dépendances;

    this.événements = new TypedEmitter<
      ÉvénementsServiceNébuleuse<RetourDémarré>
    >();
    this.estDémarré = false;
  }

  // Cycle de vie
  async démarrer(): Promise<RetourDémarré> {
    const dépendancesNonDémarrées = this.dépendances
      .map((d) => this.service(d))
      .filter((d) => !d.estDémarré)
      .map((d) => d.type);
    if (dépendancesNonDémarrées.length)
      throw new Error(
        `Dépendances de ${this.type} non démarrées: ${dépendancesNonDémarrées.join(", ")}`,
      );
    if (this.estDémarré === false) this.estDémarré = true as RetourDémarré;

    this.événements.emit("démarré", this.estDémarré);
    return this.estDémarré;
  }

  async démarré(): Promise<RetourDémarré> {
    if (this.estDémarré) return this.estDémarré;
    return new Promise((résoudre) => this.événements.once("démarré", résoudre));
  }

  async fermer(): Promise<void> {
    await this.démarré();
    this.estDémarré = false;
  }

  // Méthodes générales
  service<C extends keyof S>(clef: C): S[C] {
    return this.nébuleuse.services[clef];
  }
}
/*import { TypedNested } from "@constl/bohr-db";
import { NestedKey, NestedValue, joinKey, splitKey } from "@orbitdb/nested-db";
import {
  ExtractKeys,
  GetValueFromKey,
} from "node_modules/@constl/bohr-db/dist/types.js";
import { TypedEmitter } from "tiny-typed-emitter";
import { uneFois } from "@constl/utils-ipa";
import { OrbitDB } from "@orbitdb/core";
import { Libp2p } from "libp2p";
import { HeliaLibp2p } from "helia";
import {
  RecursivePartial,
  TraducsNom,
  schémaFonctionOublier,
  schémaFonctionSuivi,
} from "./types.js";
import { Rôle, MODÉRATEUR, MEMBRE } from "./accès/consts.js";
import { AccèsUtilisateur } from "./accès/types.js";
import { ContrôleurConstellation } from "./client.js";
import { OptionsContrôleurConstellation } from "./accès/cntrlConstellation.js";
import { ServicesLibp2p } from "./sfip/index.js";
import type { JSONSchemaType } from "ajv";

// À faire:
// * Type pour OrbitDB<T>



export class ServiceNébuleuse<
  T extends string,
  Démarré = true,
  Dépendances extends (keyof D)[] = [],
  D extends ServicesNébuleuse = ServicesDéfautNébuleuse,
  S extends StructureNébuleuse = StructureNébuleuse,
> {
  type: T;
  nébuleuse: Nébuleuse<D>;
  dépendances: (keyof D)[];
  structure: T extends ExtractKeys<S>
    ? JSONSchemaType<RecursivePartial<S>>
    : undefined;

  estDémarré: Démarré | false;
  

  bd: T extends ExtractKeys<S>
    ? GetValueFromKey<S, T> extends NestedValue
      ? (idCompte?: string) => TypedNested<GetValueFromKey<S, T>>
      : undefined
    : undefined;

  constructor({
    type,
    nébuleuse,
    dépendances = [],
    structure,
  }: {
    type: T;
    nébuleuse: Nébuleuse<D>;
    dépendances?: Dépendances;
    structure?: T extends ExtractKeys<S>
      ? GetValueFromKey<S, T> extends NestedValue
        ? JSONSchemaType<RecursivePartial<GetValueFromKey<S, T>>>
        : undefined
      : undefined;
  }) {
    this.type = type;
    this.nébuleuse = nébuleuse;
    this.dépendances = dépendances;
    this.structure = structure || undefined;

    this.estDémarré = false;
    this.événements = new TypedEmitter<ÉvénementsServiceNébuleuse>();

    this.bd = extractKeys(structure).includes(this.type)
      ? envelopperNested(this.type, nébuleuse.bd)
      : undefined;
  }


  clef(clef: NestedKey): string {
    return joinKey([
      this.type,
      ...(typeof clef === "string" ? splitKey(clef) : clef),
    ]);
  }
}

type StructureProfil = {
  noms: TraducsNom;
};
const structureProfil: JSONSchemaType<RecursivePartial<StructureProfil>> = {
  type: "object",
  properties: {
    noms: {
      type: "object",
      additionalProperties: {
        type: "string",
      },
      required: [],
      nullable: true,
    },
  },
  required: [],
};

export class Orbite extends ServiceNébuleuse<
  "orbite",
  {
    orbite?: OrbitDB<ServicesLibp2p>;
    sfip?: HeliaLibp2p<Libp2p<ServicesLibp2p>>;
  }
> {
  constructor({
    nébuleuse,
  }: {
    nébuleuse: Nébuleuse<ServicesDéfautNébuleuse>;
  }) {
    super({
      type: "orbite",
      nébuleuse,
    });
  }

  async démarrer(): Promise<{
    orbite?: OrbitDB<ServicesLibp2p>;
    sfip?: HeliaLibp2p<Libp2p<ServicesLibp2p>>;
  }> {
    this.estDémarré = { orbite, sfip };
    return await super.démarrer();
  }

  async orbite(): Promise<OrbitDB<ServicesLibp2p>> {
    return (await this.démarré()).orbite || this.nébuleuse.opts.orbite;
  }

  async sfip(): Promise<HeliaLibp2p<Libp2p<ServicesLibp2p>>> {
    return (await this.orbite()).ipfs;
  }

  async fermer(): Promise<void> {
    // Uniquement fermer orbite ou sfip s'ils n'ont pas été fournis au constructeur de la nébuleuse
    const { orbite, sfip } = await this.démarré();
    if (sfip) await sfip.stop();
    if (orbite) await orbite.stop();

    await super.fermer();
  }
}

export class Compte extends ServiceNébuleuse<
  "compte",
  { idCompte: string },
  ["orbite"]
> {
  constructor({
    nébuleuse,
  }: {
    nébuleuse: Nébuleuse<ServicesDéfautNébuleuse>;
  }) {
    super({
      type: "compte",
      nébuleuse,
      dépendances: ["orbite"],
    });
  }

  async démarrer(): Promise<{ idCompte: string }> {
    const { idCompte } = await this.initialiserIdCompte();
    this.estDémarré = { idCompte };
    return await super.démarrer();
  }

  // Gestion compte

  async obtIdCompte(): Promise<string> {
    const { idCompte } = await this.démarré();
    return idCompte;
  }

  async obtIdLibp2p(): Promise<string> {
    const orbite = await this.service("orbite").orbite();
    return orbite.ipfs.libp2p.peerId.toString();
  }

  async obtIdDispositif(): Promise<string> {
    const orbite = await this.service("orbite").orbite();
    return orbite.identity.id;
  }
}

export class Profil extends ServiceNébuleuse<"profil"> {
  constructor({
    nébuleuse,
  }: {
    nébuleuse: Nébuleuse<ServicesDéfautNébuleuse>;
  }) {
    super({
      type: "profil",
      nébuleuse,
      dépendances: ["compte", "réseau"],
      structure: structureProfil,
    });
  }

  async sauvegarderNom({ langue, nom }: { langue: string; nom: string }) {
    await this.bd().put(`noms/${langue}`, nom);
  }

  async suivreNoms({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<TraducsNom>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await suivre(this.bd(idCompte), "noms", f);
  }

  contacts({ idCompte }: { idCompte?: string } = {}): SetDb<{
    type: string;
    contact: string;
  }> {
    return this.bd(idCompte).subDb("set", "contacts");
  }

  async sauvegarderContact({
    type,
    contact,
  }: {
    type: string;
    contact: string;
  }): Promise<void> {
    await this.contacts().add({ type, contact });
  }

  async suivreContacts({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<{ type: string; contact: string }[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await suivre(this.contacts({ idCompte }), f);
  }
}

export class Réseau extends ServiceNébuleuse<"réseau"> {
  constructor({
    nébuleuse,
  }: {
    nébuleuse: Nébuleuse<ServicesDéfautNébuleuse>;
  }) {
    super({ type: "réseau", nébuleuse, dépendances: ["compte"] });
  }

  async démarrer(): Promise<true> {
    this.estDémarré = true;
    return await super.démarrer();
  }

  async fermer(): Promise<void> {
    await super.fermer();
  }
}

export type ServicesDéfautNébuleuse = {
  orbite: ConstructeurServiceNébuleuse<Orbite>;
  compte: ConstructeurServiceNébuleuse<Compte>;
  profil: ConstructeurServiceNébuleuse<Profil>;
  réseau: ConstructeurServiceNébuleuse<Réseau>;
};

export const obtServicesDéfautNébuleuse = (): ServicesDéfautNébuleuse => {
  return {
    compte: Compte,
    profil: Profil,
    réseau: Réseau,
  };
};

type StructureNébuleuse = {
  profil: {
    noms: { [langue: string]: string };
  };
};

const schémaStructureNébuleuse: JSONSchemaType<
  RecursivePartial<StructureNébuleuse>
> = {
  type: "object",
  properties: {
    profil: {
      ...structureProfil,
      nullable: true,
    },
  },
};

export class Nébuleuse<
  S extends ServicesNébuleuse = ServicesDéfautNébuleuse,
> {
  bd: TypedNested<StructureNébuleuse>;
  
  

  async initialiserIdCompte({
    orbite,
  }: {
    orbite: OrbitDB;
  }): Promise<{ idCompte: string }> {
    let idCompte =
      (await this.stockage.obt({
        clef: "idCompte",
        parCompte: false,
      })) || undefined;
    if (!idCompte) {
      const optionsAccèsRacine = {
        type: nomTypeContrôleurConstellation,
        write: orbite.identity.id,
        nom: "racine",
      };

      idCompte = await this.créerBdIndépendante({
        type: "keyvalue",
        optionsAccès: optionsAccèsRacine,
        nom: "racine",
      });

      await this.nommerDispositif({
        type: this.détecterTypeDispositif(),
      });

      await this.stockage.sauvegarder({
        clef: "idCompte",
        val: this.idCompte,
        parCompte: false,
      });
    }
  }

  // Gestions données

  async créerObjet({
    type,
    optionsAccès,
    nom,
  }: {
    type: "feed" | "set" | "keyvalue" | "ordered-keyvalue" | "nested";
    optionsAccès?: OptionsContrôleurConstellation;
    nom?: string;
  }): Promise<string> {
    const { orbite } = await this.démarrée();
    optionsAccès = optionsAccès || { write: await this.obtIdCompte() };

    return await orbite.créerBdIndépendante({
      type,
      nom,
      options: {
        AccessController: générerContrôleurConstellation(optionsAccès),
      },
    });
  }

  // Fonctions utilitaires
  async suivrePermissionObjet({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<Rôle | undefined>;
  }): Promise<schémaFonctionOublier> {
    const { bd, fOublier } = await this.ouvrirBd({ id: idObjet });

    const typeAccès = bd.access.type;

    if (typeAccès === nomTypeContrôleurConstellation) {
      const monCompte = await this.obtIdCompte();
      const accès = bd.access as ContrôleurConstellation;
      const fFinale = async (utilisateurs: AccèsUtilisateur[]) => {
        const mesRôles = utilisateurs
          .filter((u) => u.idCompte === monCompte)
          .map((u) => u.rôle);
        const rôlePlusPuissant = mesRôles.includes(MODÉRATEUR)
          ? MODÉRATEUR
          : mesRôles.includes(MEMBRE)
            ? MEMBRE
            : undefined;
        await f(rôlePlusPuissant);
      };
      const fOublierSuivreAccès =
        await accès.suivreUtilisateursAutorisés(fFinale);
      return async () => await Promise.all([fOublierSuivreAccès(), fOublier()]);
    } else {
      throw new Error(`Type d'accès ${typeAccès} non reconnu.`);
    }
  }

  async confirmerPermissionObjet({
    idObjet,
    message = "Permission de modification refusée pour ",
  }: {
    idObjet: string;
    message?: string;
  }): Promise<void> {
    const permission = await uneFois<Rôle | undefined>((fSuivi) =>
      this.suivrePermissionObjet({ idObjet, f: fSuivi }),
    );
    if (!permission) throw new Error(message + `${idObjet}.`);
  }
}
*/
