# Variables
Les variables sont associées aux colonnes des tableaux de données. Elles peuvent être partagées entre différentes bases de données.

[[toc]]

## Général
Actions générales pour gérer vos variables.

### `client.variables.suivreVariables({ f })`
Recherche les variables appartenant au compte présent. Pour rechercher des variables d'autres utilisatrices sur le réseau Constellation, voir la section [réseau](./réseau.md).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(variables: string[]) => void` | Cette fonction sera appelée avec la liste des identifiants des variables retrouvées chaque fois que celle-ci est modifiée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";

import { générerClient } from "@constl/ipa";
const client = générerClient();

const variables = ref<string[]>();
await client.variables.suivreVariables({ f: x => variables.value = x });

```

### `client.variables.créerVariable({ catégorie })`
Crée une nouvelle variable.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `catégorie` | [`catégorieVariables`](#catégorievariables) `\|` [`catégorieBaseVariables`](#catégoriebasevariables) | La catégorie de la variable.


#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant de la nouvelle variable. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: 'numérique' });

```


### `client.variables.copierVariable({ idVariable })`
Crée une copie d'une variable.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable à copier. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant de la nouvelle variable. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: 'numérique' });
const idCopie = await client.variables.copierVariable({ idVariable });

```


### `client.variables.inviterAuteur({ idVariable, idCompteAuteur, rôle })`
Inviter une autre utilisatrice à modifier une variable qui vous appartient. Attention ! Une fois invitée, une personne ne peut pas être désinvitée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `idCompteAuteur` | `string` | L'identifiant du compte de la personne à inviter. |
| `rôle` | `"MODÉRATEUR" | "MEMBRE"` | Le rôle pour lequel vous invitez la personne. Tous pourront modifier la variable ; si `"MODÉRATEUR"`, elle pourra également inviter d'autres auteurs. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "chaîne" });
await client.variables.inviterAuteur({ 
    idVariable, 
    idCompteAuteur: "idDuCompteDeMonAmiÀQuiJeFaisConfiance",
    rôle: "MODÉRATEUR" 
});

```

### `client.variables.effacerVariable({ idVariable })`
Effacer une variable. Étant donné la structure distribuée de Constellation, cette action effacera la variable de votre dispositif, mais ne pourra pas forcer les autres membres du réseau à l'effacer également.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable à effacer. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: 'numérique' });
await client.variables.effacerVariable({ idVariable });

```

### `client.variables.suivreQualitéVariable({ idVariable })`
Suivre une mesure (subjective, de 0 à 1) de la qualité d'une variable. 1 indique la meilleure qualité.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `f` | `(qualité: number) => void` | Une fonction qui sera appelée avec la qualité de la variable chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

const qualité = ref<number>();
const fOublierSuivi = await client.variables.suivreQualitéVariable({ 
    idVariable,
    f: x => qualité.value = x
});

```

## Noms
Dans Constellation, chaque variable est définie par un code identifiant et peut ensuite être nommée dans autant de langues que vous le souhaitez.

### `client.variables.sauvegarderNomVariable({ idVariable, langue, nom })`
Sauvegarde le nom de la variable dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `nom` | `string` | Le nom de la variable. |
| `langue` | `string` | La langue du nom. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.variables.sauvegarderNomVariable({
    idVariable, 
    langue: "fr", 
    nom: "Précipitation" 
});

```

### `client.variables.sauvegarderNomsVariable({ idVariable, noms })`
Sauvegarde le nom de la variable dans plusieurs langues en même temps.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `noms` | `{ [langue: string]: string }` | Les noms de la variable, indexés par langue. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.variables.sauvegarderNomsVariable({ 
    idVariable, 
    noms: { fr: "Précipitation", த: "மழைப்பொழிவு"}
});

```

### `client.variables.effacerNomVariable({ idVariable, langue })`
Efface la traduction du nom de la variable dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `langue` | `string` | La langue dont ont doit effacer le nom. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.variables.effacerNomVariable({ idVariable, langue: "fr" });
```


### `client.variables.suivreNomsVariable({ idVariable, f })`
Suit les noms (traduits en différentes langues) de la variable.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `f` | `(noms: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les noms de la variable chaque fois qu'ils changent|

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

const fOublierNoms = await client.variables.suivreNomsVariable({ 
    idVariable,
    f: async noms => {
        console.log(noms);
        await fOublierNoms();
    }
});

await client.variables.sauvegarderNomsVariable({ 
    idVariable, 
    noms: { fr: "Précipitation", த: "மழைப்பொழிவு"}
});

```

## Descriptions
Dans Constellation, chaque variable peut aussi être accompagnée d'une description plus informative.

### `client.variables.sauvegarderDescriptionVariable({ idVariable, langue, nom })`
Sauvegarde la description de la variable dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `description` | `string` | La description de la variable. |
| `langue` | `string` | La langue de la description. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.variables.sauvegarderDescriptionVariable({
    idVariable, 
    langue: "fr", 
    description: "Quantité de précipitation" 
});

```

### `client.variables.sauvegarderDescriptionsVariable({ idVariable, descriptions })`
Sauvegarde la description d'une variable dans plusieurs langues en même temps.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `descriptions` | `{ [langue: string]: string }` | Les descriptions de la variable, indexées par langue. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.variables.sauvegarderDescriptionsVariable({ 
    idVariable, 
    descriptions: { 
        fr: "La quantité de précipitation", 
        த: "மழைப்பொழிவு அளவு"
    }
});

