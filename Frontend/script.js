// Les variables globales et la navigation
let currentNiveauId = null;

const levelsContainer = document.getElementById("levels-container");
const dashboard = document.getElementById("dashboard");
const levelsPage = document.getElementById("levels-page");
const contentPage = document.getElementById("content-page") || document.getElementById("content");

// Fonctions pour l'ouverture/fermeture des Modals (Compatible Tailwind)
function ouvrirModalLogin() { 
    const modal = document.getElementById('login-modal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}
function fermerModalLogin() { 
    const modal = document.getElementById('login-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}
function ouvrirModalSignup() { 
    const modal = document.getElementById('signup-modal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}
function fermerModalSignup() { 
    const modal = document.getElementById('signup-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

// Navigation Niveaux (le Dashboard)
window.entrerDansNiveau = function(id, nom) {
    currentNiveauId = id;
    const welcome = document.querySelector(".welcome");
    if (welcome) welcome.classList.add("hidden");
    if (levelsPage) levelsPage.classList.add("hidden");
    
    if (dashboard) {
        dashboard.classList.remove("hidden");
        dashboard.style.display = ""; // Nettoie les styles inline qui gêneraient Tailwind
    }
    
    const titleElement = dashboard ? dashboard.querySelector(".title") : null;
    if (titleElement) titleElement.textContent = "Niveau : " + nom;
};

// ================= SIGNUP / LOGIN =================

async function signup() {
    const username = document.getElementById('signup-user').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-pass').value.trim();
    const niveau = document.getElementById('signup-niveau').value;

    if (!username || !email || !password) { alert("Remplis tous les champs !"); return; }

    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, niveau })
        });
        const data = await response.json();
        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            fermerModalSignup();
            location.reload(); 
        } else { alert("Erreur : " + data.message); }
    } catch (e) { alert("Le serveur ne répond pas."); }
}

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value.trim();

    if (!email || !password) { alert("Veuillez saisir votre email et votre mot de passe."); return; }

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (data.success) {
            // Enregistre les informations complètes de l'utilisateur (id, role, école, etc.)
            localStorage.setItem('user', JSON.stringify(data.user));
            fermerModalLogin();
            location.reload();
        } else { alert(data.message); }
    } catch (e) { alert("Erreur serveur."); }
}

// Déconnexion complète
function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('user_progression');
    location.reload();
}

function deconnexion() {
    logout();
}

function mettreAJourInterface(data) {
    const btnLogin = document.querySelector('.login');
    if (btnLogin) btnLogin.innerText = data.username;
    
    const btnNav = document.getElementById('btn-signup-main') || document.querySelector('.nav-btn');
    if (btnNav) {
        btnNav.innerText = "Log out";
        btnNav.style.backgroundColor = "#ef4444"; 
        btnNav.onclick = logout;
    }
    const welcomeH2 = document.querySelector('.welcome h2');
    if (welcomeH2) welcomeH2.innerText = "Ravi de te revoir, " + data.username + " !";
    
    // Application de la personnalisation de l'école (si disponible)
    if (data.ecole) {
        appliquerPersonnalisationEcole(data.ecole);
    }
}

function appliquerPersonnalisationEcole(ecole) {
    if (!ecole || ecole.id === 1) return; // Si c'est l'école publique par défaut

    const nomEcoleElement = document.getElementById('nom-ecole') || document.getElementById('header-title');
    const logoEcoleElement = document.getElementById('logo-ecole') || document.getElementById('header-logo');

    if (nomEcoleElement && ecole.nom) {
        nomEcoleElement.innerText = `MathsCollege - ${ecole.nom}`;
    }
    if (logoEcoleElement && ecole.logo) {
        logoEcoleElement.src = ecole.logo;
    }
}

// ================= AFFICHER COURS / VIDEOS / EXERCICES / CALCULATEUR =================

