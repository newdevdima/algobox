(function(){
"use strict";
const LH = 24, PT = 12, KEY = "algocahier-code-v1";
const $ = id => document.getElementById(id);
const src = $("src"), hl = $("hl"), gut = $("gutter"), band = $("band"), codebox = $("codebox");
const out = $("sortie"), varsBody = $("vars"), errBox = $("erreur"), etat = $("etat");
let errLine = 0, curLine = 0, run = null, backup = null, lastState = null;

/* ---------- Examples ---------- */
const EX = [
 {name:"Placement à 3 % (TANT_QUE)", code:
`// Au bout de combien d'années un capital placé à 3 % par an a-t-il doublé ?
VARIABLES
  capital EST_DU_TYPE NOMBRE
  annees EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  capital PREND_LA_VALEUR 1000
  annees PREND_LA_VALEUR 0
  TANT_QUE (capital < 2000) FAIRE
    DEBUT_TANT_QUE
    capital PREND_LA_VALEUR capital * 1.03
    annees PREND_LA_VALEUR annees + 1
    FIN_TANT_QUE
  AFFICHER "Le capital a doublé au bout de ", annees, " ans."
  AFFICHER "Capital final : ", round(capital * 100) / 100
FIN_ALGORITHME`},
 {name:"Prix TTC (LIRE, AFFICHER)", code:
`// Calcul d'un prix TTC avec une TVA de 20 %
VARIABLES
  prixHT EST_DU_TYPE NOMBRE
  prixTTC EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE prixHT
  prixTTC PREND_LA_VALEUR prixHT * 1.2
  AFFICHER "Prix TTC : ", prixTTC
FIN_ALGORITHME`},
 {name:"Pair ou impair (SI … SINON)", code:
`VARIABLES
  n EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE n
  SI (n % 2 == 0) ALORS
    DEBUT_SI
    AFFICHER n, " est pair"
    FIN_SI
  SINON
    DEBUT_SINON
    AFFICHER n, " est impair"
    FIN_SINON
FIN_ALGORITHME`},
 {name:"Somme de 1 à n (POUR)", code:
`VARIABLES
  n EST_DU_TYPE NOMBRE
  i EST_DU_TYPE NOMBRE
  somme EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE n
  somme PREND_LA_VALEUR 0
  POUR i ALLANT_DE 1 A n
    DEBUT_POUR
    somme PREND_LA_VALEUR somme + i
    FIN_POUR
  AFFICHER "1 + 2 + ... + ", n, " = ", somme
FIN_ALGORITHME`},
 {name:"Équation du second degré", code:
`// Résolution de ax² + bx + c = 0 (avec a non nul)
VARIABLES
  a EST_DU_TYPE NOMBRE
  b EST_DU_TYPE NOMBRE
  c EST_DU_TYPE NOMBRE
  delta EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE a
  LIRE b
  LIRE c
  delta PREND_LA_VALEUR b*b - 4*a*c
  AFFICHER "Delta = ", delta
  SI (delta < 0) ALORS
    DEBUT_SI
    AFFICHER "Pas de solution réelle"
    FIN_SI
  SINON
    DEBUT_SINON
    SI (delta == 0) ALORS
      DEBUT_SI
      AFFICHER "Une solution : x = ", -b / (2*a)
      FIN_SI
    SINON
      DEBUT_SINON
      AFFICHER "x1 = ", (-b - sqrt(delta)) / (2*a)
      AFFICHER "x2 = ", (-b + sqrt(delta)) / (2*a)
      FIN_SINON
    FIN_SINON
FIN_ALGORITHME`},
 {name:"600 lancers de dé (LISTE)", code:
`// On lance un dé 600 fois et on compte chaque face
VARIABLES
  effectifs EST_DU_TYPE LISTE
  k EST_DU_TYPE NOMBRE
  face EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  POUR k ALLANT_DE 1 A 6
    DEBUT_POUR
    effectifs[k] PREND_LA_VALEUR 0
    FIN_POUR
  POUR k ALLANT_DE 1 A 600
    DEBUT_POUR
    face PREND_LA_VALEUR ALGOBOX_ALEA_ENT(1,6)
    effectifs[face] PREND_LA_VALEUR effectifs[face] + 1
    FIN_POUR
  POUR k ALLANT_DE 1 A 6
    DEBUT_POUR
    AFFICHER "Face ", k, " : ", effectifs[k], " fois"
    FIN_POUR
FIN_ALGORITHME`}
];
const BLANK = "VARIABLES\n  \nDEBUT_ALGORITHME\n  \nFIN_ALGORITHME";

/* ---------- Highlighting ---------- */
const KW = {
  struct:new Set(["VARIABLES","DEBUT_ALGORITHME","FIN_ALGORITHME","EST_DU_TYPE","NOMBRE","CHAINE","LISTE"]),
  test:new Set(["SI","ALORS","SINON","DEBUT_SI","FIN_SI","DEBUT_SINON","FIN_SINON"]),
  loop:new Set(["POUR","ALLANT_DE","DEBUT_POUR","FIN_POUR","TANT_QUE","FAIRE","DEBUT_TANT_QUE","FIN_TANT_QUE"]),
  instr:new Set(["LIRE","AFFICHER","AFFICHERCALCUL","PREND_LA_VALEUR"]),
  logic:new Set(["ET","OU","NON","VRAI","FAUX"])
};
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const HTOK = /\/\/.*|"[^"]*"?|'[^']*'?|[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-z0-9À-ÖØ-öø-ÿ_]*|\d+(?:\.\d+)?|\s+|[\s\S]/g;
function hlLine(line){
  const isPour = /^\s*POUR\b/i.test(line);
  return line.replace(HTOK, t => {
    if (t.startsWith("//")) return '<span class="t-com">'+esc(t)+'</span>';
    if (t[0]==='"' || t[0]==="'") return '<span class="t-str">'+esc(t)+'</span>';
    if (/^[A-Za-zÀ-ÖØ-öø-ÿ_]/.test(t)) {
      const u = t.toUpperCase();
      for (const k of ["struct","test","loop","instr","logic"]) if (KW[k].has(u)) return '<span class="t-'+k+'">'+t+'</span>';
      if (isPour && u === "A") return '<span class="t-loop">'+t+'</span>';
      return t;
    }
    if (/^\d/.test(t)) return '<span class="t-num">'+t+'</span>';
    return esc(t);
  });
}
function render(){
  const lines = src.value.split("\n");
  hl.innerHTML = lines.map(hlLine).join("\n") + "\n ";
  let g = "";
  for (let i=1;i<=lines.length;i++) g += '<div'+(i===curLine?' class="g-cur"':i===errLine?' class="g-err"':'')+'>'+i+'</div>';
  gut.innerHTML = g;
  syncScroll();
}
function syncScroll(){
  hl.scrollTop = src.scrollTop; hl.scrollLeft = src.scrollLeft;
  gut.style.transform = "translateY("+(-src.scrollTop)+"px)";
  codebox.style.setProperty("--st", src.scrollTop+"px");
  const l = curLine || errLine;
  if (!l) { band.hidden = true; return; }
  band.hidden = false;
  band.className = "band " + (curLine ? "band-cur" : "band-err");
  band.style.transform = "translateY("+(PT + (l-1)*LH - src.scrollTop)+"px)";
}
function scrollToLine(n){
  const top = (n-1)*LH, h = src.clientHeight;
  if (top < src.scrollTop || top > src.scrollTop + h - 3*LH) src.scrollTop = Math.max(0, top - h/2 + LH);
  syncScroll();
}

/* ---------- Compiler ---------- */
class CErr extends Error { constructor(line,msg){ super(msg); this.line=line; } }
class RunErr extends Error {}
class StopErr extends Error {}
const ID = "[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-z0-9À-ÖØ-öø-ÿ_]*";
const IDRE = new RegExp("^"+ID+"$");
const TYPES = {NOMBRE:1, CHAINE:1, LISTE:1};
const RESERVED = new Set([...KW.struct,...KW.test,...KW.loop,...KW.instr,...KW.logic,"MATH","PI","FONCTIONS_UTILISEES","CONSTRUCTOR","__PROTO__","PROTOTYPE"]);
const FUNCS = {sqrt:"Math.sqrt",pow:"Math.pow",abs:"Math.abs",floor:"Math.floor",ceil:"Math.ceil",round:"Math.round",random:"Math.random",
  sin:"Math.sin",cos:"Math.cos",tan:"Math.tan",exp:"Math.exp",log:"Math.log",max:"Math.max",min:"Math.min",trunc:"Math.trunc",
  ALGOBOX_ALEA_ENT:"__F.alea",ALGOBOX_SOMME:"__F.somme",ALGOBOX_MOYENNE:"__F.moyenne",ALGOBOX_MAXIMUM:"__F.maxi",ALGOBOX_MINIMUM:"__F.mini"};
const MATHP = new Set(["sqrt","pow","abs","floor","ceil","round","random","sin","cos","tan","exp","log","max","min","trunc","atan","asin","acos","PI","E"]);
const STRP = new Set(["length","charAt","substr","substring","toUpperCase","toLowerCase","indexOf"]);
const WORDOPS = {ET:"&&", OU:"||", NON:"!", VRAI:"true", FAUX:"false"};
const OPMAP = {"=":"==","==":"==","!=":"!=","<>":"!=","<=":"<=",">=":">=","<":"<",">":">","&&":"&&","||":"||","**":"**","^":"**",
  "+":"+","-":"-","*":"*","/":"/","%":"%","(":"(",")":")","[":"[","]":"]",",":",","!":"!"};
const TOKX = /"[^"]*"|'[^']*'|[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-z0-9À-ÖØ-öø-ÿ_]*|\d+(?:\.\d+)?|\.\d+|==|!=|<=|>=|<>|&&|\|\||\*\*|\s+|[\s\S]/g;
const FIN = {SI:"FIN_SI", SINON:"FIN_SINON", POUR:"FIN_POUR", TANT_QUE:"FIN_TANT_QUE"};
const q = s => JSON.stringify(s);

