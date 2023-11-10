# Nuées
Les [nuées](../guide/concepts.md#nuee) de données Constellation permettent de regrouper des données, toutes suivant la même structure de données, provenant de différentes utilisatrices. Elles vous permettent de visualiser et partager, dans un seul tableau, des données provenant de personnes différentes, et aussi de décider les conditions d'accès (ouverte ou par invitation). 

Les nuées sont très utiles pour les projets de science citoyenne.

[[toc]]

## Général
Actions générales pour gérer vos nuées.

### `client.nuées.suivreNuées({ f })`
Recherche les nuées appartenant au compte présent. Pour rechercher des nuées d'autres utilisateurs sur le réseau Constellation, voir la section [réseau](./réseau.md).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(nuées: string[]) => void` | Cette fonction sera appelée avec la liste des identifiants des nuées chaque fois que celle-ci est modifiée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

const nuées = ref<string[]>();
await client.nuées.suivreNuées({ f: x => nuées.value = x });

```

### `client.nuées.créerNuée({ autorisation, nuéeParent })`
Créer une nouvelle nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `autorisation` | `string \| "IJPC" \| "CJPI" \| undefined` | La stratégie d'autorisation pour participer à la nuée. Voir la section [accès](#acces-et-permissions) pour plus d'information. `autorisation` peut aussi être un identifiant orbite d'une stratégie d'autorisation déjà existante. |
| `nuéeParent` | `string \| undefined` | Si cette nuée doit hériter d'une nuée existante, l'identifiant de cette dernière. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant de la nouvelle nuée. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ autorisation: "CJPI" });

```

### `client.nuées.copierNuée({ idNuée })`
Crée une copie d'une nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée à copier. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant de la nouvelle nuée. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ });
const idCopie = await client.nuées.copierNuée({ idNuée });

```

### `client.nuées.générerDeBd({ idBd })`
Génère une nuée structurée selon une base de données existante.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données de référence. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant de la nouvelle nuée. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

// Créer une base de données
const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });
const idVariableDate = await client.variables.créerVariable({ catégorie: "horoDatage" });
const idVariablePhoto = await client.variables.créerVariable({ catégorie: "image" });
await client.tableaux.ajouterColonneTableau({ 
    idTableau, 
    idVariable: idVariableDate 
});
await client.tableaux.ajouterColonneTableau({ 
    idTableau, 
    idVariable: idVariablePhoto 
});

// Créer une nuée correspondante
const idNuée = await client.nuées.générerDeBd({ idBd });
```


### `client.nuées.générerSchémaBdNuée({ idNuée, licence })`
Génère un [schéma de base de données](bds.md#types-schema-bd) correspondant à la structure de la nuée, qui peut ensuite être utilisé pour générer des bases de données conformes à la nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée de référence. |
| `licence` | `string` | La [licence](./licences.md#licences-disponibles) sous laquelle les bases de données correspondant au schéma devraient être créées. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<` [`bds.schémaSpécificationBd`](./bds.md#types-schema-bd)` >` | Le schéma de la nuée. |

#### Exemple
```ts
// ...continuant de ci-dessus...
const schéma = await client.nuées.générerSchémaBdNuée({ 
    idNuée, 
    licence: "ODbl-1_0" 
});
```

### `client.nuées.inviterAuteur({ idNuée, idCompteAuteur, rôle })`
Inviter une autre utilisatrice à modifier une nuée qui vous appartient. Attention ! Une fois invitée, une personne ne peut pas être désinvitée.

:::tip CONSEIL
Cette action autorise la modification de la spécification de la nuée. Les auteurs que vous invitez ainsi pourront modifier la nuée elle-même, donc son nom, sa structure et ses règles de contribution de données. Si vous voulez au contraire uniquement autoriser (ou non) quelqu'un à contribuer des données à la nuée, voir la section [accès et permissions](#acces-et-permissions) à la place.
:::

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `idCompteAuteur` | `string` | L'identifiant du compte de la personne à inviter. |
| `rôle` | `"MODÉRATEUR" | "MEMBRE"` | Le rôle pour lequel vous invitez la personne. Toutes pourront modifier la nuée ; si `"MODÉRATEUR"`, elle pourra également inviter d'autres auteurs. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idNuée = await client.nuées.créerBd({ });
await client.nuées.inviterAuteur({ 
    idNuée, 
    idCompteAuteur: "idDuCompteDeMonAmieÀQuiJeFaisTrèsConfiance",
    rôle: "MODÉRATEUR" 
});

```

### `client.nuées.effacerNuée({ idNuée })`
Effacer une nuée. Étant donné la structure distribuée de Constellation, cette action effacera la nuée de votre dispositif, mais ne pourra pas forcer les autres membres du réseau à l'effacer également.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée à effacer. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idNuée = await client.bds.créerNuée({  });
await client.nuées.effacerNuée({ idNuée });

```


### `client.nuées.suivreQualitéNuée({ idNuée, f })`
Suivre une mesure (subjective, de 0 à 1) de la qualité d'une nuée. 1 indique la meilleure qualité.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `f` | `(qualité: number) => void` | Une fonction qui sera appelée avec la qualité de la nuée chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type bds } from "@constl/ipa";

const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ });

const qualité = ref<number>();
const fOublierSuivi = await client.nuées.suivreQualitéNuée({ 
    idNuée,
    f: x => qualité.value = x
});

```


## Noms
Dans Constellation, chaque nuée est définie par un code identifiant et peut ensuite être nommée dans autant de langues que vous le souhaitez.

### `client.nuées.suivreNomsNuée({ idNuée, f })`
Suit les noms (traduits en différentes langues) de la nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `f` | `(noms: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les noms de la nuée chaque fois qu'ils changent|

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ });

