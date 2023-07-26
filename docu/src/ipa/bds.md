# Bases de données
Les bases de données Constellation sont comme des feuilles de calcul Excel ou LibreOffice Calc, avec des tableaux et des colonnes. En plus, elles se mettent automatiquement à jour sur tous vos dispositifs. C'est comme les feuilles de calcul Google Sheets, mais sans le Google.

Elles peuvent également contenir des types de données nos supportés par Excel et compagnie, tels les images, les fichiers audios et autres.

[[toc]]

## Général
Actions générales pour gérer vos bases de données.

### `client.bds.suivreBds({ f })`
Recherche les bases de données appartenant au compte présent. Pour rechercher des bases ded données d'autres utilisateurs sur le réseau Constellation, voir la section [réseau](./réseau.md).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(bds: string[]) => void` | Cette fonction sera appelée avec la liste des identifiants des bases de données chaque fois que celle-ci est modifiée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const bds = ref<string[]>();
await client.bds.suivreBds({ f: x => bds.value = x });

```

### `client.bds.créerBd({ licence, licenceContenu })`
Crée une nouvelle base de données.


#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `licence` | `string` | Le nom de la licence sous laquelle vous voulez partager ces données. |
| `licenceContenu` | `string` | Vous pouvez aussi spécifier une licence différente pour les documents (images, vidéos ou autres fichiers) présents dans la base de données. Si non spécifié, cela laisse supposer que le contenu est également partagé sous les termes de `licence`.|


#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant de la nouvelle base de données. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ 
    licence: "ODbl-1_0", 
    licenceContenu: "CC-BY-SA-4_0"
});

```

### `client.bds.copierBd({ idBd, copierDonnées })`
Crée une copie d'une base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données à copier. |
| `copierDonnées` | `boolean | undefined` | Si on copie aussi les données de la base de données (ou bien juste sa structure). Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant de la nouvelle base de données. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idCopie = await client.bds.copierBd({ idBd });

```

### `client.bds.créerBdDeSchéma({ schéma })`
Crée une base de données à partir d'une spécification de schéma.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `schéma` | [`schémaBd`](#schéma-bd) | Le schéma à utiliser. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant de la nouvelle base de données. |

#### Exemple
```ts
import { générerClient, type bds } from "@constl/ipa";
const client = générerClient();

// Créer nos variables
const idVarSite = await client.variables.créerVariable({ 
    catégorie: 'chaîneNonTraductible'
});
const idVarDate = await client.variables.créerVariable({ 
    catégorie: 'horoDatage'
});
const idVarImage = await client.variables.créerVariable({ 
    catégorie: 'image'
});

// Créer le schéma
const schéma: bds.schémaSpécificationBd = {
    licence: "ODbl-1_0",
    tableaux: [
        {
            cols: [
                {
                    idVariable: idVarSite,
                    idColonne: "site",
                    index: true,
                },
                {
                    idVariable: idVarDate,
                    idColonne: "date",
                    index: true,
                },
                {
                    idVariable: idVarImage,
                    idColonne: "image",
                },
            ],
            clef: "tableau observations",
        },
    ],
};

const idBd = await client.bds.créerBdDeSchéma({ schéma });

```

### `client.bds.inviterAuteur({ idBd, idCompteAuteur, rôle })`
Inviter une autre utilisatrice à modifier une base de données vous appartenant. Attention ! Une fois invitée, une personne ne peut pas être désinvitée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `idCompteAuteur` | `string` | L'identifiant du compte de la personne à inviter. |
| `rôle` | `"MODÉRATEUR" | "MEMBRE"` | Le rôle pour lequel vous invitez la personne. Tous pourront modifier la base de données ; si `"MODÉRATEUR"`, elle pourra également inviter d'autres auteurs. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
await client.bds.inviterAuteur({ 
    idBd, 
    idCompteAuteur: "idDuCompteDeMonAmieÀQuiJeFaisTrèsConfiance",
    rôle: "MODÉRATEUR" 
});

```

### `client.bds.effacerBd({ idBd })`
Effacer une base de données. Étant donné la structure distribuée de Constellation, cette action effacera la base de données de votre dispositif, mais ne pourra pas forcer les autres membres du réseau à l'effacer également.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données à effacer. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
await client.bds.effacerBd({ idBd });

