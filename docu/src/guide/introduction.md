# Introduction

Constellation est un logiciel de bases de données scientifiques distribuées. Il vous permet de collecter et de diffuser vos données scientifiques sans serveur ou dépôt centralisé.

## Qu'est-ce qu'un système distribué ?
Dans une système distribué, il n'y a pas de serveur qui contrôle les interactions entres utilisateurs. Les personnes participant au réseau communiquent donc directement entre elles. C'est plus résilient et plus amusant !

![systèmeCentralisé](/images/systèmeCentralisé.svg)

## Pourquoi un logiciel *local* ?
Constellation est un logiciel *local* qui garde toutes vos données sur votre propre dispositif (comme Excel ou LibreOffice). Vous n'êtes donc pas à la mercie du Wifi ou de Google pour pouvoir accéder à vos propres données. Cependant, Constellation vous permet aussi de collaborer en ligne et de partager (et syncroniser) vos données en temps réel (comme les documents Google). C'est le meilleur des deux mondes !

| Avantages | Applis intallées (p.ex., Excel) | Applis nuage (p.ex., Google) | Applis locales |
| --- | :---: | :---: | :---: |
| Rapidité | ✅ | ❌ | ✅ |
| Sans dépendance Internet | ✅ | ❌ | ✅ |
| Sans [enfermerment propriétaire](https://fr.wikipedia.org/wiki/Enfermement_propri%C3%A9taire) | ✅ | ❌ | ✅ |
| Collaboration | ❌ | ✅ | ✅ |
| Autorisations d'équipe | ❌ | ✅ | ✅ |
| Sauvegarde en ligne | ❌ | ✅ | ✅ |
| Mises à jour en directe | ❌ | ✅ | ✅ |

**Note : Tableau adapté de [local-first-web](https://github.com/local-first-web)** de Herb Caudill.

## Philosophie générale
La philosophie de Constellation se résume en quelques grandes lignes :

**Accès libre** : Les données scientifiques devraient être ouvertes et accessibles. Toutes les données partagées sur Constellation sont publiques. (Si vous travaillez en recherche clinique, ce n'est peut-être pas le logiciel pour vous.)

**Source ouverte** : Tous les logiciels de l'univers Constellation sont distribués sous licence libre.

**Indépendance** : Constellation est un logiciel ouvert, et les données sont sauvegardées sur les dispositifs des utilisatrices et utilisateurs. Les communautés gardent donc le contrôle sur leurs propres données en tout temps.

**Accessible et multilingue** : Le monde est une place multilingue ; le monde de la recherche, lui, ne l'est malheureusement pas autant. Beaucoup de données sont collectées dans des régions du monde et ensuite publiées dans des langues que les personnes qui les ont fournies ne parlent pas. Cependant, la structure des logiciels que nous utilisons façonne notre pensée, pour le mieux ou pour le pire. Beaucoup de logiciels de bases de données (Excel, MongoDB, etc.) ne permettent qu'un seul nom par colonne ou champ ; nous sommes ainsi entraînés à entrer des données monolingues. Nous avons donc conceptualisé Constellation afin qu'elle guide ses utilisateurs et utilisatrices vers une meilleure inclusion. Chaque objet en Constellation, soit-ce votre profil, une variable ou une base de données, peut être nommé en autant de langues que vous voulez. Vos données apparaîtront donc dans la langue préférée de chacune de vos utilisatrices finales.


## Comment ça se compare à ... ?

| Fonctionnalité | Constellation | [Excel](https://fr.wikipedia.org/wiki/Microsoft_Excel) | [LibreOffice](https://fr.libreoffice.org/) | [Docs Google](https://www.google.com/intl/fr/drive/) | BD sur serveur ([MongoDB](https://www.mongodb.com/fr-fr), [SQL](https://sql.sh/)) |
| --- | :---: | :---: | :---: |:---: | :---: |
| Collaboration simultanée | ✅ | ❌ | ❌ | ✅ | ✅ |
| Fonctionne hors ligne | ✅ | ✅ | ✅ | ❌ | ❌ |
| Photos, vidéos | ✅ | ❌ | ❌ | ✅ | ✅ |
| Contrôle local des données | ✅ | ✅ | ✅ | ❌ | Si le serveur vous appartient |
| Intégration avec vos applis | ✅ | ❌ | ❌ | ✅ | ✅ |
| Source ouverte | ✅ | ❌ | ✅ | ❌ | [C'est compliqué](https://www.zdnet.fr/actualites/mongodb-la-nouvelle-licence-sspl-fait-grincer-des-dents-dans-l-open-source-39879413.htm) |