function nearVar(t, vars){ return Object.keys(vars).find(v => v.toLowerCase() === t.toLowerCase()); }

function tx(expr, n, vars){
  const s0 = expr.trim();
  if (!s0) throw new CErr(n, "Il manque une valeur ou un calcul (une virgule en trop ?).");
  const T = (s0.match(TOKX) || []).filter(t => !/^\s+$/.test(t));
  const o = []; let dot = null;
  for (let j=0;j<T.length;j++){
    const t = T[j], nx = T[j+1], pv = T[j-1];
    if (dot) {
      const ok = dot === "math" ? MATHP.has(t) : STRP.has(t);
      if (!ok) throw new CErr(n, dot === "math" ? "Math."+t+" n'existe pas." : "« ."+t+" » n'est pas reconnu. On peut utiliser .length, .charAt(i) ou .substr(debut, longueur).");
      o.push(t); dot = null; continue;
    }
    const c = t[0];
    if ((c === '"' || c === "'") && t.length >= 2) { o.push(q(t.slice(1,-1))); continue; }
    if (IDRE.test(t)) {
      const u = t.toUpperCase();
      if (WORDOPS[u] && !vars[t]) { o.push(WORDOPS[u]); continue; }
      if (t === "Math") { if (nx !== ".") throw new CErr(n, "Math doit être suivi d'un point, par exemple Math.PI."); o.push("Math"); continue; }
      if (u === "PI" && !vars[t]) { o.push("Math.PI"); continue; }
      if (nx === "(") {
        const f = FUNCS[t] || (MATHP.has(t.toLowerCase()) ? FUNCS[t.toLowerCase()] : null);
        if (f) { o.push(f); continue; }
        if (vars[t]) throw new CErr(n, t+" est une variable, pas une fonction. Ajoute un opérateur, par exemple "+t+"*(…).");
        throw new CErr(n, "La fonction "+t+"( ) n'existe pas. Regarde la liste des fonctions dans l'aide-mémoire.");
      }
      if (vars[t]) {
        if (nx === "[" && vars[t] !== "LISTE") throw new CErr(n, t+" n'est pas une LISTE : on ne peut pas écrire "+t+"[…].");
        o.push("V."+t); continue;
      }
      const near = nearVar(t, vars);
      if (near) throw new CErr(n, "« "+t+" » n'est pas déclarée. Voulais-tu écrire "+near+" ? Les majuscules comptent.");
      throw new CErr(n, "« "+t+" » n'est pas une variable déclarée. Déclare-la dans VARIABLES, ou mets-la entre guillemets si c'est du texte.");
    }
    if (/^\.?\d/.test(t)) { o.push(t); continue; }
    if (t === ".") { dot = pv === "Math" ? "math" : "prop"; o.push("."); continue; }
    if (OPMAP[t] !== undefined) { o.push(OPMAP[t]); continue; }
    if (t === '"' || t === "'") throw new CErr(n, "Un guillemet n'est pas fermé.");
    throw new CErr(n, "Caractère inattendu « "+t+" » dans « "+s0+" ».");
  }
  if (dot) throw new CErr(n, "Le calcul « "+s0+" » se termine par un point.");
  const js = o.join(" ");
  try { new Function("V","__F",'"use strict";return ('+js+');'); }
  catch(e) { throw new CErr(n, "Le calcul « "+s0+" » est mal écrit : vérifie les parenthèses et les opérateurs."+(s0.includes("^")?" Pour une puissance, écris par exemple pow(x,2).":"")); }
  return "("+js+")";
}