function showContent(blockId, title) {
    const db = document.getElementById("dashboard");
    const cp = document.getElementById("content-page") || document.getElementById("content");

    if (db) {
        db.classList.add("hidden");
        db.style.display = ""; // Réinitialise l'attribut style inline
    }
    
    if (cp) {
        cp.classList.remove("hidden");
        cp.style.display = "";
    }
    
    const pageTitle = document.getElementById("content-title");
    if (pageTitle) pageTitle.textContent = title;

    // Cacher tous les blocs de contenu secondaires
    document.querySelectorAll(".content-block").forEach(b => {
        b.classList.add("hidden");
        b.style.display = "";
    });

    // Si le bloc cliqué est le calculateur
    if (blockId === "calculateur" || blockId === "calculateur-block") {
        const calcBlock = document.getElementById("calculateur-block");
        if (calcBlock) {
            calcBlock.classList.remove("hidden");
            calcBlock.style.display = "";
        }
        return;
    }
    
    const container = document.getElementById(blockId) || document.getElementById(blockId + "-list");
    if (!container) return;
    
    container.classList.remove("hidden");
    container.style.display = "";
    container.innerHTML = "<h3 class='text-slate-500 font-semibold p-4'>Chargement...</h3>";

    fetch(`/api/${blockId}/${currentNiveauId}`)
        .then(res => res.json())
        .then(data => {
            container.innerHTML = `<h3 class="text-lg font-bold text-slate-800 mb-4">${title}</h3>`;
            
            data.forEach(item => {
                if (blockId === "cours") {
                    let renduFinal = "";
                    if (item.contenu.includes("<div") || item.contenu.includes("<h")) {
                        renduFinal = item.contenu;
                    } else {
                        renduFinal = typeof marked !== 'undefined' ? marked.parse(item.contenu) : item.contenu;
                    }

                    container.innerHTML += `
                        <div class="card recherche-item bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-4">
                            <h4 class="font-bold text-slate-900 text-base mb-2">${item.titre}</h4>
                            <div class="course-body text-slate-700 text-sm leading-relaxed">
                                ${renduFinal}
                            </div>
                        </div>`;
                } 
                else if (blockId === "videos") {
                    let rawData = item.youtube_id.trim();
                    let finalUrl = "";

                    if (rawData.includes('http')) {
                        if (rawData.includes('watch?v=')) {
                            finalUrl = rawData.replace('watch?v=', 'embed/');
                        } else {
                            finalUrl = rawData;
                        }
                    } else {
                        finalUrl = `https://www.youtube.com/embed/${rawData}`;
                    }

                    container.innerHTML += `
                        <div class="card recherche-item bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6">
                            <h4 class="font-bold text-slate-900 mb-3">${item.titre}</h4>
                            <div class="video-wrapper relative pb-[56.25%] h-0 overflow-hidden rounded-xl bg-black">
                                <iframe 
                                    class="absolute top-0 left-0 w-full h-full border-0"
                                    src="${finalUrl}" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowfullscreen>
                                </iframe>
                            </div>
                            <p class="mt-3 text-xs text-slate-500">
                                <a href="${finalUrl.replace('embed/', 'watch?v=')}" target="_blank" class="text-brand-500 hover:underline">Voir directement sur YouTube</a>
                            </p>
                        </div>`;
                } else {
                    // Pour les exercices ou autres contenus
                    container.innerHTML += `
                        <div class="card recherche-item bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-4">
                            <h4 class="font-bold text-slate-900 mb-2">${item.titre}</h4>
                            <div>${item.contenu || ""}</div>
                        </div>`;
                }
            });

            // MATHJAX POUR RENDRE LES FORMULES MATHEMATIQUES
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([container]);
            }
        })
        .catch(e => {
            console.error(e);
            container.innerHTML = "<p class='text-rose-500 font-semibold p-4'>Erreur de chargement des données.</p>";
        });
}

function afficherVueContent(type) {
    let titre = "Contenu";
    if (type === 'cours') titre = "Les Cours";
    if (type === 'videos') titre = "Les Vidéos";
    if (type === 'exercices') titre = "Les Exercices";
    if (type === 'calculateur') titre = "Mon Calculateur";
    
    showContent(type, titre);
}

// ================= SOLVEUR UNIVERSEL =================