```

### `client.variables.effacerDescriptionVariable({ idVariable, langue })`
Efface la traduction d'une description de la variable dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `langue` | `string` | La langue dont ont doit effacer la description. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

await client.variables.sauvegarderDescriptionsVariable({ 
    idVariable, 
    descriptions: { 
        fr: "La quantité de précipitation", 
        த: "மழைப்பொழிவு அளவு"
    }
});
await client.variables.effacerDescriptionVariable({ idVariable, langue: "fr" });
```


### `client.variables.suivreDescriptionsVariable({ idVariable, f })`
Suit les descriptions (traduites en différentes langues) de la variable.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `f` | `(descriptions: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les descriptions de la variable chaque fois qu'elles changent|

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

const fOublierDescriptions = await client.variables.suivreDescriptionsVariable({ 
    idVariable,
    f: async descrs => {
        console.log(descrs);
        await fOublierDescriptions();
    }
});

await client.variables.sauvegarderDescriptionVariable({ 
    idVariable, 
    langue: "fr",
    description: "Concentration de Na+ dans le sol"
});

```

## Catégories
Chaque variable est associée à une [catégorie](#types), qui, comme dans un tableau Excel ou LibreOffice peut être numérique, de texte, ou de date. Cependant, Constellation vous offre aussi beaucoup d'autres formes de données possibles, tels les fichiers audio, image et vidéo que vous pouvez ajouter directement dans les cellules de vos bases de données.

### `client.variables.sauvegarderCatégorieVariable({ idVariable, catégorie })`
Sauvegarde la catégorie de la variable.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `catégorie` | [`catégorieVariables`](#categorievariables) `\|` [`catégorieBaseVariables`](#categoriebasevariables) | La catégorie de la variable.

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

// Changer la catégorie à une variable de type chaîne
await client.variables.sauvegarderCatégorieVariable({ 
    idVariable, 
    catégorie: "chaîne"
});

// Changer la catégorie à une liste de nombres
await client.variables.sauvegarderCatégorieVariable({ 
    idVariable, 
    catégorie: {
      type: "liste",
      catégorie: "numérique"
    }
});

```

### `client.variables.suivreCatégorieVariable({ idVariable, f })`
Suit la catégorie de la variable.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `f` | `(catégorie:` [`catégorieVariables`](#categorievariables) `\|` [`catégorieBaseVariables`](#categoriebasevariables) `) => void` | Une fonction qui sera appelée avec la catégorie de la variable chaque fois que celle-ci change.|

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
import { ref } from "vue";

const client = générerClient();

const catégorie = ref();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

const fOublierCatégorie = await client.variables.suivreCatégorieVariable({ 
    idVariable,
    f: x => catégorie.value = x,
});

await client.variables.sauvegarderCatégorieVariable({ 
    idVariable, 
    catégorie: "vidéo"
});

```

## Unités
...à venir

## Règles
Vous pouvez ajouter des règles à vos variables Constellation. Ces règles seront utilisées pour valider les données associées à ces variables. Les règles peuvent être ajoutées soit aux variables (décrit ci-dessous), soit directement aux [tableaux](./tableaux.md#regles) des bases de données. Dans ce premier cas, les règles s'appliqueront à tous les tableaux qui utilisent cette variable.

::: tip
Les règles peuvent être de différentes formes. Elles peuvent s'assurer qu'une variable numérique reste dans les bornes prévues - disons, que la latitude et la longitude restent bien sur la planète Terre - ou bien vérifier que les valeurs font partie d'une liste de valeurs catégoriques permises. Elles peuvent aussi être relatives (par exemple, que la température minimum ne peut être supérieure à la température maximum).

Pour en apprendre plus sur les règles, voir la [section correspondante](./règles.md).
:::

### `client.variables.ajouterRègleVariable({ idVariable, règle, idRègle })`

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `règle` | [`valid.règleVariable`](./règles.md) | Une fonction qui sera appelée avec les règles de la variable chaque fois que celles-ci changent.|
| `idRègle` | `string \| undefined` | Un identifiant unique pour la règle. Si non spécifié, Constellation en générera un de manière aléatoire.|

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant unique de la nouvelle règle. |

#### Exemple
```ts
import { générerClient, type valid } from "@constl/ipa";

const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

const règle: valid.règleBornes = {
    typeRègle: "bornes",
    détails: {
        type: "fixe",
        val: 0,
        op: ">=",
    },
};

// La variable doit être une valeur non-négative
const idRègle = await client.variables.ajouterRègleVariable({ 
    idVariable, 
    règle: 
});

```

### `client.variables.modifierRègleVariable({ idVariable, règleModifiée, idRègle })`
Permet de modifier une règle existante.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. | 
| `règleModifiée` | [`valid.règleVariable`](./règles.md) | La règle modifiée. |
| `idRègle` | `string` | L'identifiant de la règle originale.|

#### Exemple
```ts
import { générerClient, type valid } from "@constl/ipa";

const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

const règle: valid.règleBornes = {
    typeRègle: "bornes",
    détails: {
        type: "fixe",
        val: 0,
        op: ">=",
    },
};

// La variable doit être une valeur non-négative
const idRègle = await client.variables.ajouterRègleVariable({ 
    idVariable, 
    règle: 
});

// Après tout, elle doit être positive
const règleModifiée: valid.règleBornes = {
    typeRègle: "bornes",
    détails: {
        type: "fixe",
        val: 0,
        op: ">",
    },
};
await client.variables.modifierRègleVariable({ 
    idVariable, 
    règleModifiée,
    idRègle
});
```


### `client.variables.effacerRègleVariable({ idVariable, idRègle })`
Efface une règle existante.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `idRègle` | `string \| undefined` | L'identifiant de la règle à effacer.|

#### Exemple
```ts
import { générerClient, type valid } from "@constl/ipa";

const client = générerClient();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

const règle: valid.règleBornes = {
    typeRègle: "bornes",
    détails: {
        type: "fixe",
        val: 0,
        op: ">=",
    },
};

// La variable doit être une valeur non-négative
const idRègle = await client.variables.ajouterRègleVariable({ 
    idVariable, 
    règle
});

// On change d'avis !
await client.variables.effacerRègleVariable({
    idVariable,
    idRègle
});

```

### `client.variables.suivreRèglesVariable({ idVariable, f })`
Suit les règles associées à la variable.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant de la variable. |
| `f` | `(règles: schémaFonctionSuivi<règleVariableAvecId[]>) => void` | Une fonction qui sera appelée avec les règles de la variable chaque fois que celles-ci changent.|

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { générerClient, type valid } from "@constl/ipa";
import { ref } from "vue";

const client = générerClient();

const règles = ref<règleVariableAvecId[]>();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

const fOublierRègles = await client.variables.suivreRèglesVariable({ 
    idVariable,
    f: x => règles.value = x,
});

const règle: valid.règleBornes = {
    typeRègle: "bornes",
    détails: {
        type: "fixe",
        val: 0,
        op: ">=",
    },
};

// La variable doit être une valeur non-négative
await client.variables.ajouterRègleVariable({ 
    idVariable, 
    règle: 
});

```

## Types
Quelques types TypeScript sont associés aux variables Constellation.

### catégorieVariables
Les variables peuvent être de catégorie `simple` (une seule valeur permise) ou bien `liste` (plusieurs valeurs permises, mais toutes du même type).

```ts
type catégorieVariables =
  | {
      type: "simple";
      catégorie: catégorieBaseVariables;
    }
  | {
      type: "liste";
      catégorie: catégorieBaseVariables;
    };
```

### catégorieBaseVariables
Les variables Constellation sont associées à l'une de plusieurs catégories de base possibles.

* `numérique` : Une valeur numérique, telle la longitude ou la précipitation.
* `horoDatage` : Une date, avec ou sans heure précisée (par exemple, date de prélévement d'un échantillon).
* `intervaleTemps` : Une intervale de temps entre deux `horoDatages`. Par exemple, l'intervale de temps sur lequel a été calculé la température maximale de la journée.
* `chaîneNonTraductible` : Du texte qui peut être traduit en différentes langues (par exemple, le nom d'une espèce animale observée).
* `chaîne` : Du texte qui ne doit pas être traduit (par exemple, le code identifiant un échantillon).
* `booléen` : Valeur vraie ou fausse (par exemple, s'il a plu hier).
* `géojson` : Données géographiques de format [geoJSON](https://geojson.org/).
* `vidéo` : Une vidéo.
* `audio` : Un fichier audio.
* `image` : Un fichier image.
* `fichier` : Un fichier de type arbitraire.

::: tip
**Astuce de pro** : Pour d'autres catégories éventuelles qui ne correspondraient pas bien à l'une des catégories incluses avec Constellation ci-dessus (par exemple, des structures JSON propres à votre application), nous vous recommandons de sauvegarder les données sous format texte avec une variable de catégorie `chaîne`. Votre application pourra ensuite les accéder en tant que variable chaîne et les décoder comme convient.
:::

Ces catégories sont représentées par le type suivant :

```ts
type catégorieBaseVariables =
  | "numérique"
  | "horoDatage"
  | "intervaleTemps"
  | "chaîne"
  | "chaîneNonTraductible"
  | "booléen"
  | "géojson"
  | "vidéo"
  | "audio"
  | "image"
  | "fichier";
```
