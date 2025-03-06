# Recherche
L'option recherche de Constellation permet de rechercher des données du réseau Constellation général.

[[toc]]

## Profils
Ces fonctions vous permettent de rechercher des profils du réseau.

### `client.recherche.rechercherProfilSelonId({ idCompte, f, ... })`
Recherche des profils correspondant à un identifiant de compte.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant du compte à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProfilSelonId({
  idCompte: (await client.obtIdCompte()).slice(-5),
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```


### `client.recherche.rechercherProfilSelonNom({ nom, f, ... })`
Recherche des profils selon leur nom.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nom` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProfilSelonNom({
  nom: "moi",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherProfilSelonActivité({ f, ... })`
Recherche des profils selon leur niveau d'activité. Utile pour trouver des profils actifs.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatVide>
>();

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProfilSelonActivité({
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherProfilSelonCourriel({ courriel, f, ... })`
Recherche des profils selon leur courriel.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `courriel` | `string` | Le courriel à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProfilSelonNom({
  courriel: "@mail.mcgill.ca",  // Rechercher les utilisateurs étudiants de McGill
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherProfilSelonTexte({ texte, f, ... })`
Recherche des profils selon tous leurs attributs (nom, contact ou autre).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `texte` | `string` | Le texte à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProfilSelonTexte({
  courriel: "Julien",  // Recherchera les noms et les courriels avec ce texte
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

## Mots-cles
Ces fonctions vous permettent de rechercher des mots-clefs du réseau.

### `client.recherche.rechercherMotsClefs({ f, ... })`
Recherche des mots-clefs du réseau sans aucun critère spécifique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos mots-clefs à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherMotsClefs({
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```


### `client.recherche.rechercherMotsClefsSelonId({ idMotClef, f, ... })`
Recherche des mots-clefs selon leur identifiant unique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos mots-clefs à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idMotClef = await client.motsClefs.créerMotClef();

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherMotsClefs({
  idMotClef: idMotClef.slice(-5),
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherMotsClefsSelonNom({ nomMotClef, f, ... })`
Recherche des mots-clefs selon leur nom.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nomMotClef` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos mots-clefs à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderNomMotClef({ idMotClef, langue: "fr", nom: "hydrologie" });
const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherMotsClefsSelonNom({
  nomMotClef: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherMotsClefsSelonDescr({ descrMotClef, f, ... })`
Recherche des mots-clefs selon leur description.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `descrMotClef` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos mots-clefs à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderDescriptionMotClef({ idMotClef, langue: "fr", description: "hydrologie" });
const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherMotsClefsSelonDescr({
  descrMotClef: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherMotsClefsSelonTexte({ texte, f, ... })`
Recherche tous les champs des mots-clefs.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `texte` | `string` | Le texte à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos mots-clefs à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idMotClef = await client.motsClefs.créerMotClef();
await client.motsClefs.sauvegarderDescriptionMotClef({ idMotClef, langue: "fr", description: "hydrologie" });
const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherMotsClefsSelonTexte({
  descrMotClef: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

## Variables
Ces fonctions vous permettent de rechercher des variables du réseau.

### `client.recherche.rechercherVariables({ f, ... })`
Recherche des variables du réseau sans aucun critère spécifique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos variables à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherVariables({
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```


### `client.recherche.rechercherVariablesSelonId({ idVariable, f, ... })`
Recherche des variables selon leur identifiant unique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos variables à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherVariablesSelonId({
  idVariable: idVariable.slice(-5),
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherVariablesSelonNom({ nomVariable, f, ... })`
Recherche des variables selon leur nom.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nomVariable` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos variables à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.variables.sauvegarderNomVariable({ idVariable, langue: "fr", nom: "précipitation" });
const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherVariablesSelonNom({
  nomVariable: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherVariablesSelonDescr({ descrVariable, f, ... })`
Recherche des variables selon leur description.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `descrVariable` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos variables à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.variables.sauvegarderDescriptionVariable({ idVariable, langue: "fr", description: "précipitation" });
const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherVariablesSelonDescr({
  descrVariable: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherVariablesSelonTexte({ texte, f, ... })`
Recherche tous les champs des variables.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `texte` | `string` | Le texte à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos variables à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idVariable = await client.variables.créerVariable({ catégorie: "image" });
await client.variables.sauvegarderDescriptionVariable({ idVariable, langue: "fr", description: "précipitation" });
const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherVariablesSelonTexte({
  descrVariable: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

## Bases de données
Ces fonctions vous permettent de rechercher des bases de données du réseau.

### `client.recherche.rechercherBds({ f, ... })`
Recherche des bases de données du réseau sans aucun critère spécifique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos bases de données à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherBds({
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```


### `client.recherche.rechercherBdsSelonId({ idBd, f, ... })`
Recherche des bases de données selon leur identifiant unique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos bases de données à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherBdsSelonId({
  idBd: idBd.slice(-5),
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherBdsSelonNom({ nomBd, f, ... })`
Recherche des variables selon leur nom.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nomBd` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos bases de données à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
await client.bds.sauvegarderNomBd({ idBd, langue: "fr", nom: "hydrologie" });
const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherBdsSelonNom({
  nomBd: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherBdsSelonDescr({ descrBd, f, ... })`
Recherche des bases de données selon leur description.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `descrBd` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos bases de données à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
await client.bds.sauvegarderDescriptionBd({ idBd, langue: "fr", description: "hydrologie" });
const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherBdsSelonDescr({
  descrBd: "hydro",
  f: x => résultats.value = x,
  })
await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherBdsSelonIdMotClef({ idMotClef, f, ... })`
Recherche des bases de données selon les identifiants uniques de leurs mots-clefs.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos bases de données à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idMotClef = await client.motsClefs.créerMotClef();
await client.bds.ajouterMotsClefsBd({ idBd, idsMotsClefs: idMotClef });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherBdsSelonIdMotClef({
  idMotClef: idMotClef.slice(-5),
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherBdsSelonIdVariable({ idVariable, f, ... })`
Recherche des bases de données selon les identifiants uniques de leurs variables.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos bases de données à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });
const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.tableaux.ajouterColonneTableau({ idTableau, idVariable })

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherBdsSelonIdVariable({
  idVariable: idVariable.slice(-5),
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherBdsSelonNomMotClef({ nomMotClef, f, ... })`
Recherche des bases de données selon les noms de leurs mots-clefs.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nomMotClef` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos bases de données à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idMotClef = await client.motsClefs.créerMotClef();
await client.bds.ajouterMotsClefsBd({ idBd, idsMotsClefs: idMotClef });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherBdsSelonNomMotClef({
  nomMotClef: "agronomie",
  f: x => résultats.value = x,
});

await client.motsClefs.sauvegarderNomMotClef({
  idMotClef,
  langue: "cst",
  nom: "agronomía"
})

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherBdsSelonNomVariable({ nomVariable, f, ... })`
Recherche des bases de données selon les noms de leurs variables.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nomVariable` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos bases de données à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });
const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.tableaux.ajouterColonneTableau({ idTableau, idVariable })

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherBdsSelonNomVariable({
  nomVariable: "température",
  f: x => résultats.value = x,
});

await client.variables.sauvegarderNomVariable({
  idVariable,
  langue: "fr",
  nom: "Température maximale"
})

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherBdsSelonMotClef({ texte, f, ... })`
Recherche des bases de données selon leurs mots-clefs.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `texte` | `string` | Le texte à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos bases de données à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idMotClef = await client.motsClefs.créerMotClef();
await client.bds.ajouterMotsClefsBd({ idBd, idsMotsClefs: idMotClef });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherBdsSelonMotClef({
  texte: "agronomie",
  f: x => résultats.value = x,
});

await client.motsClefs.sauvegarderNomMotClef({
  idMotClef,
  langue: "cst",
  nom: "agronomía"
})

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherBdsSelonVariable({ texte, f, ... })`
Recherche des bases de données selon leurs variables.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `texte` | `string` | Le texte à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos bases de données à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });
const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.tableaux.ajouterColonneTableau({ idTableau, idVariable })

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherBdsSelonVariable({
  texte: "température",
  f: x => résultats.value = x,
});

await client.variables.sauvegarderNomVariable({
  idVariable,
  langue: "fr",
  nom: "Température maximale"
})

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherBdsSelonTexte({ texte, f, ... })`
Recherche tous les champs des bases de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `texte` | `string` | Le texte à rechercher. |
| `f` | `(résultats: `[`résultatRecherche< infoRésultatTexte \| infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos bases de données à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<utils.résultatRecherche<
  utils.infoRésultatTexte | utils.infoRésultatRecherche<utils.infoRésultatTexte>
>>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });
const idVariable = await client.variables.créerVariable({ catégorie: "image" });
await client.tableaux.ajouterColonneTableau({ idTableau, idVariable });
await client.variables.sauvegarderDescriptionVariable({ idVariable, langue: "fr", description: "précipitation" });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherBdsSelonTexte({
  texte: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

## Projets
Ces fonctions vous permettent de rechercher des projets du réseau.

### `client.recherche.rechercherProjets({ f, ... })`
Recherche des bases de données du réseau sans aucun critère spécifique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos projets à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProjets({
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```


### `client.recherche.rechercherProjetsSelonId({ idProjet, f, ... })`
Recherche des projets selon leur identifiant unique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idProjet` | `string` | L'identifiant à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos projets à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idProjet = await client.projets.créerProjet();

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProjetsSelonId({
  idProjet: idProjet.slice(-5),
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherProjetsSelonNom({ nomProjet, f, ... })`
Recherche des variables selon leur nom.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nomProjet` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos projets à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idProjet = await client.projets.créerProjet();
await client.projets.sauvegarderNomProjet({ idProjet, langue: "fr", nom: "hydrologie" });
const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProjetsSelonNom({
  nomProjet: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherProjetsSelonDescr({ descrProjet, f, ... })`
Recherche des projets selon leur description.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `descrProjet` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos projets à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idProjet = await client.projets.créerProjet();
await client.projets.sauvegarderDescriptionProjet({ idProjet, langue: "fr", description: "hydrologie" });
const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProjetsSelonDescr({
  descrProjet: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherProjetsSelonIdMotClef({ idMotClef, f, ... })`
Recherche des projets selon les identifiants uniques de leurs mots-clefs.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos projets à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idProjet = await client.projets.créerProjet();
const idMotClef = await client.motsClefs.créerMotClef();
await client.projets.ajouterMotsClefsProjet({ idProjet, idsMotsClefs: idMotClef });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProjetsSelonIdMotClef({
  idMotClef: idMotClef.slice(-5),
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherProjetsSelonIdVariable({ idVariable, f, ... })`
Recherche des projets selon les identifiants uniques de leurs variables.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos projets à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idProjet = await client.projets.créerProjet();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });
const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

await client.tableaux.ajouterColonneTableau({ idTableau, idVariable });
await client.projets.ajouterBdProjet({ idBd, idProjet });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProjetsSelonIdVariable({
  idVariable: idVariable.slice(-5),
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherProjetsSelonNomMotClef({ nomMotClef, f, ... })`
Recherche des projets selon les noms de leurs mots-clefs.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nomMotClef` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos projets à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idProjet = await client.projets.créerProjet();
const idMotClef = await client.motsClefs.créerMotClef();
await client.projets.ajouterMotsClefsProjet({ idProjet, idsMotsClefs: idMotClef });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProjetsSelonNomMotClef({
  nomMotClef: "agronomie",
  f: x => résultats.value = x,
});

await client.motsClefs.sauvegarderNomMotClef({
  idMotClef,
  langue: "cst",
  nom: "agronomía"
})

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherProjetsSelonNomVariable({ nomVariable, f, ... })`
Recherche des projets selon les noms de leurs variables.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nomVariable` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos projets à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });
const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.tableaux.ajouterColonneTableau({ idTableau, idVariable })

const idProjet = await client.projets.créerProjet();
await client.projets.ajouterBdProjet({ idBd, idProjet });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProjetsSelonNomVariable({
  nomVariable: "température",
  f: x => résultats.value = x,
});

await client.variables.sauvegarderNomVariable({
  idVariable,
  langue: "fr",
  nom: "Température maximale"
})

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherProjetsSelonMotClef({ texte, f, ... })`
Recherche des projets selon leurs mots-clefs.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `texte` | `string` | Le texte à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos projets à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idProjet = await client.projets.créerProjet();
const idMotClef = await client.motsClefs.créerMotClef();
await client.projets.ajouterMotsClefsProjet({ idProjet, idsMotsClefs: idMotClef });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProjetsSelonMotClef({
  texte: "agronomie",
  f: x => résultats.value = x,
});

await client.motsClefs.sauvegarderNomMotClef({
  idMotClef,
  langue: "cst",
  nom: "agronomía"
})

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherProjetsSelonVariable({ texte, f, ... })`
Recherche des projets selon leurs variables.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `texte` | `string` | Le texte à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos projets à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });
await client.tableaux.ajouterColonneTableau({ idTableau, idVariable })

const idProjet = await client.projets.créerProjet();
await client.projets.ajouterBdProjet({ idBd, idProjet });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProjetsSelonVariable({
  texte: "température",
  f: x => résultats.value = x,
});

await client.variables.sauvegarderNomVariable({
  idVariable,
  langue: "fr",
  nom: "Température maximale"
})

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```


### `client.recherche.rechercherProjetsSelonIdBd({ idBd, f, ... })`
Recherche des projets selon les identifiants de leurs bases de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idBd` | `string` | L'identifiant de la base de donnnées à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos projets à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
await client.projets.ajouterBdProjet({ idBd, idProjet });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProjetsSelonVariable({
  idBd: idBd.slice(-10),
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherProjetsSelonBd({ texte, f, ... })`
Recherche des projets selon leurs bases de données.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `texte` | `string` | Le texte à rechercher. |
| `f` | `(résultats: `[`résultatRecherchce< infoRésultatRecherche <infoRésultatTexte \| infoRésultatRecherche <infoRésultatTexte> > >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos projets à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<
    utils.infoRésultatRecherche<
      utils.infoRésultatTexte | utils.infoRésultatRecherche<utils.infoRésultatTexte>
    >
  >
>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
await client.projets.ajouterBdProjet({ idBd, idProjet });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProjetsSelonVariable({
  texte: "insecte",
  f: x => résultats.value = x,
});

await client.bds.sauvegarderNomBd({
  idBd,
  langue: "fr",
  nom: "Populations d'insectes"
})

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherProjetsSelonTexte({ texte, f, ... })`
Recherche tous les champs des projets.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `texte` | `string` | Le texte à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte \| infoRésultatRecherche< infoRésultatTexte \| infoRésultatRecherche <infoRésultatTexte> > >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos projets à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<utils.résultatRecherche<
  utils.infoRésultatTexte
  | utils.infoRésultatRecherche<
      utils.infoRésultatTexte | utils.infoRésultatRecherche<utils.infoRésultatTexte>
    >
>>();

const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" });
const idTableau = await client.bds.ajouterTableauBd({ idBd });
const idVariable = await client.variables.créerVariable({ catégorie: "image" });
await client.tableaux.ajouterColonneTableau({ idTableau, idVariable });
await client.variables.sauvegarderDescriptionVariable({ idVariable, langue: "fr", description: "précipitation" });

const idProjet = await client.projets.créerProjet();
await client.projets.ajouterBdProjet({ idBd, idProjet });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherProjetsSelonTexte({
  texte: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

## Nuées
Ces fonctions vous permettent de rechercher des nuées du réseau.

### `client.recherche.rechercherNuées({ f, ... })`
Recherche des nuées du réseau sans aucun critère spécifique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos nuées à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherNuées({
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```


### `client.recherche.rechercherNuéesSelonId({ idNuée, f, ... })`
Recherche des nuées selon leur identifiant unique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idNuée` | `string` | L'identifiant à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos nuées à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idNuée = await client.nuées.créerNuée();

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherNuéesSelonId({
  idNuée: idNuée.slice(-5),
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherNuéesSelonNom({ nomNuée, f, ... })`
Recherche des variables selon leur nom.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nomNuée` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos nuées à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idNuée = await client.nuées.créerNuée();
await client.nuées.sauvegarderNomNuée({ idNuée, langue: "fr", nom: "hydrologie" });
const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherNuéesSelonNom({
  nomNuée: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherNuéesSelonDescr({ descrNuée, f, ... })`
Recherche des nuées selon leur description.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `descrNuée` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatTexte>`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos nuées à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatTexte>
>();

const idNuée = await client.nuées.créerNuée();
await client.nuées.sauvegarderDescriptionNuée({ idNuée, langue: "fr", description: "hydrologie" });
const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherNuéesSelonDescr({
  descrNuée: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherNuéesSelonIdMotClef({ idMotClef, f, ... })`
Recherche des nuées selon les identifiants uniques de leurs mots-clefs.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idMotClef` | `string` | L'identifiant à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos nuées à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idNuée = await client.nuées.créerNuée();
const idMotClef = await client.motsClefs.créerMotClef();
await client.nuées.ajouterMotsClefsNuée({ idNuée, idsMotsClefs: idMotClef });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherNuéesSelonIdMotClef({
  idMotClef: idMotClef.slice(-5),
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherNuéesSelonIdVariable({ idVariable, f, ... })`
Recherche des nuées selon les identifiants uniques de leurs variables.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idVariable` | `string` | L'identifiant à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos nuées à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idNuée = await client.nuées.créerNuée();
const idTableau = await client.nuées.ajouterTableauNuée({ idNuée });
const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.nuées.ajouterColonneTableauNuée({ idTableau, idVariable })

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherNuéesSelonIdVariable({
  idVariable: idVariable.slice(-5),
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherNuéesSelonNomMotClef({ nomMotClef, f, ... })`
Recherche des nuées selon les noms de leurs mots-clefs.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nomMotClef` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos nuées à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idNuée = await client.nuées.créerNuée();
const idMotClef = await client.motsClefs.créerMotClef();
await client.nuées.ajouterMotsClefsNuée({ idNuée, idsMotsClefs: idMotClef });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherNuéesSelonNomMotClef({
  nomMotClef: "agronomie",
  f: x => résultats.value = x,
});

await client.motsClefs.sauvegarderNomMotClef({
  idMotClef,
  langue: "cst",
  nom: "agronomía"
})

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherNuéesSelonNomVariable({ nomVariable, f, ... })`
Recherche des nuées selon les noms de leurs variables.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nomVariable` | `string` | Le nom à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos nuées à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idNuée = await client.nuées.créerNuée();
const idTableau = await client.nuées.ajouterTableauNuée({ idNuée });
const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.nuées.ajouterColonneTableauNuée({ idTableau, idVariable })

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherNuéesSelonNomVariable({
  nomVariable: "température",
  f: x => résultats.value = x,
});

await client.variables.sauvegarderNomVariable({
  idVariable,
  langue: "fr",
  nom: "Température maximale"
})

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherNuéesSelonMotClef({ texte, f, ... })`
Recherche des nuées selon leurs mots-clefs.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `texte` | `string` | Le texte à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos nuées à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idNuée = await client.nuées.créerNuée();
const idMotClef = await client.motsClefs.créerMotClef();
await client.nuées.ajouterMotsClefsNuée({ idNuée, idsMotsClefs: idMotClef });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherNuéesSelonMotClef({
  texte: "agronomie",
  f: x => résultats.value = x,
});

await client.motsClefs.sauvegarderNomMotClef({
  idMotClef,
  langue: "cst",
  nom: "agronomía"
})

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherNuéesSelonVariable({ texte, f, ... })`
Recherche des nuées selon leurs variables.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `texte` | `string` | Le texte à rechercher. |
| `f` | `(résultats: `[`résultatRecherche <infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos nuées à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<
  utils.résultatRecherche<utils.infoRésultatRecherche<utils.infoRésultatTexte>>
>();

const idNuée = await client.nuées.créerNuée();
const idTableau = await client.nuées.ajouterTableauNuée({ idNuée });
const idVariable = await client.variables.créerVariable({ catégorie: "numérique" });
await client.nuées.ajouterColonneTableauNuée({ idTableau, idVariable })

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherNuéesSelonVariable({
  texte: "température",
  f: x => résultats.value = x,
});

await client.variables.sauvegarderNomVariable({
  idVariable,
  langue: "fr",
  nom: "Température maximale"
})

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```

### `client.recherche.rechercherNuéesSelonTexte({ texte, f, ... })`
Recherche tous les champs des nuées.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `texte` | `string` | Le texte à rechercher. |
| `f` | `(résultats: `[`résultatRecherche< infoRésultatTexte \| infoRésultatRecherche <infoRésultatTexte> >`](#types) `[]) => void` | La fonction qui sera appellée avec les résultats de la recherche chaque fois que ceux-ci changent. |
| `nRésultatsDésirés` | `number \| undefined` | Le nombre de résultats désirés. |
| `toutLeRéseau` | `boolean` | Si nous recherchons tout le réseau ou bien uniquement parmi nos nuées à nous. Vrai par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerN: (n: number) => Promise<void>; }>` | Fonctions à appeler pour arrêter le suivi ou pour changer le nombre de résultats désirés. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type utils } from "@constl/ipa";

const client = créerConstellation();

const résultats = ref<utils.résultatRecherche<
  utils.infoRésultatTexte | utils.infoRésultatRecherche<utils.infoRésultatTexte>
>>();

const idNuée = await client.nuées.créerNuée();
const idTableau = await client.nuées.ajouterTableauNuée({ idNuée, idVariable });

const idVariable = await client.variables.créerVariable({ catégorie: "image" });

await client.nuées.ajouterColonneTableauNuée({ idTableau, idVariable });
await client.variables.sauvegarderDescriptionVariable({ idVariable, langue: "fr", description: "précipitation" });

const { 
  fOublier, 
  fChangerN 
} = await client.recherche.rechercherNuéesSelonTexte({
  texte: "hydro",
  f: x => résultats.value = x,
});

await fChangerN(3);  // On veut 3 résultats maximum
await fOublier();  // Arrêter le suivi
```


## Types
Plusieurs types sont associés aux résultats de recherche.

```ts
interface résultatRecherche<T extends infoRésultat> {
  résultatObjectif: résultatObjectifRecherche<T>;
  id: string;
}
interface résultatObjectifRecherche<T extends infoRésultat>
  extends infoRésultatRecherche<T> {
  score: number;
}
type infoRésultat =
  | infoRésultatTexte
  | infoRésultatVide
  | infoRésultatRecherche;

interface infoRésultatTexte {
  type: "texte";
  texte: string;
  début: number;
  fin: number;
}

interface infoRésultatVide {
  type: "vide";
}

interface infoRésultatRecherche<T extends infoRésultat = infoRésultat> {
  type: "résultat";
  de: string;
  clef?: string;
  info: T;
}
```
