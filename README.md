# L'interface de programmation d'applications (IPA) de Constellation
[![Couverture](https://codecov.io/gh/reseau-constellation/ipa/branch/main/graph/badge.svg?token=D41D2XBE0P)](https://codecov.io/gh/reseau-constellation/ipa)

L'IPA JavaScript de Constellation contient tout le code nécessaire pour se joindre
et pour participer au réseau Constellation. Le code roule entièrement sur le
client (pensez navigateur, téléphone «intelligent», Électron, etc.). Donc,
vous pouvez oublier les serveurs !

Si vous cherchez le code pour l'application Constellation elle-même
(l'interface graphique), veuillez vous rendre [ici](https://github.com/reseau-constellation/constellation).

**Attention ! Constellation est un programme en développement actif. Pis encore,
il se repose sur des technologies (Orbit-DB et SFIP) qui sont en mode alpha
elles-mêmes. Tout peut briser à tout moment. Utilisez à vos propres risques et
gardez toujours une copie de vos données externe à Constellation (on vous
expliquera comment faire ça facilement dans la documentation).**

## Comment ça marche
Vous pouvez installer Constellation avec `yarn`:
`yarn install @constl/ipa`

Si vous voulez utiliser Constellation pour partager vos données, l'interface
générale offerte par [l'appli Constellation](https://reseau-constellation.github.io/constellation/) est probablement suffisante. Vous n'avez plus rien à faire ici !

Cependant, si vous développez votre propre logiciel ou appli pour la science citoyenne
(p. ex., une appli de recensement écologique, un projet de collecte de données hydriques...)
vous voudrez probablement développer votre propre interface. C'est là que vous
devrez utiliser l'IPA de Constellation.

## Exemples et tutoriels
*On en écrira éventuellement !* En attendant, contactez-moi au julien.malard@mail.mcgill.ca.