function splitArgs(s){
  const r = []; let d = 0, qt = null, cur = "";
  for (const ch of s) {
    if (qt) { cur += ch; if (ch === qt) qt = null; continue; }
    if (ch === '"' || ch === "'") { qt = ch; cur += ch; continue; }
    if (ch === "(" || ch === "[") d++; else if (ch === ")" || ch === "]") d--;
    if (ch === "," && d === 0) { r.push(cur); cur = ""; continue; }
    cur += ch;
  }
  r.push(cur);
  return r.map(x => x.trim());
}

function target(str, n, vars, verb){
  const m = str.trim().match(new RegExp("^("+ID+")\\s*(?:\\[(.+)\\])?$"));
  if (!m) throw new CErr(n, verb === "LIRE" ? "Après LIRE, il faut un nom de variable (exemple : LIRE x)." : "Avant PREND_LA_VALEUR, il faut un nom de variable (exemple : x PREND_LA_VALEUR 3).");
  const name = m[1], ty = vars[name];
  if (!ty) {
    const near = nearVar(name, vars);
    throw new CErr(n, near ? "« "+name+" » n'est pas déclarée. Voulais-tu écrire "+near+" ? Les majuscules comptent." : "La variable "+name+" n'est pas déclarée. Ajoute « "+name+" EST_DU_TYPE NOMBRE » dans VARIABLES.");
  }
  if (m[2] !== undefined) {
    if (ty !== "LISTE") throw new CErr(n, name+" n'est pas une LISTE : on ne peut pas écrire "+name+"[…].");
    return {name, ty, idx: tx(m[2], n, vars)};
  }
  if (ty === "LISTE") throw new CErr(n, name+" est une LISTE : précise l'élément, par exemple "+name+"[1].");
  return {name, ty, idx: null};
}