(function () {
    'use strict';

    const EPS = 1e-9;
    const REL_HTML = { '=': '=', '<': '&lt;', '>': '&gt;', '<=': '≤', '>=': '≥' };

    function fmt(n) {
        if (!isFinite(n)) return String(n);
        const r = Math.round(n * 1e4) / 1e4;
        return String(Object.is(r, -0) ? 0 : r);
    }

    const isExact = (n) => Math.abs(n - Math.round(n * 1e4) / 1e4) < EPS;
    const esc = (s) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cx = (c) => (c === 1 ? '' : c === -1 ? '-' : fmt(c));

    function poly(terms) {
        let s = '';
        for (const [c, sym] of terms) {
            if (Math.abs(c) < EPS) continue;
            const abs = Math.abs(c);
            const body = sym ? (abs === 1 ? sym : fmt(abs) + sym) : fmt(abs);
            if (!s) s = (c < 0 ? '-' : '') + body;
            else s += (c < 0 ? ' - ' : ' + ') + body;
        }
        return s || '0';
    }

    const errMsg = (msg) => `<span class="text-rose-500">${msg}</span>`;

    function card({ title, steps = [], result = '', note = '' }) {
        const stepsHtml = steps
            .map((s, i) => `<p>• <b>Étape ${i + 1} :</b> ${s}</p>`)
            .join('');
        return `
            <div class="bg-slate-50 border-l-4 border-indigo-500 p-4 rounded-r-xl text-left space-y-3 text-sm mt-2">
                <div class="font-bold text-slate-800">${title}</div>
                ${stepsHtml ? `<div class="bg-white p-3 rounded-lg border text-xs space-y-1 text-slate-700">${stepsHtml}</div>` : ''}
                ${note ? `<p class="text-amber-700 bg-amber-50 p-2 rounded text-xs">${note}</p>` : ''}
                <div class="text-base font-bold text-indigo-600">${result}</div>
            </div>`;
    }

    function normalize(raw) {
        return raw
            .toLowerCase()
            .replace(/\s/g, '')
            .replace(/,/g, '.')
            .replace(/²/g, '^2')
            .replace(/≤/g, '<=')
            .replace(/≥/g, '>=')
            .replace(/×/g, '*')
            .replace(/÷/g, ':')
            .replace(/−/g, '-')
            .replace(/\*(?=[xy])/g, '');
    }

    function parseSide(str) {
        if (!str) return null;
        const tokens = str.match(/[+-]?[^+-]+/g) || [];
        if (tokens.join('') !== str) return null;

        const res = { a: 0, b: 0, y: 0, c: 0 };
        for (const tok of tokens) {
            const m = tok.match(/^([+-]?)(\d*\.?\d*)(x\^2|x|y)?$/);
            if (!m) return null;
            const [, sign, digits, v] = m;
            if (!v && digits === '') return null;
            if (digits === '.') return null;
            const coef = (sign === '-' ? -1 : 1) * (digits === '' ? 1 : parseFloat(digits));
            if (isNaN(coef)) return null;
            if (v === 'x^2') res.a += coef;
            else if (v === 'x') res.b += coef;
            else if (v === 'y') res.y += coef;
            else res.c += coef;
        }
        return res;
 }

    function divisionEuclidienne(a, b) {
        if (b === 0) return errMsg('Erreur : division par zéro impossible.');
        const q = Math.floor(a / b);
        const r = a % b;
        return `
            <div class="bg-indigo-50 border border-indigo-200 p-4 rounded-xl text-slate-800 mt-2 space-y-3 text-left">
                <div class="font-bold text-indigo-900">Division euclidienne</div>
                <div class="bg-white p-3 rounded-lg border border-indigo-100 text-sm space-y-1">
                    <p>• <b>Dividende :</b> ${a}</p>
                    <p>• <b>Diviseur :</b> ${b}</p>
                    <p>• <b>Quotient entier :</b> ${q}</p>
                    <p>• <b>Reste :</b> ${r}</p>
                </div>
                <div class="bg-indigo-100/60 p-2.5 rounded-lg text-xs font-mono text-indigo-900">
                    💡 <b>Résultat :</b> ${a} = (${b} × ${q}) + ${r}
                </div>
                <div class="text-xs text-slate-600">Valeur décimale : ${a} ÷ ${b} = ${fmt(a / b)}</div>
            </div>`;
    }

    function solveTwoVars(A, B, Y, C) {
        const fa = -A / Y, fb = -B / Y, fc = -C / Y;
        const type = Math.abs(A) > EPS ? 'Parabole' : Math.abs(B) > EPS ? 'Droite' : 'Droite horizontale';

        const steps = [
            `Isoler le terme en <i>y</i> : <code>${cx(Y)}y = ${poly([[-A, 'x²'], [-B, 'x'], [-C, '']])}</code>`
        ];
        if (Y !== 1) steps.push(`Diviser les deux membres par ${fmt(Y)}`);

        return card({
            title: `Équation à deux inconnues (<i>x</i> et <i>y</i>) — ${type}`,
            steps,
            result: `y = ${poly([[fa, 'x²'], [fb, 'x'], [fc, '']])}`
        });
    }

    function solveLinear(B, C, rel) {
        const sym = REL_HTML[rel];
        const val = -C / B;
        const flipped = B < 0 && rel !== '=';
        const flipMap = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };
        const finalRel = flipped ? flipMap[rel] : rel;
        const fsym = REL_HTML[finalRel];

        const steps = [
            `Tout regrouper : <code>${poly([[B, 'x'], [C, '']])} ${sym} 0</code>`,
            `Transposer la constante : <code>${cx(B)}x ${sym} ${fmt(-C)}</code>`,
            `Diviser par ${fmt(B)} : <code>x ${fsym} ${fmt(-C)} / ${fmt(B)}</code>`
        ];
        const note = flipped
            ? `⚠️ <b>Règle :</b> on divise par un nombre négatif (${fmt(B)}), le sens de l'inégalité est inversé !`
            : '';
        const approx = isExact(val) ? '' : ' (valeur arrondie)';

        return card({
            title: `1er degré (${rel === '=' ? 'équation' : 'inéquation'})`,
            steps,
            note,
            result: rel === '='
                ? `Solution : x = ${fmt(val)}${approx}`
                : `Solution : x ${fsym} ${fmt(val)}${approx}`
        });
    }

    function inequalitySet(pos, strict, delta, roots) {
        if (delta > 0) {
            const [p, q] = roots.map(fmt);
            if (pos) {
                return strict
                    ? { cond: `x < ${p} ou x > ${q}`, set: `]−∞ ; ${p}[ ∪ ]${q} ; +∞[` }
                    : { cond: `x ≤ ${p} ou x ≥ ${q}`, set: `]−∞ ; ${p}] ∪ [${q} ; +∞[` };
            }
            return strict
                ? { cond: `${p} < x < ${q}`, set: `]${p} ; ${q}[` }
                : { cond: `${p} ≤ x ≤ ${q}`, set: `[${p} ; ${q}]` };
        }
        if (delta === 0) {
            const p = fmt(roots[0]);
            if (pos) {
                return strict
                    ? { cond: `x ≠ ${p}`, set: `ℝ \\ {${p}}` }
                    : { cond: 'tout réel x', set: 'ℝ' };
            }
            return strict
                ? { cond: 'aucune solution', set: '∅' }
                : { cond: `x = ${p}`, set: `{${p}}` };
        }
        return pos ? { cond: 'tout réel x', set: 'ℝ' } : { cond: 'aucune solution', set: '∅' };
    }

    function solveQuadratic(A, B, C, rel) {
        const sym = REL_HTML[rel];
        let delta = B * B - 4 * A * C;
        if (Math.abs(delta) < EPS) delta = 0;

        const steps = [
            `Mettre sous la forme <i>ax² + bx + c</i> ${sym} 0 : <code>${poly([[A, 'x²'], [B, 'x'], [C, '']])} ${sym} 0</code>`,
            `Identifier : a = ${fmt(A)}, b = ${fmt(B)}, c = ${fmt(C)}`,
            `Discriminant : Δ = b² − 4ac = (${fmt(B)})² − 4×(${fmt(A)})×(${fmt(C)}) = <b>${fmt(delta)}</b>`
        ];

        let roots = [];
        if (delta > 0) {
            const s = Math.sqrt(delta);
            roots = [(-B - s) / (2 * A), (-B + s) / (2 * A)].sort((p, q) => p - q);
            steps.push(`Δ &gt; 0 : deux racines réelles <code>x = (−b ± √Δ) / 2a</code> → x₁ = <b>${fmt(roots[0])}</b> et x₂ = <b>${fmt(roots[1])}</b>`);
        } else if (delta === 0) {
            roots = [-B / (2 * A) + 0];
            steps.push(`Δ = 0 : racine double <code>x = −b / 2a</code> = <b>${fmt(roots[0])}</b>`);
        } else {
            steps.push('Δ &lt; 0 : pas de racine réelle.');
        }

        if (rel === '=') {
            const result = delta > 0
                ? `S = { ${fmt(roots[0])} ; ${fmt(roots[1])} }`
                : delta === 0
                    ? `S = { ${fmt(roots[0])} }`
                    : 'S = ∅ (aucune solution réelle)';
            return card({ title: 'Second degré (équation)', steps, result });
        }

        const wantPositive = rel === '>' || rel === '>=';
        const pos = (wantPositive ? A : -A) > 0;
        const strict = rel === '<' || rel === '>';
        const { cond, set } = inequalitySet(pos, strict, delta, roots);

        steps.push(
            `Le trinôme est du signe de <i>a</i> à l'extérieur des racines et du signe contraire entre les racines (a ${A > 0 ? '&gt; 0' : '&lt; 0'}).`
        );
        return card({
            title: 'Second degré (inéquation)',
            steps,
            result: `Solution : ${esc(cond)}<br><span class="text-sm">S = ${esc(set)}</span>`
        });
    }

    const OPS = { '*': '×', '/': '÷', '^': '^', '+': '+', '-': '−' };
    const formatError = () => new Error('format');

    function tokenize(expr) {
        const raw = expr.match(/\d+\.?\d*|\.\d+|[()+\-*/^]/g) || [];
        if (raw.join('') !== expr) throw formatError();

        const out = [];
        for (let i = 0; i < raw.length; i++) {
            const t = raw[i];
            const prev = out[out.length - 1];
            const prevIsValue = typeof prev === 'number' || prev === ')';

            if (/^[\d.]/.test(t)) {
                if (prevIsValue) throw formatError();
                out.push(parseFloat(t));
            } else if ((t === '-' || t === '+') && !prevIsValue) {
                const next = raw[i + 1];
                if (next !== undefined && /^[\d.]/.test(next)) {
                    if (t === '-' && raw[i + 2] === '^') {
                        out.push(-1, '*', parseFloat(next));
                    } else {
                        out.push(t === '-' ? -parseFloat(next) : parseFloat(next));
                    }
                    i++;
                } else if (next === '(') {
                    if (t === '-') out.push(-1, '*');
                } else {
                    throw formatError();
                }
            } else if (t === '(') {
                if (prevIsValue) out.push('*');
                out.push('(');
            } else {
                out.push(t);
            }
        }
        return out;
    }

    function showTokens(tokens) {
        return tokens
            .map((t, i) => {
                if (typeof t === 'number') {
                    const s = fmt(t);
                    return t < 0 && i > 0 && tokens[i - 1] !== '(' ? `(${s})` : s;
                }
                return OPS[t] || t;
            })
            .join(' ')
            .replace(/\( /g, '(')             .replace(/ \)/g, ')');
    }

    function reduceRange(tokens, lo, hi) {
        let idx = -1;
        for (let i = hi - 1; i > lo; i--) if (tokens[i] === '^') { idx = i; break; }
        if (idx < 0) for (let i = lo; i < hi; i++) if (tokens[i] === '*' || tokens[i] === '/') { idx = i; break; }
        if (idx < 0) for (let i = lo; i < hi; i++) if (tokens[i] === '+' || tokens[i] === '-') { idx = i; break; }
        if (idx < 0) throw formatError();

        const a = tokens[idx - 1];
        const b = tokens[idx + 1];
        const op = tokens[idx];
        if (idx - 1 < lo || idx + 1 >= hi || typeof a !== 'number' || typeof b !== 'number') throw formatError();

        let r;
        if (op === '+') r = a + b;
        else if (op === '-') r = a - b;
        else if (op === '*') r = a * b;
        else if (op === '^') r = Math.pow(a, b);
        else {
            if (b === 0) throw new Error('div0');
            r = a / b;
        }
        if (!isFinite(r)) throw formatError();

        tokens.splice(idx - 1, 3, r);
        const num = (n) => (n < 0 ? `(${fmt(n)})` : fmt(n));
        return `${num(a)} ${OPS[op]} ${num(b)} = <b>${fmt(r)}</b>`;
    }

    function evaluateWithSteps(expr) {
        const tokens = tokenize(expr);
        const steps = [];

        for (let guard = 0; guard < 200; guard++) {
            let changed = true;
            while (changed) {
                changed = false;
                for (let i = 0; i < tokens.length - 2; i++) {
                    if (tokens[i] === '(' && typeof tokens[i + 1] === 'number' && tokens[i + 2] === ')') {
                        tokens.splice(i, 3, tokens[i + 1]);
                        changed = true;
                        break;
                    }
                }
            }
            if (tokens.length === 1 && typeof tokens[0] === 'number') {
                return { steps, result: tokens[0] };
            }

            const before = showTokens(tokens);
            let lo = 0, hi = tokens.length;
            const close = tokens.indexOf(')');
            if (close >= 0) {
                const open = tokens.lastIndexOf('(', close);
                if (open < 0) throw formatError();
                lo = open + 1;
                hi = close;
            } else if (tokens.includes('(')) {
                throw formatError();
            }

            const action = reduceRange(tokens, lo, hi);
            steps.push({ before, action });
        }
        throw formatError();
    }

    function solveArithmetic(input) {
        if (!/^[0-9+\-*/().^:]+$/.test(input)) {
            return errMsg('Caractères non autorisés. Utilisez des chiffres et + − × ÷ ^ ( ).');
        }
        try {
            const { steps, result } = evaluateWithSteps(input.replace(/:/g, '/'));
            const stepsHtml = steps
                .map((s, i) => `
                    <div class="text-xs text-slate-700">
                        <span class="font-bold text-indigo-600">Étape ${i + 1} :</span>
                        <code>${s.before}</code><br>
                        <span class="pl-4">→ Calculer : ${s.action}</span>
                    </div>`)
                .join('');
            return `
                <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-800 mt-2 space-y-3 text-left">
                    <div class="font-bold text-slate-800">Décomposition du calcul</div>
                    <div class="bg-white p-3 rounded-lg border space-y-2">
                        ${stepsHtml || '<p class="text-xs text-slate-500">Calcul direct</p>'}
                    </div>
                    <div class="text-xl font-bold text-indigo-600">Résultat final : ${isExact(result) ? '' : '≈ '}${fmt(result)}</div>
                </div>`;
        } catch (e) {
            if (e.message === 'div0') return errMsg('Erreur : division par zéro impossible.');
            return errMsg('Format invalide. Vérifiez les parenthèses ou la saisie.');
        }
    }

    function resoudre() {
        const display = document.getElementById('resultat-solveur');
        const raw = document.getElementById('equation-input').value;

        const render = (html) => {
            display.innerHTML = html;
            if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([display]);
        };

        if (!raw.trim()) {
            return render(errMsg('Veuillez entrer un calcul, une équation ou une inéquation.'));
        }

        const input = normalize(raw);

        const div = input.match(/^(\d+)[\/:](\d+)$/);
        if (div) return render(divisionEuclidienne(parseInt(div[1], 10), parseInt(div[2], 10)));

        const parts = input.split(/(<=|>=|=|<|>)/);

        if (parts.length === 1) {
            if (/[xy]/.test(input)) {
                return render(errMsg('Ajoutez un signe <b>=</b>, <b>&lt;</b> ou <b>&gt;</b> (ex : 2x+4=0).'));
            }
            return render(solveArithmetic(input));
        }

        if (parts.length !== 3) return render(errMsg('Une seule relation (=, &lt;, &gt;, ≤, ≥) est autorisée.'));

        const rel = parts[1];
        const L = parseSide(parts[0]);
        const R = parseSide(parts[2]);
        if (!L || !R) {
            return render(errMsg('Format non reconnu. Exemples : 2x+4=0, x^2-5x+6&gt;0, 2x+y=6.'));
        }

        const A = L.a - R.a;
        const B = L.b - R.b;
        const Y = L.y - R.y;
        const C = L.c - R.c;

        if (Math.abs(Y) > EPS) {
            if (rel !== '=') return render(errMsg('Les inéquations à deux inconnues ne sont pas gérées.'));
            return render(solveTwoVars(A, B, Y, C));
        }

        if (Math.abs(A) > EPS) return render(solveQuadratic(A, B, C, rel));
        if (Math.abs(B) > EPS) return render(solveLinear(B, C, rel));

        const truth = {
            '=': Math.abs(C) < EPS,
            '<': C < -EPS,
            '>': C > EPS,
            '<=': C <= EPS,
            '>=': C >= -EPS
        }[rel];
        return render(card({
            title: 'Relation sans inconnue après simplification',
            steps: [`Tout regrouper : <code>${fmt(C)} ${REL_HTML[rel]} 0</code>`],
            result: truth ? 'Toujours vraie : S = ℝ' : 'Jamais vraie : S = ∅'
        }));
    }

    window.resoudre = resoudre;
})();