const noms = ref<{[langue: string]: string}>();
const fOublierNoms = await client.nuées.suivreNomsNuée({ 
    idNuée,
    f: x => noms.value = x,
});

await client.nuées.sauvegarderNomsNuée({ 
    idNuée, 
    noms: { 
        fr: "Science citoyenne fleuve Saint-Laurent", 
        த: "ஸென் லொரான் ஆற்றில் கூடிமக்கள் அறிவியல்"
    }
});

```

### `client.nuées.sauvegarderNomNuée({ idNuée, langue, nom })`
Sauvegarde le nom de la nuée dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `nom` | `string` | Le nom de la nuée. |
| `langue` | `string` | La langue du nom. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ });
await client.nuées.sauvegarderNomNuée({
    idNuée, 
    langue: "fr", 
    nom: "Science citoyenne fleuve Saint-Laurent" 
});

```

### `client.nuées.sauvegarderNomsNuée({ idNuée, noms })`
Sauvegarde le nom de la nuée dans plusieurs langues en même temps.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `noms` | `{ [langue: string]: string }` | Les noms de la nuée, indexés par langue. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idBd = await client.nuées.créerNuée({ });
await client.nuées.sauvegarderNomsNuée({ 
    idBd, 
    noms: { 
        fr: "Science citoyenne fleuve Saint-Laurent", 
        த: "ஸைன் லொரான் ஆற்றில் கூடிமக்கள் அறிவியல்"
    }
});

```

### `client.nuées.effacerNomNuée({ idNuée, langue })`
Efface la traduction du nom de la nuée dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `langue` | `string` | La langue dont ont doit effacer le nom. |

#### Exemple
```ts
// ...continuant de ci-dessus...
await client.nuées.effacerNomNuée({ idNuée, langue: "fr" });
```

## Descriptions
Dans Constellation, chaque nuée peut aussi être accompagnée d'une description plus informative.

### `client.nuées.sauvegarderDescriptionNuée({ idNuée, langue, nom })`
Sauvegarde la description de la nuée dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `description` | `string` | La description de la nuée. |
| `langue` | `string` | La langue de la description. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ });
await client.nuée.sauvegarderDescriptionNuée({
    idNuée, 
    langue: "fr", 
    description: "Données d'observations citoyennes de la qualité de l'eau du fleuve Saint-Laurent." 
});

```

### `client.nuées.sauvegarderDescriptionsNuée({ idNuée, descriptions })`
Sauvegarde la description d'une nuée dans plusieurs langues en même temps.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `descriptions` | `{ [langue: string]: string }` | Les descriptions de la nuée, indexées par langue. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ });
await client.nuées.sauvegarderDescriptionsNuée({ 
    idNuée, 
    descriptions: { 
        fr: "Données d'observations citoyennes de la qualité de l'eau du fleuve Saint-Laurent.", 
        த: "ஸென் லொரான் ஆற்றின் நீர் தரத்தைப் பற்றி பங்களிப்பாளர்களால் கண்டுப்பிட்டத்த கண்காணிப்புகள்."
    }
});