```

### `client.bds.suivreQualitéBd({ idBd })`
Suivre une mesure (subjective, de 0 à 1) de la qualité d'une base de données. 1 indique la meilleure qualité.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `f` | `(qualité:` [`infoScore`](#score-bd) `) => void` | Une fonction qui sera appelée avec la qualité de la base de données chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type infoScore } from "@constl/ipa";

const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const qualité = ref<bds,infoScore>();
const fOublierSuivi = await client.bds.suivreQualitéBd({ 
    idBd,
    f: x => qualité.value = x
});

```

## Noms
Dans Constellation, chaque base de données est défini par un code identifiant et peut ensuite être nommé dans autant de langues que vous le souhaitez.

### `client.bds.sauvegarderNomBd({ idBd, langue, nom })`
Sauvegarde le nom de la base de données dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `nom` | `string` | Le nom de la base de données. |
| `langue` | `string` | La langue du nom. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
await client.bds.sauvegarderNomBd({
    idBd, 
    langue: "fr", 
    nom: "Croissance culture de millet" 
});

```

### `client.bds.sauvegarderNomsBd({ idBd, noms })`
Sauvegarde le nom de la base de données dans plusieurs langues en même temps.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `noms` | `{ [langue: string]: string }` | Les noms de la base de données, indexés par langue. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
await client.bds.sauvegarderNomsBd({ 
    idBd, 
    noms: { fr: "Croissance culture de millet", த: "சிறுதானிய பயிர் வளர்ச்சி"}
});

```

