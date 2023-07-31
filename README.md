<p align="center">
  <a href="https://docu.réseau-constellation.ca" title="Constellation">
    <img src="https://docu.xn--rseau-constellation-bzb.ca/logo.svg" alt="Logo Constellation" width="244" />
  </a>
</p>
<h1 align="center">IPA Constellation</h1>
<h3 align="center">L'interface de programmation d'applications Constellation</h3>

<p align="center">
  <a href="https://github.com/reseau-constellation/ipa/actions/workflows/tests.yml"><img src="https://github.com/reseau-constellation/ipa/actions/workflows/tests.yml/badge.svg"></a>
  <a href="https://codecov.io/gh/reseau-constellation/ipa" >
 <img src="https://codecov.io/gh/reseau-constellation/ipa/branch/main/graph/badge.svg?token=D41D2XBE0P"/>
 </a>
  <br>
</p>


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
