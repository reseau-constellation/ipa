# Favoris
Étant un système distribué, Constellation ne garde pas les données quelque part sur un serveur central. Ce sont les utilisateurs eux-mêmes qui en gardent et partagent des copies sur leurs dispositifs.

Donc comment être sûre que les données qui vous intéressent seront toujours disponibles, même si la personne qui les a contribuées ferme son ordinateur pour la nuit, échape son téléphone dans un égout d'une ruelle à Coimbatore ou bien tout simplement décide qu'elle retourne avec Google Sheets et efface son compte Constellation ?

En ajoutant des données à vos favoris, vous serez assurés que Constellation en gardera toujours une copie locale, même si les données ne sont plus disponibles ailleurs sur le réseau.

:::warning AVERTISSEMENT
Constellation est toujours un logiciel expérimental. Des « oups » sont toujours possibles. **Si vos données sont vraiment vraiment importantes, on vous suggère, en plus de les ajouter à vos favoris, d'en garder une copie exportée comme sauvegarde d'au cas où.** Vous pouvez aussi [automatiser](./automatisations.md) l'exportation des données de manière périodique ; c'est bien pratique !

Bon, là vous êtes prévenus, majeurs et vaccinés. Si vous ne m'écoutez pas, je ne suis pas responsable. (En réalité, selon la [licence](https://github.com/reseau-constellation/ipa/blob/main/LICENSE), je ne le suis pas peu importe.)
:::

[[toc]]

## Fonctions
Ces fonctions permettent de suivre et de modifier les données épinglés dans nos favoris. Plusieurs d'entre elles permenttent de spécifier quels dispositifs doivent épingler les données en question. Cette spécification pourra être l'une des suivantes :

* L'identifiant (ou une liste d'identifiants) des dispositifs, obtenables selon [`client.obtIdDispositif()`](./client.md#clientobtiddispositif) ou bien [`client.suivreDispositifs`](./client.md#client-suivredispositifs-f-idcompte).
* `"TOUS"`, soit, tous les dispositifs de ce compte.
* `"INSTALLÉ"`, soit, tous les dispositifs ayant une version installée de Constellation (Électron ou Node.js), excluant donc l'appli Constellation Internet sur navigateur.

### `client.favoris.suivreFavoris({ f, idCompte })`
Suit les favoris d'un compte. Identique à [`client.réseau.suivreFavorisMembre`](./réseau.md#client-reseau-suivrefavorismembre-idcompte-f).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(favoris: `[`ÉlémentFavorisAvecObjet`](#types)`) => void` | Une fonction qui sera appelée avec la liste des favoris associées au compte chaque fois que celle-ci change. |
| `idCompte` | `string` | L'identifiant de compte dont on veut suivre les favoris. Si non spécifié, le compte actuel sera utilisé. |


#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type favoris as fav} from "@constl/ipa";

const client = créerConstellation();

const favoris = ref<fav.ÉlémentFavorisAvecObjet[]>();
const fOublier = await client.favoris.suivreFavoris({
  f: x => favoris.value = x,
});
```

### `client.favoris.épinglerFavori({ idObjet, dispositifs, ... })`
Épingle des données sur ce compte.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idObjet` | `string` | L'identifiant des données (bases de données, variable ou autre) à épingler. |
| `dispositifs` | [`typeDispositifs`](#types) | Les dispositifs sur lesquels ces données doivent être épinglées.
| `dispositifsFichiers` | [`typeDispositifs`](#types)` \| undefined` | Les dispositifs sur lesquels des fichiers éventuelement présents dans les données (images, vidéos ou autres) devraient être épinglés. Par défaut, les fichiers seront uniquement épinglés sur les dispositifs avec une installation de Constellation (et non sur les navigateurs) afin de sauvegarder de l'espace.


#### Exemple
```ts
import { créerConstellation, type favoris } from "@constl/ipa";

const client = créerConstellation();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

await client.favoris.épinglerFavori({
  idObjet: idBd,
});
``` 


### `client.favoris.désépinglerFavori({ idObjet })`
Désépingle des données de ce compte.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idObjet` | `string` | L'identifiant des données (bases de données, variable ou autre) à désépingler. |

#### Exemple
```ts
/// ...continuant de ci-dessus...

await client.favoris.désépinglerFavori({
  idObjet: idBd,
});
``` 


### `client.favoris.suivreÉtatFavori({ idObjet, f })`
Suit le statut de l'épingle d'un objet sur ce compte.

:::tip CONSEIL
Si vous voulez savoir si des données sont épinglées ailleurs sur le réseau, utiliser [`client.réseau.suivreFavorisObjet`](./réseau.md#client-reseau-suivrefavorisobjet-idobjet-f-profondeur) à la place.
:::

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idObjet` | `string` | L'identifiant de l'objet (base de données, projet, variable ou autre) d'intérêt. |
| `f` | `(favoris: `[`ÉlémentFavoris`](#types)` \| undefined) => void` | Une fonction qui sera appelée avec l'épingle de l'objet chaque fois que celle-ci change. Si l'objet n'est pas épinglé sur ce compte, `undefined` sera passé à la fonction. |


#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type favoris as fav } from "@constl/ipa";

const client = créerConstellation();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const favoris = ref<fav.ÉlémentFavoris | undefined>();
const fOublier = await client.favoris.suivreÉtatFavori({
  idObjet: idBd,
  f: x => favoris.value = x,
});
```

### `client.favoris.suivreEstÉpingléSurDispositif({ idObjet, f, ... })`
Suit le statut de l'épingle d'un objet sur un dispositif.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idObjet` | `string` | L'identifiant de l'objet (base de données, projet, variable ou autre) d'intérêt. |
| `f` | `(favoris: `[`ÉlémentFavoris`](#types)` \| undefined) => void` | Une fonction qui sera appelée avec l'épingle de l'objet chaque fois que celle-ci change. Si l'objet n'est pas épinglé sur ce compte, `undefined` sera passé à la fonction. |
| `idDispositif` | `string` | L'Identtifiant du dispositif d'intérêt. Si non spécifié, Constellation utilisera le dispositif actuel par défaut. |


#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type favoris as fav } from "@constl/ipa";

const client = créerConstellation();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const épingle = ref<fav.épingleDispositif | undefined>();
const fOublier = await client.favoris.suivreEstÉpingléSurDispositif({
  idObjet: idBd,
  f: x => épingle.value = x,
});
```


## Types
Plusieurs types son associés avec les favoris.

```ts
type typeDispositifs = string | string[] | "TOUS" | "INSTALLÉ";

type ÉlémentFavoris = {
  récursif: boolean;
  dispositifs: typeDispositifs;
  dispositifsFichiers?: typeDispositifs;
};

type ÉlémentFavorisAvecObjet = ÉlémentFavoris & { idObjet: string };

```