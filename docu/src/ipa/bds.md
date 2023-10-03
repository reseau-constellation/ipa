# Bases de données
Les bases de données Constellation sont comme des feuilles de calcul Excel ou LibreOffice Calc, avec des tableaux et des colonnes. En plus, elles se mettent automatiquement à jour sur tous vos dispositifs. C'est comme les feuilles de calcul Google Sheets, mais sans le Google.

Elles peuvent également contenir des types de données nos supportés par Excel et compagnie, tels les images, les fichiers audios et autres.

[[toc]]

## Général
Actions générales pour gérer vos bases de données.

### `client.bds.suivreBds({ f })`
Recherche les bases de données appartenant au compte présent. Pour rechercher des bases de données d'autres utilisateurs sur le réseau Constellation, voir la section [réseau](./réseau.md).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(bds: string[]) => void` | Cette fonction sera appelée avec la liste des identifiants des bases de données chaque fois que celle-ci est modifiée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

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
const client = générerClient({});

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
| `copierDonnées` | `boolean \| undefined` | Si on copie aussi les données de la base de données (ou bien juste sa structure). Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant de la nouvelle base de données. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
const idCopie = await client.bds.copierBd({ idBd });

```

### `client.bds.créerBdDeSchéma({ schéma })`
Crée une base de données à partir d'une spécification de schéma.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `schéma` | [`schémaSpécificationBd`](#schema-bd) | Le schéma à utiliser. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant de la nouvelle base de données. |

#### Exemple
```ts
import { générerClient, type bds } from "@constl/ipa";
const client = générerClient({});

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
const client = générerClient({});

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
const client = générerClient({});

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
await client.bds.effacerBd({ idBd });

```

### `client.bds.suivreQualitéBd({ idBd, f })`
Suivre une mesure (subjective, de 0 à 1) de la qualité d'une base de données. 1 indique la meilleure qualité.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `f` | `(qualité:` [`infoScore`](#score-bd) `) => void` | Une fonction qui sera appelée avec la qualité de la base de données chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type bds } from "@constl/ipa";

const client = générerClient({});

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const qualité = ref<bds.infoScore>();
const fOublierSuivi = await client.bds.suivreQualitéBd({ 
    idBd,
    f: x => qualité.value = x
});

```

## Noms
Dans Constellation, chaque base de données est définie par un code identifiant et peut ensuite être nommée dans autant de langues que vous le souhaitez.

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
const client = générerClient({});

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
const client = générerClient({});

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
const client = générerClient({});

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
await client.bds.effacerNomBd({ idBd, langue: "fr" });
```


### `client.bds.suivreNomsBd({ idBd, f })`
Suit les noms (traduits en différentes langues) de la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `f` | `(noms: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les noms de la base de données chaque fois qu'ils changent. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

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
Dans Constellation, chaque base de données peut aussi être accompagnée d'une description plus informative.

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
const client = générerClient({});

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
const client = générerClient({});

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
const client = générerClient({});

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
await client.bds.effacerDescriptionBd({ idBd, langue: "fr" });
```

### `client.bds.suivreDescriptionsBd({ idBd, f })`
Suit les descriptions (traduites en différentes langues) de la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `f` | `(descriptions: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les descriptions de la base de données chaque fois qu'elles changent. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

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
    langue: "த",
    description: "பல்கலைக்கழக சோதனையில் ஒரு சிறுதானிய பயிரின் வளர்ச்சி தகவல்கள்"
});

```

## Image
Les bases de données peuvent être avoir une image décorative qui apparaîtra sur l'interface.

### `client.bds.sauvegarderImage({ idBd, image })`
Sauvegarde une image décorative.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `image` | `import("ipfs-core-types/src/utils").ImportCandidate` | Le fichier de l'image. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const image = fs.readFileSync("mon image locale.jpeg");
await client.bds.sauvegarderImage({ idBd, image });

```

### `client.bds.effacerImage({ idBd })`
Efface l'image de la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |

#### Exemple
```ts
// ...continuant de ci-dessus...

await client.bds.effacerImage( { idBd });
```

### `client.bds.suivreImage({ idBd, f })`
Suit l'image de la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
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

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const image = ref<Uint8Array | null>();
const fOublierImage = await client.bds.suivreImage({ 
    idBd,
    f: x => image.value = x,
});

await fOublierImage();
```

## Licences
Chaque base de données dans Constellation doit être associée à une licence qui explique les conditions d'utilisation des données qu'elle contient. 

:::tip ASTUCE
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
const client = générerClient({});

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });
await client.bds.changerLicenceBd({ idBd, licence: "ODC-BY-1_0" });
```

