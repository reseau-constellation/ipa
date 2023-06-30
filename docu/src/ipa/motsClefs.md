# Mots-clefs
Les mots-clefs peuvent s'associer à une [base de données](ipa/bds.md), à un [projet](ipa/projets.md) ou à une [nuée](ipa/nuées.md) et servent pour indexer et retrouver les données dans le réseau Constellation.

[[toc]]

## Général
Actions générales pour gérer vos mot-clefs.

### `client.motClefs.suivreMotsClefs({ f })`
Recherche les mots-clefs appartenant au compte présent. Pour rechercher des mots-clefs d'autres utilisateurs sur le réseau Constellation, voir la section [réseau](ipa/réseau.md).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(motsClefs: string[]) => void` | Cette fonction sera appelée avec la liste des identifiants des mot-clefs chaque fois que celle-ci est modifiée. |

#### Exemple
```ts
import { ref } from "vue";

import { générerClient } from "@constl/ipa";
const client = générerClient();

const motsClefs = ref<string[]>();
await client.motsClefs.suivreMotsClefs({ f: x => motsClefs.value = x });

```

### `client.motClefs.créerMotClef()`
Crée un nouveau mot-clef.

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant du nouveau mot-clef. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idMotClef = await client.motsClefs.créerMotClef();

```


### `client.motClefs.copierMotClef({ idMotClef })`
Crée une copie d'un mot-clef.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant du mot-clef à copier. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant du nouveau mot-clef. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idMotClef = await client.motsClefs.créerMotClef();
const idCopie = await client.motsClefs.copierMotClef({ idMotClef });

```


### `client.motClefs.inviterAuteur({ idMotClef, idCompteAuteur, rôle })`
Inviter une autre utilisatrice à modifier un mot-clef vous appartenant. Attention ! Une fois invitée, une personne ne peut pas être désinvitée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant du mot-clef. |
| `idCompteAuteur` | `string` | L'identifiant du compte de la personne à inviter. |
| `rôle` | `"MODÉRATEUR" | "MEMBRE"` | Le rôle pour lequel vous invitez la personne. Tous pourront modifier le mot-clef ; si `"MODÉRATEUR"`, elle pourra également inviter d'autres auteurs. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.inviterAuteur({ 
    idMotClef, 
    idCompteAuteur: "idDuCompteDeMonAmiÀQuiJeFaisConfiance",
    rôle: "MODÉRATEUR" 
});

```

### `client.motClefs.effacerMotClef({ idMotClef })`
Effacer un mot-clef. Étant donné la structure distribuée de Constellation, cette action effacera le mot-clef de votre dispositif, mais ne pourra pas forcer les autres membres du réseau à l'effacer également.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant du mot-clef à copier. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant du nouveau mot-clef. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idMotClef = await client.motsClefs.créerMotClef();
const idCopie = await client.motsClefs.copierMotClef({ idMotClef });

```

### `client.motClefs.suivreQualitéMotClef({ idMotClef })`
Suivre une mesure (subjective, de 0 à 1) de la qualité d'un mot-clef. 1 indique la meilleure qualité.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant du mot-clef. |
| `f` | `(qualité: number) => void` | Une fonction qui sera appelée avec la qualité du mot-clef chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi |


#### Exemple
```ts
import { ref } from "vue";

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idMotClef = await client.motsClefs.créerMotClef();

const qualité = ref<number>();
const fOublierSuivi = await client.motsClefs.suivreQualitéMotClef({ 
    idMotClef,
    f: x => qualité.value = x
});

```


## Noms
Dans Constellation, chaque mot-clef est défini par un code identifiant et peut ensuite être nommé dans autant de langues que vous le souhaitez.

### `client.motClefs.sauvegarderNomMotClef({ idMotClef, langue, nom })`
Sauvegarde le nom du mot-clef dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant du mot-clef. |
| `nom` | `string` | Le nom du mot-clef. |
| `langue` | `string` | La langue du nom. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderNomMotClef({
    idMotClef, 
    langue: "fr", 
    nom: "Hydrologie" 
});

```

### `client.motsClefs.sauvegarderNomsMotClef({ idMotClef, noms })`
Sauvegarde le nom du mot-clef dans plusieurs langues en même temps.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant du mot-clef. |
| `noms` | `{ [langue: string]: string }` | Les noms du mot-clef, indexés par langue. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderNomsMotClef({ 
    idMotClef, 
    noms: { fr: "Hydrologie", த: "நீரியல்"}
});

```

### `client.motsClefs.effacerNomMotClef({ idMotClef, langue })`
Efface la traduction du nom du mot-clef dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant du mot-clef. |
| `langue` | `string` | La langue dont ont doit effacer le nom. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.effacerNomMotClef({ idMotClef, langue: "fr" });
```


### `client.motsClefs.suivreNomsMotClef({ idMotClef, f })`
Suit les noms (traduits en différentes langues) du mot-clef.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant du mot-clef. |
| `f` | `(noms: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les noms du mot-clef chaque fois qu'ils changent|

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idMotClef = await client.motsClefs.créerMotClef();

const fOublierNoms = await client.motsClefs.suivreNomsMotClef({ 
    idMotClef,
    f: async noms => {
        console.log(noms);
        await fOublierNoms();
    }
});

await client.motsClefs.sauvegarderNomsMotClef({ 
    idMotClef, 
    noms: { fr: "Hydrologie", த: "நீரியல்"}
});

```


## Descriptions
Dans Constellation, chaque mot-clef peut aussi être accompagné d'une description plus informative.

### `client.motClefs.sauvegarderDescriptionMotClef({ idMotClef, langue, nom })`
Sauvegarde la description du mot-clef dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant du mot-clef. |
| `description` | `string` | La description du mot-clef. |
| `langue` | `string` | La langue de la description. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderDescriptionMotClef({
    idMotClef, 
    langue: "fr", 
    description: "Données hydrologiques, telles les données fluviales, météorologiques, et autres." 
});

```

### `client.motsClefs.sauvegarderDescriptionsMotClef({ idMotClef, descriptions })`
Sauvegarde la description d'un mot-clef dans plusieurs langues en même temps.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant du mot-clef. |
| `descriptions` | `{ [langue: string]: string }` | Les descriptions du mot-clef, indexés par langue. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderDescriptionsMotClef({ 
    idMotClef, 
    descriptions: { 
        fr: "Données hydrologiques ou météorologiques", 
        த: "நீரியல் மற்றும் வானிலையியல் தகவல்கள்"
    }
});

```

### `client.motsClefs.effacerDescriptionMotClef({ idMotClef, langue })`
Efface la traduction d'une description du mot-clef dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant du mot-clef. |
| `langue` | `string` | La langue dont ont doit effacer la description. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.effacerDescriptionMotClef({ idMotClef, langue: "fr" });
```


### `client.motsClefs.suivreDescriptionsMotClef({ idMotClef, f })`
Suit les descriptions (traduits en différentes langues) du mot-clef.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant du mot-clef. |
| `f` | `(noms: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les descriptions du mot-clef chaque fois qu'elles changent|

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idMotClef = await client.motsClefs.créerMotClef();

const fOublierDescriptions = await client.motsClefs.suivreDescriptionsMotClef({ 
    idMotClef,
    f: async descrs => {
        console.log(descrs);
        await fOublierDescriptions();
    }
});

await client.motsClefs.sauvegarderDescriptionMotClef({ 
    idMotClef, 
    langue: "fr",
    description: "Données hydrologiques"
});

```