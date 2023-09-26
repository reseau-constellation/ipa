import{_ as s,o as n,c as a,Q as l}from"./chunks/framework.a7175731.js";const d=JSON.parse('{"title":"R","description":"","frontmatter":{},"headers":[],"relativePath":"తె/avancé/autresLangages/r.md","filePath":"తె/avancé/autresLangages/r.md"}'),p={name:"తె/avancé/autresLangages/r.md"},o=l(`<h1 id="r" tabindex="-1">R <a class="header-anchor" href="#r" aria-label="Permalink to &quot;R&quot;">​</a></h1><p>Le client R vous permet d&#39;accéder au réseau Constellation à partir d&#39;un programme en <a href="https://www.r-project.org/" target="_blank" rel="noreferrer">R</a>.</p><p><a href="https://github.com/reseau-constellation/client-r/actions/workflows/R-CMD-check.yaml" target="_blank" rel="noreferrer"><img src="https://github.com/reseau-constellation/client-r/actions/workflows/R-CMD-check.yaml/badge.svg" alt="R-CMD-check"></a><a href="https://codecov.io/github/reseau-constellation/client-r" target="_blank" rel="noreferrer"><img src="https://codecov.io/github/reseau-constellation/client-r/graph/badge.svg?token=U2MUE2ZLGO" alt="codecov"></a></p><h2 id="installation" tabindex="-1">Installation <a class="header-anchor" href="#installation" aria-label="Permalink to &quot;Installation&quot;">​</a></h2><p>Vous pouvez installer <code>constellationR</code> de <a href="https://github.com/" target="_blank" rel="noreferrer">GitHub</a> ainsi :</p><div class="language-r vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">r</span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#6A737D;"># install.packages(&quot;devtools&quot;)</span></span>
<span class="line"><span style="color:#B392F0;">devtools</span><span style="color:#F97583;">::</span><span style="color:#FFAB70;">install_github</span><span style="color:#E1E4E8;">(</span><span style="color:#9ECBFF;">&quot;reseau-constellation/client-r&quot;</span><span style="color:#E1E4E8;">)</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#6A737D;"># install.packages(&quot;devtools&quot;)</span></span>
<span class="line"><span style="color:#6F42C1;">devtools</span><span style="color:#D73A49;">::</span><span style="color:#E36209;">install_github</span><span style="color:#24292E;">(</span><span style="color:#032F62;">&quot;reseau-constellation/client-r&quot;</span><span style="color:#24292E;">)</span></span></code></pre></div><h2 id="utilisation" tabindex="-1">Utilisation <a class="header-anchor" href="#utilisation" aria-label="Permalink to &quot;Utilisation&quot;">​</a></h2><p>Vous pouvez effectuer des actions ainsi :</p><div class="language-r vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">r</span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#79B8FF;">library</span><span style="color:#E1E4E8;">(constellationR)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#B392F0;">constellationR</span><span style="color:#F97583;">::</span><span style="color:#FFAB70;">avecClientEtServeur</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">  function (client) {</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#6A737D;"># Accéder l&#39;identifiant du compte</span></span>
<span class="line"><span style="color:#E1E4E8;">    idCompte </span><span style="color:#F97583;">&lt;-</span><span style="color:#E1E4E8;"> client</span><span style="color:#F97583;">$</span><span style="color:#FFAB70;">appeler</span><span style="color:#E1E4E8;">(</span><span style="color:#9ECBFF;">&quot;obtIdCompte&quot;</span><span style="color:#E1E4E8;">)</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#6A737D;"># Créer une nouvelle base de données</span></span>
<span class="line"><span style="color:#E1E4E8;">    idBd </span><span style="color:#F97583;">&lt;-</span><span style="color:#E1E4E8;"> client</span><span style="color:#F97583;">$</span><span style="color:#FFAB70;">appeler</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#9ECBFF;">&quot;bds.créerBd&quot;</span><span style="color:#E1E4E8;">, </span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#F97583;">list</span><span style="color:#E1E4E8;">(</span><span style="color:#FFAB70;">licence</span><span style="color:#F97583;">=</span><span style="color:#9ECBFF;">&quot;ODbl-1_0&quot;</span><span style="color:#E1E4E8;">)</span></span>
<span class="line"><span style="color:#E1E4E8;">    )</span></span>
<span class="line"><span style="color:#E1E4E8;">  }</span></span>
<span class="line"><span style="color:#E1E4E8;">)</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#005CC5;">library</span><span style="color:#24292E;">(constellationR)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6F42C1;">constellationR</span><span style="color:#D73A49;">::</span><span style="color:#E36209;">avecClientEtServeur</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">  function (client) {</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#6A737D;"># Accéder l&#39;identifiant du compte</span></span>
<span class="line"><span style="color:#24292E;">    idCompte </span><span style="color:#D73A49;">&lt;-</span><span style="color:#24292E;"> client</span><span style="color:#D73A49;">$</span><span style="color:#E36209;">appeler</span><span style="color:#24292E;">(</span><span style="color:#032F62;">&quot;obtIdCompte&quot;</span><span style="color:#24292E;">)</span></span>
<span class="line"><span style="color:#24292E;">    </span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#6A737D;"># Créer une nouvelle base de données</span></span>
<span class="line"><span style="color:#24292E;">    idBd </span><span style="color:#D73A49;">&lt;-</span><span style="color:#24292E;"> client</span><span style="color:#D73A49;">$</span><span style="color:#E36209;">appeler</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#032F62;">&quot;bds.créerBd&quot;</span><span style="color:#24292E;">, </span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#D73A49;">list</span><span style="color:#24292E;">(</span><span style="color:#E36209;">licence</span><span style="color:#D73A49;">=</span><span style="color:#032F62;">&quot;ODbl-1_0&quot;</span><span style="color:#24292E;">)</span></span>
<span class="line"><span style="color:#24292E;">    )</span></span>
<span class="line"><span style="color:#24292E;">  }</span></span>
<span class="line"><span style="color:#24292E;">)</span></span></code></pre></div><p>Vous pouvez également suivre des données du réseau Constellation :</p><div class="language-r vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">r</span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#79B8FF;">library</span><span style="color:#E1E4E8;">(constellationR)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#B392F0;">constellationR</span><span style="color:#F97583;">::</span><span style="color:#FFAB70;">avecClientEtServeur</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">  function (client) {</span></span>
<span class="line"><span style="color:#E1E4E8;">    oublier </span><span style="color:#F97583;">&lt;-</span><span style="color:#E1E4E8;"> client</span><span style="color:#F97583;">$</span><span style="color:#FFAB70;">appeler</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#9ECBFF;">&quot;bds.suivreNomsBd&quot;</span><span style="color:#E1E4E8;">,</span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#F97583;">list</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">        </span><span style="color:#FFAB70;">idBd</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> idBd,</span></span>
<span class="line"><span style="color:#E1E4E8;">        </span><span style="color:#FFAB70;">f</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> print</span></span>
<span class="line"><span style="color:#E1E4E8;">      )</span></span>
<span class="line"><span style="color:#E1E4E8;">    )</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#79B8FF;">Sys.sleep</span><span style="color:#E1E4E8;">(</span><span style="color:#79B8FF;">2</span><span style="color:#E1E4E8;">)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#6A737D;"># Arrêter le suivi après 2 secondes</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#FFAB70;">oublier</span><span style="color:#E1E4E8;">()</span></span>
<span class="line"><span style="color:#E1E4E8;">  }</span></span>
<span class="line"><span style="color:#E1E4E8;">)</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#005CC5;">library</span><span style="color:#24292E;">(constellationR)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6F42C1;">constellationR</span><span style="color:#D73A49;">::</span><span style="color:#E36209;">avecClientEtServeur</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">  function (client) {</span></span>
<span class="line"><span style="color:#24292E;">    oublier </span><span style="color:#D73A49;">&lt;-</span><span style="color:#24292E;"> client</span><span style="color:#D73A49;">$</span><span style="color:#E36209;">appeler</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#032F62;">&quot;bds.suivreNomsBd&quot;</span><span style="color:#24292E;">,</span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#D73A49;">list</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">        </span><span style="color:#E36209;">idBd</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> idBd,</span></span>
<span class="line"><span style="color:#24292E;">        </span><span style="color:#E36209;">f</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> print</span></span>
<span class="line"><span style="color:#24292E;">      )</span></span>
<span class="line"><span style="color:#24292E;">    )</span></span>
<span class="line"><span style="color:#24292E;">    </span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#005CC5;">Sys.sleep</span><span style="color:#24292E;">(</span><span style="color:#005CC5;">2</span><span style="color:#24292E;">)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#6A737D;"># Arrêter le suivi après 2 secondes</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#E36209;">oublier</span><span style="color:#24292E;">()</span></span>
<span class="line"><span style="color:#24292E;">  }</span></span>
<span class="line"><span style="color:#24292E;">)</span></span></code></pre></div><p>Si vous ne voulez pas suivre les données, mais seulement obtenir leur valeur au moment que la fonction est invoquée, vous n&#39;avez qu&#39;à omettre le paramètre de fonction de suivi :</p><div class="language-r vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">r</span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#79B8FF;">library</span><span style="color:#E1E4E8;">(constellationR)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#B392F0;">constellationR</span><span style="color:#F97583;">::</span><span style="color:#FFAB70;">avecClientEtServeur</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">  function (client) {</span></span>
<span class="line"><span style="color:#E1E4E8;">    nomsBd </span><span style="color:#F97583;">&lt;-</span><span style="color:#E1E4E8;"> client</span><span style="color:#F97583;">$</span><span style="color:#FFAB70;">appeler</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#9ECBFF;">&quot;bds.suivreNomsBd&quot;</span><span style="color:#E1E4E8;">,</span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#F97583;">list</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">        </span><span style="color:#FFAB70;">idBd</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> idBd</span></span>
<span class="line"><span style="color:#E1E4E8;">      )</span></span>
<span class="line"><span style="color:#E1E4E8;">    )</span></span>
<span class="line"><span style="color:#E1E4E8;">  }</span></span>
<span class="line"><span style="color:#E1E4E8;">)</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#005CC5;">library</span><span style="color:#24292E;">(constellationR)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6F42C1;">constellationR</span><span style="color:#D73A49;">::</span><span style="color:#E36209;">avecClientEtServeur</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">  function (client) {</span></span>
<span class="line"><span style="color:#24292E;">    nomsBd </span><span style="color:#D73A49;">&lt;-</span><span style="color:#24292E;"> client</span><span style="color:#D73A49;">$</span><span style="color:#E36209;">appeler</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#032F62;">&quot;bds.suivreNomsBd&quot;</span><span style="color:#24292E;">,</span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#D73A49;">list</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">        </span><span style="color:#E36209;">idBd</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> idBd</span></span>
<span class="line"><span style="color:#24292E;">      )</span></span>
<span class="line"><span style="color:#24292E;">    )</span></span>
<span class="line"><span style="color:#24292E;">  }</span></span>
<span class="line"><span style="color:#24292E;">)</span></span></code></pre></div><p>C&#39;est là même chose pour les fonctions de recherche :</p><div class="language-r vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">r</span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#79B8FF;">library</span><span style="color:#E1E4E8;">(constellationR)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#B392F0;">constellationR</span><span style="color:#F97583;">::</span><span style="color:#FFAB70;">avecClientEtServeur</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">  function (client) {</span></span>
<span class="line"><span style="color:#E1E4E8;">    variablesTrouvées </span><span style="color:#F97583;">&lt;-</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">NULL</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#B392F0;">f</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">&lt;-</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">function</span><span style="color:#E1E4E8;">(résultats) {</span></span>
<span class="line"><span style="color:#E1E4E8;">      variablesTrouvées </span><span style="color:#F97583;">&lt;&lt;-</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">sapply</span><span style="color:#E1E4E8;">(résultats, (\\(x) x</span><span style="color:#F97583;">$</span><span style="color:#E1E4E8;">id))</span></span>
<span class="line"><span style="color:#E1E4E8;">    }</span></span>
<span class="line"><span style="color:#E1E4E8;">    retour </span><span style="color:#F97583;">&lt;-</span><span style="color:#E1E4E8;"> client</span><span style="color:#F97583;">$</span><span style="color:#FFAB70;">rechercher</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#9ECBFF;">&quot;recherche.rechercherVariablesSelonNom&quot;</span><span style="color:#E1E4E8;">,</span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#F97583;">list</span><span style="color:#E1E4E8;">(</span><span style="color:#FFAB70;">nomVariable</span><span style="color:#F97583;">=</span><span style="color:#9ECBFF;">&quot;oiseaux&quot;</span><span style="color:#E1E4E8;">, </span><span style="color:#FFAB70;">nRésultatsDésirés</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">10</span><span style="color:#E1E4E8;">, </span><span style="color:#FFAB70;">f</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> f)</span></span>
<span class="line"><span style="color:#E1E4E8;">    )</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    idVariableAudio </span><span style="color:#F97583;">&lt;-</span><span style="color:#E1E4E8;"> client</span><span style="color:#F97583;">$</span><span style="color:#FFAB70;">action</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#9ECBFF;">&quot;variables.créerVariable&quot;</span><span style="color:#E1E4E8;">, </span><span style="color:#F97583;">list</span><span style="color:#E1E4E8;">(</span><span style="color:#FFAB70;">catégorie</span><span style="color:#F97583;">=</span><span style="color:#9ECBFF;">&quot;audio&quot;</span><span style="color:#E1E4E8;">)</span></span>
<span class="line"><span style="color:#E1E4E8;">    )</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    client</span><span style="color:#F97583;">$</span><span style="color:#FFAB70;">action</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#9ECBFF;">&quot;variables.sauvegarderNomVariable&quot;</span><span style="color:#E1E4E8;">,</span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#F97583;">list</span><span style="color:#E1E4E8;">(</span><span style="color:#FFAB70;">idVariable</span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;">idVariableAudio, </span><span style="color:#FFAB70;">langue</span><span style="color:#F97583;">=</span><span style="color:#9ECBFF;">&quot;fr&quot;</span><span style="color:#E1E4E8;">, </span><span style="color:#FFAB70;">nom</span><span style="color:#F97583;">=</span><span style="color:#9ECBFF;">&quot;Audio oiseaux&quot;</span><span style="color:#E1E4E8;">)</span></span>
<span class="line"><span style="color:#E1E4E8;">    )</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    idVariableNom </span><span style="color:#F97583;">&lt;-</span><span style="color:#E1E4E8;"> client</span><span style="color:#F97583;">$</span><span style="color:#FFAB70;">action</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#9ECBFF;">&quot;variables.créerVariable&quot;</span><span style="color:#E1E4E8;">, </span><span style="color:#F97583;">list</span><span style="color:#E1E4E8;">(</span><span style="color:#FFAB70;">catégorie</span><span style="color:#F97583;">=</span><span style="color:#9ECBFF;">&quot;chaîne&quot;</span><span style="color:#E1E4E8;">)</span></span>
<span class="line"><span style="color:#E1E4E8;">    )</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    client</span><span style="color:#F97583;">$</span><span style="color:#FFAB70;">action</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#9ECBFF;">&quot;variables.sauvegarderNomVariable&quot;</span><span style="color:#E1E4E8;">,</span></span>
<span class="line"><span style="color:#E1E4E8;">      </span><span style="color:#F97583;">list</span><span style="color:#E1E4E8;">(</span><span style="color:#FFAB70;">idVariable</span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;">idVariableNom, </span><span style="color:#FFAB70;">langue</span><span style="color:#F97583;">=</span><span style="color:#9ECBFF;">&quot;fr&quot;</span><span style="color:#E1E4E8;">, </span><span style="color:#FFAB70;">nom</span><span style="color:#F97583;">=</span><span style="color:#9ECBFF;">&quot;Nom oiseau&quot;</span><span style="color:#E1E4E8;">)</span></span>
<span class="line"><span style="color:#E1E4E8;">    )</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span></span>
<span class="line"><span style="color:#E1E4E8;">    retour</span><span style="color:#F97583;">$</span><span style="color:#FFAB70;">fChangerN</span><span style="color:#E1E4E8;">(</span><span style="color:#79B8FF;">1</span><span style="color:#E1E4E8;">)</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#79B8FF;">Sys.sleep</span><span style="color:#E1E4E8;">(</span><span style="color:#79B8FF;">2</span><span style="color:#E1E4E8;">)</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span></span>
<span class="line"><span style="color:#E1E4E8;">    retour</span><span style="color:#F97583;">$</span><span style="color:#FFAB70;">fChangerN</span><span style="color:#E1E4E8;">(</span><span style="color:#79B8FF;">4</span><span style="color:#E1E4E8;">)</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#79B8FF;">Sys.sleep</span><span style="color:#E1E4E8;">(</span><span style="color:#79B8FF;">2</span><span style="color:#E1E4E8;">)</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span></span>
<span class="line"><span style="color:#E1E4E8;">    retour</span><span style="color:#F97583;">$</span><span style="color:#FFAB70;">fOublier</span><span style="color:#E1E4E8;">()</span></span>
<span class="line"><span style="color:#E1E4E8;">  }</span></span>
<span class="line"><span style="color:#E1E4E8;">)</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#005CC5;">library</span><span style="color:#24292E;">(constellationR)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6F42C1;">constellationR</span><span style="color:#D73A49;">::</span><span style="color:#E36209;">avecClientEtServeur</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">  function (client) {</span></span>
<span class="line"><span style="color:#24292E;">    variablesTrouvées </span><span style="color:#D73A49;">&lt;-</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">NULL</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#6F42C1;">f</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">&lt;-</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">function</span><span style="color:#24292E;">(résultats) {</span></span>
<span class="line"><span style="color:#24292E;">      variablesTrouvées </span><span style="color:#D73A49;">&lt;&lt;-</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">sapply</span><span style="color:#24292E;">(résultats, (\\(x) x</span><span style="color:#D73A49;">$</span><span style="color:#24292E;">id))</span></span>
<span class="line"><span style="color:#24292E;">    }</span></span>
<span class="line"><span style="color:#24292E;">    retour </span><span style="color:#D73A49;">&lt;-</span><span style="color:#24292E;"> client</span><span style="color:#D73A49;">$</span><span style="color:#E36209;">rechercher</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#032F62;">&quot;recherche.rechercherVariablesSelonNom&quot;</span><span style="color:#24292E;">,</span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#D73A49;">list</span><span style="color:#24292E;">(</span><span style="color:#E36209;">nomVariable</span><span style="color:#D73A49;">=</span><span style="color:#032F62;">&quot;oiseaux&quot;</span><span style="color:#24292E;">, </span><span style="color:#E36209;">nRésultatsDésirés</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">10</span><span style="color:#24292E;">, </span><span style="color:#E36209;">f</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> f)</span></span>
<span class="line"><span style="color:#24292E;">    )</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    idVariableAudio </span><span style="color:#D73A49;">&lt;-</span><span style="color:#24292E;"> client</span><span style="color:#D73A49;">$</span><span style="color:#E36209;">action</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#032F62;">&quot;variables.créerVariable&quot;</span><span style="color:#24292E;">, </span><span style="color:#D73A49;">list</span><span style="color:#24292E;">(</span><span style="color:#E36209;">catégorie</span><span style="color:#D73A49;">=</span><span style="color:#032F62;">&quot;audio&quot;</span><span style="color:#24292E;">)</span></span>
<span class="line"><span style="color:#24292E;">    )</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    client</span><span style="color:#D73A49;">$</span><span style="color:#E36209;">action</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#032F62;">&quot;variables.sauvegarderNomVariable&quot;</span><span style="color:#24292E;">,</span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#D73A49;">list</span><span style="color:#24292E;">(</span><span style="color:#E36209;">idVariable</span><span style="color:#D73A49;">=</span><span style="color:#24292E;">idVariableAudio, </span><span style="color:#E36209;">langue</span><span style="color:#D73A49;">=</span><span style="color:#032F62;">&quot;fr&quot;</span><span style="color:#24292E;">, </span><span style="color:#E36209;">nom</span><span style="color:#D73A49;">=</span><span style="color:#032F62;">&quot;Audio oiseaux&quot;</span><span style="color:#24292E;">)</span></span>
<span class="line"><span style="color:#24292E;">    )</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    idVariableNom </span><span style="color:#D73A49;">&lt;-</span><span style="color:#24292E;"> client</span><span style="color:#D73A49;">$</span><span style="color:#E36209;">action</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#032F62;">&quot;variables.créerVariable&quot;</span><span style="color:#24292E;">, </span><span style="color:#D73A49;">list</span><span style="color:#24292E;">(</span><span style="color:#E36209;">catégorie</span><span style="color:#D73A49;">=</span><span style="color:#032F62;">&quot;chaîne&quot;</span><span style="color:#24292E;">)</span></span>
<span class="line"><span style="color:#24292E;">    )</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    client</span><span style="color:#D73A49;">$</span><span style="color:#E36209;">action</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#032F62;">&quot;variables.sauvegarderNomVariable&quot;</span><span style="color:#24292E;">,</span></span>
<span class="line"><span style="color:#24292E;">      </span><span style="color:#D73A49;">list</span><span style="color:#24292E;">(</span><span style="color:#E36209;">idVariable</span><span style="color:#D73A49;">=</span><span style="color:#24292E;">idVariableNom, </span><span style="color:#E36209;">langue</span><span style="color:#D73A49;">=</span><span style="color:#032F62;">&quot;fr&quot;</span><span style="color:#24292E;">, </span><span style="color:#E36209;">nom</span><span style="color:#D73A49;">=</span><span style="color:#032F62;">&quot;Nom oiseau&quot;</span><span style="color:#24292E;">)</span></span>
<span class="line"><span style="color:#24292E;">    )</span></span>
<span class="line"><span style="color:#24292E;">    </span></span>
<span class="line"><span style="color:#24292E;">    retour</span><span style="color:#D73A49;">$</span><span style="color:#E36209;">fChangerN</span><span style="color:#24292E;">(</span><span style="color:#005CC5;">1</span><span style="color:#24292E;">)</span></span>
<span class="line"><span style="color:#24292E;">    </span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#005CC5;">Sys.sleep</span><span style="color:#24292E;">(</span><span style="color:#005CC5;">2</span><span style="color:#24292E;">)</span></span>
<span class="line"><span style="color:#24292E;">    </span></span>
<span class="line"><span style="color:#24292E;">    retour</span><span style="color:#D73A49;">$</span><span style="color:#E36209;">fChangerN</span><span style="color:#24292E;">(</span><span style="color:#005CC5;">4</span><span style="color:#24292E;">)</span></span>
<span class="line"><span style="color:#24292E;">    </span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#005CC5;">Sys.sleep</span><span style="color:#24292E;">(</span><span style="color:#005CC5;">2</span><span style="color:#24292E;">)</span></span>
<span class="line"><span style="color:#24292E;">    </span></span>
<span class="line"><span style="color:#24292E;">    retour</span><span style="color:#D73A49;">$</span><span style="color:#E36209;">fOublier</span><span style="color:#24292E;">()</span></span>
<span class="line"><span style="color:#24292E;">  }</span></span>
<span class="line"><span style="color:#24292E;">)</span></span></code></pre></div><h3 id="serveur-existant" tabindex="-1">Serveur existant <a class="header-anchor" href="#serveur-existant" aria-label="Permalink to &quot;Serveur existant&quot;">​</a></h3><p>Si vous avez déjà lancé un serveur Constellation (p. ex., dans l&#39;interface graphique ou bien à travers un autre processus), vous pouvez vous connecter directement à celui-ci.</p><div class="language-r vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">r</span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#79B8FF;">library</span><span style="color:#E1E4E8;">(constellationR)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#F97583;">//</span><span style="color:#E1E4E8;"> Le numéro du port sur lequel vous avez lancé Constellation</span></span>
<span class="line"><span style="color:#E1E4E8;">port </span><span style="color:#F97583;">&lt;-</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">5003</span></span>
<span class="line"></span>
<span class="line"><span style="color:#B392F0;">constellationR</span><span style="color:#F97583;">::</span><span style="color:#FFAB70;">avecClient</span><span style="color:#E1E4E8;">(</span></span>
<span class="line"><span style="color:#E1E4E8;">  </span><span style="color:#F97583;">function</span><span style="color:#E1E4E8;">(client) {</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#F97583;">//</span><span style="color:#E1E4E8;"> Faire quelque chose avec le client</span><span style="color:#F97583;">...</span></span>
<span class="line"><span style="color:#E1E4E8;">  },</span></span>
<span class="line"><span style="color:#E1E4E8;">  </span><span style="color:#FFAB70;">port</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> port</span></span>
<span class="line"><span style="color:#E1E4E8;">)</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#005CC5;">library</span><span style="color:#24292E;">(constellationR)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D73A49;">//</span><span style="color:#24292E;"> Le numéro du port sur lequel vous avez lancé Constellation</span></span>
<span class="line"><span style="color:#24292E;">port </span><span style="color:#D73A49;">&lt;-</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">5003</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6F42C1;">constellationR</span><span style="color:#D73A49;">::</span><span style="color:#E36209;">avecClient</span><span style="color:#24292E;">(</span></span>
<span class="line"><span style="color:#24292E;">  </span><span style="color:#D73A49;">function</span><span style="color:#24292E;">(client) {</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#D73A49;">//</span><span style="color:#24292E;"> Faire quelque chose avec le client</span><span style="color:#D73A49;">...</span></span>
<span class="line"><span style="color:#24292E;">  },</span></span>
<span class="line"><span style="color:#24292E;">  </span><span style="color:#E36209;">port</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> port</span></span>
<span class="line"><span style="color:#24292E;">)</span></span></code></pre></div>`,18),e=[o];function t(c,r,E,y,i,u){return n(),a("div",null,e)}const v=s(p,[["render",t]]);export{d as __pageData,v as default};
