# Tableaux

[[toc]]

## Noms
Dans Constellation, chaque tableau est défini par un code identifiant et peut ensuite être nommé dans autant de langues que vous le souhaitez.

### `client.tableaux.sauvegarderNomTableau({ idTableau, langue, nom })`
Sauvegarde le nom du tableau dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `nom` | `string` | Le nom du tableau. |
| `langue` | `string` | La langue du nom. |

#### Exemple
```ts

import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idTableau = await client.tableaux.créerTableau({ idBd });
await client.tableaux.sauvegarderNomTableau({
    idTableau, 
    langue: "fr", 
    nom: "Hydrologie" 
});

```

### `client.tableaux.sauvegarderNomsTableau({ idTableau, noms })`
Sauvegarde le nom du tableau dans plusieurs langues en même temps.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `noms` | `{ [langue: string]: string }` | Les noms du tableau, indexés par langue. |

#### Exemple
```ts

import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idTableau = await client.tableaux.créerTableau({ idBd });
await client.tableaux.sauvegarderNomsTableau({ 
    idTableau, 
    noms: { fr: "Observations", த: "கண்காணிப்புகள்"}
});

```

### `client.tableaux.effacerNomTableau({ idTableau, langue })`
Efface la traduction du nom du tableau dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `langue` | `string` | La langue dont ont doit effacer le nom. |

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idTableau = await client.tableaux.créerTableau({ idBd });
await client.tableaux.effacerNomTableau({ idTableau, langue: "fr" });
```

### `client.tableaux.suivreNomsTableau({ idTableau, f })`
Suit les noms (traduits en différentes langues) du tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `f` | `(noms: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les noms du tableau chaque fois qu'ils changent|

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idTableau = await client.tableaux.créerTableau({ idBd });

const fOublierNoms = await client.tableaux.suivreNomsTableau({ 
    idTableau,
    f: async noms => {
        console.log(noms);
        await fOublierNoms();
    }
});

await client.tableaux.sauvegarderNomsTableau({ 
    idTableau, 
    noms: { fr: "Observations", த: "கண்காணிப்புகள்"}
});

```

## Colonnes
Chaque colonne d'un tableau est associé à une variable Constellation.

### `client.tableaux.ajouterColonneTableau({ idTableau, idVariable, idColonne })`
Ajoute une colonne à un tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `idVariable` | `string` | L'identifiant de la variable à associer à la colonne. |
| `idColonne` | `string \| undefined` | Identifiant unique (par tableau) pour la colonne. Si non spécifié, Constellation en créera un. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idTableau = await client.tableaux.créerTableau({ idBd });
const idVariable = await client.variables.créerVariable({ catégorie: "horoDatage" });

const idColonne = await client.tableaux.ajouterColonneTableau({ idTableau, idVariable });

```
### `client.tableaux.effacerColonneTableau({ idTableau, idColonne })`
Efface une colonne d'un tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `idColonne` | `string` | L'identifiant de la colonne. |

#### Exemple
```ts
// ...continuant de ci-dessus...
const idColonne = await client.tableaux.effacerColonneTableau({ idTableau, idVariable });
```

### `client.tableaux.suivreColonnesTableau({ idTableau, f, catégories })`
Suit les colonnes d'un tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `f` | `(colonnes:` [`InfoCol`](#types-colonnes)` \| `[`InfoColAvecCatégorie`](#types-colonnes) `) => void` | Une fonction qui sera appellée avec les colonnes du tableau chaque fois que celles-ci changent. |
| `catégories` | `boolean \| undefined` | Si on veut obtenir aussi les catégories des variables des colonnes. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type tableaux } from "@constl/ipa";

const client = créerConstellation();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idTableau = await client.tableaux.créerTableau({ idBd });
const idVariable = await client.variables.créerVariable({ catégorie: "horoDatage" });

const idColonne = await client.tableaux.ajouterColonneTableau({ idTableau, idVariable });

