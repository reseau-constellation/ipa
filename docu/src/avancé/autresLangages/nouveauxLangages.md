# Nouveaux langages
Si vous voulez développer un client Constellation pour un autre langage informatique, vous pouvez utiliser la spécification ci-dessous afin de développer une interface dans le langage de votre choix qui communiquera avec le nœud Constellation.

Les clients existants (JavaScript, Python, Julia et R) implémentent tous cette interface.

## Spécification générale
Le client devra communiquer avec le nœud Constellation par l'entremise de WebSockets. Vous pouvez accéder les fonctions action, de suivi ou de recherche de Constellation. Les actions sont les fonctions qui vous redonnent immédiatement une valeur, tandis que les [fonctions de suivi](../../ipa/introduction.md#quelques-concepts) sont celles qui écoutent les changements du réseau et vous renvoient les nouvelles données en temps réel, au fur et à mesure qu'elles changent.

### Actions
Pour invoquer une action Constellation, le client devra envoyer un message de la forme suivante :

```TypeScript
interface MessageActionPourTravailleur extends MessagePourTravailleur {
  type: "action";
  id: string;  // Un identifiant unique (qui sera inclut dans le message de retour avec le résultat de la requête)
  fonction: string[];  // Le nom de la fonction Constellation, en forme de liste
  args: { [key: string]: unknown };  // Les arguments de la fonction Constellation
}
```

Il recevra ensuite, du serveur, un message de la forme suivante :

```TypeScript
interface MessageActionDeTravailleur extends MessageDeTravailleur {
  type: "action";
  id: string;  // Le même identifiant qu'inclus dans le message `MessageActionPourTravailleur` originalement envoyé au serveur
  résultat: unknown;  // Le résultat de la fonction
}
```

À titre d'exemple, la fonction suivante de l'[IPA Constellation](https://github.com/reseau-constellation/ipa) crée une nouvelle base de données.
```TypeScript
const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" })
```

Afin d'invoquer la même fonction par le serveur Constellation, nous enverrons un message comme suit (utilisant le module [uuid](https://www.npmjs.com/package/uuid) pour générer un identifiant unique pour la requête). L'exemple de code est donné en TypeScript, mais pourrait être en n'importe quel
langage informatique.

```TypeScript
import { v4 as uuidv4 } from 'uuid';

const id = uuidv4();

const message: MessageActionPourTravailleur = {
  type: "action",
  id,
  fonction: ["bds", "créerBd"],
  args: { "licence": "ODbl-1_0" },
}

// Envoyer le message par WS au serveur sur le port connecté.
```

Et nous recevrons une réponse comme tel :

```Json
{
  "type": "action",
  "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  "résultat": "/orbitdb/..."
}
```

### Suivis
Les fonctions qui suivent les résultats d'une requête à travers le temps, plutôt que je redonner un résultat ponctuel dans le temps, sont un peu plus compliquées. La fonction suivante suis les noms d'une variable :


```TypeScript
const idDeMaVariable = "/orbitdb/..."  // Selon la variable qui vous intéresse ; générée par `client.variables.créerVariable`
const fOublier = await client.variables.suivreNomsVariable({ id: idDeMaVariable, f: console.log });

// Annuler le suivi
await fOublier();
```

Pour invoquer la même fonction par le serveur, nous enverrons le message suivant :

```TypeScript
import { v4 as uuidv4 } from 'uuid';

const id = uuidv4();

const message: MessageSuivrePourTravailleur = {
  type: "suivre",
  id,
  fonction: ["variables", "suivreNomsVariable"],
  args: { id: idDeMaVariable },
  nomArgFonction: "f",  // Nom de l'argument correspondant à la fonction de suivi
}

// Envoyer le message par WS au serveur sur le port connecté.
```

Et nous recevrons une réponse comme tel lorsque le suivi est amorcé :

```Json
{
  "type": "suivrePrêt",
  "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
}
```

Et des messages suiveront avec les résultats en temps réel de la recherche :

```Json
{
  "type": "suivre",
  "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  "résultat": { "fr": "Précipitation", "த": "பொழிவு" }
}
```

Pour annuler le suivi, envoyer le message suivant :

```TypeScript
const message: MessageRetourPourTravailleur = {
  type: "retour",
  id,
  fonction: "fOublier"
}

// Envoyer le message par WS au serveur sur le port connecté.
```


### Recherches
Une recherche s'éffectue de manière similaire à un suivi, mais elle retourne également une fonction pour changer le nombre de résultats désirés.

```TypeScript
const { 
  fOublier, 
  fChangerN
} = await client.recherche.rechercherBdSelonNom({ 
  nomBd: "météo", 
  f: console.log,
});

// Demander plus de résultats
await fChangerN(40);

// Annuler la recherche
await fOublier();
```

Pour invoquer la même fonction par le serveur, nous enverrons le message suivant :

```TypeScript
import { v4 as uuidv4 } from 'uuid';

const id = uuidv4();

const message: MessageSuivrePourTravailleur = {
  type: "suivre",
  id,
  fonction: ["recherche", "rechercherBdSelonNom"],
  args: { nomBd: "météo" },
  nomArgFonction: "f",  // Nom de l'argument correspondant à la fonction de suivi
}

// Envoyer le message par WS au serveur sur le port connecté.
```

Et nous recevrons une réponse comme suit lorsque la recherche est amorcée :

```Json
{
  "type": "suivrePrêt",
  "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  "fonctions": ["fOublier", "fChangerN"]
}
```

Pour changer le nombre de résultats désirés, il suffit d'envoyer un message comme suit :

```TypeScript
const message: MessageRetourPourTravailleur = {
  type: "retour",
  id,
  fonction: "fChangerN",
  args: [40]
}

// Envoyer le message par WS au serveur sur le port connecté.
```


### Erreurs
Si le serveur a des difficultés, il enverra un message d'erreur. Le champ `id` est facultatif et sera présent si l'erreur provient spécifiquement d'une requête particulière.

```Json
{
  "type": "erreur",
  "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  "erreur": "Message d'erreur tel que rencontré par le serveur."
}
```
