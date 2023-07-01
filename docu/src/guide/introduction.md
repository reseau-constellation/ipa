# Introduction

Constellation est un logiciel de bases de données scientifiques distribuées. Il vous permet de collecter et de diffuser vos données scientifiques sans serveur ou dépôt centralisé.

## Qu'est-ce qu'un système distribué ?
Dans une système distribué, il n'y a pas de serveur qui contrôle les interactions entres utilisateurs. Les personnes participant au réseau communiquent donc directement entre elles. C'est plus résilient et plus amusant !

![systèmeCentralisé](/images/systèmeCentralisé.svg)

## Philosophie générale

**Ouvert** : Les données scientifiques devraient être ouvertes et accessibles. Toutes les données partagées sur Constellation sont publiques. (Si vous travaillez en recherche clinique, ce n'est peut-être pas le logiciel pour vous.)

**Source ouverte** : Tous les logiciels de l'univers Constellation sont distribués sous licence libre.

**Multilingue** : Le monde est une place multilingue ; le monde de la recherche, lui, ne l'est malheureusement pas autant. Beaucoup de données sont collectées dans des régions du monde et ensuite publiées dans des langues que les personnes qui les ont fournies ne parlent pas. Cependant, la structure des logiciels que nous utilisons façonne notre pensée, pour le mieux ou pour le pire. Beaucoup de logiciels de bases de données (Excel, MongoDB, etc.) ne permettent qu'un seul nom par colonne ou champ ; nous sommes ainsi entraînés à entrer des données monolingues. Nous avons donc conceptualisé Constellation afin qu'elle guide ses utilisateurs et utilisatrices vers une meilleure inclusion. Chaque objet en Constellation, soit-ce votre profil, une variable ou une base de données, peut être nommé en autant de langues que vous voulez. Vos données apparaîtront donc dans la langue préférée de chacune de vos utilisatrices finales.


## Comment ça se compare à ... ?
| | Constellation | [Excel](https://fr.wikipedia.org/wiki/Microsoft_Excel) | [LibreOffice](https://fr.libreoffice.org/) | [Docs Google](https://www.google.com/intl/fr/drive/) | BD sur serveur ([MongoDB](https://www.mongodb.com/fr-fr), [SQL](https://sql.sh/)) |
| --- | :---: | :---: | :---: |:---: | :---: |
| Collaboration simultanée | ✅ | ❌ | ❌ | ✅ | ✅ |
| Fontionne hors ligne | ✅ | ✅ | ✅ | ❌ | ❌ |
| Photos, vidéos | ✅ | ❌ | ❌ | ✅ | ✅ |
| Contrôle local des données | ✅ | ✅ | ✅ | ❌ | Si le serveur vous appartient |
| Intégration avec vos applis | ✅ | ❌ | ❌ | ✅ | ✅ |
| Source ouverte | ✅ | ❌ | ✅ | ❌ | [C'est compliqué](https://www.zdnet.fr/actualites/mongodb-la-nouvelle-licence-sspl-fait-grincer-des-dents-dans-l-open-source-39879413.htm) |

