import{_ as s,o as n,c as e,Q as a}from"./chunks/framework.a7175731.js";const v=JSON.parse('{"title":"Nouveaux langages","description":"","frontmatter":{},"headers":[],"relativePath":"kaq/avancé/autresLangages/nouveauxLangages.md","filePath":"kaq/avancé/autresLangages/nouveauxLangages.md"}'),l={name:"kaq/avancé/autresLangages/nouveauxLangages.md"},o=a(`<h1 id="nouveaux-langages" tabindex="-1">Nouveaux langages <a class="header-anchor" href="#nouveaux-langages" aria-label="Permalink to &quot;Nouveaux langages&quot;">​</a></h1><p>Si vous voulez développer un client Constellation pour un autre langage informatique, vous pouvez utiliser la spécification ci-dessous afin de développer une interface dans le langage de votre choix qui communiquera avec le nœud Constellation.</p><p>Les clients existants (JavaScript, Python, Julia et R) implémentent tous cette interface.</p><h2 id="specification-generale" tabindex="-1">Spécification générale <a class="header-anchor" href="#specification-generale" aria-label="Permalink to &quot;Spécification générale&quot;">​</a></h2><p>Le client devra communiquer avec le nœud Constellation par l&#39;entremise de WebSockets. Vous pouvez accéder les fonctions action, de suivi ou de recherche de Constellation. Les actions sont les fonctions qui vous redonnent immédiatement une valeur, tandis que les <a href="./../../ipa/introduction.html#quelques-concepts">fonctions de suivi</a> sont celles qui écoutent les changements du réseau et vous renvoient les nouvelles données en temps réel, au fur et à mesure qu&#39;elles changent.</p><h3 id="actions" tabindex="-1">Actions <a class="header-anchor" href="#actions" aria-label="Permalink to &quot;Actions&quot;">​</a></h3><p>Pour invoquer une action Constellation, le client devra envoyer un message de la forme suivante :\`\`\`TypeScript interface MessageActionPourTravailleur extends MessagePourTravailleur { type: &quot;action&quot;; id: string; // Un identifiant unique (qui sera inclut dans le message de retour avec le résultat de la requète) fonction: string[]; // Le nom de la fonction Constellation, en forme de liste args: { [key: string]: unknown }; // Les arguments de la fonction Constellation }</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;">Il recevra ensuite, du serveur, un message de la forme suivante :\`\`\`TypeScript</span></span>
<span class="line"><span style="color:#e1e4e8;">interface MessageActionDeTravailleur extends MessageDeTravailleur {</span></span>
<span class="line"><span style="color:#e1e4e8;">  type: &quot;action&quot;;</span></span>
<span class="line"><span style="color:#e1e4e8;">  id: string;  // Le même identifiant qu&#39;inclus dans le message \`MessageActionPourTravailleur\` originalement envoyé au serveur</span></span>
<span class="line"><span style="color:#e1e4e8;">  résultat: unknown;  // Le résultat de la fonction</span></span>
<span class="line"><span style="color:#e1e4e8;">}</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;">Il recevra ensuite, du serveur, un message de la forme suivante :\`\`\`TypeScript</span></span>
<span class="line"><span style="color:#24292e;">interface MessageActionDeTravailleur extends MessageDeTravailleur {</span></span>
<span class="line"><span style="color:#24292e;">  type: &quot;action&quot;;</span></span>
<span class="line"><span style="color:#24292e;">  id: string;  // Le même identifiant qu&#39;inclus dans le message \`MessageActionPourTravailleur\` originalement envoyé au serveur</span></span>
<span class="line"><span style="color:#24292e;">  résultat: unknown;  // Le résultat de la fonction</span></span>
<span class="line"><span style="color:#24292e;">}</span></span></code></pre></div><p>À titre d&#39;exemple, la fonction suivante de l&#39;<a href="https://github.com/reseau-constellation/ipa" target="_blank" rel="noreferrer">IPA Constellation</a> crée une nouvelle base de données.\`\`\`TypeScript const idBd = await client.bds.créerBd({ licence: &quot;ODbl-1_0&quot; })</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;">Afin d&#39;invoquer la même fonction par le serveur Constellation, nous enverrons un message comme suit (utilisant le module [uuid](https://www.npmjs.com/package/uuid) pour générer un identifiant unique pour la requète). L&#39;exemple de code est donné en TypeScript, mais pourrait être en n&#39;importe quel</span></span>
<span class="line"><span style="color:#e1e4e8;">langage informatique.</span></span>
<span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;">\`\`\`TypeScript</span></span>
<span class="line"><span style="color:#e1e4e8;">import { v4 as uuidv4 } from &#39;uuid&#39;;</span></span>
<span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;">const id = uuidv4();</span></span>
<span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;">const message: MessageActionPourTravailleur = {</span></span>
<span class="line"><span style="color:#e1e4e8;">  type: &quot;action&quot;,</span></span>
<span class="line"><span style="color:#e1e4e8;">  id,</span></span>
<span class="line"><span style="color:#e1e4e8;">  fonction: [&quot;bds&quot;, &quot;créerBd&quot;],</span></span>
<span class="line"><span style="color:#e1e4e8;">  args: { &quot;licence&quot;: &quot;ODbl-1_0&quot; },</span></span>
<span class="line"><span style="color:#e1e4e8;">}</span></span>
<span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;">// Envoyer le message par WS au serveur sur le port connecté.</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;">Afin d&#39;invoquer la même fonction par le serveur Constellation, nous enverrons un message comme suit (utilisant le module [uuid](https://www.npmjs.com/package/uuid) pour générer un identifiant unique pour la requète). L&#39;exemple de code est donné en TypeScript, mais pourrait être en n&#39;importe quel</span></span>
<span class="line"><span style="color:#24292e;">langage informatique.</span></span>
<span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;">\`\`\`TypeScript</span></span>
<span class="line"><span style="color:#24292e;">import { v4 as uuidv4 } from &#39;uuid&#39;;</span></span>
<span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;">const id = uuidv4();</span></span>
<span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;">const message: MessageActionPourTravailleur = {</span></span>
<span class="line"><span style="color:#24292e;">  type: &quot;action&quot;,</span></span>
<span class="line"><span style="color:#24292e;">  id,</span></span>
<span class="line"><span style="color:#24292e;">  fonction: [&quot;bds&quot;, &quot;créerBd&quot;],</span></span>
<span class="line"><span style="color:#24292e;">  args: { &quot;licence&quot;: &quot;ODbl-1_0&quot; },</span></span>
<span class="line"><span style="color:#24292e;">}</span></span>
<span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;">// Envoyer le message par WS au serveur sur le port connecté.</span></span></code></pre></div><p>Et nous recevrons une réponse comme tel :</p><div class="language-Json vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">Json</span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#E1E4E8;">{</span></span>
<span class="line"><span style="color:#E1E4E8;">  </span><span style="color:#79B8FF;">&quot;type&quot;</span><span style="color:#E1E4E8;">: </span><span style="color:#9ECBFF;">&quot;action&quot;</span><span style="color:#E1E4E8;">,</span></span>
<span class="line"><span style="color:#E1E4E8;">  </span><span style="color:#79B8FF;">&quot;id&quot;</span><span style="color:#E1E4E8;">: </span><span style="color:#9ECBFF;">&quot;1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&quot;</span><span style="color:#E1E4E8;">,</span></span>
<span class="line"><span style="color:#E1E4E8;">  </span><span style="color:#79B8FF;">&quot;résultat&quot;</span><span style="color:#E1E4E8;">: </span><span style="color:#9ECBFF;">&quot;/orbitdb/...&quot;</span></span>
<span class="line"><span style="color:#E1E4E8;">}</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#24292E;">{</span></span>
<span class="line"><span style="color:#24292E;">  </span><span style="color:#005CC5;">&quot;type&quot;</span><span style="color:#24292E;">: </span><span style="color:#032F62;">&quot;action&quot;</span><span style="color:#24292E;">,</span></span>
<span class="line"><span style="color:#24292E;">  </span><span style="color:#005CC5;">&quot;id&quot;</span><span style="color:#24292E;">: </span><span style="color:#032F62;">&quot;1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&quot;</span><span style="color:#24292E;">,</span></span>
<span class="line"><span style="color:#24292E;">  </span><span style="color:#005CC5;">&quot;résultat&quot;</span><span style="color:#24292E;">: </span><span style="color:#032F62;">&quot;/orbitdb/...&quot;</span></span>
<span class="line"><span style="color:#24292E;">}</span></span></code></pre></div><h3 id="suivis" tabindex="-1">Suivis <a class="header-anchor" href="#suivis" aria-label="Permalink to &quot;Suivis&quot;">​</a></h3><p>Les fonctions qui suivent les résultats d&#39;une requète à travers le temps, plutôt que je redonner un résultat ponctuel dans le temps, sont un peu plus compliquées. La fonction suivante suis les noms d&#39;une variable :</p><div class="language-TypeScript vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">TypeScript</span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">idDeMaVariable</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> </span><span style="color:#9ECBFF;">&quot;/orbitdb/...&quot;</span><span style="color:#E1E4E8;">  </span><span style="color:#6A737D;">// Selon la variable qui vous intéresse ; générée par \`client.variables.créerVariable\`</span></span>
<span class="line"><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">fOublier</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">await</span><span style="color:#E1E4E8;"> client.variables.</span><span style="color:#B392F0;">suivreNomsVariable</span><span style="color:#E1E4E8;">({ id: idDeMaVariable, f: console.log });</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6A737D;">// Annuler le suivi</span></span>
<span class="line"><span style="color:#F97583;">await</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">fOublier</span><span style="color:#E1E4E8;">();</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#D73A49;">const</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">idDeMaVariable</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> </span><span style="color:#032F62;">&quot;/orbitdb/...&quot;</span><span style="color:#24292E;">  </span><span style="color:#6A737D;">// Selon la variable qui vous intéresse ; générée par \`client.variables.créerVariable\`</span></span>
<span class="line"><span style="color:#D73A49;">const</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">fOublier</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">await</span><span style="color:#24292E;"> client.variables.</span><span style="color:#6F42C1;">suivreNomsVariable</span><span style="color:#24292E;">({ id: idDeMaVariable, f: console.log });</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6A737D;">// Annuler le suivi</span></span>
<span class="line"><span style="color:#D73A49;">await</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">fOublier</span><span style="color:#24292E;">();</span></span></code></pre></div><p>Pour invoquer la même fonction par le serveur, nous enverrons le message suivant :\`\`\`TypeScript import { v4 as uuidv4 } from &#39;uuid&#39;;</p><p>const id = uuidv4();</p><p>const message: MessageSuivrePourTravailleur = { type: &quot;suivre&quot;, id, fonction: [&quot;variables&quot;, &quot;suivreNomsVariable&quot;], args: { id: idDeMaVariable }, nomArgFonction: &quot;f&quot;, // Nom de l&#39;argument correspondant à la fonction de suivi }</p><p>// Envoyer le message par WS au serveur sur le port connecté.</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;">Et nous recevrons une réponse comme tel lorsque le suivi est amorcé :</span></span>
<span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;">\`\`\`Json</span></span>
<span class="line"><span style="color:#e1e4e8;">{</span></span>
<span class="line"><span style="color:#e1e4e8;">  &quot;type&quot;: &quot;suivrePrêt&quot;,</span></span>
<span class="line"><span style="color:#e1e4e8;">  &quot;id&quot;: &quot;1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&quot;,</span></span>
<span class="line"><span style="color:#e1e4e8;">}</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;">Et nous recevrons une réponse comme tel lorsque le suivi est amorcé :</span></span>
<span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;">\`\`\`Json</span></span>
<span class="line"><span style="color:#24292e;">{</span></span>
<span class="line"><span style="color:#24292e;">  &quot;type&quot;: &quot;suivrePrêt&quot;,</span></span>
<span class="line"><span style="color:#24292e;">  &quot;id&quot;: &quot;1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&quot;,</span></span>
<span class="line"><span style="color:#24292e;">}</span></span></code></pre></div><p>Et des messages suiveront avec les résultats en temps réel de la recherche :\`\`\`Json { &quot;type&quot;: &quot;suivre&quot;, &quot;id&quot;: &quot;1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&quot;, &quot;résultat&quot;: { &quot;fr&quot;: &quot;Précipitation&quot;, &quot;த&quot;: &quot;பொழிவு&quot; } }</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;">Pour annuler le suivi, envoyer le message suivant :\`\`\`TypeScript</span></span>
<span class="line"><span style="color:#e1e4e8;">const message: MessageRetourPourTravailleur = {</span></span>
<span class="line"><span style="color:#e1e4e8;">  type: &quot;retour&quot;,</span></span>
<span class="line"><span style="color:#e1e4e8;">  id,</span></span>
<span class="line"><span style="color:#e1e4e8;">  fonction: &quot;fOublier&quot;</span></span>
<span class="line"><span style="color:#e1e4e8;">}</span></span>
<span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;">// Envoyer le message par WS au serveur sur le port connecté.</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;">Pour annuler le suivi, envoyer le message suivant :\`\`\`TypeScript</span></span>
<span class="line"><span style="color:#24292e;">const message: MessageRetourPourTravailleur = {</span></span>
<span class="line"><span style="color:#24292e;">  type: &quot;retour&quot;,</span></span>
<span class="line"><span style="color:#24292e;">  id,</span></span>
<span class="line"><span style="color:#24292e;">  fonction: &quot;fOublier&quot;</span></span>
<span class="line"><span style="color:#24292e;">}</span></span>
<span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;">// Envoyer le message par WS au serveur sur le port connecté.</span></span></code></pre></div><h3 id="recherches" tabindex="-1">Recherches <a class="header-anchor" href="#recherches" aria-label="Permalink to &quot;Recherches&quot;">​</a></h3><p>Une recherche s&#39;éffectue de manière similaire à un suivi, mais elle retourne également une fonction pour changer le nombre de résultats désirés.</p><div class="language-TypeScript vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">TypeScript</span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> { </span></span>
<span class="line"><span style="color:#E1E4E8;">  </span><span style="color:#79B8FF;">fOublier</span><span style="color:#E1E4E8;">, </span></span>
<span class="line"><span style="color:#E1E4E8;">  </span><span style="color:#79B8FF;">fChangerN</span></span>
<span class="line"><span style="color:#E1E4E8;">} </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">await</span><span style="color:#E1E4E8;"> client.recherche.</span><span style="color:#B392F0;">rechercherBdSelonNom</span><span style="color:#E1E4E8;">({ </span></span>
<span class="line"><span style="color:#E1E4E8;">  nomBd: </span><span style="color:#9ECBFF;">&quot;météo&quot;</span><span style="color:#E1E4E8;">, </span></span>
<span class="line"><span style="color:#E1E4E8;">  f: console.log, </span></span>
<span class="line"><span style="color:#E1E4E8;">  nRésultatsDésirés: </span><span style="color:#79B8FF;">30</span><span style="color:#E1E4E8;"> </span></span>
<span class="line"><span style="color:#E1E4E8;">});</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6A737D;">// Demander plus de résultats</span></span>
<span class="line"><span style="color:#F97583;">await</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">fChangerN</span><span style="color:#E1E4E8;">(</span><span style="color:#79B8FF;">40</span><span style="color:#E1E4E8;">);</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6A737D;">// Annuler la recherche</span></span>
<span class="line"><span style="color:#F97583;">await</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">fOublier</span><span style="color:#E1E4E8;">();</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#D73A49;">const</span><span style="color:#24292E;"> { </span></span>
<span class="line"><span style="color:#24292E;">  </span><span style="color:#005CC5;">fOublier</span><span style="color:#24292E;">, </span></span>
<span class="line"><span style="color:#24292E;">  </span><span style="color:#005CC5;">fChangerN</span></span>
<span class="line"><span style="color:#24292E;">} </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">await</span><span style="color:#24292E;"> client.recherche.</span><span style="color:#6F42C1;">rechercherBdSelonNom</span><span style="color:#24292E;">({ </span></span>
<span class="line"><span style="color:#24292E;">  nomBd: </span><span style="color:#032F62;">&quot;météo&quot;</span><span style="color:#24292E;">, </span></span>
<span class="line"><span style="color:#24292E;">  f: console.log, </span></span>
<span class="line"><span style="color:#24292E;">  nRésultatsDésirés: </span><span style="color:#005CC5;">30</span><span style="color:#24292E;"> </span></span>
<span class="line"><span style="color:#24292E;">});</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6A737D;">// Demander plus de résultats</span></span>
<span class="line"><span style="color:#D73A49;">await</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">fChangerN</span><span style="color:#24292E;">(</span><span style="color:#005CC5;">40</span><span style="color:#24292E;">);</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6A737D;">// Annuler la recherche</span></span>
<span class="line"><span style="color:#D73A49;">await</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">fOublier</span><span style="color:#24292E;">();</span></span></code></pre></div><p>Pour invoquer la même fonction par le serveur, nous enverrons le message suivant :\`\`\`TypeScript import { v4 as uuidv4 } from &#39;uuid&#39;;</p><p>const id = uuidv4();</p><p>const message: MessageSuivrePourTravailleur = { type: &quot;suivre&quot;, id, fonction: [&quot;recherche&quot;, &quot;rechercherBdSelonNom&quot;], args: { nomBd: &quot;météo&quot;, nRésultatsDésirés: 30 }, nomArgFonction: &quot;f&quot;, // Nom de l&#39;argument correspondant à la fonction de suivi }</p><p>// Envoyer le message par WS au serveur sur le port connecté.</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;">Et nous recevrons une réponse comme suit lorsque la recherche est amorcée :\`\`\`Json</span></span>
<span class="line"><span style="color:#e1e4e8;">{</span></span>
<span class="line"><span style="color:#e1e4e8;">  &quot;type&quot;: &quot;suivrePrêt&quot;,</span></span>
<span class="line"><span style="color:#e1e4e8;">  &quot;id&quot;: &quot;1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&quot;,</span></span>
<span class="line"><span style="color:#e1e4e8;">  &quot;fonctions&quot;: [&quot;fOublier&quot;, &quot;fChangerN&quot;]</span></span>
<span class="line"><span style="color:#e1e4e8;">}</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;">Et nous recevrons une réponse comme suit lorsque la recherche est amorcée :\`\`\`Json</span></span>
<span class="line"><span style="color:#24292e;">{</span></span>
<span class="line"><span style="color:#24292e;">  &quot;type&quot;: &quot;suivrePrêt&quot;,</span></span>
<span class="line"><span style="color:#24292e;">  &quot;id&quot;: &quot;1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&quot;,</span></span>
<span class="line"><span style="color:#24292e;">  &quot;fonctions&quot;: [&quot;fOublier&quot;, &quot;fChangerN&quot;]</span></span>
<span class="line"><span style="color:#24292e;">}</span></span></code></pre></div><p>Pour changer le nombre de résultats désirés, il suffit d&#39;envoyer un message comme suit :\`\`\`TypeScript const message: MessageRetourPourTravailleur = { type: &quot;retour&quot;, id, fonction: &quot;fChangerN&quot;, args: [40] }</p><p>// Envoyer le message par WS au serveur sur le port connecté.</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki github-dark has-diff vp-code-dark"><code><span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;">### Erreurs</span></span>
<span class="line"><span style="color:#e1e4e8;">Si le serveur a des difficultés, il enverra un message d&#39;erreur. Le champ \`id\` est facultatif et sera présent si l&#39;erreur provient spécifiquement d&#39;une requète particulière.</span></span>
<span class="line"><span style="color:#e1e4e8;"></span></span>
<span class="line"><span style="color:#e1e4e8;">\`\`\`Json</span></span>
<span class="line"><span style="color:#e1e4e8;">{</span></span>
<span class="line"><span style="color:#e1e4e8;">  &quot;type&quot;: &quot;erreur&quot;,</span></span>
<span class="line"><span style="color:#e1e4e8;">  &quot;id&quot;: &quot;1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&quot;,</span></span>
<span class="line"><span style="color:#e1e4e8;">  &quot;erreur&quot;: &quot;Message d&#39;erreur tel que rencontré par le serveur.&quot;</span></span>
<span class="line"><span style="color:#e1e4e8;">}</span></span></code></pre><pre class="shiki github-light has-diff vp-code-light"><code><span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;">### Erreurs</span></span>
<span class="line"><span style="color:#24292e;">Si le serveur a des difficultés, il enverra un message d&#39;erreur. Le champ \`id\` est facultatif et sera présent si l&#39;erreur provient spécifiquement d&#39;une requète particulière.</span></span>
<span class="line"><span style="color:#24292e;"></span></span>
<span class="line"><span style="color:#24292e;">\`\`\`Json</span></span>
<span class="line"><span style="color:#24292e;">{</span></span>
<span class="line"><span style="color:#24292e;">  &quot;type&quot;: &quot;erreur&quot;,</span></span>
<span class="line"><span style="color:#24292e;">  &quot;id&quot;: &quot;1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&quot;,</span></span>
<span class="line"><span style="color:#24292e;">  &quot;erreur&quot;: &quot;Message d&#39;erreur tel que rencontré par le serveur.&quot;</span></span>
<span class="line"><span style="color:#24292e;">}</span></span></code></pre></div>`,33),p=[o];function t(r,c,i,u,d,y){return n(),e("div",null,p)}const g=s(l,[["render",t]]);export{v as __pageData,g as default};
