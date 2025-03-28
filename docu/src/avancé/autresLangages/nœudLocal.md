# Nœud local
[![Serveur WS](https://github.com/reseau-constellation/serveur-ws/actions/workflows/tests.yml/badge.svg)](https://github.com/reseau-constellation/serveur-ws/actions/workflows/tests.yml)

La librairie `@constl/serveur` vous permet de créer un nœud local Constellation et de le rendre accessible à d'autres logiciels sur votre machine par l'entremise d'un serveur WS local.

::: danger DANGER
⚠️ Ce serveur **local** n'est pas apte à être utilisé en tant que serveur publique ! Entre autres limitations, **il donne accès illimité à un environnement Node.js**. Il est donc configuré afin d'être uniquement disponible sur localhost. Ce serveur est dédié uniquement à la communication entre processus sur le même ordinateur, lorsque différents processus veulent accéder au même nœud Constellation local.

**N'exposez jamais le serveur WS Constellation sur un port publique.**
:::

## Utilisation
Si vous voulez tout simplement utiliser Constellation avec Python ou R, veuillez installer les librairies respectives [constellation-py](https://github.com/reseau-constellation/client-python), [Constellation.jl](https://github.com/reseau-constellation/Consellation.jl) et [constellation-R](https://github.com/reseau-constellation/client-r) (en progrès). Celles-ci se chargeront automatiquement de lancer le serveur Constellation.

## Installation globale
L'installation globale vous permet de lancer un nœud local Constellation de la ligne de commande. Si vous comptez simplement utiliser le serveur Constellation (y compris pour une analyse en Python, en R ou en Julia), installez-le comme suit :

::: code-group
```bash [pnpm]
$ curl https://raw.githubusercontent.com/reseau-constellation/serveur-ws/principale/installer.cjs | node -
```
:::

### Ligne de commande
Vous pourrez ensuite lancer le nœud local en spécifiant (ou non) le port et le dossier à utiliser pour sauvegarder les données de votre compte :

`$ constl lancer [-p <port>] [--dossier <dossier>]`


Pour obtenir le numéro de la version :
```bash
$ constl version
```

Pour obtenir de l'aide :
```bash
$ constl -a
```

## Utilisation dans un autre projet
Si vous voulez incorporer le serveur Constellation dans une autre librairie
JavaScript, vous pouvez l'installer ainsi :

::: code-group
```bash [pnpm]
$ pnpm add @constl/serveur
```
```bash [npm]
$ pnpm install @constl/serveur
```
:::

Vous pourrez ensuite importer le serveur dans votre propre code et le lancer programmatiquement.

::: tip CONSEIL 
Constellation elle-même (`@constl/ipa`) est spécifiée en tant que dépendance pair du serveur Constellation. Vous pouvez donc installer la version de Constellation qui vous convient.
:::

### Serveur
```JavaScript
import { lancerServeur } from "@constl/serveur";

const { fermerServeur, port, codeSecret } = await lancerServeur();

// `port` contient maintenant le numéro de port à utiliser dans le client
// `codeSecret` contient le code secret à utiliser pour se connecter au serveur

// Lorsqu'on a fini :
fermerServeur();

```

Invoqué sans configuration, `lancerServeur` trouvera un port disponible sur `localhost` et redonnera cette valeur dans la variable `port`. Vous pouvez également spécifier une configuration Constellation plus précise :

```TypeScript
import { lancerServeur } from "@constl/serveur";

const { fermerServeur, port, codeSecret } = await lancerServeur({
  port: 5003,
  optsConstellation: {
    dossier: "mon-dossier",  // Dossier du compte Constellation
  }
});

```

### Client

Vous voudrez aussi probablement utiliser le client websocket qui est aussi disponible dans cette librairie. Celui-ci peut être lancé dans un processus séparé, se connecte au serveur local Constellation et vous pemettra de l'utiliser comme s'il s'agissait d'une instance Constellation normale. Alternativement, vous pouvez vous connecter au serveur à partir d'un autre langage informatique.

```TypeScript
import { lancerClient } from "@constl/serveur";

const port = 5001  // Ou une autre valeur, selon `lancerServeur`
const codeSecret = "le code secret donné par le serveur"
const { client, fermerClient } = lancerClient({ port, codeSecret });

// On peut maintenant appeler des fonctions sur le client comme s'il
// s'agissait d'un client Constellation ordinaire :
let noms = {};
const oublierNoms = await client.profil.suivreNoms(x => noms = x);

// Pour arrêter le suivi :
oublierNoms();

// Lorsqu'on a fini :
fermerClient();

```

