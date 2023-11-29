# Questions et problèmes

[[toc]]

## Erreurs fréquentes Constellation
Nous répertorions ici les erreurs fréquentes que l'on a rencontrés en utilisant Constellation. *Apprenons des maux de tête des autres !*

### `SyntaxError: Unexpected identifier`
Assurez-vous d'être sur la plus récente version de `Node.js`. Si vous utilisez [`nvm`](https://github.com/nvm-sh/nvm), `nvm use stable` devrait régler le problème.

### `LockExistsError: Lock already being held for file: constl/sfip/repo.lock`
Vous avez probablement lancé plus d'une instance de Constellation en même temps.

### `Error: Listener is not ready yet`
Vous avez probablement lancé plus d'une instance de Constellation en même temps.