function effacerSolveur() {
    document.getElementById('equation-input').value = "";
    document.getElementById('resultat-solveur').innerHTML = "";
}

// ================= COACH SYLVIE IA (GÉRÉ AVEC QUOTA & USER ID) =================

async function envoyerQuestionIA() {
    const input = document.getElementById('monInputIA');
    const reponseZone = document.getElementById('reponseIA');
    const question = input.value.trim();

    if (!question) return;

    // Récupérer le profil connecté depuis le localStorage
    const userStocke = localStorage.getItem('user');
    const userData = userStocke ? JSON.parse(userStocke) : null;
    const userId = userData ? userData.id : null;

    // 1. Afficher le message de l'utilisateur
    reponseZone.innerHTML += `
        <div class="user-msg bg-brand-500 text-white p-3 rounded-2xl mb-3 max-w-[85%] ml-auto text-right text-sm">
            ${question}
        </div>`;
    input.value = "";
    
    // 2. Bulle de chargement
    const loadingId = "load-" + Date.now();
    reponseZone.innerHTML += `
        <div id="${loadingId}" class="bot-msg bg-slate-100 text-slate-600 p-3 rounded-2xl mb-3 max-w-[85%] text-sm">
            <em>Sylvie réfléchit...</em>
        </div>`;
    
    reponseZone.scrollTop = reponseZone.scrollHeight;

    try {
        const response = await fetch('/ask-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: question,
                userId: userId // Transmet l'ID de l'utilisateur connecté pour vérifier le quota
            })
        });

        const data = await response.json();
        const botBubble = document.getElementById(loadingId);

        if (response.ok && data.answer) {
            const htmlContent = typeof marked !== 'undefined' ? marked.parse(data.answer) : data.answer;
            botBubble.innerHTML = `<strong class="text-brand-500">Sylvie :</strong> ${htmlContent}`;

            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([botBubble]);
            }
        } else {
            // Affichage des messages d'erreur ou de dépassement de quota (ex: Code HTTP 429)
            const messageErreur = data.answer || "Désolée, je n'ai pas pu traiter votre demande.";
            botBubble.innerHTML = `<span class="text-rose-600 font-medium">⚠️ ${messageErreur}</span>`;
        }

    } catch (error) {
        console.error("Erreur IA:", error);
        const errBubble = document.getElementById(loadingId);
        if (errBubble) errBubble.innerHTML = "<span class='text-rose-500'>⚠️ Connexion perdue avec le serveur.</span>";
    }

    reponseZone.scrollTop = reponseZone.scrollHeight;
}