```

### `client.nuées.effacerDescriptionNuée({ idNuée, langue })`
Efface la traduction d'une description de la nuée dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `langue` | `string` | La langue dont ont doit effacer la description. |

#### Exemple
```ts
// ...continuant de ci-dessus...
await client.nuées.effacerDescriptionNuée({ idNuée, langue: "fr" });
```

### `client.nuées.suivreDescriptionsNuée({ idNuée, f })`
Suit les descriptions (traduites en différentes langues) de la nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `f` | `(descriptions: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les descriptions de la nuée chaque fois qu'elles changent. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";à

const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ });

const descriptions = ref<{ [langue: string]: string }>();
const fOublierDescriptions = await client.nuées.suivreDescriptionsNuée({ 
    idNuée,
    f: x => descriptions.value = x,
});

await client.nuées.sauvegarderDescriptionsNuée({ 
    idNuée, 
    descriptions: { 
        fr: "Données d'observations citoyennes de la qualité de l'eau du fleuve Saint-Laurent.", 
        த: "ஸென் லொரான் ஆற்றின் நீர் தரத்தைப் பற்றி பங்களிப்பாளர்களால் கண்டுப்பிட்டத்த கண்காணிப்புகள்."
    }
});

```

## Image
Les nuées peuvent être avoir une image décorative qui apparaîtra sur l'interface.

### `client.nuées.sauvegarderImage({ idNuée, image })`
Sauvegarde une image décorative.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `image` | `import("ipfs-core-types/src/utils").ImportCandidate` | Le fichier de l'image. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ });

const image = fs.readFileSync("mon image locale.jpeg");
await client.nuées.sauvegarderImage({ idNuée, image });

```

### `client.nuées.effacerImage({ idNuée })`
Efface l'image de la nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |

#### Exemple
```ts
// ...continuant de ci-dessus...

await client.nuées.effacerImage( { idNuée });
```

### `client.nuées.suivreImage({ idNuée, f })`
Suit l'image de la nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `f` | `(image: Uint8Array | null) => void` | Une fonction qui sera appelée avec l'image chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from 'vue';
import { générerClient } from "@constl/ipa";

const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ });

const image = ref<Uint8Array | null>();
const fOublierImage = await client.nuées.suivreImage({ 
    idNuée, 
    f: x => image.value = x
});

await fOublierImage();
```


## Mots-clefs
Chaque nuée Constellation peut être associée avec plusieurs [mots-clefs](./motsClefs.md).

### `client.nuées.ajouterMotsClefsNuée({ idNuée, idsMotsClefs })`
Ajoute des mots-clefs à la nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `idsMotsClefs` | `string \| string[]` | Les identifiants des mots-clefs à ajouter. |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ });

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderNomMotClef({
    idMotClef,
    nom: "Hydrologie",
    langue: "fr"
})

await client.nuées.ajouterMotsClefsNuée({ 
    idNuée, 
    idsMotsClefs: idMotClef
});
```

### `client.nuées.effacerMotClefNuée({ idNuée, idMotClef })`
Enlève un mot-clef de la nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `idMotClef` | `string` | L'identifiant du mot-clef à enlever. |

#### Exemple
```ts
// En continuant de ci-dessus...

await client.nuées.effacerMotClefNuée({ 
    idNuée, 
    idMotClef
});
```

### `client.nuées.suivreMotsClefsNuée({ idNuée, f })`
Suit les mots-clefs associés à la nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `f` | `(motsClefs: string[]) => void` | Une fonction qui sera appelée avec la liste des identifiants des mots-clefs associés à la nuée chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ });

const motsClefs = ref<string[]>();

const fOublierMotsClefs = await client.nuées.suivreMotsClefsNuée({ 
    idNuée,
    f: x => motsClefs.value = x,
});

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderNomMotClef({
    idMotClef,
    nom: "Hydrologie",
    langue: "fr"
})

await client.nuées.ajouterMotsClefsNuée({ 
    idNuée, 
    idsMotsClefs: idMotClef
});