function compile(code){
  const lines = code.split("\n");
  const vars = Object.create(null), order = [], js = [], stack = [];
  let phase = 0, last = "", loopId = 0, lastNonEmpty = 1;
  const err = (n,m) => { throw new CErr(n,m); };
  for (let i=0;i<lines.length;i++){
    const n = i+1, s = lines[i].trim();
    if (!s || s.startsWith("//")) continue;
    lastNonEmpty = n;
    const U = s.toUpperCase();
    if (phase === 3) err(n, "Cette ligne est après FIN_ALGORITHME : elle ne sera jamais exécutée. Déplace-la avant FIN_ALGORITHME.");
    if (phase < 2) {
      if (U === "VARIABLES") { phase = 1; continue; }
      if (U === "FONCTIONS_UTILISEES") continue;
      const m = s.match(new RegExp("^("+ID+")\\s+EST_DU_TYPE\\s+([A-Za-z]+)$","i"));
      if (m) {
        const name = m[1], ty = m[2].toUpperCase();
        if (!TYPES[ty]) err(n, "Type inconnu « "+m[2]+" ». Les types possibles sont NOMBRE, CHAINE et LISTE.");
        if (RESERVED.has(name.toUpperCase()) || name.startsWith("__")) err(n, "« "+name+" » est un mot réservé : choisis un autre nom de variable.");
        if (vars[name]) err(n, "La variable "+name+" est déjà déclarée.");
        vars[name] = ty; order.push(name); continue;
      }
      if (U === "DEBUT_ALGORITHME") { phase = 2; continue; }
      if (/EST_DU_TYPE/i.test(s)) err(n, "Déclaration mal écrite. Exemple : x EST_DU_TYPE NOMBRE");
      err(n, phase === 1 ? "Ici, on ne peut que déclarer des variables (exemple : x EST_DU_TYPE NOMBRE). Les instructions vont après DEBUT_ALGORITHME." : "Un algorithme commence par VARIABLES, puis DEBUT_ALGORITHME.");
    }
    /* body */
    if (U === "FIN_ALGORITHME") {
      if (stack.length) { const t = stack[stack.length-1]; err(n, "Le bloc "+t.kind+" ouvert ligne "+t.line+" n'est pas fermé : il manque "+FIN[t.kind]+"."); }
      phase = 3; js.push("__ln("+n+");"); continue;
    }
    const top = stack[stack.length-1];
    const debM = U.match(/^DEBUT_(SI|SINON|POUR|TANT_QUE)$/);
    const finM = U.match(/^FIN_(SI|SINON|POUR|TANT_QUE)$/);
    if (top && !top.opened) {
      if (debM) {
        if (debM[1] !== top.kind) err(n, "Après la ligne "+top.line+" ("+top.kind+"), on attend DEBUT_"+top.kind+" et non "+U+".");
        top.opened = true; js.push(top.open); last = U; continue;
      }
      top.opened = true; js.push(top.open);
    } else if (debM) err(n, U+" doit venir juste après la ligne "+(debM[1]==="SINON"?"SINON":debM[1]+" …")+".");
    if (finM) {
      if (!top) err(n, U+" ne ferme aucun bloc ouvert.");
      if (top.kind !== finM[1]) err(n, U+" trouvé, mais le bloc ouvert ligne "+top.line+" est un "+top.kind+" : il faut d'abord "+FIN[top.kind]+".");
      stack.pop(); js.push(top.close); last = U; continue;
    }
    if (U === "SINON") {
      if (last !== "FIN_SI") err(n, "SINON doit venir juste après FIN_SI.");
      js.push("else"); stack.push({kind:"SINON", line:n, opened:false, open:"{", close:"}"}); last = U; continue;
    }
    let m;
    if ((m = s.match(/^SI\b\s*(.+?)\s*\bALORS$/i))) {
      js.push("if((await __s("+n+"), __c("+tx(m[1],n,vars)+")))");
      stack.push({kind:"SI", line:n, opened:false, open:"{", close:"}"}); last = "SI"; continue;
    }
    if (/^SI\b/i.test(s)) err(n, "Syntaxe attendue : SI (condition) ALORS");
    if ((m = s.match(/^TANT_QUE\b\s*(.+?)\s*\bFAIRE$/i))) {
      js.push("while((await __s("+n+"), __c("+tx(m[1],n,vars)+")))");
      stack.push({kind:"TANT_QUE", line:n, opened:false, open:"{ await __tick();", close:"}"}); last = "TANT_QUE"; continue;
    }
    if (/^TANT_QUE\b/i.test(s)) err(n, "Syntaxe attendue : TANT_QUE (condition) FAIRE");
    if ((m = s.match(new RegExp("^POUR\\s+("+ID+")\\s+ALLANT_DE\\s+(.+?)\\s+A\\s+(.+)$","i")))) {
      const v = m[1];
      if (!vars[v]) err(n, "Le compteur "+v+" doit être déclaré (exemple : "+v+" EST_DU_TYPE NOMBRE).");
      if (vars[v] !== "NOMBRE") err(n, "Le compteur "+v+" doit être de type NOMBRE.");
      const a = tx(m[2],n,vars), b = tx(m[3],n,vars), id = loopId++;
      js.push("__ln("+n+"); { const __b"+id+" = __num("+b+"); for(__set("+q(v)+", __num("+a+")); V."+v+" <= __b"+id+"; __set("+q(v)+", V."+v+" + 1))");
      stack.push({kind:"POUR", line:n, opened:false, open:"{ await __tick(); await __s("+n+");", close:"}}"}); last = "POUR"; continue;
    }
    if (/^POUR\b/i.test(s)) err(n, "Syntaxe attendue : POUR i ALLANT_DE 1 A 10");
    if ((m = s.match(/^LIRE\b\s*(.*)$/i))) {
      const t = target(m[1], n, vars, "LIRE");
      if (t.idx) js.push("await __s("+n+"); { const __k = __idx("+t.idx+"); __setEl("+q(t.name)+", __k, await __lire("+q(t.name)+", \"NOMBRE\", __k)); }");
      else js.push("await __s("+n+"); __set("+q(t.name)+", await __lire("+q(t.name)+", "+q(t.ty)+", null));");
      last = "LIRE"; continue;
    }
    if ((m = s.match(/^AFFICHER(?:CALCUL)?\b\s*(.*)$/i))) {
      if (!m[1].trim()) err(n, "Que faut-il afficher ? Exemple : AFFICHER x ou AFFICHER \"Bonjour\"");
      const parts = splitArgs(m[1]).map(a => tx(a, n, vars));
      js.push("await __s("+n+"); __aff(["+parts.join(", ")+"]);"); last = "AFFICHER"; continue;
    }
    if (/PREND_LA_VALEUR\s*$/i.test(s)) err(n, "Il manque la valeur après PREND_LA_VALEUR.");
    if ((m = s.match(/^(.+?)\s+PREND_LA_VALEUR\s+(.+)$/i))) {
      const t = target(m[1], n, vars, "PREND");
      const val = tx(m[2], n, vars);
      if (t.idx) js.push("await __s("+n+"); __setEl("+q(t.name)+", __idx("+t.idx+"), "+val+");");
      else js.push("await __s("+n+"); __set("+q(t.name)+", "+val+");");
      last = "PREND"; continue;
    }
    if (/^[^"']*[^=!<>]=[^=]/.test(s)) err(n, "Pour donner une valeur à une variable, écris par exemple : x PREND_LA_VALEUR 3");
    err(n, "Instruction non reconnue : « "+s+" ».");
  }
  if (phase < 2) throw new CErr(lastNonEmpty, "Il manque la ligne DEBUT_ALGORITHME.");
  if (phase < 3) {
    if (stack.length) { const t = stack[stack.length-1]; throw new CErr(t.line, "Le bloc "+t.kind+" ouvert ici n'est pas fermé : il manque "+FIN[t.kind]+", puis FIN_ALGORITHME."); }
    throw new CErr(lastNonEmpty, "Il manque la ligne FIN_ALGORITHME à la fin.");
  }
  const body = '"use strict"; return (async () => {\n' + js.join("\n") + "\n})();";
  let fn;
  try { fn = new Function("V","__s","__ln","__set","__setEl","__lire","__aff","__tick","__c","__num","__idx","__F", body); }
  catch(e) { throw new CErr(0, "L'algorithme n'a pas pu être préparé ("+e.message+")."); }
  return {fn, vars, order};
}

/* ---------- Formatting ---------- */
function fmt(n){
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(10)));
}
function fmtList(raw, name){
  const ks = Object.keys(raw).map(Number).sort((a,b)=>a-b);
  if (!ks.length) return "(vide)";
  return ks.map(k => name+"["+k+"] = "+fmtVal(raw[k])).join(" ; ");
}
function fmtVal(v){
  if (typeof v === "number") return fmt(v);
  if (typeof v === "boolean") return v ? "VRAI" : "FAUX";
  if (v && typeof v === "object" && v.__raw) return fmtList(v.__raw, v.__name);
  if (v === undefined) return "?";
  return String(v);
}