function declencherEntrainement() {
    const user = JSON.parse(localStorage.getItem('user'));
    const prenom = (user && user.username) ? user.username : "l'ami";

    const aiContainer = document.getElementById('ai-chat-container') || document.getElementById('reponseIA');
    if (aiContainer) aiContainer.scrollIntoView({ behavior: 'smooth' });

    const reponseZone = document.getElementById('reponseIA');
    if (reponseZone) {
        reponseZone.innerHTML += `
            <div class="bot-msg bg-amber-50 border-l-4 border-brand-500 text-slate-800 p-3 rounded-xl mt-3 text-sm">
                <strong>Sylvie :</strong> C'est parti ${prenom} ! Je te prépare une série d'exercices. 
                Dis-moi sur quel chapitre tu veux t'exercer !
            </div>`;
        reponseZone.scrollTop = reponseZone.scrollHeight;
    }
}

// ================= INITIALISATION ET CHARGEMENT DE LA PAGE =================

document.addEventListener('DOMContentLoaded', () => {
    const userStocke = localStorage.getItem('user');
    const reponseIA = document.getElementById('reponseIA');

    if (userStocke) {
        // --- CAS 1 : UTILISATEUR CONNECTÉ ---
        const userData = JSON.parse(userStocke);
        mettreAJourInterface(userData);
        
        document.getElementById('guest-zone')?.classList.add('hidden');
        document.getElementById('user-zone')?.classList.remove('hidden');
        document.getElementById('banner-guest')?.classList.add('hidden');
        document.getElementById('banner-user')?.classList.remove('hidden');

        const nom = userData.username || userData.nom || "Élève";
        const classe = userData.niveau || userData.classe || "6ème";

        if (document.getElementById('user-badge')) document.getElementById('user-badge').textContent = `Classe : ${classe}`;
        if (document.getElementById('user-display-name')) document.getElementById('user-display-name').textContent = nom;
        if (document.getElementById('user-display-class')) document.getElementById('user-display-class').textContent = classe;

        if (reponseIA) {
            reponseIA.innerHTML = `
                <div class="bot-msg bg-brand-50/80 p-3 rounded-2xl border-l-4 border-brand-500 text-sm text-slate-700">
                    <strong>Sylvie :</strong> Bonjour <strong>${nom}</strong> ! Je suis prête à t'aider. Que veux-tu réviser ?
                </div>`;
        }
    } else {
        // --- CAS 2 : INVITÉ (NON CONNECTÉ) ---
        document.getElementById('guest-zone')?.classList.remove('hidden');
        document.getElementById('user-zone')?.classList.add('hidden');
        document.getElementById('banner-guest')?.classList.remove('hidden');
        document.getElementById('banner-user')?.classList.add('hidden');

        if (reponseIA) {
            reponseIA.innerHTML = `
                <div class="bot-msg bg-brand-50/80 p-3 rounded-2xl border-l-4 border-brand-500 text-sm text-slate-700">
                    <strong>Sylvie :</strong> Bonjour ! Je suis ta coach de maths. Pose-moi tes questions sur les cours ou un exercice ! (Connecte-toi pour profiter de Coach Sylvie).
                </div>`;
        }
    }

    // Écouteurs d'événements des boutons du Dashboard
    document.getElementById("btn-cours")?.addEventListener("click", () => showContent("cours", "Cours"));
    document.getElementById("btn-videos")?.addEventListener("click", () => showContent("videos", "Vidéos"));

    // Écouteur Touche Entrée pour l'IA
    document.getElementById('monInputIA')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') envoyerQuestionIA();
    });

    // Chargement des niveaux depuis le Backend
    if (levelsContainer) {
        fetch("/niveaux")
            .then(res => res.json())
            .then(data => {
                levelsContainer.innerHTML = ""; 
                data.forEach(niveau => {
                    const card = document.createElement("div");
                    card.className = "level-card bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition text-left flex flex-col justify-between";
                    card.innerHTML = `
                        <h3 class="font-bold text-slate-900 text-lg mb-4">${niveau.nom}</h3>
                        <button class="action-btn bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2 px-4 rounded-xl text-sm transition w-full" onclick="entrerDansNiveau(${niveau.id}, '${niveau.nom}')">Entrer</button>
                    `;
                    levelsContainer.appendChild(card);
                });
            })
            .catch(err => console.error("Serveur Backend éteint ou inaccessible."));
    }
});