const colonnes = ref<tableaux.InfoColAvecCatégorie>();
const fOublierColonnes = await client.tableaux.suivreColonnesTableau({ 
    idTableau,
    f: x => colonnes.value = x
});

```

## Index
Les colonnes d'un tableau peuvent être identifiées en tant que colonnes indexes. Les valeurs de ces colonnes ne peuvent pas être dupliquées parmi les données. Par exemple, si vous spécifiez l'horodatage et le site d'échantillonnage en tant que colonnes indexes, Constellation, lors de tout fusionnement de données, s'assurera que les indexes ne soient pas dupliqués et combinera les rangées avec des sites et horodatages identiques.

### `client.tableaux.changerColIndex({ idTableau, idColonne, val })`
Change le statut d'index d'une colonne.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `idColonne` | `string` | L'identifiant de la colonne. |
| `val` | `boolean` | Si la colonne est une colonne indexe ou non. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idTableau = await client.tableaux.créerTableau({ idBd });
const idVariable = await client.variables.créerVariable({ catégorie: "horoDatage" });

const idColonne = await client.tableaux.ajouterColonneTableau({ idTableau, idVariable });

await client.tableaux.changerColIndex({ 
    idTableau,
    idColonne,
    val: true
});

```

### `client.tableaux.suivreIndex({ idTableau, f })`
Suit les noms (traduits en différentes langues) du tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `f` | `(colonnes: string[]) => void` | Une fonctionne qui sera appellée avec les identifiants des colonnes indexes chaque fois que ceux-ci changent. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idTableau = await client.tableaux.créerTableau({ idBd });

const indexes = ref<string[]>();
const fOublierIndexes = await client.tableaux.suivreIndex({ 
    idTableau,
    f: x => indexes.value = x
});

```

## Variables
Vous pouvez suivre la liste des variables associées avec un tableau.

### `client.tableaux.suivreVariables({ idTableau, f })`
Suit les variables associées au tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `suivreVariables` | `string` | L'identifiant du tableau. |
| `f` | `(variables: string[]) => void` | Une fonction qui sera appelée avec la liste des identifiants des variables associées au tableau chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

## Données
Ces fonctions vous permettent d'observer et de modifier les données d'un tableau.

### `client.tableaux.ajouterÉlément({ idTableau, vals })`
Ajoute un ou plusieurs éléments à un tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `vals` | [`élémentBdListeDonnées[]`](#types-donnees) | Les données à ajouter. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string[]>` | Les identifiants uniques des éléments ajoutés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type bds, type tableaux } from "@constl/ipa";

const client = créerConstellation();

// Créer nos variables
const idVarSite = await client.variables.créerVariable({ 
    catégorie: 'chaîneNonTraductible'
});
const idVarDate = await client.variables.créerVariable({ 
    catégorie: 'horoDatage'
});
const idVarTempérature = await client.variables.créerVariable({ 
    catégorie: 'numérique'
});

// Créer notre base de données
const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });
const idColSite = await client.tableaux.ajouterColonneTableau({
  idTableau,
  idVariable: idVarSite,
});
const idColDate = await client.tableaux.ajouterColonneTableau({
  idTableau,
  idVariable: idVarDate,
});
const idColTempérature = await client.tableaux.ajouterColonneTableau({
  idTableau,
  idVariable: idVarTempérature,
});

// Enfin, ajouter les données
const idsÉléments = await client.tableaux.ajouterÉlément({ 
  schémaBd, 
  idNuéeUnique, 
  clefTableau: CLEF_TABLEAU,
  vals: {
    "site": "mon site d'observation",
    "date": Date.now(),
    "température": 52.2,
  },
});
```

### `client.tableaux.modifierÉlément({ idTableau, vals, idÉlément })`
Modifie un élément d'un tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `vals` | { [idColonne: string]: [`élémentsBd`](./tableaux.md#types-donnees) \| undefined } | Les données à jour. Si une colonne n'apparaît pas sur `vals`, elle ne sera pas modifiée. Si, au contraire, elle est égale à `undefined`, la valeur correspondante sera effacée. |
| `idÉlément` | `string` | L'identifiant de l'élément à modifier. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant unique de l'élément modifié. |

#### Exemple
```ts
// ...continuant de ci-dessus...

