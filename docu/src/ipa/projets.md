# Projets
Les projets Constellation vous permettent de regrouper des différentes bases de données qui portent sur le même thème (par exemple, fluviologie du monde, ou agronomie des vergers).

[[toc]]

## Général
Actions générales pour gérer vos projets.

### `client.projets.suivreProjets({ f })`
Recherche les projets appartenant au compte présent. Pour rechercher des bases ded données d'autres utilisatrices sur le réseau Constellation, voir la section [réseau](./réseau.md).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(projets: string[]) => void` | Cette fonction sera appelée avec la liste des identifiants des projets chaque fois que celle-ci est modifiée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const projets = ref<string[]>();
await client.projets.suivreProjets({ f: x => projets.value = x });

```

### `client.projets.créerProjet()`
Crée un nouveau projet .

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant du nouveau projet. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();

```

### `client.projets.copierProjet({ idProjet })`
Crée une copie d'un projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet à copier. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'identifiant du nouveau projet. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();
const idCopie = await client.projets.copierProjet({ idProjet });

```

### `client.projets.inviterAuteur({ idProjet, idCompteAuteur, rôle })`
Inviter une autre utilisatrice à modifier un projet vous appartenant. Attention ! Une fois invitée, une personne ne peut pas être désinvitée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `idCompteAuteur` | `string` | L'identifiant du compte de la personne à inviter. |
| `rôle` | `"MODÉRATEUR" | "MEMBRE"` | Le rôle pour lequel vous invitez la personne. Tous pourront modifier le projet ; si `"MODÉRATEUR"`, elle pourra également inviter d'autres auteurs. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();
await client.projets.inviterAuteur({ 
    idProjet, 
    idCompteAuteur: "idDuCompteDeMonAmieÀQuiJeFaisTrèsConfiance",
    rôle: "MODÉRATEUR" 
});

```

### `client.projets.effacerProjet({ idProjet })`
Effacer un projet. Étant donné la structure distribuée de Constellation, cette action effacera le projet de votre dispositif, mais ne pourra pas forcer les autres membres du réseau à l'effacer également.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet à effacer. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();
await client.projets.effacerProjet({ idProjet });

```

### `client.projets.suivreQualitéProjet({ idProjet })`
Suivre une mesure (subjective, de 0 à 1) de la qualité d'un projet. 1 indique la meilleure qualité.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `f` | `(qualité: number) => void` | Une fonction qui sera appelée avec la qualité du projet chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const idProjet = await client.projets.créerProjet();

const qualité = ref<number>();
const fOublierSuivi = await client.projets.suivreQualitéProjet({ 
    idProjet,
    f: x => qualité.value = x
});

```

## Noms
Dans Constellation, chaque projet est défini par un code identifiant et peut ensuite être nommé dans autant de langues que vous le souhaitez.

### `client.projets.sauvegarderNomProjet({ idProjet, langue, nom })`
Sauvegarde le nom du projet dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `nom` | `string` | Le nom du projet. |
| `langue` | `string` | La langue du nom. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();
await client.projets.sauvegarderNomProjet({
    idProjet, 
    langue: "fr", 
    nom: "Hydrologie fluviale" 
});

```

### `client.projets.sauvegarderNomsProjet({ idProjet, noms })`
Sauvegarde le nom du projet dans plusieurs langues en même temps.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `noms` | `{ [langue: string]: string }` | Les noms du projet, indexés par langue. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();
await client.projets.sauvegarderNomsProjet({ 
    idProjet, 
    noms: { fr: "Hydrologie fluviale", த: "ஆறு நீரியல்"}
});

```

