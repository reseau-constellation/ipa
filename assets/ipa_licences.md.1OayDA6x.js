import{_ as s,o as i,c as e,R as a}from"./chunks/framework.Eeo-33mw.js";const u=JSON.parse('{"title":"Licences","description":"","frontmatter":{},"headers":[],"relativePath":"ipa/licences.md","filePath":"ipa/licences.md"}'),n={name:"ipa/licences.md"},t=a(`<h1 id="licences" tabindex="-1">Licences <a class="header-anchor" href="#licences" aria-label="Permalink to &quot;Licences&quot;">​</a></h1><p>Constellation vient avec une liste de licences reconnues pour associer à vos bases de données.</p><div class="tip custom-block"><p class="custom-block-title">ASTUCE</p><p>Cette liste est également dynamique ; au fur et à mesure que de nouvelles licences sont suggérées par les membres du réseau et puis approuvées, celles-ci apparaîteront automatiquement dans la liste des licences reconnues par Constellation, et ce, sans aucun besoin de mise à jour.</p><p>Comment est-ce possible ? En utilisant une base de données de Constellation elle-même pour sauvegarder les informations des licences approuvées, bien sûr ! Nous utilisons aussi un petit paquet nommé <code>கிளி</code> (<a href="https://www.npmjs.com/package/@lassi-js/kili" target="_blank" rel="noreferrer"><code>@lassi-js/kili</code></a>) pour syncroniser les suggestions des membres du réseau et gérer leur approbation éventuelle.</p></div><nav class="table-of-contents"><ul><li><a href="#fonctions">Fonctions</a><ul><li><a href="#client-licences-suivrelicences-f">client.licences.suivreLicences({ f })</a></li><li><a href="#client-licences-suggererlicence-code-infolicence">client.licences.suggérerLicence({ code, infoLicence })</a></li><li><a href="#client-licences-effacersuggestionlicence-idelement">client.licences.effacerSuggestionLicence({ idÉlément })</a></li><li><a href="#client-licences-suivresuggestionslicences-f">client.licences.suivreSuggestionsLicences({ f })</a></li><li><a href="#client-licences-approuverlicence-suggestion">client.licences.approuverLicence({ suggestion })</a></li></ul></li><li><a href="#licences-disponibles">Licences disponibles</a><ul><li><a href="#licences-pour-bases-de-donnees-recommendees">Licences pour bases de données (recommendées)</a></li><li><a href="#licences-artistiques">Licences artistiques</a></li><li><a href="#licences-de-code">Licences de code</a></li></ul></li><li><a href="#types">Types</a></li></ul></nav><h2 id="fonctions" tabindex="-1">Fonctions <a class="header-anchor" href="#fonctions" aria-label="Permalink to &quot;Fonctions&quot;">​</a></h2><h3 id="client-licences-suivrelicences-f" tabindex="-1"><code>client.licences.suivreLicences({ f })</code> <a class="header-anchor" href="#client-licences-suivrelicences-f" aria-label="Permalink to &quot;\`client.licences.suivreLicences({ f })\`&quot;">​</a></h3><p>Suit les licences disponibles sur Constellation.</p><h4 id="parametres" tabindex="-1">Paramètres <a class="header-anchor" href="#parametres" aria-label="Permalink to &quot;Paramètres&quot;">​</a></h4><table><thead><tr><th>Nom</th><th>Type</th><th>Description</th></tr></thead><tbody><tr><td><code>f</code></td><td><code>(licences: { [licence: string]: </code><a href="#types"><code>InfoLicence</code></a><code> }) =&gt; void</code></td><td>La fonction qui sera appellée avec la liste des licences reconnues par Constellation chaque fois que celle-ci change.</td></tr></tbody></table><h4 id="retour" tabindex="-1">Retour <a class="header-anchor" href="#retour" aria-label="Permalink to &quot;Retour&quot;">​</a></h4><table><thead><tr><th>Type</th><th>Description</th></tr></thead><tbody><tr><td><code>Promise&lt;() =&gt; Promise&lt;void&gt;&gt;</code></td><td>Fonction à appeler pour arrêter le suivi.</td></tr></tbody></table><h4 id="exemple" tabindex="-1">Exemple <a class="header-anchor" href="#exemple" aria-label="Permalink to &quot;Exemple&quot;">​</a></h4><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { ref } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;vue&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { créerConstellation } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;@constl/ipa&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> client</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> créerConstellation</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">();</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> licences</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> ref</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&lt;</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">InfoLicence</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">[]&gt;();</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> fOublier</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> client.licences.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">suivreLicences</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">    f</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">x</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> licence.value </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> x;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">})</span></span></code></pre></div><h3 id="client-licences-suggererlicence-code-infolicence" tabindex="-1"><code>client.licences.suggérerLicence({ code, infoLicence })</code> <a class="header-anchor" href="#client-licences-suggererlicence-code-infolicence" aria-label="Permalink to &quot;\`client.licences.suggérerLicence({ code, infoLicence })\`&quot;">​</a></h3><p>Suggère une nouvelle licence à ajouter à la liste des licences reconnues par Constellation.</p><div class="warning custom-block"><p class="custom-block-title">AVERTISSEMENT</p><p>N&#39;importe qui (oui, toi aussi !) peut suggérer une nouvelle licence à inclure. Si elle est acceptée, elle sera ajoutée à la liste officielle et apparaîtra dans l&#39;interface de Constellation. <strong>Pour être acceptée, la licence doit être libre</strong> ; c&#39;est-à-dire, elle doit permettre la modification et le partage des données qui seront publiées sous cette licence. La licence peut, bien entendu, aussi inclure des limitations ou des conditions associées à ces droits.</p></div><h4 id="parametres-1" tabindex="-1">Paramètres <a class="header-anchor" href="#parametres-1" aria-label="Permalink to &quot;Paramètres&quot;">​</a></h4><table><thead><tr><th>Nom</th><th>Type</th><th>Description</th></tr></thead><tbody><tr><td><code>code</code></td><td><code>string</code></td><td>Un code unique pour identifier cette licence.</td></tr><tr><td><code>infoLicence</code></td><td><a href="#types"><code>InfoLicence</code></a></td><td>Les détails de la licence.</td></tr></tbody></table><h4 id="exemple-1" tabindex="-1">Exemple <a class="header-anchor" href="#exemple-1" aria-label="Permalink to &quot;Exemple&quot;">​</a></h4><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { créerConstellation } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;@constl/ipa&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> client</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> créerConstellation</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">();</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> client.licences.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">suggérerLicence</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    code: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;codeDeMaLicence&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    </span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // Un petit résumé des caractéristiques de notre licence:</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    infoLicence: {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        conditions: [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;attribution&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;partageÉgal&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;inclureDroitDauteur&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">],</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        droits: [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;partager&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;adapter&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;usageComercial&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">],</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        limitations: [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;aucuneResponsabilité&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;aucuneGarantie&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">],</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        catégorie: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;basesDeDonnées&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        spécialisée: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">false</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// Indique une licence d&#39;usage général (et non spécifique à une organisation ou compagnie)</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">})</span></span></code></pre></div><h3 id="client-licences-effacersuggestionlicence-idelement" tabindex="-1"><code>client.licences.effacerSuggestionLicence({ idÉlément })</code> <a class="header-anchor" href="#client-licences-effacersuggestionlicence-idelement" aria-label="Permalink to &quot;\`client.licences.effacerSuggestionLicence({ idÉlément })\`&quot;">​</a></h3><p>Efface une suggesion de nouvelle licence que vous aviez fait auparavant.</p><h4 id="parametres-2" tabindex="-1">Paramètres <a class="header-anchor" href="#parametres-2" aria-label="Permalink to &quot;Paramètres&quot;">​</a></h4><table><thead><tr><th>Nom</th><th>Type</th><th>Description</th></tr></thead><tbody><tr><td><code>idÉlément</code></td><td><code>string</code></td><td>L&#39;identifiant unique de votre suggestion.</td></tr></tbody></table><h4 id="exemple-2" tabindex="-1">Exemple <a class="header-anchor" href="#exemple-2" aria-label="Permalink to &quot;Exemple&quot;">​</a></h4><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { créerConstellation } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;@constl/ipa&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> client</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> créerConstellation</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">();</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> client.licences.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">effacerSuggestionLicence</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    idÉlément: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;codeDeMaSuggestion&quot;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">})</span></span></code></pre></div><h3 id="client-licences-suivresuggestionslicences-f" tabindex="-1"><code>client.licences.suivreSuggestionsLicences({ f })</code> <a class="header-anchor" href="#client-licences-suivresuggestionslicences-f" aria-label="Permalink to &quot;\`client.licences.suivreSuggestionsLicences({ f })\`&quot;">​</a></h3><p>Suit les suggestions faites par les membres du réseau Constellation.</p><h4 id="parametres-3" tabindex="-1">Paramètres <a class="header-anchor" href="#parametres-3" aria-label="Permalink to &quot;Paramètres&quot;">​</a></h4><table><thead><tr><th>Nom</th><th>Type</th><th>Description</th></tr></thead><tbody><tr><td><code>f</code></td><td><code>(suggestions: கிளி.பிணையம்_பரிந்துரை&lt;</code><a href="#types"><code>InfoLicenceAvecCode</code></a><code>&gt;[]) =&gt; void</code></td><td>La fonction qui sera appellée avec la liste des suggesions de licences chaque fois que celle-ci change.</td></tr></tbody></table><h4 id="retour-1" tabindex="-1">Retour <a class="header-anchor" href="#retour-1" aria-label="Permalink to &quot;Retour&quot;">​</a></h4><table><thead><tr><th>Type</th><th>Description</th></tr></thead><tbody><tr><td><code>Promise&lt;{ fOublier: () =&gt; Promise&lt;void&gt;, fChangerProfondeur: (n: number) =&gt; Promise:void&gt; }&gt;</code></td><td>Fonctions à appeler pour changer le nombre de résultats ou bien pour arrêter le suivi.</td></tr></tbody></table><h4 id="exemple-3" tabindex="-1">Exemple <a class="header-anchor" href="#exemple-3" aria-label="Permalink to &quot;Exemple&quot;">​</a></h4><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { ref } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;vue&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { créerConstellation, </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">type</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> licences } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;@constl/ipa&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">type</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> பிணையம்_பரிந்துரை } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;@lassi-js/kili&quot;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> client</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> créerConstellation</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">();</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> suggestions</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> பிணையம</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">்</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">_பரிந</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">்</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">துரை</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&lt;</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">licences</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">InfoLicenceAvecCode</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;[]([]);</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> client.licences.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">suivreSuggestionsLicences</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">    f</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">x</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> suggestions.value </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> x,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">});</span></span></code></pre></div><h3 id="client-licences-approuverlicence-suggestion" tabindex="-1"><code>client.licences.approuverLicence({ suggestion })</code> <a class="header-anchor" href="#client-licences-approuverlicence-suggestion" aria-label="Permalink to &quot;\`client.licences.approuverLicence({ suggestion })\`&quot;">​</a></h3><p>Permet d&#39;approuver une suggestion de licence et de l&#39;ajouter à l&#39;interface générale de Constellation.</p><div class="warning custom-block"><p class="custom-block-title">AVERTISSEMENT</p><p><strong>Fonction uniquement disponible si vous avez un accès modérateur à la base de données des licences approuvées par Constellation.</strong> (Si vous n&#39;êtes pas sûr, la réponse est probablement non.)</p></div><h4 id="parametres-4" tabindex="-1">Paramètres <a class="header-anchor" href="#parametres-4" aria-label="Permalink to &quot;Paramètres&quot;">​</a></h4><table><thead><tr><th>Nom</th><th>Type</th><th>Description</th></tr></thead><tbody><tr><td><code>suggestion</code></td><td><code>கிளி.பிணையம்_பரிந்துரை&lt;</code><a href="#types"><code>InfoLicenceAvecId</code></a><code>&gt;</code></td><td>La suggestion de licence.</td></tr></tbody></table><h4 id="exemple-4" tabindex="-1">Exemple <a class="header-anchor" href="#exemple-4" aria-label="Permalink to &quot;Exemple&quot;">​</a></h4><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// ... continuant de ci-dessus...</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> toutApprouver</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> async</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> () </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">    await</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> Promise</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">all</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        suggestions.value.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">map</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span></span>
<span class="line"><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">            suggestion</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> client.licences.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">approuverLicence</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({ suggestion })</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        )</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    );</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre></div><h2 id="licences-disponibles" tabindex="-1">Licences disponibles <a class="header-anchor" href="#licences-disponibles" aria-label="Permalink to &quot;Licences disponibles&quot;">​</a></h2><p>Les licences suivantes sont reconnues par Constellation.</p><div class="tip custom-block"><p class="custom-block-title">ASTUCE</p><p>Vous pouvez bien sûr inclure utiliser d&#39;autres licences, mais seulement celles identifiées ci-dessous seront reconnues par l&#39;interface de l&#39;appli Constellation.</p></div><h3 id="licences-pour-bases-de-donnees-recommendees" tabindex="-1">Licences pour bases de données (recommendées) <a class="header-anchor" href="#licences-pour-bases-de-donnees-recommendees" aria-label="Permalink to &quot;Licences pour bases de données (recommendées)&quot;">​</a></h3><ul><li><code>ODbl-1_0</code></li><li><code>ODC-BY-1_0</code></li><li><code>PDDL</code></li><li><code>rvca-open</code></li></ul><h3 id="licences-artistiques" tabindex="-1">Licences artistiques <a class="header-anchor" href="#licences-artistiques" aria-label="Permalink to &quot;Licences artistiques&quot;">​</a></h3><p>Celles-ci sont plus appropriées pour les images, vidéo ou autre expression artistique.</p><ul><li><code>CC-BY-SA-4_0</code></li><li><code>CC-BY-4_0</code></li><li><code>CC-0-1_0</code></li></ul><h3 id="licences-de-code" tabindex="-1">Licences de code <a class="header-anchor" href="#licences-de-code" aria-label="Permalink to &quot;Licences de code&quot;">​</a></h3><p>Ces licences furent développées pour le code informatique.</p><ul><li><code>0bsd</code></li><li><code>afl-3_0</code></li><li><code>agpl-3_0</code></li><li><code>apache-2_0</code></li><li><code>artistic-2_0</code></li><li><code>bsd-2-clause</code></li><li><code>bsd-3-clause-clear</code></li><li><code>bsd-3-clause</code></li><li><code>bsd-4-clause</code></li><li><code>bsl-1_0</code></li><li><code>cecill-2_1</code></li><li><code>ecl-2_0</code></li><li><code>epl-1_0</code></li><li><code>epl-2_0</code></li><li><code>eupl-1_0</code></li><li><code>eupl-1_2</code></li><li><code>gpl-2_0</code></li><li><code>gpl-3_0</code></li><li><code>isc</code></li><li><code>lgpl-2_1</code></li><li><code>lgpl-3_0</code></li><li><code>lppl-1_3c</code></li><li><code>mit-0</code></li><li><code>mit</code></li><li><code>mpl-2_0</code></li><li><code>ms-pl</code></li><li><code>ms-rl</code></li><li><code>mulanpsl-2_0</code></li><li><code>ncsa</code></li><li><code>osl-3_0</code></li><li><code>postgresql</code></li><li><code>unlicence</code></li><li><code>upl-1_0</code></li><li><code>vim</code></li><li><code>wtfpl</code></li><li><code>zlib</code></li><li><code>ofl-1_1</code></li></ul><h2 id="types" tabindex="-1">Types <a class="header-anchor" href="#types" aria-label="Permalink to &quot;Types&quot;">​</a></h2><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">type</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> InfoLicence</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">  conditions</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> condition</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">[];</span></span>
<span class="line"><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">  droits</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> string</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">[];</span></span>
<span class="line"><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">  limitations</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> string</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">[];</span></span>
<span class="line"><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">  catégorie</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> catégorie</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">  spécialisée</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">?:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> boolean</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">type</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> InfoLicenceAvecId</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> InfoLicence</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> &amp;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { </span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">id</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> string</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> };</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">type</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> condition</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;attribution&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;partageÉgal&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;inclureDroitDauteur&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;indiquerChangements&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;partagerCodeSource&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;usagereseau&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">type</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> droit</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;partager&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;adapter&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;usageComercial&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;usagePrivé&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;usageBrevets&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">type</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> limitation</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">  &quot;aucuneResponsabilité&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;aucuneGarantie&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;marqueCommerce&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;brevetExclu&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;sousLicence&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">type</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> catégorie</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;basesDeDonnées&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;artistique&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;codeInformatique&quot;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> |</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;autre&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span></code></pre></div>`,54),l=[t];function h(p,c,k,r,o,d){return i(),e("div",null,l)}const E=s(n,[["render",h]]);export{u as __pageData,E as default};