### `client.bds.changerLicenceContenuBd({ idBd, licenceContenu })`
Change la licence des fichiers (images, vidéos ou autres) contenus dans la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `licenceContenu` | `string \| undefined` | Le code de la nouvelle licence pour le contenu. Si `undefined`, la licence sera effacée et le contenu donc disponible sous la même licence que la base de données elle-même. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

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
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

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
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

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
Chaque base de données Constellation peut être associée avec plusieurs [mots-clefs](./motsClefs.md).

### `client.bds.ajouterMotsClefsBd({ idBd, idsMotsClefs })`
Ajoute des mots-clefs à la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `idsMotsClefs` | `string \| string[]` | Les identifiants des mots-clefs à ajouter. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

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
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

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

## Variables
Les variables ne peuvent pas être ajoutées directement à une base de données, sinon aux [tableaux](./tableaux.md#colonnes) de celle-ci. Cependant, vous pouvez suivre la liste de variables associées à une base de données.

### `client.bds.suivreVariablesBd({ idBd, f })`
Suit les variables associées à la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `f` | `(variables: string[]) => void` | Une fonction qui sera appelée avec la liste des identifiants des variables associées à la base de données chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const variables = ref<string[]>();

const fOublierVariables = await client.bds.suivreVariablesBd({ 
    idBd,
    f: x => variables.value = x,
});

const idTableau = await client.bds.ajouterTableauBd({ idBd });
const idVariableNumérique = await client.variables.créerVariable({ catégorie: "numérique" });
await client.tableaux.ajouterColonneTableau({
    idTableau,
    idVariable: idVariableNumérique,
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
| `clefTableau` | `string \| undefined` | La clef du tableau. Si non spécifiée, Constellation en générera une de manière aléatoire. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

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
const client = générerClient({});

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
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type bds } from "@constl/ipa";

const client = générerClient({});

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const tableaux = ref<bds.infoTableauAvecId[]>();

const fOublierTableaux = await client.bds.suivreTableauxBd({ 
    idBd,
    f: x => tableaux.value = x,
});

const idTableau = await client.tableaux.ajouterTableauBd({ idBd });

```

## Importation et exportation
Vous pouvez exporter des données Constellation vers un autre format (Excel, LibreOffice ou autre).

:::tip ASTUCE
Pour ce qui est de l'importation de données, celle-ci s'effectue directement sur les [tableaux eux-mêmes](./tableaux.md#importation-et-exportation).
:::

### `client.bds.exporterDonnées({ idBd, langues, nomFichier })`
Exporte les données d'une la base de données mais ne le sauvegarde pas immédiatement au disque.

:::tip ASTUCE
Vous pouvez également [automatiser](./automatisations.md) ces actions !
:::

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `langues` | `string[] \| undefined` | Si vous voulez que les colonnes et les tableaux portent leurs noms respectifs au lieu de leurs identifiants uniques, la liste de langues (en ordre de préférence) dans laquelle vous souhaitez recevoir les données. Une liste vide utilisera, sans préférence, n'importe quelle langue parmi celles disponibles. |
| `nomFichier` | `string \| undefined` | Le nom du fichier que vous voulez créer. Si non spécifié, Constellation utilisera le nom de la base de données si `langues !== undefined` ou, à défaut, l'identifiant unique de la base de données. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<`[`donnéesBdExportées`](#donnees-exportees)`>` | Les données exportées, prètes à être écrites à un fichier de votre choix. |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idBd = await client.bds.créerBd({  licence: "ODBl-1_0" });

// ... créer des tableaux et ajouter des données ...

const donnéesExportées = await client.bds.exporterDonnées({ 
    idBd, 
    langues: ["fr", "த", "kaq"]
});

// Faire quelque chose avec le document

```

### `client.bds.exporterDocumentDonnées({ données, formatDoc, dossier, inclureFichiersSFIP })`
Prend les données exportées par [`client.bds.exporterDonnées`](#clientbdsexporterdonnées-idbd-langues-nomfichier) et les sauvegarde sur le disque.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `données` | [`donnéesBdExportées`](#donnees-exportees) | Les données déjà exportées. |
| `formatDoc` | `xlsx.BookType \| "xls"` | Le format du fichier (`odt`, `xlsx`, `csv`, `txt` ou n'importe quel autre type supporté par [SheetJS](https://docs.sheetjs.com/docs/api/write-options/#supported-output-formats). |
| `dossier` | `string \| undefined` | Le dossier (optionnel) où sauvegarder les données. |
| `inclureFichiersSFIP` | `boolean` | Si nous voulons sauvegarder les fichiers (images, vidéos ou autres) incluses dans la base de données. Si oui, le tout sera sauvegardé en tant que fichier `zip`. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'adresse du fichier créé. |


#### Exemple
```ts
// ... continuant de ci-dessus ...

const adresseFichier = await client.bds.exporterDocumentDonnées({ 
    données: donnéesExportées,
    formatDoc: "ods",  // ou bien "xlsx",
    dossier: "./mes données exportées"
});

// Vous pouvez maintenant ouvrir le document `adresseFichier`.

```

## Statut
Les bases de données peuvent être identifiées en tant qu'actives, bêta, obsolètes ou bien internes à une autre application.

### `client.bds.changerStatutBd({ idBd, statut })`
Change le statut de la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `statut` | [`schémaStatut`](#statut-1) | Le statut de la base de données. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idBd = await client.bds.créerBd({  licence: "ODBl-1_0" });

await client.bds.changerStatutBd({ 
    idBd, 
    statut: {
        statut: "interne"
    }
});
```

### `client.bds.marquerObsolète({ idBd, idNouvelle })`
Indique que la base de données est maintenant obsolète.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `idNouvelle` | `string \| undefined` | L'identifiant (optionnel) d'une nouvelle base de données qui reprendra le rôle de la base de données obsolète. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idBd = await client.bds.créerBd({  licence: "ODBl-1_0" });

const idNouvelle = await client.bds.créerBd({  licence: "ODBl-1_0" });
await client.bds.marquerObsolète({ 
    idBd, 
    idNouvelle
});
```

### `client.bds.marquerActive({ idBd })`
Indique que la base de données est active (pas obsolète).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idBd = await client.bds.créerBd({  licence: "ODBl-1_0" });

await client.bds.marquerActive({ idBd });
```

### `client.bds.marquerBêta({ idBd })`
Indique que la base de données est en phase d'essaie (bêta).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idBd = await client.bds.créerBd({  licence: "ODBl-1_0" });

await client.bds.marquerBêta({ idBd });
```

### `client.bds.marquerInterne({ idBd })`
Indique que la base de données est une base de données interne pour une application tièrce et ne devrait probablement pas être directement visible à l'utilisateur ou bien modifiable à la main.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idBd = await client.bds.créerBd({  licence: "ODBl-1_0" });

await client.bds.marquerInterne({ idBd });
```

### `client.bds.suivreStatutBd({ idBd, f })`
Suit le statut de la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `f` | `(statut:`[`schémaStatut`](#statut-1)`) => void` | Une fonction qui sera appelée avec le statut de la base de données chaque fois que celui-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { générerClient, type utils } from "@constl/ipa";
import { ref } from "vue";

const client = générerClient({});

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const statut = ref<utils.schémaStatut>();
const fOublierStatut = await client.bds.suivreStatutBd({ 
    idBd,
    f: x => statut.value = x,
});

const idTableau = await client.bds.marquerBêta({ idBd });

```

## Nuées
Une base de données peut être associée à une ou plusieurs [nuées](./nuées.md) qui permettent de regrouper des données - ayant le même format - de plusieurs utilisatrices de Constellation.

### `client.bds.rejoindreNuées({ idBd, idsNuées })`
Associer la base de données à des nuées.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `idsNuées` | `string \| string[]` | Les identifiants des nuées à ajouter. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient({});

const idBd = await client.bds.créerBd({  licence: "ODBl-1_0" });

const idNuée = await client.nuées.créerNuée();

await client.bds.rejoindreNuées({ 
    idBd, 
    idsNuées: [idNuée]
});
```

### `client.bds.quitterNuée({ idBd, idNuée })`
Dissocie une la base de données de la nuée spécifiée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `idNuée` | `string` | L'identifiant de la nuée à dissocier. |

#### Exemple
```ts
// En continuant de ci-dessus...

await client.bds.quitterNuée({ 
    idBd, 
    idNuée
});
```

### `client.bds.suivreNuéesBd({ idBd, f })`
Suit les nuées associées à la base de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de données. |
| `f` | `(nuées: string[]) => void` | Une fonction qui sera appelée avec la liste des identifiants des nuées associées à la base de données chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient({});

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const nuées = ref<string[]>();
const fOublierNuées = await client.bds.suivreNuéesBd({ 
    idBd,
    f: x => nuées.value = x,
});

```



suivreNuéesBd


## BDs uniques
:::tip ASTUCE
Cette section est vraiment pour les pros. Si c'est votre première fois, passez donc à autre chose. Pas de soucis. :)
:::

Constellation, étant distribué, vous permet de travailler hors ligne. Si vous avez plusieurs dispositifs, ceux-ci syncroniseront automatiquement vos données lorsque vous les reconnecterez.

Cependant, une situation cause problème : que faire avec les applications tièrces qui dépendent d'une base de données spéciale pour fonctionner ? Si vous développez une application de collecte de données hydrologiques par science citoyenne, chacune de vos utilisatrices devrait avoir une seule base de données pour sauvegarder ses observations. Si elle se connecte sur son téléphone et sur son ordinateur, comment Constellation pourra-t-elle savoir que les bases de données créées de manière indépendante sur les deux dispositifs sont en réalité la même base de données et doivent être fusionnnées ?

C'est là que servent les bases de données uniques, qui sont associées à une [nuée](./nuées.md) unique. Constellation s'assurera que chaque compte d'utilisateur n'aura qu'une seule base de données associée à cette nuée, et, si elle en détecte plus qu'une, fusionnera les données qu'elles contiennent.

:::warning AVERTISSEMENT
Constellation fusionnera automatiquement toutes les bases de données appartenant au même compte et qui sont associées à la nuée unique. **N'utilisez donc pas une nuée qui est utilisée pour d'autres projets !** Si vous voulez, vous pouvez bien évidemment associer la base de données à plusieurs nuées existantes (à spécifier dans le `schémaBd`) et utiliser une copie personnelle d'une d'entres elles pour la nuée unique (`idNuéeUnique`).
:::

### `client.bds.suivreDonnéesDeTableauUnique({ schémaBd, idNuéeUnique, clefTableau, f })`
Suit les données d'un tableau d'une base de données unique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `schémaBd` | [`schémaSpécificationBd`](#schema-bd) | Le schéma de spécification de la base de données. Il sera utilisé pour créer la base de données si elle n'existe pas encore. |
| `idNuéeUnique` | `string` | L'identifiant de la nuée à laquelle une seule base de données par compte peut appartenir. Doit exister dans `schémaBd`. |
| `clefTableau` | `string` | La clef du tableau dont nous voulons suivre les données. Doit exister dans `schémaBd`. |
| `f` | `(données:`[`élémentDonnées`](./tableaux.md#types-donnees)`[]) => void` | La fonction qui sera appellée avec les données du tableau chaque fois que ceux-ci changent. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type bds, type tableaux } from "@constl/ipa";

const client = générerClient({});

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

// Créer notre nuée
const CLEF_TABLEAU = "tableau observations"; 
const idNuéeUnique = await client.nuées.créerNuée()
const idTableau = await client.nuées.ajouterTableauNuée({
    idNuée,
    clefTableau: CLEF_TABLEAU
});
await client.nuées.ajouterColonneTableauNuée({
    idTableau,
    idVariable: idVarSite,
    idColonne: "site",
    index: true
});
await client.nuées.ajouterColonneTableauNuée({
    idTableau,
    idVariable: idVarDate,
    idColonne: "date",
    index: true
});
await client.nuées.ajouterColonneTableauNuée({
    idTableau,
    idVariable: idVarImage,
    idColonne: "image",
});

// Créer le schéma
const schémaBd = await client.nuées.générerSchémaBdNuée({
    idNuée: idNuéeUnique,
    licence: "ODbl-1_0"
});

// Enfin, suivre les données
const données = ref<tableaux.élémentDonnées[]>();
const fOublierDonnées = await client.bds.suivreDonnéesDeTableauUnique({ 
    schémaBd, 
    idNuéeUnique, 
    clefTableau: CLEF_TABLEAU,
    f: x => données.value = x,
 });

```

### `client.bds.ajouterÉlémentÀTableauUnique({ schémaBd, idNuéeUnique, clefTableau, vals })`
Ajoute un élément à un tableau d'une base de données unique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `schémaBd` | [`schémaSpécificationBd`](#schema-bd) | Le schéma de spécification de la base de données. Il sera utilisé pour créer la base de données si elle n'existe pas encore. |
| `idNuéeUnique` | `string` | L'identifiant de la nuée à laquelle une seule base de données par compte peut appartenir. Doit exister dans `schémaBd`. |
| `clefTableau` | `string` | La clef du tableau auquel nous voulons ajouter des données. Doit exister dans `schémaBd`. |
| `vals` | [`élémentBdListeDonnées | élémentBdListeDonnées`](./tableaux.md#types-donnees) `[]` | Les données à ajouter. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string[]>` | Les identifiants unique des éléments ajoutés. |

#### Exemple
```ts
// ...continuant de ci-dessus...

const image = ref<File>()  // L'image sera sélectionnée par l'utilisateur dans l'interface
const site = ref<string>() // Pareil pour le site de l'observation

const idsÉléments = ref<string[]>();

const sauvegarderDonnées = async () => {
    if (!image.value || !site.value) return  // Arrêter ici si l'image ou le site n'ont pas encore été sélectionnés
    idsÉléments.value = await client.bds.ajouterÉlémentÀTableauUnique({ 
        schémaBd, 
        idNuéeUnique, 
        clefTableau: CLEF_TABLEAU,
        vals: {
            "site": site.value,
            "date": Date.now(),
            "image": image.value ,
        },
    });
};
```

### `client.bds.modifierÉlémentDeTableauUnique({ schémaBd, idNuéeUnique, clefTableau, vals, idÉlément })`
Modifie un élément d'un tableau d'une base de données unique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `schémaBd` | [`schémaSpécificationBd`](#schema-bd) | Le schéma de spécification de la base de données. Il sera utilisé pour créer la base de données si elle n'existe pas encore. |
| `idNuéeUnique` | `string` | L'identifiant de la nuée à laquelle une seule base de données par compte peut appartenir. Doit exister dans `schémaBd`. |
| `clefTableau` | `string` | La clef du tableau dont nous voulons modifier des données. Doit exister dans `schémaBd`. |
| `vals` | { [idColonne: string]: [`élémentsBd`](./tableaux.md#types-donnees) \| undefined } | Les données à jour. Si une colonne n'apparaît pas sur `vals`, elle ne sera pas modifiée. Si, au contraire, elle est égale à `undefined`, la valeur correspondante sera effacée. |
| `idÉlément` | `string` | L'identifiant de l'élément à modifier. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant de l'élément modifié. |

#### Exemple
```ts
// ...continuant de ci-dessus...

const nouvelleImage = ref<File>()  // L'image sera sélectionnée par l'utilisateur dans l'interface

const modifierImage = async () => {
    if (!nouvelleImage.value) return  // Arrêter ici si l'image n'a pas encore été sélectionnée
    await client.bds.modifierÉlémentDeTableauUnique({ 
        schémaBd, 
        idNuéeUnique, 
        clefTableau: CLEF_TABLEAU,
        vals: {
            "image": nouvelleImage.value ,
        },
        idÉlément: idsÉléments.value[0],
    });
};
```

### `client.bds.effacerÉlémentDeTableauUnique({ schémaBd, idNuéeUnique, clefTableau, idÉlément })`
Efface un élément d'un tableau d'une base de données unique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `schémaBd` | [`schémaSpécificationBd`](#schema-bd) | Le schéma de spécification de la base de données. Il sera utilisé pour créer la base de données si elle n'existe pas encore. |
| `idNuéeUnique` | `string` | L'identifiant de la nuée à laquelle une seule base de données par compte peut appartenir. Doit exister dans `schémaBd`. |
| `clefTableau` | `string` | La clef du tableau dont nous voulons effacer des données. Doit exister dans `schémaBd`. |
| `idÉlément` | `string` | L'identifiant de la rangée à effacer. |

#### Exemple
```ts
// ...continuant de ci-dessus...

const effacerDonnées = async () => {
    await client.bds.effacerÉlémentDeTableauUnique({ 
        schémaBd, 
        idNuéeUnique, 
        clefTableau: CLEF_TABLEAU,
        idÉlément: idsÉléments.value[0],
    });
};
```

## Types
Plusieurs types sont associés avec les bases de données Constellation.

### Types score BD
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

### Types schéma BD
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

### Types statut
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

### Types info tableaux
Ces types représentent la spécification d'un tableau et sa position dans la base de données.

```ts
type infoTableau = {
  clef: string;
  position: number;
};
type infoTableauAvecId = infoTableau & { id: string }
```

### Types données exportées
Ce type décrit les données exportées d'une base de données Constellation.

```ts
export interface donnéesBdExportées {
  doc: xlsx.WorkBook;
  fichiersSFIP: Set<{ cid: string; ext: string }>;
  nomFichier: string;
}
````