await client.tableaux.modifierÉlément({ 
  idTableau,
  vals: {
    [idColTempérature]: 38.2 ,
  },
  idsÉléments[0],
});
```

### `client.tableaux.effacerÉlément({ idTableau, idÉlément })`
Efface un élément d'un tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `idÉlément` | `string` | L'identifiant de la rangée à effacer. |

#### Exemple
```ts
// ...continuant de ci-dessus...
await client.tableaux.effacerÉlément({ 
  idTableau, 
  idÉlément: idsÉléments[0],
});
```


### `client.tableaux.suivreDonnées({ idTableau, f, clefsSelonVariables })`
Suit les données d'un tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `f` | `(données:`[`élémentDonnées`](./tableaux.md#types-donnees)`[]) => void` | La fonction qui sera appellée avec les données chaque fois que celles-ci changent. |
| `clefsSelonVariables` | `boolean \| undefined` | Si nous voulons utiliser les identifiants des variables (au lieu de l'identifiant des colonnes) pour les clefs des valeurs. Faux par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
// ...continuant de ci-dessus...

const données = ref<tableaux.élémentDonnées[]>();
const fOublierDonnées = await client.tableaux.suivreDonnées({ 
    idTableau,
    f: x => données.value = x,
 });

```


## Règles
Vous pouvez ajouter des règles de validation des données directement aux tableaux. Pour voir toutes les possibilités de règles permises, voir la [section correspondante](./règles.md).

### `client.tableaux.ajouterRègleTableau({ idTableau, idColonne, règle })`
Ajoute une règle de validation à un tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `idColonne` | `string` | L'identifiant de la colonne. |
| `règle` | [`valid.règleVariable`](./règles.md) | La règle à ajouter. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant unique de la nouvelle règle. |


#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idTableau = await client.tableaux.créerTableau({ idBd });
const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

const idColonne = await client.tableaux.ajouterColonneTableau({ idTableau, idVariable });

const règle: valid.règleBornes = {
    typeRègle: "bornes",
    détails: {
        type: "fixe",
        val: 0,
        op: ">=",
    },
};
const idRègle = await client.tableaux.ajouterRègleTableau({ idTableau, idColonne, règle })

```

### `client.tableaux.effacerRègleTableau({ idTableau, idRègle })`
Ajoute une règle de validation à un tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `idColonne` | `string` | L'identifiant de la règle à effacer. |

#### Exemple
```ts
// ...continuant de ci-dessus...
await client.tableaux.effacerRègleTableau({ idTableau, idRègle })

```

### `client.tableaux.suivreRègles({ idTableau, f })`
Suit les règles associées au tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `f` | `(règles:` [`valid.règleColonne`](./règles.md#types)` []) => void` | Une fonction qui sera appelée avec les règles du tableau chaque fois que celles-ci changent.|

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
// ...continuant de ci-dessus...

const règles = ref<valid.règleColonne[]>();

const fOublierRègles = await client.tableaux.suivreRègles({ 
    idTableau,
    f: x => règles.value = x,
});

```

## Validation
Constellation vous permet de valider les données des tableaux.