/* ---------- Output ---------- */
let scrollPending = false;
function toBottom(){ if (scrollPending) return; scrollPending = true; requestAnimationFrame(()=>{ scrollPending = false; out.scrollTop = out.scrollHeight; }); }
function outLine(text, cls){
  const d = document.createElement("div");
  d.className = cls || "o-line"; d.textContent = text; out.appendChild(d); toBottom();
}
function setEtat(text, s){ etat.textContent = text; etat.dataset.s = s || ""; }
function showErr(line, msg){
  errLine = line || 0;
  errBox.hidden = false;
  errBox.innerHTML = (line ? "<strong>Ligne "+line+"</strong>" : "") + esc(msg);
  render();
  if (line) scrollToLine(line);
}
function clearErr(){ errLine = 0; errBox.hidden = true; errBox.textContent = ""; }

function updateVars(){
  if (!lastState || !lastState.order.length) {
    varsBody.innerHTML = '<tr><td colspan="3" class="empty">'+(lastState ? "Aucune variable déclarée." : "Les valeurs apparaissent ici pendant l'exécution.")+'</td></tr>';
    return;
  }
  const {order, types, store, lists} = lastState;
  varsBody.innerHTML = order.map(k => {
    const ty = types[k];
    let val, vide = false;
    if (ty === "LISTE") { val = fmtList(lists[k], k); vide = val === "(vide)"; }
    else if (store[k] === undefined) { val = "pas encore de valeur"; vide = true; }
    else val = fmtVal(store[k]);
    if (ty === "CHAINE" && !vide) val = "“" + val + "”";
    return '<tr><td>'+esc(k)+'</td><td class="ty">'+ty+'</td><td class="val'+(vide?' vide':'')+'">'+esc(val)+'</td></tr>';
  }).join("");
}

/* ---------- Runtime ---------- */
function setRunning(on, step){
  $("btn-run").hidden = on; $("btn-step").hidden = on; $("hint-kbd").hidden = on;
  $("btn-stop").hidden = !on;
  $("btn-next").hidden = !(on && step); $("btn-cont").hidden = !(on && step);
  src.readOnly = on;
  $("exemples").disabled = on; $("btn-ouvrir").disabled = on; $("btn-new").disabled = on;
  document.querySelectorAll(".chip").forEach(b => b.disabled = on);
}

