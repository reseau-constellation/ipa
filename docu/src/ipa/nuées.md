# Nuées
Les nuées de données Constellation permettent de regrouper des données, toutes suivant la même structure de données, provenant de différentes utilisatrices. Elles vous permettent de visualiser et partager, dans un seul tableau, des données provenant de personnes différentes, et aussi de décider les conditions d'accès (ouverte ou par invitation). 

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
Cette action autorise la modification de la spécification de la nuée. Les auteurs que vous invitez ainsi pourront modifier la nuée elle-même, donc son nom, sa structure et ses règles de contribution de données. Si vous voulez au contraire uniquement autoriser (ou non) quelque à contribuer des données à la nuée, voir la section [accès et permissions](#acces-et-permissions) à la place.
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
### `client.nuées.ajouterMotsClefsNuée`
### `client.nuées.effacerMotClefNuée`
### `client.nuées.suivreMotsClefsNuée`

## Variables
### `client.nuées.suivreVariablesNuée`

## Statut
### `client.nuées.changerStatutNuée`
### `client.nuées.suivreStatutNuée`
### `client.nuées.marquerObsolète`
### `client.nuées.marquerActive`
### `client.nuées.marquerBêta`
### `client.nuées.marquerInterne`

## Tableaux
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
### `client.nuées.suivreDonnéesTableauNuée`

## Bds
### `client.nuées.suivreBdsCorrespondantes`

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

## Règles
### `client.nuées.ajouterRègleTableauNuée`
### `client.nuées.effacerRègleTableauNuée`
### `client.nuées.suivreRèglesTableauNuée`

## Comparaisons
### `client.nuées.suivreDifférencesNuéeEtTableau`
### `client.nuées.suivreDifférencesNuéeEtBd`
### `client.nuées.suivreCorrespondanceBd` ?

## Exportation
### `client.nuées.exporterDonnéesNuée`

## Héritage
### `client.nuées.rechercherNuéesSpécialiséesLiées`
### `client.nuées.suivreNuéesParents`