### `client.tableaux.suivreValidDonnées({ idTableau, f })`
Suit les erreurs de validation des données du tableau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `f` | `(erreurs:` [`valid.erreurValidation`](./règles.md#types-erreurs) `[]) => void` | Une fonction qui sera appelée avec les erreurs de validation du tableau chaque fois que celles-ci changent.|

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
// ...continuant de ci-dessus...

const erreursValidation = ref<valid.erreurValidation[]>();

const fOublierRègles = await client.tableaux.suivreValidDonnées({ 
    idTableau,
    f: x => erreursValidation.value = x,
});

```

### `client.tableaux.suivreValidRègles({ idTableau, f })`
Suit les erreurs présentes dans les règles elles-mêmes. Ces erreurs peuvent indiquer si:

* La colonne associée à une règle catégorique n'existe pas.
* La colonne associée à une règle de bornes n'existe pas sur ce tableau.
* Aucune colonne sur ce tableau n'a la variable associée à une règle de bornes.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `f` | `(erreurs:` [`valid.erreurRègle`](./règles.md#types-erreurs) `[]) => void` | Une fonction qui sera appelée avec les erreurs des règles du tableau chaque fois que celles-ci changent.|

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
// ...continuant de ci-dessus...

const erreursRègles = ref<valid.erreurRègle[]>();

const fOublierRègles = await client.tableaux.suivreValidRègles({ 
    idTableau,
    f: x => erreursRègles.value = x,
});

```

## Importation et exportation
Vous pouvez importer et exporter des données d'un tableau.

:::tip ASTUCE
Vous pouvez également [automatiser](./automatisations.md) ces actions !
:::

### `client.tableaux.importerDonnées({ idTableau, données, conversions, cheminBaseFichiers })`
Importer des données vers un tableau Constellation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `données` | [`élémentBdListeDonnées`](#types-données) | Les données à importer. |
| `conversions` | `{ [col: string]: `[`tableaux.conversionDonnées`](#types-conversions-donnees)` } \| undefined` | Optionnellement, des conversions à appliquer aux données importées. |
| `cheminBaseFichiers` | `string \| undefined` | Optionnellement, un dossier de base pour résoudre des références à des fichiers locaux (par exemples, des documents ou des images) pour des variables de type `image`, `audio`, `vidéo` ou bien `fichier`. |

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const idBd = await client.bds.créerBd(: "ODBl-1_0" });
const idTableau = await client.tableaux.créerTableau({ idBd });

const idVarDate = await client.variables.créerVariable({
  catégorie: "horoDatage",
});
const idVarEndroit = await client.variables.créerVariable({
  catégorie: "chaîneNonTraductible",
});
const idVarTempMin = await client.variables.créerVariable({
  catégorie: "numérique",
});
const idVarTempMax = await client.variables.créerVariable({
  catégorie: "numérique",
});

const idsCols = {};
for (const idVariable of [
  idVarDate,
  idVarEndroit,
  idVarTempMin,
  idVarTempMax,
]) {
  const idCol = await client.tableaux.ajouterColonneTableau({
    idTableau,
    idVariable,
  });
  idsCols[idVar] = idCol;
}

const nouvellesDonnées = [
  {
    [idsCols[idVarEndroit]]: "ici",
    [idsCols[idVarDate]]: "2023-01-01",
    [idsCols[idVarTempMin]]: 101,  // Ouach! Fahrenheit...
  },
  {
    [idsCols[idVarEndroit]]: "là",
    [idsCols[idVarDate]]: "2023-01-01",
    [idsCols[idVarTempMax]]: 110,
  },
];

// Convertir à centigrades
const fÀC = {
  type: "numérique";
  opération: [
    { op: "-", val: 32 },
    { op: "*", val: 5/9 }
  ]
}

// Finalement, importer les données
await client.tableaux.importerDonnées({
  idTableau,
  données: nouvellesDonnées,
  conversions: {  
    [idsCols[idVarTempMin]]: fÀC,
    [idsCols[idVarTempMaxx]]: fÀC,
  }
});
```

### `client.tableaux.exporterDonnées({ idTableau, langues, doc, nomFichier })`
Exporte des données d'un tableau Constellation, mais ne le sauvegarde pas immédiatement au disque.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `langues` | `string[] \| undefined` | Si vous voulez que les colonnes et les tableaux portent leurs noms respectifs au lieu de leurs identifiants uniques, la liste de langues (en ordre de préférence) dans laquelle vous souhaitez recevoir les données. Une liste vide utilisera, sans préférence, n'importe quelle langue parmi celles disponibles. |
| `doc` | `xlsx.WorkBook \| undefined` | Optionnellement, un document `xlsx.WorkBook` existant auquel ajouter le tableau. Si non défini, un nouveau document `xlsx.WorkBook` sera créé. |
| `nomFichier` | `string \| undefined` | Le nom du fichier que vous voulez créer. Si non spécifié, Constellation utilisera le nom du tableau si `langues !== undefined` ou, à défaut, l'identifiant unique du tableau. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<`[`donnéesBdExportées`](./bds.md#donnees-exportees)`>` | Les données exportées, prètes à être écrites à un fichier de votre choix. |


#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const idBd = await client.bds.créerBd(: "ODBl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });

// ... ajouter des colonnes et des données ...

const donnéesExportées = await client.tableaux.exporterDonnées({ 
    idTableau, 
    langues: ["fr", "த", "kaq"],
});

// Faire quelque chose avec le document

```

### `client.tableaux.suivreDonnéesExportation({ idTableau, langues, f })`
Suite les données d'un tableau en format exportation (données traduites).


#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `langues` | `string[] \| undefined` | Si vous voulez que les colonnes et les tableaux portent leurs noms respectifs au lieu de leurs identifiants uniques, la liste de langues (en ordre de préférence) dans laquelle vous souhaitez recevoir les données. Une liste vide utilisera, sans préférence, n'importe quelle langue parmi celles disponibles. |
| `f` | `Promise<`[`donnéesTableauExportation`](#types-exportation)`>` | Fonction de suivi qui sera appellée chaque fois que changeront les données. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const idBd = await client.bds.créerBd(: "ODBl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });

// ... ajouter des colonnes et des données ...

const fOublier = await client.tableaux.suivreDonnéesExportation({ 
    idTableau, 
    langues: ["fr", "த", "kaq"],
    f: console.log
});

```


## Types
Plusieurs types sont associés aux tableaux Constellation et à leurs données.

### Types données
```ts
// Représente une rangé de données provenant d'un tableau
interface élémentDonnées<
  T extends élémentBdListeDonnées = élémentBdListeDonnées
> {
  données: T;
  id: string;  // Identifiant unique de la rangé de données
}

type élémentBdListeDonnées = {
  [key: string]: élémentsBd;
};

// Représente tout type de données pouvant être sauvegardé à orbit-db
type élémentsBd =
  | number
  | boolean
  | string
  | { [clef: string]: élémentsBd }
  | Array<élémentsBd>;

```

### Types colonnes
Ces types sont associés avec les informations des colonnes des tableaux.

```ts
type InfoCol = {
  id: string;
  variable: string;
  index?: boolean;
};

type InfoColAvecCatégorie = InfoCol & {
  catégorie?: catégorieVariables;
};
```

### Types conversions données

```ts
export type conversionDonnées =
  | conversionDonnéesNumérique
  | conversionDonnéesDate
  | conversionDonnéesChaîne;

export type conversionDonnéesNumérique = {
  type: "numérique";
  opération?: opérationConversionNumérique | opérationConversionNumérique[];
  systèmeNumération?: string;
};

export type opérationConversionNumérique = {
  op: "+" | "-" | "/" | "*" | "^";
  val: number;
}

export type conversionDonnéesDate = {
  type: "horoDatage";
  système: string;
  format: string;
};
export type conversionDonnéesChaîne = {
  type: "chaîne";
  langue: string;
};
```

#### Types exportation

```ts
type donnéesTableauExportation = {
  nomTableau: string;
  données: élémentBdListeDonnées[];
  fichiersSFIP: Set<string>;
};

```