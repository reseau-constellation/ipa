# Systèmes pair à pair
Afin de bien comprendre Constellation, c'est peut-être util de comprendre ce qu'est un système distribué ou pair à pair. Premièrement, ils ne sont pas exactement la même chose. Un système pair à pair, c'est un système qui, contrairement à votre courriel ou à Google, ne nécessite pas de serveur central pour fonctionner. Chouette, n'est-ce pas ?

Les systèmes pair à pair peuvent être **décentralisés** ou bien **distribués**. Dans un système décentralisé, le logiciel est trop gros ou compliqué pour fonctionner sur la majorité des téléphones ou ordinateurs des participants au réseau. Donc, certains participants au réseau qui ont les gros ordinateurs nécessaires servent de point contact et de service pour la majorité des autres participants. À la fin, c'est beaucoup comme un système centralisé.

Au contraire, dans un système distribué, tout les participants sont égaux les un aux autres. Certains peuvent être connectés avec des machines plus puissantes ou avec plus de mémoire, bien sûr, mais tous intéragissent d'égal à égal dans le réseau.

::: info
Constellation n'est **pas** une chaîne de bloques !

Les systèmes pair à pair ont malheureusement une mauvaise réputation, peut-être parce que la majorité des premiers logiciels populaires étaient des platformes de partage de médias qui étaient aussi illégales. Ensuite sont arrivé les cryptomonnaies basées sur les chaînes de bloques, qui ont fréquemment bien mérité leur réputation en tant que [pyramides de Ponzi](https://web3isgoinggreat.com/) et trous noirs énergétiques [notoirement inefficaces](https://www.usenix.org/publications/loginonline/web3-fraud) pour toute application utile.

Donc nous répétons : Constellation est un système distribué de pair 
 en pair, mais **pas** une chaîne de bloques !
:::

## Mais pourquoi pas une chaîne de bloques ?
Premièrement, parce que c'est ben trop cher. Chaque transaction sur une chaîne de bloques comme Éthereum coûte de la fausse argent (cryptomonnaies), que vous devez malheureusement achetter avec de la vraie argent. Et les fluctuations des prix sont bien entendu complètement hors de notre contrôle. Pourquoi créer un système de données distribuées pour améliorer la souveraineté des données pour ensuite devoir payer des personnes anonymes une somme d'argent variable pour le privilège d'écrire à nos propres bases de données ?

Et deuxièmement, c'est complètement inutil. Les chaînes de bloques sont nécessaires pour les cryptomonnaies et leurs transactions financières. Mais nous, on veut partager des données scientifiques. Nous n'avons rien à faire avec de l'argent ou des transactions financières.

Donc oublions tout ça. Constellation fonctionne de manière complètement distribuée, entièrement sur les dispositifs de ses utilisatrices et utilisateurs.

## Comment ça fonctionne
Lorsque vous sauvegardez des données sur Constellation, celles-ci sont sauvegardées sur votre appareil local, et y resteront toujours disponibles.

::: tip
Si vous sauvegardez vos données sur un système sur le « nuage » comme les documents Google, vous aurez peut-être remarqué que vos données n'apparaissent plus lorsque vous (ou Google !) est hors ligne. L'avantage d'un système local comme Constellation est que vous êtes toujours garanti d'avoir accès à vos données, parce qu'elles demeurent toujours sur votre dispositif.
:::
Le logiciel Constellation recherche également d'autres utilisatrices et utilisateurs du réseau et vous permet d'accéder et de visualiser leurs données. La magie d'un système distribué est qu'il permet aux tièrces personnes de partager, **mais pas de modifier**, les données des autres. Si vous vivez au Québec et vous partagez vos données scientifiques et avant fermez votre téléphone pour aller dormir, vos données ne seront plus disponible sur le réseau jusqu'à votre réveil, heure de l'est. Mais, si quelqu'un d'autre, disons au Botswana, les a déjà accédées, elles seront automatiquement repartagées et disponibles sur le réseau à partir du nouveau dispositif, toute prêtes pour le réveil de vos collègues de l'Inde au Japon ! Donc, contrairement à un système centralisé, sur Constellation, **le plus populaires vos données, le plus disponibles elles seront.**

Mais comment empêchons-nous les autres personnes de modifier vos données avant de les partager ? Chaque changement que vous apportez à vos données est accompagné d'une signature que uniquement votre compte peut générer. Si quelqu'un d'autre essaie de modifier vos données, la signature deviendra invalide et les changements frauduleux seront automatiquement rejetés par le réseau.

## Au niveau technique
Pour ceux et celles qui ça amuse, Constellation est construit sur [bd-orbite](https://orbitdb.org), un logiciel de bases de données distribuées, lui-même construit sur [libp2p](https://libp2p.io) et le Système de fichiers interplanétaire [SFIP](https://ipfs.io/). Toutes les bases de données sur Constellation sont composées de multiples bases de données orbite, tandis que les fichiers (images, vidéos) sont sauvegardés directement sur SFIP.