async function execute(step){
  if (run) return;
  clearErr(); curLine = 0; out.innerHTML = "";
  let prog;
  try { prog = compile(src.value); }
  catch(e) {
    if (!(e instanceof CErr)) throw e;
    showErr(e.line, e.message);
    outLine("L'algorithme contient une erreur : corrige la ligne indiquée sous le code.", "o-err");
    setEtat("Erreur", "err"); return;
  }
  render();
  const st = {stop:false, step, ticks:0, line:0, shown:0, resolveStep:null, rejectStep:null, cancelRead:null};
  run = st;
  const types = prog.vars, store = Object.create(null), lists = Object.create(null);
  function makeList(name){
    const raw = Object.create(null); lists[name] = raw;
    return new Proxy(raw, {get(t,k){
      if (typeof k === "symbol") return undefined;
      if (k === "__raw") return t;
      if (k === "__name") return name;
      if (/^-?\d+(\.\d+)?$/.test(k)) {
        if (!(k in t)) throw new RunErr(name+"["+k+"] n'a pas encore de valeur.");
        return t[k];
      }
      return undefined;
    }});
  }
  for (const k of prog.order) store[k] = types[k] === "LISTE" ? makeList(k) : undefined;
  lastState = {order: prog.order, types, store, lists};
  const V = new Proxy(store, {get(t,k){
    if (typeof k === "string" && types[k] && t[k] === undefined) throw new RunErr("La variable "+k+" n'a pas encore de valeur : utilise LIRE ou PREND_LA_VALEUR avant de t'en servir.");
    return t[k];
  }});
  function checkNum(v, label){
    if (typeof v === "boolean") throw new RunErr(label+" est un NOMBRE : on ne peut pas y ranger VRAI ou FAUX.");
    if (typeof v === "string") throw new RunErr(label+" est un NOMBRE, mais reçoit du texte (« "+v+" »). Déclare-la comme CHAINE, ou retire les guillemets.");
    if (typeof v !== "number") throw new RunErr(label+" doit recevoir un nombre.");
    if (Number.isNaN(v)) throw new RunErr("Le calcul pour "+label+" n'a pas de sens (par exemple la racine carrée d'un nombre négatif).");
    if (!Number.isFinite(v)) throw new RunErr("Le calcul pour "+label+" donne l'infini : y a-t-il une division par zéro ?");
    return v;
  }
  const __set = (name, v) => {
    const ty = types[name];
    if (ty === "NOMBRE") v = checkNum(v, name);
    else if (ty === "CHAINE") {
      if (typeof v === "boolean") v = v ? "VRAI" : "FAUX";
      else if (typeof v === "number") v = fmt(v);
      else if (v && typeof v === "object") throw new RunErr(name+" est une CHAINE : on ne peut pas y ranger une liste.");
      v = String(v);
    }
    store[name] = v;
  };
  const __idx = v => { v = checkNum(v, "le rang"); if (!Number.isInteger(v)) throw new RunErr("Le rang d'un élément de liste doit être un nombre entier (ici "+fmt(v)+")."); return v; };
  const __setEl = (name, k, v) => { lists[name][k] = checkNum(v, name+"["+k+"]"); };
  const __num = v => checkNum(v, "la borne de la boucle POUR");
  const __c = v => !!v;
  const __ln = n => { st.line = n; };
  const __s = n => {
    st.line = n;
    if (st.stop) throw new StopErr();
    if (st.step) {
      curLine = n; render(); scrollToLine(n); updateVars();
      setEtat("Pas à pas · ligne "+n, "run");
      return new Promise((res, rej) => { st.resolveStep = res; st.rejectStep = rej; });
    }
  };
  const __tick = () => {
    if (st.stop) throw new StopErr();
    st.ticks++;
    if (!st.step && st.ticks > 1000000) throw new RunErr("Plus d'un million de tours de boucle : la condition d'arrêt n'est sans doute jamais atteinte.");
    if (st.ticks % 4000 === 0) return new Promise(r => setTimeout(r, 0));
  };
  const __aff = arr => {
    st.shown++;
    if (st.shown > 3000) throw new RunErr("Plus de 3000 lignes affichées : l'algorithme a été arrêté.");
    outLine(arr.map(fmtVal).join(""));
  };
  const __lire = (name, type, k) => new Promise((res, rej) => {
    const label = k == null ? name : name+"["+fmt(k)+"]";
    const f = document.createElement("form");
    f.className = "lire";
    f.innerHTML = '<label for="lire-in">Entrer '+esc(label)+' :</label><input id="lire-in" autocomplete="off" '+(type==="NOMBRE"?'inputmode="decimal"':'')+'><button type="submit">Valider</button><span class="lire-msg"></span>';
    out.appendChild(f); toBottom();
    const inp = f.querySelector("input"), msg = f.querySelector(".lire-msg");
    setTimeout(() => { try { inp.focus({preventScroll:false}); } catch(e){} }, 0);
    updateVars();
    const prev = etat.textContent;
    setEtat("En attente de "+label, "run");
    f.addEventListener("submit", ev => {
      ev.preventDefault();
      let v = inp.value.trim();
      if (type === "NOMBRE") {
        const x = Number(v.replace(",", "."));
        if (v === "" || !Number.isFinite(x)) { msg.textContent = "Entre un nombre, par exemple 12 ou 3.5"; inp.focus(); return; }
        v = x;
      }
      const e = document.createElement("div");
      e.className = "o-line o-echo";
      e.textContent = "Entrée : " + label + " = " + (typeof v === "number" ? fmt(v) : v);
      f.replaceWith(e); toBottom();
      st.cancelRead = null;
      setEtat(st.step ? prev : "En cours", "run");
      res(v);
    });
    st.cancelRead = () => rej(new StopErr());
  });
  const __F = {
    alea: (a, b) => { a = checkNum(a,"ALGOBOX_ALEA_ENT"); b = checkNum(b,"ALGOBOX_ALEA_ENT"); return a + Math.floor(Math.random()*(b - a + 1)); },
    somme: (L, a, b) => { let s = 0; for (let k=a;k<=b;k++) s += L[k]; return s; },
    moyenne: (L, a, b) => __F.somme(L,a,b) / (b - a + 1),
    maxi: (L, a, b) => { let m = -Infinity; for (let k=a;k<=b;k++) m = Math.max(m, L[k]); return m; },
    mini: (L, a, b) => { let m = Infinity; for (let k=a;k<=b;k++) m = Math.min(m, L[k]); return m; }
  };

  setRunning(true, step);
  setEtat(step ? "Pas à pas" : "En cours", "run");
  updateVars();
  try {
    await prog.fn(V, __s, __ln, __set, __setEl, __lire, __aff, __tick, __c, __num, __idx, __F);
    outLine("Algorithme terminé.", "o-sys");
    setEtat("Terminé", "ok");
  } catch(e) {
    if (e instanceof StopErr) { outLine("Algorithme arrêté.", "o-sys"); setEtat("Arrêté"); }
    else {
      const line = e.line || st.line;
      const msg = e instanceof RunErr ? e.message : "Erreur pendant le calcul : " + e.message;
      curLine = 0;
      showErr(line, msg);
      outLine("Erreur ligne "+line+" : "+msg, "o-err");
      setEtat("Erreur", "err");
    }
  } finally {
    curLine = 0; run = null;
    setRunning(false);
    render(); updateVars();
  }
}

