# Réseau
La section `réseau` de Constellation permet de réseauter avec d'autres membres du réseau.

[[toc]]

## Connexions
Ces fonctions suivent la connection du compte sur le réseau Constellation.

### `client.réseau.suivreConnexionsMembres({ f })`
Suit les connexions aux autres comptes Constellation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(membres: `[`statutMembre`](#types-connexions) `) => void` | Cette fonction sera appelée avec la liste des connexions chaque fois que celle-ci est modifiée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type réseau } from "@constl/ipa";

const client = générerClient();

const connexions = ref<réseau.statutMembre[]>();

const fOublier = await client.réseau.suivreConnexionsMembres({
    f: x => connexions.value = x,
})

```

### `client.réseau.suivreConnexionsDispositifs({ f })`
Suit les connexions aux autres dispositifs des comptes Constellation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(dispositifs: `[`statutDispositif`](#types-connexions) `) => void` | Cette fonction sera appelée avec la liste des connexions chaque fois que celle-ci est modifiée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type réseau } from "@constl/ipa";

const client = générerClient();

const connexions = ref<réseau.statutDispositif[]>();

const fOublier = await client.réseau.suivreConnexionsDispositifs({
    f: x => connexions.value = x,
})

```

### `client.réseau.suivreConnexionsPostesSFIP({ f })`
Suit les connexions aux autres postes du [Systèmes de fichiers Interplanétaire](https://ipfs.io) sur lequel est bâti Constellation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(connexions: { adresse: string; pair: string }[]) => void` | Cette fonction sera appelée avec la liste des connexions chaque fois que celle-ci est modifiée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const connexions = ref<{ adresse: string; pair: string }[]>();

const fOublier = await client.réseau.suivreConnexionsPostesSFIP({
    f: x => connexions.value = x,
})

```

### `client.réseau.suivreComptesRéseau({ f, profondeur, idCompteDébut })`
Suit les membres qui font parti du réseau personnel d'un compte (en ligne ou non). Les résultats incluent la profondeur  et le niveau de confiance envers chaque membre retrouvé. Une confiance de 0 indique un inconnu, une confiance de 1 une personne de confiance et une valeur négative un compte bloqué.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(membres: ` [`infoMembreRéseau`](#types-connexions) `[]) => void` | Cette fonction sera appelée avec la liste des connexions chaque fois que celle-ci est modifiée. |
| `profondeur` | `number` | La profondeur à rechercher dans le réseau (relatif au compte original). |
| `idCompteDébut` | `string \| undefined` | Le compte à partir duquel lancer la recherche. Si non spécifié, le compte actuel sera utilisé par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type réseau } from "@constl/ipa";

const client = générerClient();

const comptes = ref<réseau.infoMembreRéseau[]>();

const fOublier = await client.réseau.suivreComptesRéseau({
    f: x => comptes.value = x,
})

```



### `client.réseau.suivreComptesRéseauEtEnLigne({ f, profondeur, idCompteDébut })`
Suit les membres qui font parti du réseau personnel d'un compte (en ligne ou non) et inclut aussi les membres en ligne (qu'ils fassent parti du réseau personnel ou non). Les résultats incluent la profondeur  et le niveau de confiance envers chaque membre retrouvé. Une confiance de 0 indique un inconnu, une confiance de 1 une personne de confiance et une valeur négative un compte bloqué. Une profondeur infinie indique une personne qui ne fait pas partie de votre réseau.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(membres: ` [`infoMembreRéseau`](#types-connexions) `[]) => void` | Cette fonction sera appelée avec la liste des connexions chaque fois que celle-ci est modifiée. |
| `profondeur` | `number` | La profondeur à rechercher dans le réseau (relatif au compte original). |
| `idCompteDébut` | `string \| undefined` | Le compte à partir duquel lancer la recherche. Si non spécifié, le compte actuel sera utilisé par défaut. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type réseau } from "@constl/ipa";

const client = générerClient();

const comptes = ref<réseau.infoMembreRéseau[]>();

const fOublier = await client.réseau.suivreComptesRéseauEtEnLigne({
    f: x => comptes.value = x,
})

```

## Confiance
Constellation étant un réseau distribué, nous ne pouvons pas simplement effacer les comptes des personnes qui ne sont pas gentilles. Ce que nous pouvons faire, au contraire, est de permettre aux utilisatrices d'identifier des comptes auquels elles font confiance (ou non). **Ces relations de confiances sont transitives** ; c'est-à-dire, indiquer votre confiance ou non envers un compte Constellation affectera la confiance que vos contacts accorderont, eux aussi, à ce compte.

:::tip CONSEIL
Si vous développez des interfaces graphiques basées sur Constellation, il est recommendé de ne pas laisser paraître les comptes dont la confiance est inférieure à 0.
:::

### `client.réseau.faireConfianceAuMembre({ idCompte })`
Indique que vous faites confiance à un compte Constellation (`confiance = 1`).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant de compte à qui faire confiance. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

await client.réseau.faireConfianceAuMembre({
    idCompte: "idCompteDeQuelquUnDeChouette",
})

```

### `client.réseau.nePlusFaireConfianceAuMembre({ idCompte })`
Indique que vous ne faites plus confiance à un compte Constellation (la confiance retournera à 0).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant de compte à qui ne plus faire confiance. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

await client.réseau.nePlusFaireConfianceAuMembre({
    idCompte: "idCompteDeQuelquUnDePasSiChouetteAprèsTout",
})

```

### `client.réseau.bloquerMembre({ idCompte, privé })`
Indique que vous voulez bloquer un compte Constellation (`confiance = -1`).

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant de compte à bloquer. |
| `privé` | `boolean \| undefined` | Si le bloquage doit être privé ou non (vrai par défaut). |

:::warning AVERTISSEMENT
Si le bloquage est publique, tout le monde saura que vous avez bloqué ce compte, et il sera également bloqué chez les personnes qui vous font confiance. Mais la personne qui vous avez bloqué pourrait finir par le savoir (peut-être que ce serait grave, ou bien peut-être pas si grave que ça; je n'en sais rien). 

Si le bloquage est privé, le compte sera bloqué uniquement sur ce dispositif, et vous devrez donc le bloquer à nouveau sur chacun des dispositifs de votre compte.
:::

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

await client.réseau.bloquerMembre({
    idCompte: "idCompteDeQuelquUnQuiNestVraimentPasGentil",
})

```

### `client.réseau.débloquerMembre({ idCompte })`
Débloque un compte qui avait été bloqué.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant du compte qu'on veut débloquer. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const confiance = ref<number>();

const fOublier = await client.réseau.débloquerMembre({
    idCompte: "idCompteDeQuelquUnQuiVientDeSExcuser"
});

```

### `client.réseau.suivreFiables({ f, idCompte })`
Suit les comptes à qui on fait confiance.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(fiables: string[]) => void` | Cette fonction sera appelée avec la liste des comptes auxquels `idCompte` fait confiance chaque fois que celle-ci est modifiée. |
| `idCompte` | `string` | L'identifiant du compte dont on veut suivre les relations de confiance. Si non spécifié, Constellation utilisera le compte actuel. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const fiables = ref<string[]>();

const fOublier = await client.réseau.suivreFiables({
    f: x => fiables.value = x,
})

```

### `client.réseau.suivreBloqués({ f, idCompte })`
Suit les comptes qui ont été bloqués.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(bloqués: { idCompte: string; privé: boolean }[]) => void` | Cette fonction sera appelée avec la liste des comptes qui ont été bloquées par `idCompte` chaque fois que celle-ci est modifiée. |
| `idCompte` | `string \| undefined` | L'identifiant du compte dont on veut suivre les relations de confiance. Si non spécifié, Constellation utilisera le compte actuel. |

:::tip CONSEIL
Le champ `privé` dans les réponses indique si le compte est bloqué de manière privé ou publique (`privé = true` n'est possible que si `idCompte === client.idCompte`. )
:::

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const bloqués = ref<{ idCompte: string; privé: boolean }[]>();

const fOublier = await client.réseau.suivreBloqués({
    f: x => bloqués.value = x,
})

```

### `client.réseau.suivreBloquésPubliques({ f, idCompte })`
Suit les comptes qui ont été bloqués de manière publique.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(bloqués: string[]) => void` | Cette fonction sera appelée avec la liste des comptes qui ont été bloquées par `idCompte` chaque fois que celle-ci est modifiée. |
| `idCompte` | `string \| undefined` | L'identifiant du compte dont on veut suivre les relations de confiance. Si non spécifié, Constellation utilisera le compte actuel. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const bloqués = ref<string[]>();

const fOublier = await client.réseau.suivreBloquésPubliques({
    f: x => bloqués.value = x,
})

```

### `client.réseau.suivreConfianceMonRéseauPourMembre({ idCompte, f, ... })`
Suit la confiance de mon réseau envers un compte.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant du compte envers lequel veut suivre le niveau de confiance. |
| `f` | `(bloqués: string[]) => void` | Cette fonction sera appelée avec le niveau de confiance chaque fois que celui-ci est modifiée. |
| `profondeur` | `number` | La profondeur de la recherche. |
| `idCompteRéférence` | `string \| undefined` | L'identifiant du compte dont on veut suivre le niveau de confiance envers `idCompte`. Si non spécifié, Constellation utilisera le compte actuel. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const confiance = ref<number>();

const fOublier = await client.réseau.suivreConfianceMonRéseauPourMembre({
    idCompte: "idCompteDeQuelquUnDautre",
    f: x => confiance.value = x,
})

```

## Recherche
Ces fonctions servent à visualiser les données d'un autre membre du réseau Constellation. Elles vérifient également que, si la personne en question n'a pas créé l'objet elle-même, qu'elle a bel et bien accepté l'invitation de s'y joindre en tant qu'auteur.

:::tip CONSEIL
Les fonctionnalités-ci servent à trouver toutes les données appartement à un membre en particulier. Si vous voulez au contraire rechercher des données du réseau Constellation en entier selon un critère donné, voir la section [`client.recherche`](./recherche.md).
:::

### `client.réseau.suivreBdsMembre({ idCompte, f })`
Suit les bases de données appartenant à un utilisateur Constellation, en vérifiant et que la personne a été invitée à être auteur de la base de données, et qu'elle a accepté ladite invitation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant de compte de la personne d'intérêt. |
| `f` | `(bds: string[]) => void` | Cette fonction sera appelée avec la liste des identifiants des bases de données chaque fois que celle-ci est modifiée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const bds = ref<string[]>();

const fOublier = await client.réseau.suivreBdsMembre({
    idCompte: "idCompteDeQuelquUnDautre",
    f: x => bds.value = x,
})

```

### `client.réseau.suivreProjetsMembre({ idCompte, f })`
Suit les projets appartenant à une utilisatrice Constellation, en vérifiant et que la personne a été invitée à être auteur du projet, et qu'elle a accepté ladite invitation.


#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant de compte de la personne d'intérêt. |
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

const fOublier = await client.réseau.suivreProjetsMembre({
    idCompte: "idCompteDeQuelquUnDautre",
    f: x => projets.value = x,
})

```


### `client.réseau.suivreVariablesMembre({ idCompte, f })`
Suit les variables appartenant à une utilisatrice Constellation, en vérifiant et que la personne a été invitée à être auteur de la variable, et qu'elle a accepté ladite invitation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant de compte de la personne d'intérêt. |
| `f` | `(variables: string[]) => void` | Cette fonction sera appelée avec la liste des identifiants des variables chaque fois que celle-ci est modifiée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const variables = ref<string[]>();

const fOublier = await client.réseau.suivreVariablesMembre({
    idCompte: "idCompteDeQuelquUnDautre",
    f: x => variables.value = x,
})

```

### `client.réseau.suivreMotsClefsMembre({ idCompte, f })`
Suit les mots-clefs appartenant à une utilisatrice Constellation, en vérifiant et que la personne a été invitée à être auteur du mot-clef, et qu'elle a accepté ladite invitation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant de compte de la personne d'intérêt. |
| `f` | `(motsClefs: string[]) => void` | Cette fonction sera appelée avec la liste des identifiants des mots-clefs chaque fois que celle-ci est modifiée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const motsClefs = ref<string[]>();

const fOublier = await client.réseau.suivreMotsClefsMembre({
    idCompte: "idCompteDeQuelquUnDautre",
    f: x => motsClefs.value = x,
})

```

### `client.réseau.suivreNuéesMembre({ idCompte, f })`
Suit les nuées appartenant à une utilisatrice Constellation, en vérifiant et que la personne a été invitée à être auteur du projet, et qu'elle a accepté ladite invitation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant de compte de la personne d'intérêt. |
| `f` | `(nuées: string[]) => void` | Cette fonction sera appelée avec la liste des identifiants des nuées chaque fois que celle-ci est modifiée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const nuées = ref<string[]>();

const fOublier = await client.réseau.suivreNuéesMembre({
    idCompte: "idCompteDeQuelquUnDautre",
    f: x => nuées.value = x,
})

```

### `client.réseau.suivreFavorisMembre({ idCompte, f })`
Suit les favoris d'une utilisatrice Constellation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idCompte` | `string` | L'identifiant de compte de la personne d'intérêt. |
| `f` | `(favoris: ` [`ÉlémentFavorisAvecObjet`](./favoris.md#types) `[]) => void` | Cette fonction sera appelée avec la liste des favoris chaque fois que celle-ci est modifiée. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type favoris as favo } from "@constl/ipa";

const client = générerClient();

const favoris = ref<favo.ÉlémentFavorisAvecObjet[]>();

const fOublier = await client.réseau.suivreFavorisMembre({
    idCompte: "idCompteDeQuelquUnDautre",
    f: x => favoris.value = x,
})

```

### `client.réseau.suivreFavorisObjet({ idObjet, f, profondeur })`
Suit les personnes qui ont marqué un objet (base de données, projet, variable ou autre) en tant que favoris.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idObjet` | `string` | L'identifiant de l'objet d'intérêt. |
| `f` | `(favoris: ( `[`ÉlémentFavorisAvecObjet`](./favoris.md#types) ` & {idCompte: string} ) []) => void` | Cette fonction sera appelée avec la liste des favoris chaque fois que celle-ci est modifiée. |
| `profondeur` | `number` | La profondeur à rechercher dans le réseau (relatif au compte actuel). |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type favoris as favo } from "@constl/ipa";

const client = générerClient();

const favoris = ref<(favo.ÉlémentFavorisAvecObjet & { idCompte: string })[]>();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const fOublier = await client.réseau.suivreFavorisMembre({
    idObjet: idBd,
    f: x => favoris.value = x,
    profondeur: 10,
})

```

### `client.réseau.suivreRéplications({ idObjet, f, profondeur })`
Suit les réplications d'un objet (base de données, projet, variable ou autre) à travers le réseau Constellation. Similaire à [`client.réseau.suivreFavorisObjet`](#clientréseausuivrefavorisobjet-idobjet-f-profondeur), mais inclut aussi de l'information sur la disponibilité en ligne des copies de l'objet.


#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `idObjet` | `string` | L'identifiant de l'objet d'intérêt. |
| `f` | `(favoris: `[`infoRéplications`](#types-replications) `) => void` | Cette fonction sera appelée avec la liste des réplications chaque fois que celle-ci est modifiée. |
| `profondeur` | `number` | La profondeur à rechercher dans le réseau (relatif au compte actuel). |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient, type réseau } from "@constl/ipa";

const client = générerClient();

const réplications = ref<réseau.infoRéplications>();

const idBd = await client.bds.créerBd({ licence: "ODBl-1_0" });

const fOublier = await client.réseau.suivreRéplications({
    idObjet: idBd,
    f: x => réplications.value = x,
    profondeur: 10,
})

```

## Protocoles
Constellation permet d'initialiser des dispositifs avec une [liste de protocoles tiers](./client.md#initialisation). Ces protocoles permettent à des applications construites sur Constellation de retrouver leurs membres sur le réseau.

### `client.réseau.suivreProtocolesMembre({ f, idCompte })`
Suit les protocoles associés à un membre du réseau Constellation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(protocoles: string[]) => void` | Cette fonction sera appelée avec la liste des protocoles du compte chaque fois que celle-ci est modifiée. |
| `idCompte` | `string |\ undefined` | L'identifiant de compte dont on veut connaître les protocoles. Si non spécifié, Constellation utilisera le compte actuel. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const protocoles = ref<string[]>();

const fOublier = await client.réseau.suivreProtocolesMembre({
    f: x => protocoles.value = x,
})

```

### `client.réseau.suivreProtocolesDispositif({ f, idDispositif })`
Suit les protocoles associés à un dispositif sur le réseau Constellation.

#### Paramètres
| Nom | Type | Description |
| --- | ---- | ----------- |
| `f` | `(protocoles: string[]) => void` | Cette fonction sera appelée avec la liste des protocoles du compte chaque fois que celle-ci est modifiée. |
| `idDispositif` | `string \| undefined` | L'identifiant du dispositif dont veut connaître les protocoles. Si non spécifié, Constellation utilisera le dispositif actuel. |

#### Retour
| Type | Description |
| ---- | ----------- |
| `Promise<() => Promise<void>>` | Fonction à appeler pour arrêter le suivi. |

#### Exemple
```ts
import { ref } from "vue";
import { générerClient } from "@constl/ipa";

const client = générerClient();

const protocoles = ref<string[]>();

const fOublier = await client.réseau.suivreProtocolesDispositif({
    f: x => protocoles.value = x,
})

```

## Types
Plusieurs types sont associés avec le réseautage Constellation.

### Types connexions
Ces types sont associés avec les connexions du réseau.

```ts
interface infoMembre {
  idCompte: string;
  protocoles: string[];
  dispositifs: infoDispositif[];
}

interface statutMembre {
  infoMembre: infoMembre;
  vuÀ?: number;
}

type infoDispositif = {
  idSFIP: string;
  idDispositif: string;
  idCompte: string;
  clefPublique: string;
  signatures: { id: string; publicKey: string };
  encryption?: { type: string; clefPublique: string };
};

type infoMembreRéseau = {
  idCompte: string;
  profondeur: number;
  confiance: number;
};
```


### Types réplications

```ts
interface infoRéplications {
  membres: statutMembre[];
  dispositifs: (épingleDispositif & {
    idDispositif: string;
    idCompte?: string;
    vuÀ?: number;
  })[];
}
```

