# Licences
Constellation vient avec une liste de licences reconnues pour associer à vos bases de données. 

:::tip ASTUCE
Cette liste est également dynamique ; au fur et à mesure que de nouvelles licences sont suggérées par les membres du réseau et puis approuvées, celles-ci apparaîteront automatiquement dans la liste des licences reconnues par Constellation, et ce, sans aucun besoin de mise à jour.

Comment est-ce possible ? En utilisant une base de données de Constellation elle-même pour sauvegarder les informations des licences approuvées, bien sûr ! Nous utilisons aussi un petit paquet nommé `கிளி` ([`@lassi-js/kili`](https://www.npmjs.com/package/@lassi-js/kili)) pour syncroniser les suggestions des membres du réseau et gérer leur approbation éventuelle.
:::

[[toc]]

## Fonctions

### `client.licences.suivreLicences({ f })`
Suit les licences disponibles sur Constellation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(licences: { [licence: string]: `[`InfoLicence`](#types)` }) => void` | La fonction qui sera appellée avec la liste des licences reconnues par Constellation chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

const licences = ref<InfoLicence[]>();
const fOublier = await client.licences.suivreLicences({
    f: x => licence.value = x;
})
```

### `client.licences.suggérerLicence({ code, infoLicence })`
Suggère une nouvelle licence à ajouter à la liste des licences reconnues par Constellation.

:::warning AVERTISSEMENT
N'importe qui (oui, toi aussi !) peut suggérer une nouvelle licence à inclure. Si elle est acceptée, elle sera ajoutée à la liste officielle et apparaîtra dans l'interface de Constellation. **Pour être acceptée, la licence doit être libre** ; c'est-à-dire, elle doit permettre la modification et le partage des données qui seront publiées sous cette licence. La licence peut, bien entendu, aussi inclure des limitations ou des conditions associées à ces droits.
:::

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `code` | `string` | Un code unique pour identifier cette licence. |
| `infoLicence` | [`InfoLicence`](#types) | Les détails de la licence. |

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

await client.licences.suggérerLicence({
    code: "codeDeMaLicence";
    
    // Un petit résumé des caractéristiques de notre licence:
    infoLicence: {
        conditions: ["attribution", "partageÉgal", "inclureDroitDauteur"],
        droits: ["partager", "adapter", "usageComercial"],
        limitations: ["aucuneResponsabilité", "aucuneGarantie"],
        catégorie: "basesDeDonnées",
        spécialisée: false;  // Indique une licence d'usage général (et non spécifique à une organisation ou compagnie)
    }
})
```

### `client.licences.effacerSuggestionLicence({ idÉlément })`
Efface une suggesion de nouvelle licence que vous aviez fait auparavant.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idÉlément` | `string` | L'identifiant unique de votre suggestion. |

#### Exemple
```ts
import { créerConstellation } from "@constl/ipa";

const client = créerConstellation();

await client.licences.effacerSuggestionLicence({
    idÉlément: "codeDeMaSuggestion"
})
```

### `client.licences.suivreSuggestionsLicences({ f })`
Suit les suggestions faites par les membres du réseau Constellation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(suggestions: கிளி.பிணையம்_பரிந்துரை<`[`InfoLicenceAvecCode`](#types)`>[]) => void` | La fonction qui sera appellée avec la liste des suggesions de licences chaque fois que celle-ci change. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<{ fOublier: () => Promise<void>, fChangerProfondeur: (n: number) => Promise:void> }>` | Fonctions à appeler pour changer le nombre de résultats ou bien pour arrêter le suivi. |


#### Exemple
```ts
import { ref } from "vue";
import { créerConstellation, type licences } from "@constl/ipa";

import { type பிணையம்_பரிந்துரை } from "@lassi-js/kili"

const client = créerConstellation();

const suggestions: பிணையம்_பரிந்துரை<licences.InfoLicenceAvecCode>[]([]);
await client.licences.suivreSuggestionsLicences({
    f: x => suggestions.value = x,
});
```

### `client.licences.approuverLicence({ suggestion })`
Permet d'approuver une suggestion de licence et de l'ajouter à l'interface générale de Constellation.

:::warning AVERTISSEMENT
**Fonction uniquement disponible si vous avez un accès modérateur à la base de données des licences approuvées par Constellation.** (Si vous n'êtes pas sûr, la réponse est probablement non.)
:::

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `suggestion` | `கிளி.பிணையம்_பரிந்துரை<`[`InfoLicenceAvecId`](#types)`>` | La suggestion de licence. |

#### Exemple
```ts
// ... continuant de ci-dessus...

const toutApprouver = async () => {
    await Promise.all(
        suggestions.value.map(
            suggestion => client.licences.approuverLicence({ suggestion })
        )
    );
}

```


## Licences disponibles
Les licences suivantes sont reconnues par Constellation.

:::tip ASTUCE
Vous pouvez bien sûr inclure utiliser d'autres licences, mais seulement celles identifiées ci-dessous seront reconnues par l'interface de l'appli Constellation.
:::

### Licences pour bases de données (recommendées)
* `ODbl-1_0`
* `ODC-BY-1_0`
* `PDDL`
* `rvca-open`

### Licences artistiques
Celles-ci sont plus appropriées pour les images, vidéo ou autre expression artistique.

* `CC-BY-SA-4_0`
* `CC-BY-4_0`
* `CC-0-1_0`

### Licences de code
Ces licences furent développées pour le code informatique.

* `0bsd`
* `afl-3_0`
* `agpl-3_0`
* `apache-2_0`
* `artistic-2_0`
* `bsd-2-clause`
* `bsd-3-clause-clear`
* `bsd-3-clause`
* `bsd-4-clause`
* `bsl-1_0`
* `cecill-2_1`
* `ecl-2_0`
* `epl-1_0`
* `epl-2_0`
* `eupl-1_0`
* `eupl-1_2`
* `gpl-2_0`
* `gpl-3_0`
* `isc`
* `lgpl-2_1`
* `lgpl-3_0`
* `lppl-1_3c`
* `mit-0`
* `mit`
* `mpl-2_0`
* `ms-pl`
* `ms-rl`
* `mulanpsl-2_0`
* `ncsa`
* `osl-3_0`
* `postgresql`
* `unlicence`
* `upl-1_0`
* `vim`
* `wtfpl`
* `zlib`
* `ofl-1_1`

## Types

```ts
type InfoLicence = {
  conditions: condition[];
  droits: string[];
  limitations: string[];
  catégorie: catégorie;
  spécialisée?: boolean;
}

type InfoLicenceAvecId = InfoLicence & { id: string };

type condition = "attribution" | "partageÉgal" | "inclureDroitDauteur" | "indiquerChangements" | "partagerCodeSource" | "usagereseau";
type droit = "partager" | "adapter" | "usageComercial" | "usagePrivé" | "usageBrevets";
type limitation =  "aucuneResponsabilité" | "aucuneGarantie" | "marqueCommerce" | "brevetExclu" | "sousLicence";
type catégorie = "basesDeDonnées" | "artistique" | "codeInformatique" | "autre";

```