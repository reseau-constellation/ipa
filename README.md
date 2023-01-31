# IPA Constellation
[![Tests](https://github.com/reseau-constellation/ipa/actions/workflows/tests.yml/badge.svg)](https://github.com/reseau-constellation/ipa/actions/workflows/tests.yml)

Le logiciel Constellation est divisé en deux parties principales :
[l'interface graphique](https://github.com/reseau-constellation/constellation/)
et le code de réseautage (interface de programmation d'applications, ou IPA).
Cette séparation vous permet de développer vos propres interfaces spécifiques
à vos projets et besoins, tout en connectant vos applications au réseau
distribué Constellation.

Ce répertoire contient le code de l'IPA de Constellation.
C'est ici que vous retrouverez toutes les fonctionnalités du réseau
Constellation. L'IPA de Constellation est une librairie TypeScript qui peut être utilisée dans n'importe quelle application afin de la connecter avec le réseau
distribué Constellation.

## Installation
Vous pouvez ajouter l'IPA Constellation à vos projets JavaScript ou TypeScript
avec la commande suivante:

```sh
$ pnpm install @constl/ipa
```

Si vous développez une application dans un autre langage (p. ex., Python),
nous vous recommandons d'utiliser le [serveur WS Constellation](https://github.com/reseau-constellation/serveur-ws) ou bien l'un de ses clients pré-fabriqués
([Python](https://github.com/reseau-constellation/client-python),
[R](https://github.com/reseau-constellation/client-r), [Julia](https://github.com/reseau-constellation/Constellation.jl))
selon le langage de votre projet.

## Utilisation
Une fois l'IPA installé, vous pouvez importer Constellation et l'utiliser dans vos
projets.

```TypeScript
import { client } from "@constl/ipa";
...

```

## Documentation
Pour la documentation complète de Constellation, rendez-vous au https://docu.réseau-constellation.ca.