### `client.projets.effacerNomProjet({ idProjet, langue })`
Efface la traduction du nom du projet dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `langue` | `string` | La langue dont ont doit effacer le nom. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();
await client.projets.effacerNomProjet({ idProjet, langue: "fr" });
```


### `client.projets.suivreNomsProjet({ idProjet, f })`
Suit les noms (traduits en différentes langues) du projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `f` | `(noms: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les noms du projet chaque fois qu'ils changent|

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();

const fOublierNoms = await client.projets.suivreNomsProjet({ 
    idProjet,
    f: async noms => {
        console.log(noms);
        await fOublierNoms();
    }
});

await client.projets.sauvegarderNomsProjet({ 
    idProjet, 
    noms: { fr: "Hydrologie fluviale", த: "ஆறு நீரியல்"}
});

```


## Descriptions
Dans Constellation, chaque projet peut aussi être accompagné d'une description plus informative.

### `client.projets.sauvegarderDescriptionProjet({ idProjet, langue, nom })`
Sauvegarde la description du projet dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `description` | `string` | La description du projet. |
| `langue` | `string` | La langue de la description. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();
await client.projets.sauvegarderDescriptionProjet({
    idProjet, 
    langue: "fr", 
    description: "Projet regroupant des bases de données d'hydrologie fluviale." 
});

```

### `client.projets.sauvegarderDescriptionsProjet({ idProjet, descriptions })`
Sauvegarde la description d'un projet dans plusieurs langues en même temps.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `descriptions` | `{ [langue: string]: string }` | Les descriptions du projet, indexées par langue. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();
await client.projets.sauvegarderDescriptionsProjet({ 
    idProjet, 
    descriptions: { 
        fr: "Projet regroupant des bases de données d'hydrologie fluviale.", 
        த: "ஆறு நீரியல் தரவுகள் சேர்க்கும் ஒரு திட்டம்."
    }
});

```

### `client.projets.effacerDescriptionProjet({ idProjet, langue })`
Efface la traduction d'une description du projet dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `langue` | `string` | La langue dont ont doit effacer la description. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();
await client.projets.effacerDescriptionProjet({ idProjet, langue: "fr" });
```

### `client.projets.suivreDescriptionsProjet({ idProjet, f })`
Suit les descriptions (traduites en différentes langues) du projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `f` | `(descriptions: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les descriptions du projet chaque fois qu'elles changent|

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();

const fOublierDescriptions = await client.projets.suivreDescriptionsProjet({ 
    idProjet,
    f: async descrs => {
        console.log(descrs);
        await fOublierDescriptions();
    }
});

await client.projets.sauvegarderDescriptionProjet({ 
    idProjet, 
    langue: "த",
    description: "ஆறு நீரியல் தரவுகள் சேர்க்கும் ஒரு திட்டம்."
});
```

## Image
Les projets peuvent être avoir une image décorative qui apparaîtra sur l'interface.

### `client.projets.sauvegarderImage({ idProjet, image })`
Sauvegarde une image décorative.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `image` | `import("ipfs-core-types/src/utils").ImportCandidate` | L'image. |

#### Exemple
```ts

import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();

const image = fs.readFileSync("mon image locale.jpeg");
await client.projets.sauvegarderImage({ idProjet, image });

```

### `client.projets.effacerImage({ idProjet })`
Efface l'image du projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |

#### Exemple
```ts
// ...continuant de ci-dessus...

await client.projets.effacerImage( { idProjet });
```

### `client.projets.suivreImage({ idProjet, f })`
Suit l'image du projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `f` | `(image: Uint8Array | null) => void` | Une fonction qui sera appelée avec l'image chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from 'vue';
import { générerClient } from "@constl/ipa";

const client = générerClient();

const idProjet = await client.projets.créerProjet();

const image = ref<Uint8Array | null>();
const fOublierImage = await client.projets.suivreImage({ f: x => image.value = x });

await fOublierImage();
```

## Bases de données
Chaque projet Constellation regroupe plusieurs [bases de données](./bds.md).

### `client.projets.ajouterBdProjet({ idProjet, idBd })`
Ajoute des mots-clefs au projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `idBd` | `string \| string[]` | L'identifiant de la base de donnée à ajouter. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();
const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });

await client.projets.ajouterBdProjet({ 
    idProjet, 
    idBd
});
```

### `client.projets.effacerBdProjet({ idProjet, idBd })`
Enlève une base de données du projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `idBd` | `string` | L'identifiant de la base de données à enlever. |

#### Exemple
```ts
// En continuant de ci-dessus...

await client.projets.effacerBdProjet({ 
    idProjet, 
    idBd
});
```

### `client.projets.suivreBdsProjet({ idProjet, f })`
Suit les bases de données associées au projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `f` | `(bds: string[]) => void` | Une fonction qui sera appelée avec la liste des identifiants des bases de données associées au projet chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const idProjet = await client.projets.créerProjet();

const bdsProjet = ref<string[]>();

const fOublierBds = await client.projets.suivreBdsProjet({ 
    idProjet,
    f: x => bdsProjet.value = x,
});

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
await client.projets.ajouterBdProjet({ 
    idProjet, 
    idBd
});
```

## Mots-clefs
Chaque projet Constellation peut être associé avec plusieurs [mots-clefs](./motsClefs.md).

### `client.projets.ajouterMotsClefsProjet({ idProjet, idsMotsClefs })`
Ajoute des mots-clefs au projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `idsMotsClefs` | `string \| string[]` | Les identifiants des mots-clefs à ajouter. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderNomMotClef({
    idMotClef,
    nom: "Hydrologie",
    langue: "fr"
})

await client.projets.ajouterMotsClefsProjet({ 
    idProjet, 
    idsMotsClefs: idMotClef
});
```

### `client.projets.effacerMotClefProjet({ idProjet, idMotClef })`
Enlève un mot-clef du projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `idMotClef` | `string` | L'identifiant du mot-clef à enlever. |

#### Exemple
```ts
// En continuant de ci-dessus...

await client.projets.effacerMotClefProjet({ 
    idProjet, 
    idMotClef
});
```

### `client.projets.suivreMotsClefsProjet({ idProjet, f })`
Suit les mots-clefs associés au projet, soit directement, soit indirectement à travers les mots-clefs des bases de données incluses dans le projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `f` | `(motsClefs: {idMotClef: string, source: "projet" | "bds"}[]) => void` | Une fonction qui sera appelée avec la liste des identifiants des mots-clefs associés au projet chaque fois que celle-ci change. `source` indique si le mot-clef vient directement du projet lui-même, ou bien indirectement des mots-clefs des bases de données incluses dans le projet. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const idProjet = await client.projets.créerProjet();

const motsClefs = ref<{idMotClef: string, source: "projet" | "bds"}[]>();

const fOublierMotsClefs = await client.projets.suivreMotsClefsProjet({ 
    idProjet,
    f: x => motsClefs.value = x,
});

const idMotClefHydrologie = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderNomMotClef({
    idMotClef,
    nom: "Hydrologie",
    langue: "fr"
})

// Ajouter des mots-clefs directement au projet
await client.projets.ajouterMotsClefsProjet({ 
    idProjet, 
    idsMotsClefs: idMotClefHydrologie
});


// Ajouter des mots-clefs à une base de données
const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idMotClefFluviologie = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderNomMotClef({
    idMotClef,
    nom: "Fluviologie",
    langue: "fr"
});
await client.bds.ajouterMotsClefsBd({ 
    idBd, idsMotsClefs: idMotClefFluviologie 
});

// Ajouter la base de données au projet
await client.projets.ajouterBdProjet({ idProjet, idBd });

```

## Variables
Les variables ne peuvent pas être ajoutées directement à un projet, sinon à ses [bases de données](./bds.md) de celle-ci. Cependant, vous pouvez suivre la liste de variables associées à un projet.

### `client.projets.suivreVariablesProjet({ idProjet, f })`
Suit les variables associées au projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `f` | `(variables: string[]) => void` | Une fonction qui sera appelée avec la liste des identifiants des variables associées au projet chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const idProjet = await client.projets.créerProjet();

const variables = ref<string[]>();
const fOublierVariables = await client.projets.suivreVariablesProjet({ 
    idProjet,
    f: x => variables.value = x,
});

// Ajouter des variables à une base de données
const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });
const idVariableNumérique = await client.variables.créerVariable({ catégorie: "numérique" });
await client.tableaux.ajouterColonneTableau({
    idTableau,
    idVariable: idVariableNumérique,
});

// Ajouter la base de données au projet
await client.projets.ajouterBdProjet({ idProjet, idBd });

```

## Exportation données
Vous pouvez exporter des données d'un projet Constellation vers un autre format (Excel, LibreOffice ou autre).

### `client.projets.exporterDonnées({ idProjet, langues, nomFichier })`
Exporte les données d'une le projet mais ne le sauvegarde pas immédiatement au disque.

:::tip ASTUCE
Vous pouvez également [automatiser](./automatisations.md) ces actions !
:::

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `langues` | `string[] \| undefined` | Si vous voulez que les colonnes et les tableaux portent leurs noms respectifs au lieu de leurs identifiants uniques, la liste de langues (en ordre de préférence) dans laquelle vous souhaitez recevoir les données. Une liste vide utilisera, sans préférence, n'importe quelle langue parmi celles disponibles. |
| `nomFichier` | `string \| undefined` | Le nom du fichier que vous voulez créer. Si non spécifier, Constellation utilisera le nom du projet si `langues !== undefined` ou, à défaut, l'identifiant unique du projet. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<`[`donnéesProjetExportées`](#types-exportation)`>` | Les données exportées, prètes à être écrites à un fichier de votre choix. |


#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();

// ... ajouter des bases de données ...

const donnéesExportées = await client.projets.exporterDonnées({ 
    idProjet, 
    langues: ["fr", "த", "kaq"]
});

// Faire quelque chose avec le document

```

### `client.projets.exporterDocumentDonnées({ données, formatDoc, dossier, inclureFichiersSFIP })`
Prend les données exportées par [`client.projets.exporterDonnées`](#clientprojetsexporterdonnées-idprojet-langues-nomfichier) et les sauvegarde sur le disque.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `données` | [`donnéesProjetExportées`](#donnees-exportees) | Les données déjà exportées. |
| `formatDoc` | `xlsx.BookType \| "xls"` | Le format du fichier (`odt`, `xlsx`, `csv`, `txt` ou n'importe quel autre type supporté par [SheetJS](https://docs.sheetjs.com/docs/api/write-options/#supported-output-formats). |
| `dossier` | `string \| undefined` | Le dossier (optionnel) où sauvegarder les données. |
| `inclureFichiersSFIP` | `boolean` | Si nous voulons sauvegarder les fichiers (images, vidéos ou autres) incluses dans le projet. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<string>` | L'adresse du fichier créé. |


#### Exemple
```ts
// ... continuant de ci-dessus ...

const adresseFichier = await client.projets.exporterDocumentDonnées({ 
    données: donnéesExportées,
    formatDoc: "ods",  // ou bien "xlsx",
    dossier: "./mes données exportées"
});

// Vous pouvez maintenant ouvrir le document `adresseFichier`.

```

## Statut
Les projets peuvent être identifiées en tant qu'actifs, bêta, obsolètes ou bien internes à une autre application.

### `client.projets.changerStatutProjet({ idProjet, statut })`
Change le statut du projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `statut` | [`schémaStatut`](#statut-1) | Le statut du projet. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();

await client.projets.changerStatutProjet({ 
    idProjet, 
    statut: {
        statut: "interne"
    }
});
```

### `client.projets.marquerObsolète({ idProjet, idNouvelle })`
Indique que le projet est maintenant obsolète.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `idNouvelle` | `string \| undefined` | L'identifiant (optionnel) d'un nouveau projet qui reprendra le rôle du projet obsolète. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();

const idNouvelle = await client.projets.créerProjet();
await client.projets.marquerObsolète({ 
    idProjet, 
    idNouvelle
});
```

### `client.projets.marquerActif({ idProjet })`
Indique que le projet est actif (pas obsolète).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();

await client.projets.marquerActive({ idProjet });
```

### `client.projets.marquerBêta({ idProjet })`
Indique que le projet est en phase d'essaie (bêta).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();

await client.projets.marquerBêta({ idProjet });
```

### `client.projets.marquerInterne({ idProjet })`
Indique que le projet est un projet interne pour une application tièrce et ne devrait probablement pas être directement visible à l'utilisateur ou bien modifiable à la main.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |

#### Exemple
```ts
import { générerClient } from "@constl/ipa";
const client = générerClient();

const idProjet = await client.projets.créerProjet();

await client.projets.marquerInterne({ idProjet });
```

### `client.projets.suivreStatutProjet({ idProjet, f })`
Suit le statut du projet.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant du projet. |
| `f` | `(statut:`[`schémaStatut`](#statut-1)`) => void` | Une fonction qui sera appelée avec le statut du projet chaque fois que celui-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { générerClient, type types } from "@constl/ipa";
import { ref } from "vue";

const client = générerClient();

const idProjet = await client.projets.créerProjet();

const statut = ref<types.schémaStatut>();
const fOublierStatut = await client.projets.suivreStatutProjet({ 
    idProjet,
    f: x => statut.value = x,
});

const idTableau = await client.projets.marquerBêta({ idProjet });

```

## Types

### Types exportation
L'interface `donnéesProjetExportées` représente des données exportées d'un projet.

```ts
interface donnéesProjetExportées {
  docs: { doc: WorkBook; nom: string }[];
  fichiersSFIP: Set<{ cid: string; ext: string }>;
  nomFichier: string;
}
```