```


## Variables
Les variables ne peuvent pas être ajoutées directement à une nuée, sinon aux [tableaux](#tableaux) de celle-ci. Cependant, vous pouvez suivre la liste de variables associées à une nuée.

### `client.nuées.suivreVariablesNuée({ idNuée, f })`
Suit les variables associées à la nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `f` | `(variables: string[]) => void` | Une fonction qui sera appelée avec la liste des identifiants des variables associées à la nuée chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ });

const variables = ref<string[]>();

const fOublierVariables = await client.nuées.suivreVariablesNuée({ 
    idNuée,
    f: x => variables.value = x,
});

const idTableau = await client.nuées.ajouterTableauNuée({ idNuée });
const idVariableNumérique = await client.variables.créerVariable({ catégorie: "numérique" });
await client.tableaux.ajouterColonneTableauNuée({
    idTableau,
    idVariable: idVariableNumérique,
});

```

## Statut

### `client.nuées.changerStatutNuée`
### `client.nuées.suivreStatutNuée`
### `client.nuées.marquerObsolète`
### `client.nuées.marquerActive`
### `client.nuées.marquerBêta`
### `client.nuées.marquerInterne`

## Tableaux
Les tableaux des nuées se comportent comme les [tableaux](./tableaux.md) des bases de données, à l'exception que ces premiers **ne peuvent pas contenir des données**. En effet, les nuées ne contiennent pas leurs propres données, mais servent plutôt à [regrouper des données existantes](#donnees) (avec le même format) dans différentes bases de données appartenant à différentes personnes. Même si elles présentent les données sous la forme d'un seul tableau, derrière tout cela, il s'agit de multiples bases de données apartenant à différentes personnes (d'où le nom `nuée`). Pour cette raison, les tableaux des nuées servent uniquement à spécifier la structure des données qui seront ajoutées aux bases de données participantes, et non à sauvegarder les données elles-mêmes.

