# Client
Le client Constellation représente un compte sur le réseau.

[[toc]]

## Initialisation

### `créerConstellation({ opts, mandataire })`
Initialise un client Constellation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `opts` | [`optsConstellation \| optsIpaTravailleur`](#types-initialisation) | Les options d'initialisation de Constellation. Pour les pros, vous pouvez spécifier le dossier du compte, les protocoles tiers ou bien un nœu SFIP ou une instance de bd orbite à utiliser. |
| `mandataire` | `"proc" \| "travailleur" \| undefined` | Par défaut, Constellation est lancé dans le même processus. Vous pouvez aussi le lancer dans un processus travailleur sur le navigateur. Lorsque `"travailleur"`, opts doit être de type `optsIpaTravailleur`. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<ClientConstellation>` | Le client Constellation, prêt à utiliser. |

#### Exemple
```ts

import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

```


### `client.fermer()`
Ferme le client.

#### Exemple
```ts
// ...continuant de ci-dessus...

await client.fermer();
```

## Identité
Ces fonctions permettent d'interagir avec les identifiants du compte.

### `client.obtIdCompte()`
Obtenir l'identifiant du compte Constellation. Cet identifiant est partagé parmi tous les dispositifs connectés au compte.

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant du compte. |

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const idCompte = await client.obtIdCompte();

```

### `client.suivreIdCompte()`
Suivre l'identifiant du compte Constellation. Celui-ci ne changera que si le dispositif se rejoint à un compte existant.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(id: string) => void` | Une fonction qui sera appelée avec l'identifiant du compte chaque fois que celui-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

const idCompte = ref<string>();
const fOublier = await client.suivreIdCompte({ 
    f: x => idCompte.value = x
});

```

### `client.obtIdDispositif()`
Obtenir l'identifiant du dispositif actuel. 

:::info INFO
Celui-ci est identique à l'identifiant [bd-orbite](https://github.com/orbitdb/orbit-db) du dispositif.
:::

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant du dispositif. |

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const idDispositif = await client.obtIdDispositif();

```

### `client.obtIdSFIP()`
Obtenir l'identifiant du nœud de Système de fichiers interplanétaire ([SFIP](https://ipfs.io/)) connecté au compte Constellation.

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<ipfs.IDResult>` | L'identifiant SFIP du compte. |

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const idSFIP = await client.obtIdSFIP();

```

## Dispositifs
Différents dispositifs (téléphones, ordinateurs) peuvent être connectés au même compte Constellation.

### `client.suivreDispositifs({ f, idCompte })`
Suivre les dispositifs associés à ce compte.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(dispositifs: string[]) => void` | Une fonction qui sera appelée avec les identifiants des dispositiffs du compte chaque fois qu'ils changent|
| `idCompte` | `string \| undefined` | L'identifiant du compte dont on veut suivre les dispositifs. Si non spécifié, Constellation utilisera le compte actuel. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

const dispositifs = ref<string[]>();

const fOublier = await client.suivreDispositifs({ 
    idBd,
    f: x => dispositifs.value = x,
});
```

### `client.nommerDispositif({ idDispositif, nom, type})`
Spécifier un nom pour votre dispositif afin de mieux le reconnaître.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idDispositif` | `string \| undefined` | L'identifiant du dispositif. Si non spécifié, Constellation utilisera le dispositif actuel. |
| `nom` | `string` | Le nom à donner au dispositif. |
| `type` | `string` | Le type de dispositif. Peut être n'importe quelle valeure, mais nous recommendons l'un de `téléphone`, `navigateur`, `tablette`, `ordinateur` ou `serveur`. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

const fOublier = await client.nommerDispositif({ 
    nom: "Mon téléphone",
    type: "téléphone"
});
```

### `client.suivreNomsDispositifs({ f, idCompte })`
Suivre les noms des dispositifs associés à un compte.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(noms: `[`structureNomsDispositifs`](#types-dispositifs)` ) => void` | Une fonction qui sera appelée avec les noms des dispositifs chaque fois qu'ils changent. |
| `idCompte` | `string \| undefined` | L'identifiant du compte dont on veut suivre les noms des dispositifs. Si non spécifié, Constellation utilisera le compte actuel. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type client } from "@constl/ipa";

const client = créerConstellation();

const dispositifs = ref<client.structureNomsDispositifs>();

const fOublier = await client.suivreNomsDispositifs({ 
    idBd,
    f: x => dispositifs.value = x,
});
```

### `client.suivreNomDispositif({ idCompte, idDispositif, f })`
Suivre le nom d'un dispositif spécifique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string \| undefined` | L'identifiant du compte dont on veut suivre le nom du dispositif. |
| `idDispositif` | `string \| undefined` | L'identifiant du dispositif dont on veut suivre le nom. |
| `f` | `(nom: { type?: string; nom?: string } ) => void` | Une fonction qui sera appelée avec le nom du dispositif chaque fois qu'il change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type client } from "@constl/ipa";

const client = créerConstellation();

const nom = ref<{ type?: string; nom?: string }>();

const fOublier = await client.suivreNomDispositif({ 
    idCompte: await client.obtIdCompte(),
    idDispositif: await client.obtIdDispositif(),
    f: x => nom.value = x,
});
```

### `client.générerInvitationRejoindreCompte()`
Générer une invitation qu'un autre dispositif peut utiliser pour se joindre à ce compte.

:::danger
**Ne partagez pas l'invitation générée de façon publique !** N'importe qui connaît le secret pourra se connecter à votre compte et agir en tant que vous.
:::

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<idCompte: string; codeSecret: string }>` | L'invitation secrète. |

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

const invitationSecrète = await client.générerInvitationRejoindreCompte();
```

### `client.révoquerInvitationRejoindreCompte({ codeSecret })`
Révoquer une invitation. Uniquement possible si l'invitation n'a pas encore été utilisée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `codeSecret` | `string \| undefined` | Le code secret de l'invitation à révoquer. Si non spécifié, toutes les invitations actives seront révoquées. |

#### Exemple
```ts
// ...continuant de ci-dessus...
const invitationSecrète = await client.révoquerInvitationRejoindreCompte({
    codeSecret: invitationSecrète.codeSecret
});
```

### `client.demanderEtPuisRejoindreCompte({ idCompte, codeSecret })`
Utiliser une invitation pour rejoindre un compte existant.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant du compte que l'on veut rejoindre. |
| `codeSecret` | `string` | Le code secret de l'invitation. |

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

await client.demanderEtPuisRejoindreCompte({
    idCompte: "idDuCompteQueJeVeuxRejoindre",
    codeSecret: "leCodeSecretQueJ'aiReçu",
});
```

### `client.exporterDispositif({ nomFichier })`
Exporter les données de ce dispositif pour pouvoir le réinitialiser en cas de perte.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nomFichier` | `string` | Le nom du fichier où nous allons sauvegarder une copie du compte. |

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

await client.exporterDispositif({ nomFichier: "ma sauvegarde"});
```

### `client.effacerDispositif()`
Effacer ce dispositif.

:::danger
**Cette action est irréversible** et effacera toutes les données liées à votre dispositif. Pour effacer votre compte Constellation, effacer tous les dispositifs connectés au compte.
:::

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

await client.effacerDispositif();
```

## Autre

### `client.suivreTypeObjet({ idObjet, f })`
Détecte le type d'un objet (variable, base de données, projet ou autre).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant de l'objet. |
| `f` | `(type:  "motClef" \| "variable" \| "bd" \| "projet" \| "nuée" \| undefined ) => void` | Une fonction qui sera appelée avec le type de l'objet chaque fois qu'il change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

const idVariable = await client.créerVariable({ catégorie: "numérique" });

const type = ref<string>();
const fOublier = await client.suivreTypeObjet({ 
    idObjet: idVariable,
    f: x => type.value = x,
});
```

### `client.suivrePermission({ idObjet, f })`
Suit l'autorisation d'un compte envers des données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idObjet` | `string` | L'identifiant de l'objet d'intérpet. |
| `f` | `(permission:  "MODÉRATEUR" \| "MEMBRE" \| undefined ) => void` | Une fonction qui sera appelée avec le niveau d'autorisation chaque fois qu'il change. Les membres peuvent modifier les données, et les modératrices peuvent aussi inviter d'autres membres ou modératrices. Si aucune permission n'est détectée, renverra `undefined`. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

const idVariable = await client.créerVariable({ catégorie: "numérique" });

const permission = ref<string>();
const fOublier = await client.suivrePermission({ 
    idObjet: idVariable,
    f: x => permission.value = x,
});
```

### `client.suivrePermissionÉcrire({ idObjet, f })`
Fonction d'utilité qui suit le niveau d'autorisation d'un compte envers des données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idObjet` | `string` | L'identifiant de l'objet d'intérpet. |
| `f` | `(permission: boolean ) => void` | Une fonction qui sera appelée avec le niveau d'autorisation chaque fois qu'il change. Renvoie vrai si la modification des données est autorisée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

const idVariable = await client.créerVariable({ catégorie: "numérique" });

const permission = ref<boolean>();
const fOublier = await client.suivrePermissionÉcrire({ 
    idObjet: idVariable,
    f: x => permission.value = x,
});
```

## Types
Plusieurs types sont associés au client Constellation.

### Types initialisation
```ts
interface optsConstellation {
  compte?: string;
  sujetRéseau?: string;
  orbite?: optsOrbite;
  protocoles?: string[];
}
type optsOrbite = OrbitDB | optsInitOrbite;

type optsInitOrbite = {
  dossier?: string;
  sfip?: optsInitSFIP;
};

type optsInitSFIP = {
  sfip?: IPFS;
  dossier?: string;
};

interface optsIpaTravailleur extends optsConstellation {
  compte?: string;
  sujetRéseau?: string;
  orbite?: {
    dossier?: string;
    sfip?: {
      dossier?: string;
    };
  };
}
```

### Types dispositifs
```ts
type structureNomsDispositifs = {
  [idDispositif: string]: { nom?: string; type?: string };
};

```