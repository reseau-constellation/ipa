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

import ClientConstellation from "@constl/ipa";
const client = ClientConstellation();

await client.profil.sauvegarderNom({ langue: "fr", nom: "C'est bien moi !" });

```

### `client.profil.effacerNom({ langue })`
Efface la traduction du nom de l'utilisateur dans une langue donnée.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `langue` | `string` | La langue dont ont doit effacer le nom. |

#### Exemple
```ts
import ClientConstellation from "@constl/ipa";
const client = ClientConstellation();

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
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi |


#### Exemple
```ts
import ClientConstellation from "@constl/ipa";
const client = ClientConstellation();

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

import ClientConstellation from "@constl/ipa";
const client = ClientConstellation();

const image = fs.readFileSync("mon image locale.jpeg");
await client.profil.sauvegarderImage({ image });

```

### `client.profil.effacerImage()`
Efface l'image de profil.

#### Exemple
```ts
import ClientConstellation from "@constl/ipa";
const client = ClientConstellation();

await client.profil.effacerImage();
```

### `client.profil.suivreImage({ f, idCompte? })`
Suit l'image de profil de l'utilisatrice.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(image: Uint8Array) => void` | Une fonction qui sera appelée avec l'image chaque fois que celle-ci change. |
| `idCompte?` | `string \| undefined` | L'id du compte de l'utilisateur. Par défaut, sera l'utilisateur courrant. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `() => Promise<void>` | Fonction à appeler pour arrêter le suivi |

#### Exemple
```ts
import { ref } from 'vue';
import ClientConstellation from "@constl/ipa";
const client = ClientConstellation();

const image = ref<Uint8Array>();
const fOublierImage = await client.profil.suivreImage({ f: x => image.value = x });
await fOublierImage();
```

## Contact