/* ---------- AlgoBox .alg import ---------- */
function fromAlg(xml){
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("le fichier .alg semble abîmé.");
  const lines = []; let affIdx = -1;
  const desc = doc.querySelector("description");
  const dt = desc && desc.getAttribute("texte");
  if (dt && dt.trim()) dt.trim().split(/\r?\n/).forEach(l => lines.push("// " + l));
  (function walk(el, depth){
    for (const it of Array.from(el.children)) {
      if (it.tagName !== "item") continue;
      const t = (it.getAttribute("algoitem") || "").trim();
      const code = (it.getAttribute("code") || "").split("#");
      const ind = "  ".repeat(depth);
      if (t.toUpperCase() === "FONCTIONS_UTILISEES" && !it.children.length) continue;
      const am = t.match(/^AFFICHER(CALCUL)?\b\s*(.*)$/i);
      if (am) {
        let arg = am[2];
        if (code[0] === "4" && !/^["']/.test(arg)) arg = '"' + arg + '"';
        const noNl = code.length > 2 && code[code.length-1] === "0";
        if (affIdx >= 0) lines[affIdx] += ", " + arg;
        else { lines.push(ind + "AFFICHER " + arg); affIdx = lines.length - 1; }
        if (!noNl) affIdx = -1;
        continue;
      }
      affIdx = -1;
      if (t) lines.push(ind + t);
      walk(it, depth + 1);
    }
  })(doc.documentElement, 0);
  if (!lines.length) throw new Error("aucune instruction trouvée dans ce fichier.");
  return lines.join("\n");
}

/* ---------- Editing helpers ---------- */
function save(){ try { localStorage.setItem(KEY, src.value); } catch(e){} }
let saveT = 0;
function onInput(){ if (errLine) clearErr(); render(); clearTimeout(saveT); saveT = setTimeout(save, 400); }
function setCode(code){ src.value = code; src.scrollTop = 0; clearErr(); render(); save(); }
const isExample = c => c.trim() === BLANK.trim() || EX.some(e => e.code.trim() === c.trim());
function replaceCode(code){
  if (src.value.trim() && !isExample(src.value)) { backup = src.value; $("btn-restore").hidden = false; }
  setCode(code);
}
function ins(text){
  src.focus();
  let ok = false;
  try { ok = document.execCommand("insertText", false, text); } catch(e){}
  if (!ok) { src.setRangeText(text, src.selectionStart, src.selectionEnd, "end"); onInput(); }
}
const SNIP = {
  var:{lines:["x EST_DU_TYPE NOMBRE"], sel:[0,1]},
  lire:{lines:["LIRE x"], sel:[5,6]},
  aff:{lines:['AFFICHER "Résultat : ", x'], sel:[9,26]},
  prend:{lines:["x PREND_LA_VALEUR 0"], sel:[0,1]},
  si:{lines:["SI (x > 0) ALORS","  DEBUT_SI","  ","  FIN_SI"], sel:[3,10]},
  sisinon:{lines:["SI (x > 0) ALORS","  DEBUT_SI","  ","  FIN_SI","SINON","  DEBUT_SINON","  ","  FIN_SINON"], sel:[3,10]},
  pour:{lines:["POUR i ALLANT_DE 1 A 10","  DEBUT_POUR","  ","  FIN_POUR"], sel:[5,6]},
  tq:{lines:["TANT_QUE (x < 100) FAIRE","  DEBUT_TANT_QUE","  ","  FIN_TANT_QUE"], sel:[9,18]}
};
function insertSnippet(key){
  if (run) return;
  const sn = SNIP[key], v = src.value, lines = v.split("\n");
  const debut = lines.findIndex(l => l.trim().toUpperCase() === "DEBUT_ALGORITHME");
  const lineStart = i => lines.slice(0, i).reduce((a, l) => a + l.length + 1, 0);
  let from, to, ind, lead;
  if (key === "var") {
    const at = debut >= 0 ? lineStart(debut) : 0;
    from = to = at; ind = "  "; lead = "";
    const text = ind + sn.lines[0] + "\n";
    src.focus(); src.setSelectionRange(from, to); ins(text);
    src.setSelectionRange(at + ind.length + sn.sel[0], at + ind.length + sn.sel[1]);
    return;
  }
  const p = src.selectionStart;
  let li = v.slice(0, p).split("\n").length - 1;
  if (debut >= 0 && li <= debut) li = debut;           // instructions go after DEBUT_ALGORITHME
  let line = lines[li] || "", tr = line.trim().toUpperCase();
  ind = (line.match(/^\s*/) || [""])[0];
  if (tr === "FIN_ALGORITHME") {
    from = to = lineStart(li); ind = "  ";
    const text = sn.lines.map(l => ind + l).join("\n") + "\n";
    src.focus(); src.setSelectionRange(from, to); ins(text);
    src.setSelectionRange(from + ind.length + sn.sel[0], from + ind.length + sn.sel[1]);
    return;
  }
  if (/^(DEBUT_\w+|VARIABLES)$/.test(tr)) ind += "  ";
  if (/^(SI .*ALORS|POUR .*|TANT_QUE .*FAIRE|SINON)$/.test(tr)) ind += "  ";
  const ls = lineStart(li);
  if (tr === "") { from = ls; to = ls + line.length; lead = ""; }
  else { from = to = ls + line.length; lead = "\n"; }
  const text = lead + sn.lines.map(l => ind + l).join("\n");
  src.focus(); src.setSelectionRange(from, to); ins(text);
  const s0 = from + lead.length + ind.length;
  src.setSelectionRange(s0 + sn.sel[0], s0 + sn.sel[1]);
}

/* ---------- Wiring ---------- */
src.addEventListener("input", onInput);
src.addEventListener("scroll", syncScroll);
src.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); if (!run) execute(false); return; }
  if (src.readOnly) return;
  if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); ins("  "); return; }
  if (e.key === "Enter" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
    const p = src.selectionStart, ls = src.value.lastIndexOf("\n", p - 1) + 1, cur = src.value.slice(ls, p);
    let ind = (cur.match(/^\s*/) || [""])[0];
    const tr = cur.trim().toUpperCase();
    if (/^(VARIABLES|DEBUT_ALGORITHME)$/.test(tr)) ind += "  ";
    e.preventDefault(); ins("\n" + ind);
  }
});
$("btn-run").addEventListener("click", () => execute(false));
$("btn-step").addEventListener("click", () => execute(true));
$("btn-next").addEventListener("click", () => { if (run && run.resolveStep) { const r = run.resolveStep; run.resolveStep = null; r(); } });
$("btn-cont").addEventListener("click", () => {
  if (!run) return;
  run.step = false; curLine = 0; render();
  $("btn-next").hidden = true; $("btn-cont").hidden = true;
  setEtat("En cours", "run");
  if (run.resolveStep) { const r = run.resolveStep; run.resolveStep = null; r(); }
});
$("btn-stop").addEventListener("click", () => {
  if (!run) return;
  run.stop = true;
  if (run.cancelRead) run.cancelRead();
  if (run.rejectStep) { const r = run.rejectStep; run.rejectStep = null; r(new StopErr()); }
});
document.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => insertSnippet(b.dataset.snip)));

