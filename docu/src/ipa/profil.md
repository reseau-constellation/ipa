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


### `client.profil.suivreNoms({ f, idBdProfil? })`
Suit les noms (traduits en différentes langues) de l'utilisatrice.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(noms: { [langue: string]: string }) => void` | Une fonction qui sera appelée avec les noms de l'utilisatrice chaque fois qu'ils changent|
| `idBdProfil?` | `string \| undefined` | L'addresse orbit-db du profil de l'utilisateur. Par défaut, sera l'utilisateur courrant. Ne pas toucher. |

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

## Contact
