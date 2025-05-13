# Profil
Le `profil` organise toutes les informations de profil (nom, image, contact) de l'utilisateur.

[[toc]]

## Noms
Plutôt qu'un identifiant d'utilisateur ou d'utilisatrice, dans Constellation, chaque personne présente son nom dans autant de langues qu'elle le souhaite.

### `client.profil.sauvegarderNom({ langue, nom })`
Sauvegarde le nom de l'utilisateur dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `nom` | `string` | Le nom de l'utilisatrice. |
| `langue` | `string` | La langue du nom. |

#### Exemple
```ts

import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

await client.profil.sauvegarderNom({ langue: "fr", nom: "C'est bien moi !" });

```

### `client.profil.sauvegarderNoms({ noms })`
Sauvegarde le nom de l'utilisateur dans plusieurs langues en même temps.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `noms` | `{ [langue: string]: string }` | Les noms de l'utilisatrice, indexés par langue. |

#### Exemple
```ts

import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

await client.profil.sauvegarderNoms({ fr: "C'est bien moi !", हिं: "मैं हुँ"});

```

### `client.profil.effacerNom({ langue })`
Efface la traduction du nom de l'utilisateur dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `langue` | `string` | La langue dont ont doit effacer le nom. |

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

await client.profil.effacerNom({ langue: "fr" });
```


### `client.profil.suivreNoms({ f, idCompte? })`
Suit les noms (traduits en différentes langues) de l'utilisatrice.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(noms: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les noms de l'utilisatrice chaque fois qu'ils changent|
| `idCompte?` | `string \| undefined` | L'id du compte de l'utilisateur. Par défaut, sera l'utilisateur courrant. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |


#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const fOublierNoms = await client.profil.suivreNoms({ f: noms => console.log(noms) });
await fOublierNoms();
```

## Image

### `client.profil.sauvegarderImage({ image })`
Sauvegarde une image de profil.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `image` | `import("ipfs-core-types/src/utils").ImportCandidate` | Le fichier de l'image. |

#### Exemple
```ts

import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const image = fs.readFileSync("mon image locale.jpeg");
await client.profil.sauvegarderImage({ image });

```

### `client.profil.effacerImage()`
Efface l'image de profil.

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

await client.profil.effacerImage();
```

### `client.profil.suivreImage({ f, idCompte? })`
Suit l'image de profil de l'utilisatrice.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(image: { image: Uint8Array, idImage: string } \| null) => void` | Une fonction qui sera appelée avec l'image chaque fois que celle-ci change. |
| `idCompte?` | `string \| undefined` | L'id du compte de l'utilisateur. Par défaut, sera l'utilisateur courrant. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from 'vue';
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const image = ref<{ image: { image: Uint8Array, idImage: string }, idImage: string } | null>();
const fOublierImage = await client.profil.suivreImage({ f: x => image.value = x });
await fOublierImage();
```

## Contact
Chaque profil Constellation peur inclure des informations publiques de contact (courriel ou autre).

### `client.profil.sauvegarderContact({ type, contact })`
Sauvegarde un moyen de contact.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `type` | `string` | Le type de contact (p. ex., courriel, site Internet, numéro téléphonique). Peut être n'importe quelle valeur; nous recommandons l'un de `courriel`, `siteInternet`, `whatsapp`, `téléphone` ou `télégramme`|
| `contact` | `string` | Le contact. |

#### Exemple
```ts

import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

await client.profil.sauvegarderContact({ 
    type: "courriel", 
    contact: "moi@cestbienmoi.ca" 
});

```

### `client.profil.effacerContact({ type, contact })`
Effacer l'information de contact.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `type` | `string` | Le type de contact. |
| `contact` | `string \| undefined` | Le contact à effacer. Si non spécifié, effacera tous les contacts de type `type`. |

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

await client.profil.effacerContact({ type: "courriel" });
```

### `client.profil.suivreContacts({ f, idCompte? })`
Suit les informations de contact de l'utilisatrice.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(contacts: {type: string, contact: string}[]) => void` | Une fonction qui sera appelée avec les informations de contact chaque fois que celles-ci changent. |
| `idCompte?` | `string \| undefined` | L'id du compte de l'utilisateur. Par défaut, sera l'utilisateur courrant. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from 'vue';
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const contacts = ref<Uint8Array>({type: string, contact: string}[]);
const fOublierContacts = await client.profil.suivreContacts({
    f: x => contacts.value = x
});
await fOublierContacts();
```

### `client.profil.sauvegarderCourriel({ courriel })`
Fonction rapide pour sauvegarder un courriel. Équivalent à `client.profil.sauvegarderContact` avec `type === "courriel"`.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `courriel` | `string` | L'adresse courriel. |

#### Exemple
```ts

import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

await client.profil.sauvegarderCourriel({ 
    courriel: "moi@cestbienmoi.ca" 
});

```

### `client.profil.effacerCourriel()`
Fonction rapide pour effacer un courriel. Équivalent à `client.profil.effacerContact({ type: "courriel" })`.

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

await client.profil.effacerCourriel();
```

### `client.profil.suivreCourriel({ f, idCompte? })`
Version spécifique de `client.profil.suivreContact` qui suit le courriel de l'utilisatrice.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(courriel: string) => void` | Une fonction qui sera appelée avec l'adresse courriel chaque fois que celle-ci change. |
| `idCompte?` | `string \| undefined` | L'id du compte de l'utilisateur. Par défaut, sera l'utilisateur courrant. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from 'vue';
import { créerConstellation } from "@constl/ipa";
const client = créerConstellation();

const courriel = ref<Uint8Array>();
const fOublierCourriel = await client.profil.suivreCourriel({
    f: x => courriel.value = x
});
await fOublierCourriel();
```