// ================= NAVIGATION =================

function selectionnerNiveau(niveau) {
  currentNiveau = niveau;
  localStorage.setItem('niveauSelectionne', niveau);

  if (document.getElementById('current-niveau-display')) {
      document.getElementById('current-niveau-display').textContent = niveau;
  }

  document.getElementById('levels-page')?.classList.add('hidden');
  
  const db = document.getElementById('dashboard');
  if (db) {
      db.classList.remove('hidden');
      db.style.display = "";
  }
}

function revenirAccueil() {
  const db = document.getElementById('dashboard');
  const cp = document.getElementById('content-page') || document.getElementById('content');
  const lp = document.getElementById('levels-page');

  if (db) { db.classList.add('hidden'); db.style.display = ""; }
  if (cp) { cp.classList.add('hidden'); cp.style.display = ""; }
  if (lp) { lp.classList.remove('hidden'); lp.style.display = ""; }
}

function revenirDashboard() {
  const cp = document.getElementById('content-page') || document.getElementById('content');
  const db = document.getElementById('dashboard');

  if (cp) {
      cp.classList.add('hidden');
      cp.style.display = "";
  }
  if (db) {
      db.classList.remove('hidden');
      db.style.display = "";
  }
}

function scrollToSolveur() {
  const box = document.getElementById('solveur-box') || document.getElementById('calculateur-block');
  box?.scrollIntoView({ behavior: 'smooth' });
}