const sel = $("exemples");
sel.innerHTML = '<option value="">Choisir un exemple…</option>' + EX.map((e,i) => '<option value="'+i+'">'+esc(e.name)+'</option>').join("");
sel.addEventListener("change", () => {
  if (sel.value === "") return;
  replaceCode(EX[+sel.value].code);
  sel.value = "";
  out.innerHTML = '<div class="o-empty">Exemple chargé. Clique sur Exécuter pour le lancer.</div>';
  setEtat("Prêt");
});
$("btn-restore").addEventListener("click", () => {
  if (backup == null) return;
  setCode(backup); backup = null; $("btn-restore").hidden = true;
});
const fileIn = $("fichier");
$("btn-ouvrir").addEventListener("click", () => fileIn.click());
fileIn.addEventListener("change", async () => {
  const f = fileIn.files && fileIn.files[0];
  if (!f) return;
  try {
    const t = (await f.text()).replace(/\r\n?/g, "\n");
    const code = /<Algo[\s>]/.test(t) ? fromAlg(t) : t;
    replaceCode(code);
    out.innerHTML = '<div class="o-empty">Fichier « '+esc(f.name)+' » ouvert. Clique sur Exécuter pour le lancer.</div>';
    setEtat("Prêt");
  } catch(e) {
    showErr(0, "Impossible d'ouvrir ce fichier : " + e.message);
  }
  fileIn.value = "";
});
let copyT = 0;
$("btn-copy").addEventListener("click", () => {
  const b = $("btn-copy");
  const done = t => { b.textContent = t; clearTimeout(copyT); copyT = setTimeout(() => b.textContent = "Copier le code", 2200); };
  try {
    navigator.clipboard.writeText(src.value).then(() => done("Code copié"), () => { src.focus(); src.select(); done("Sélectionné : fais Ctrl+C"); });
  } catch(e) { src.focus(); src.select(); done("Sélectionné : fais Ctrl+C"); }
});
let newT = 0, newArmed = false;
$("btn-new").addEventListener("click", () => {
  const b = $("btn-new");
  if (!newArmed) {
    newArmed = true; b.textContent = "Effacer le code ?"; b.classList.add("danger");
    clearTimeout(newT); newT = setTimeout(() => { newArmed = false; b.textContent = "Nouveau"; b.classList.remove("danger"); }, 3000);
    return;
  }
  newArmed = false; clearTimeout(newT); b.textContent = "Nouveau"; b.classList.remove("danger");
  replaceCode(BLANK);
  out.innerHTML = '<div class="o-empty">Nouvel algorithme. Déclare tes variables, puis écris les instructions.</div>';
  lastState = null; updateVars(); setEtat("Prêt");
  src.focus(); src.setSelectionRange(12, 12);
});

/* Memo highlighting */
document.querySelectorAll("pre.mini").forEach(el => { el.innerHTML = el.textContent.split("\n").map(hlLine).join("\n"); });

/* Start */
let start = null;
try { start = localStorage.getItem(KEY); } catch(e){}
setCode(start && start.trim() ? start : EX[0].code);
updateVars();
if (!/^\s*LIRE\b/mi.test(src.value)) execute(false);
else out.innerHTML = '<div class="o-empty">Clique sur Exécuter pour lancer l\'algorithme.</div>';
})();