### `client.bds.effacerNomBd({ idBd, langue })`
Efface la traduction du nom de la base de données dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `langue` | `string` | La langue dont ont doit effacer le nom. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
await client.bds.effacerNomBd({ idBd, langue: "fr" });
```


### `client.bds.suivreNomsBd({ idBd, f })`
Suit les noms (traduits en différentes langues) de la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `f` | `(noms: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les noms de la base de données chaque fois qu'ils changent|

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const fOublierNoms = await client.bds.suivreNomsBd({ 
    idBd,
    f: async noms => {
        console.log(noms);
        await fOublierNoms();
    }
});

await client.bds.sauvegarderNomsBd({ 
    idBd, 
    noms: { fr: "Hydrologie", த: "நீரியல்"}
});

```


## Descriptions
Dans Constellation, chaque base de données peut aussi être accompagné d'une description plus informative.

### `client.bds.sauvegarderDescriptionBd({ idBd, langue, nom })`
Sauvegarde la description de la base de données dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `description` | `string` | La description de la base de données. |
| `langue` | `string` | La langue de la description. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
await client.bds.sauvegarderDescriptionBd({
    idBd, 
    langue: "fr", 
    description: "Données d'observation de croissance d'une culture expérimentale de millet." 
});

```

### `client.bds.sauvegarderDescriptionsBd({ idBd, descriptions })`
Sauvegarde la description d'une base de données dans plusieurs langues en même temps.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `descriptions` | `{ [langue: string]: string }` | Les descriptions de la base de données, indexées par langue. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
await client.bds.sauvegarderDescriptionsBd({ 
    idBd, 
    descriptions: { 
        fr: "Données d'observation de croissance d'une culture expérimentale de millet.", 
        த: "பல்கலைக்கழக சோதனையில் ஒரு சிறுதானிய பயிரின் வளர்ச்சி தகவல்கள்."
    }
});

```

### `client.bds.effacerDescriptionBd({ idBd, langue })`
Efface la traduction d'une description de la base de données dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `langue` | `string` | La langue dont ont doit effacer la description. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
await client.bds.effacerDescriptionBd({ idBd, langue: "fr" });
```

### `client.bds.suivreDescriptionsBd({ idBd, f })`
Suit les descriptions (traduites en différentes langues) de la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `f` | `(descriptions: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les descriptions de la base de données chaque fois qu'elles changent|

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const fOublierDescriptions = await client.bds.suivreDescriptionsBd({ 
    idBd,
    f: async descrs => {
        console.log(descrs);
        await fOublierDescriptions();
    }
});

await client.bds.sauvegarderDescriptionBd({ 
    idBd, 
    langue: "fr",
    description: "பல்கலைக்கழக சோதனையில் ஒரு சிறுதானிய பயிரின் வளர்ச்சி தகவல்கள்"
});

```

## Licences
Chaque base de données dans Constellation doit être associée à une licence qui explique les conditions d'utilisation des données qu'elle contient. 

:::tip
Voir les [licences](./licences.md) pour accéder à la liste de licences possibles.

Vous n'êtes évidemment pas limités par cette liste, et vous pouvez inclure n'importe quel nom de licence avec vos bases de données. Cependant, seulement les licences reconnues par Constellation apparaîteront avec un résumé de leurs conditions sur [l'interface graphique](https://github.com/reseau-constellation/iug) de Constellation.
:::

### `client.bds.changerLicenceBd({ idBd, licence })`
Change la licence d'une base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `licence` | `string` | Le code de la nouvelle licence. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
await client.bds.changerLicenceBd({ idBd, licence: "ODC-BY-1_0" });
```

### `client.bds.changerLicenceContenuBd({ idBd, licenceContenu })`
Change la licence des fichiers (images, vidéos ou autres) contenus dans la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `licenceContenu` | `string | undefined` | Le code de la nouvelle licence pour le contenu. Si `undefined`, la licence sera effacée et le contenu donc disponible sous la même licence que la base de données elle-même. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({ 
    licence: "ODBl-1_0", 
    licenceContenu: "CC-BY-SA-4_0" 
});
await client.bds.changerLicenceContenuBd({ 
    idBd, 
    licenceContenu: "CC-BY-4_0" 
});
```

### `client.bds.suivreLicenceBd({ idBd, f })`
Suit la licence de la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `f` | `(licence: string) => void` | Une fonction qui sera appelée avec la licence de la base de données chaque fois qu'elle change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const licence = ref<string>();

const fOublierLicence = await client.bds.suivreLicenceBd({ 
    idBd,
    f: x => licence.value = x,
});

await client.bds.changerLicenceBd({ 
    idBd, 
    licence: "ODC-BY-1_0",
});

```

### `client.bds.suivreLicenceContenuBd({ idBd, f })`
Suit la licence des fichiers contenus par la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `f` | `(licenceContenu: string) => void` | Une fonction qui sera appelée avec la licence des fichiers contenus par la base de données chaque fois qu'elle change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const licenceContenu = ref<string>();

const fOublierLicenceContenu = await client.bds.suivreLicenceContenuBd({ 
    idBd,
    f: x => licenceContenu.value = x,
});

await client.bds.changerLicenceContenuBd({ 
    idBd, 
    licence: "CC-BY-SA-4_0",
});

```

## Mots-clefs
Chaque base de données Constellation peut être associé avec plusieurs [mots-clefs](./motsClefs.md).

### `client.bds.ajouterMotsClefsBd({ idBd, idsMotsClefs })`
Ajoute des mots-clefs à la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `idsMotsClefs` | `string | string[]` | Les identifiants des mots-clefs à ajouter. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({  licence: "ODBl-1_0" });

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderNomMotClef({
    idMotClef,
    nom: "Hydrologie",
    langue: "fr"
})

await client.bds.ajouterMotsClefsBd({ 
    idBd, 
    idsMotsClefs: idMotClef
});
```

### `client.bds.effacerMotClefBd({ idBd, idMotClef })`
Enlève un mot-clef de la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `idMotClef` | `string` | L'identifiant du mot-clef à enlever. |

#### Exemple
```ts
// En continuant de ci-dessus...

await client.bds.effacerMotClefBd({ 
    idBd, 
    idMotClef
});
```

### `client.bds.suivreMotsClefsBd({ idBd, f })`
Suit les mots-clefs associés à la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `f` | `(motsClefs: string[]) => void` | Une fonction qui sera appelée avec la liste des identifiants des mots-clefs associés à la base de données chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const motsClefs = ref<string[]>();

const fOublierMotsClefs = await client.bds.suivreMotsClefsBd({ 
    idBd,
    f: x => motsClefs.value = x,
});

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderNomMotClef({
    idMotClef,
    nom: "Hydrologie",
    langue: "fr"
})

await client.bds.ajouterMotsClefsBd({ 
    idBd, 
    idsMotsClefs: idMotClef
});

```

## Tableaux
Chaque base de données contient un ou plusieurs [tableaux](./tableaux.md), lesquels à leur tour contiennent vos données. C'est comme les onglets d'une feuille de calcule Excel/LibreOffice.

:::info
**Pour les pros :** Chaque tableau a un identifiant (`idTableau`) unique parmi tout le réseau Constellation, de même qu'une `clef` qui, elle, peut être partagée entre différentes bases de données (mais pas dans la même base de données). Cette clef est utile pour combiner ou comparer les données de différentes bases de données suivant toutes le même schéma, car les identifiants `idTableau` des tableaux sur différentes bases de données, étant tous différents, ne peuvent pas être utiliser pour identifier les tableaux correspondants.
:::

### `client.bds.ajouterTableauBd({ idBd, clefTableau })`
Ajoute un nouveau tableau à la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `clefTableau` | `string | undefined` | La clef du tableau. Si non spécifiée, Constellation en générera une de manière aléatoire. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({  licence: "ODBl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });

```

### `client.bds.spécifierClefTableau({ idBd, idTableau, clef })`
Change la clef identifiant un tableau de la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `idTableau` | `string` | L'identifiant du tableau. |
| `clef` | `string` | La nouvelle clef du tableau. Celle-ci ne doit pas déjà exister sur un autre tableau de la même base de données. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idBd = await client.bds.créerBd({  licence: "ODBl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });

await client.bds.spécifierClefTableau({ 
    idBd, 
    idTableau,
    clef: "sites d'observation"
});
```

### `client.bds.effacerTableauBd({ idBd, idTableau })`
Enlève un tableau de la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `idTableau` | `string` | L'identifiant du tableau à enlever. |

#### Exemple
```ts
// En continuant de ci-dessus...

await client.bds.effacerTableauBd({ 
    idBd, 
    idTableau
});
```

### `client.bds.suivreTableauxBd({ idBd, f })`
Suit les tableaux associés à la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `f` | `(tableaux:`[`infoTableauAvecId`](#info-tableaux)[]`) => void` | Une fonction qui sera appelée avec la liste des tableaux de la base de données chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type bds } from "@constl/ipa";

const client = générerClient();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const tableaux = ref<bds.infoTableauAvecId[]>();

const fOublierTableaux = await client.bds.suivreTableauxBd({ 
    idBd,
    f: x => tableaux.value = x,
});

const idTableau = await client.tableaux.ajouterTableauBd({ idBd });

```

## Importation et exportation

## Statut

## BDs uniques

## Types
Plusieurs types sont associés avec les bases de données Constellation.

### Score Bd
L'interface `infoScore` représente les différentes parties du score de qualité d'une base de données.

```ts
interface infoScore {
  accès?: number;
  couverture?: number;
  valide?: number;
  licence?: number;
  total: number;
}
```

### Schéma Bd
Les schémas de bases de données permettent de rapidement créer des bases de données selon un schéma prédéterminé.

```ts
interface schémaSpécificationBd {
  licence: string;
  licenceContenu?: string;
  motsClefs?: string[];
  nuées?: string[];
  statut?: schémaStatut;
  tableaux: {
    cols: {
      idVariable: string;
      idColonne: string;
      index?: boolean;
      optionnel?: boolean;
    }[];
    clef: string;
  }[];
};

```

### Statut
Les bases de données, de même que d'autres objets Constellation, peuvent avoi différents statuts de développement. La valeur par défaut est `active`.

```ts
enum TYPES_STATUT {
    INTERNE = "interne",
    BÊTA = "bêta",
    ACTIVE = "active",
    OBSOLÈTE = "obsolète",
}

type schémaStatut = {
    statut: TYPES_STATUT;
    idNouvelle?: string;
};
```

### Info tableaux
Ces types représentent la spécification d'un tableau et sa position dans la base de données.

```ts
type infoTableau = {
  clef: string;
  position: number;
};
type infoTableauAvecId = infoTableau & { id: string }
```