À part ce petit détail, les tableaux des nuées sont identiques ceux des bases de données - vous pouvez y ajouter des colonnes et des [règles de validation](#regles) des données.

### `client.nuées.ajouterTableauNuée`
### `client.nuées.effacerTableauNuée`
### `client.nuées.suivreTableauxNuée`
### `client.nuées.ajouterNomsTableauNuée`
### `client.nuées.effacerNomsTableauNuée`
### `client.nuées.suivreNomsTableauNuée`
### `client.nuées.ajouterColonneTableauNuée`
### `client.nuées.effacerColonneTableauNuée`
### `client.nuées.changerColIndexTableauNuée`
### `client.nuées.suivreColonnesTableauNuée`

## Règles
Vous pouvez ajouter des règles de validation de données aux nuées. Ces règles seront appliquées pour valider les données contribuées par les différents participants. Pour plus d'information sur les possibilités de validation, voir la section [règles](./règles.md) de la documentation.

### `client.nuées.ajouterRègleTableauNuée({ idTableau, idColonne, règle })`
Ajoute une règle de validation à un tableau d'une nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau de la nuée. |
| `idColonne` | `string` | L'identifiant de la colonne. |
| `règle` | [`valid.règleVariable`](./règles.md) | La règle à ajouter. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant unique de la nouvelle règle. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

const clefTableau = "mon tableau principal";

const idNuée = await client.nuées.créerNuée({});
const idTableau = await client.nuées.ajouterTableauNuée({ idNuée, clefTableau });
const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

const idColonne = await client.nuées.ajouterColonneTableauNuée({ idTableau, idVariable });

const règle: valid.règleBornes = {
    typeRègle: "bornes",
    détails: {
        type: "fixe",
        val: 0,
        op: ">=",
    },
};
const idRègle = await client.nuées.ajouterRègleTableauNuée({ idTableau, idColonne, règle })

```

### `client.nuées.effacerRègleTableauNuée({ idTableau, idRègle })`
Ajoute une règle de validation à un tableau d'une nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idTableau` | `string` | L'identifiant du tableau. |
| `idColonne` | `string` | L'identifiant de la règle à effacer. |

#### Exemple
```ts
// ...continuant de ci-dessus...
await client.nuées.effacerRègleTableauNuée({ idTableau, idRègle })

```

### `client.nuées.suivreRèglesTableauNuée({ idNuée, clefTableau, f })`
Suit les règles associées au tableau d'une nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `clefTableau` | `string` | La clef du tableau. |
| `f` | `(règles:` [`valid.règleColonne`](./règles.md#types)` []) => void` | Une fonction qui sera appelée avec les règles du tableau chaque fois que celles-ci changent.|

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
// ...continuant de ci-dessus...

const règles = ref<valid.règleColonne[]>();

const fOublierRègles = await client.nuées.suivreRèglesTableauNuée({ 
    idNuée,
    clefTableau,
    f: x => règles.value = x,
});

```

## Données

### `client.nuées.suivreDonnéesTableauNuée({ idNuée, clefTableau, f, ... })`
Suit les données d'un tableau d'une nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `clefTableau` | `string` | La clef du tableau. |
| `f` | `(données:` [`élémentDeMembreAvecValid`](#types-donnees)` []) => void` | La fonction qui sera appellée avec les données chaque fois que celles-ci changent. |
| `nRésultatsDésirés` | `number` | Le nombre de résultats désiré. |
| `ignorerErreursFormatBd` | `boolean` | Ignorer les erreurs de structure des bases de données faisant parti de la nuée. Vrai par défaut. |
| `ignorerErreursFormatTableau` | `boolean` | Ignorer les erreurs de structure des tableaux faisant parti de la nuée. Faux par défaut. |
| `ignorerErreursDonnéesTableau` | `boolean` | Ignorer les erreurs des données faisant parti de la nuée. Vrai par défaut (les données avec des erreurs de validation seront présentes dans les résultats, mais les erreurs seront elles aussi signalées). |
| `licencesPermises` | `string[] \| undefined` | Une liste de licences permises. Si spécifiée, uniquement les bases de données ayant une licence présente dans la liste seront incluses dans les résultats. |
| `toujoursInclureLesMiennes` | `boolean` | Si nous incluons toujours les données provenant de notre propre compte dans les résultats, peu importe si nous sommes autorisés à contribuer à la nuée ou non. Vrai par défaut. |
| `clefsSelonVariables` | `boolean \| undefined` | Si nous voulons utiliser les identifiants des variables (au lieu de l'identifiant des colonnes) pour les clefs des valeurs. Faux par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
// ...continuant de ci-dessus...

const données = ref<réseau.élémentDeMembreAvecValid[]>();
const fOublierDonnées = await clientnuées.suivreDonnéesTableauNuée({ 
    idNuée,
    clefTableau,
    f: x => données.value = x,
 });

```


## Bds
### `client.nuées.suivreBdsCorrespondantes({ idNuée, f, ... })`
Suit les bases de données (sur tout le réseau) qui sont associées à la nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `f` | `(bds: string[]) => void` | La fonction qui sera appellée avec les identifiants des bases de données associées données chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number` | Le nombre de résultats désiré. |
| `vérifierAutorisation` | `boolean` | Si nous rapportons uniquement les bases de données autorisées à contribuer à la nuée. Vrai par défaut. |
| `toujoursInclureLesMiennes` | `boolean` | S'il faut sauter la vérification d'autorisation pour les bases de données provenant de notre propre compte. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
// ...continuant de ci-dessus...

const bdsConnexes = ref<string[]>();
const fOublierBdss = await clientnuées.suivreBdsCorrespondantes({ 
    idNuée,
    f: x => bdsConnexes.value = x,
    nRésultatsDésirés: 100,
 });

```

## Accès et permissions
La stratégie d'accès à une nuée peut être soit « innocent jusqu'à ce que prouvé coupable », ou `"IJPC"` (tout le monde peut participer, jusqu'à ce qu'on les bloque), soit « coupable jusqu'à ce que prouvé innocent », ou `"CJPI"` (uniquement les personnes invitées peuvent participer).

:::tip CONSEIL
Ces autorisations ne s'appliquent qu'au droit des personnes à contribuer des données à la nuée. Pour autoriser quelqu'un à modifier la nuée elle-même (soit sa structure, ses noms, et ces autorisations elles-mêmes), utiliser la fonction [`client.nuées.inviterAuteur`](#client-nuees-inviterauteur-idnuee-idcompteauteur-role).
:::

### `client.nuées.changerPhisolophieAutorisation`
### `client.nuées.suivrePhilosophieAutorisation`
### `client.nuées.accepterMembreAutorisation`
### `client.nuées.accepterMembreNuée`
### `client.nuées.exclureMembreAutorisation`
### `client.nuées.exclureMembreDeNuée`
### `client.nuées.suivreGestionnaireAutorisations`
### `client.nuées.changerGestionnaireAutorisations`
### `client.nuées.obtGestionnaireAutorisationsDeNuée`
### `client.nuées.suivreAutorisationsMembresDeGestionnaire`
### `client.nuées.suivreAutorisationsMembresDeNuée`

## Comparaisons
Ces fonctions servent à comparer une base de donnée ou un tableau à leurs spécifications dans une nuée afin de vérifier s'ils sont compatibles ou non.

### `client.nuées.suivreCorrespondanceBd`
Suit toutes les différences de structure entre une base de données et les nuées auxquelles elle est associée (y compris les différences entre leux tableaux).


### `client.nuées.suivreDifférencesNuéeEtTableau`
Suit différences de structure entre un tableaux d'un base de données et sa spécification correspondante dans une nuée.

### `client.nuées.suivreDifférencesNuéeEtBd`
Suit différences de structure entre une base de données et la spécification d'une nuée.


## Exportation
Vous pouvez exporter des données d'une nuée vers un fichier externe sur votre ordinateur. Ceci est utile pour faire des sauvegardes des données importantes.

:::warning AVERTISSEMENT
**Constellation est un logiciel en début de développement.** Même si nous espérons ben ben fort que ce ne sera pas le cas, des erreurs et des pertes de données sont toujours possibles. Nous vous recommandons d'utiliser ces fonctionnalités d'exportation et de sauvegarde de manière fréquente et enthousiaste.
:::

### `client.nuées.exporterDonnéesNuée({ idNuée, ... })`
Cette fonction vous permet d'exporter les données présentes dans une nuée.

:::tip CONSEIL
Vous pouvez également [automatiser](./automatisations.md) les exportations selon une fréquence qui vous convient. C'est bien plus pratique !
:::

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée. |
| `langues` | `string[] \| undefined` | Si vous voulez que les colonnes portent leurs noms respectifs au lieu de leurs identifiants uniques, la liste de langues (en ordre de préférence) dans laquelle vous souhaitez recevoir les données. Une liste vide utilisera, sans préférence, n'importe quelle langue parmi celles disponibles. |
| `nomFichier` | `string \| undefined` | Le nom du fichier que vous voulez créer. Si non spécifié, Constellation utilisera le nom de la nuée si `langues !== undefined` ou, à défaut, l'identifiant unique de la nuée. |
| `nRésultatsDésirés` | `number` | Le nombre maximum de files de données désirées (le réseau peut être grand !). |


#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<`[`donnéesBdExportées`](./bds.md#types-donnees-exportees)`>` | Les données exportées, prètes à être écrites à un fichier de votre choix. |

:::tip CONSEIL
Vous pouvez passer le résultat de cette fonction à la fonction [`bds.exporterDocumentDonnées`](./bds.md#client-bds-exporterdocumentdonnees-donnees-formatdoc-dossier-inclurefichierssfip) afin d'écrire le des données exportées à un document local ou les télécharger.
:::

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

const idNuée = await client.nuées.créerNuée({ });

// ajouter des tableaux, créer des bases de données liées et y ajouter des données...

const données = await client.nuées.exporterDonnéesNuée({ 
    idNuée,
    langues: [],
    nRésultatsDésirés: 1000
});

```

## Héritage
Les nuées peuvent hériter d'autres nuées. Cette fonctionnalité leur permet de partager des noms, des mots-clefs et des structures de données. Les nuées « enfant » doivent contenir tous les tableaux et colonnes des nuées « parent » , mais peuvent contenir des colonnes ou des tableaux additionnels si vous le souhaitez.

:::info INFO
Un exemple classique est le système de traduction communautaire [`கிளிமூக்கு`](https://github.com/lassi-niruvanam/kilimukku) (`kilimukku`). Dans cet exemple, une nuée originale permet de spécifier la structure et de regrouper toutes les traductions communautaires de tous les projets de traduction utilisant `kilimukku`. Ensuite, chaque projet de traduction individuel crée sa propre nuée, héritant de la nuée `kilimukku` originale, afin de recevoir les propositions de traduction pour les phrases appartenant à ce projet particulier.
:::

### `client.nuées.rechercherNuéesDéscendantes({ idNuée, f, ... })`
Cette fonction suit, de manière récursive, les nuées qui ont spécifié la nuée présente en tant que nuée « parent ».

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée parent. |
| `f` | `(résultats: string[]) => void` | La fonction qui sera appellée avec les identifiants des nuées liées chaque fois que celles-ci changent. |
| `nRésultatsDésirés` | `number` | Le nombre de résultats désirés. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

const nuéesLiées = ref<string[]>();

const idNuée = await client.nuées.créerNuée({ });
const idNuéeSpécialisée = await client.nuées.créerNuée({ nuéeParent: idNuée });

const { 
  fOublier, 
  fChangerN 
} = await client.nuées.rechercherNuéesDéscendantes({
  idNuée,
  f: x => résultats.value = x,
  nRésultatsDésirés: 10,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```


### `client.nuées.suivreNuéesParents({ idNuée, f })`
Cette fonction suit, de manière récursive, les nuées « parent » de la présente nuée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée d'intérêt. |
| `f` | `(résultats: string[]) => void` | La fonction qui sera appellée avec les identifiants des nuées « parent » de la nuée présente chaque fois que celles-ci changent. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
// ...continuant de ci-dessus...

const parents = ref<string[]>();
const { 
  fOublier: fOublierParents, 
  fChangerN: fChangerNParents, 
} = await client.nuées.suivreNuéesParents({
  idNuée: idNuéeSpécialisée,
  f: x => parents.value = x,
  nRésultatsDésirés: 10,
});

await fChangerNParents(3);  // On veut 3 résultats maximum
await fOublierParents();  // Arrêter le suivi
```

### `client.nuées.préciserParent({ idNuée, idNuéeParent })`
Spécifier une nuée parent.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée d'intérêt. |
| `idNuéeParent` | `string` | L'identifiant de la nuée parent'. |


#### Exemple
```ts
// ...continuant de ci-dessus...

await client.nuées.préciserParent({ 
  idNuée, 
  idNuéeParent: idAutreNuée 
});
```

### `client.nuées.enleverParent({ idNuée })`
Enlever une nuée parent.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant de la nuée d'intérêt. |

#### Exemple
```ts
// ...continuant de ci-dessus...

await client.nuées.enleverParent({ 
  idNuée
});
```

## Types

### Types données
Ces types décrivent la structure des données d'une nuée.

```ts
export type élémentDeMembre<T extends élémentBdListeDonnées> = {
  idCompte: string;
  élément: élémentDonnées<T>;
};

export type élémentDeMembreAvecValid<T extends élémentBdListeDonnées> =
  élémentDeMembre<T> & {
    valid: erreurValidation[];
  };
```

### Types différences
Ces types décrivent les différences entre des tableaux ou bases de données et leurs spécifications correspondantes dans une nuée.

```ts
// Pour les tableaux
export type différenceTableaux =
  | différenceVariableColonne
  | différenceIndexColonne
  | différenceColonneManquante
  | différenceColonneSupplémentaire;

export type différenceVariableColonne = {
  type: "variableColonne";
  sévère: true;
  idCol: string;
  varColTableau: string;
  varColTableauLiée: string;
};

export type différenceIndexColonne = {
  type: "indexColonne";
  sévère: true;
  idCol: string;
  colTableauIndexée: boolean;
};

export type différenceColonneManquante = {
  type: "colonneManquante";
  sévère: true;
  idManquante: string;
};

export type différenceColonneSupplémentaire = {
  type: "colonneSupplémentaire";
  sévère: false;
  idExtra: string;
};

// Pour les bases de données
export type différenceBds =
  | différenceBDTableauSupplémentaire
  | différenceBDTableauManquant
  | différenceTableauxBds;

export type différenceBDTableauManquant = {
  type: "tableauManquant";
  sévère: true;
  clefManquante: string;
};

export type différenceBDTableauSupplémentaire = {
  type: "tableauSupplémentaire";
  sévère: false;
  clefExtra: string;
};

export type différenceTableauxBds<
  T extends différenceTableaux = différenceTableaux
> = {
  type: "tableau";
  sévère: T["sévère"];
  idTableau: string;
  différence: T;
};

export type correspondanceBdEtNuée = {
  nuée: string;
  différences: différenceBds[];
};

```
