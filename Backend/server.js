// ============= IMPORTS =============
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require('express');
const cors = require('cors');
const { evaluate } = require('mathjs');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sanitizeHtml = require('sanitize-html');

// ============= IMPORTS CLOUDINARY =============
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ============= CONFIGURATION =============
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const app = express();

// Configuration Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Storage Cloudinary pour les Logos d'Écoles ---
const storageLogosCloudinary = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'mathscollege/logos',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'svg'],
        public_id: (req, file) => 'logo-' + Date.now()
    }
});
const uploadLogo = multer({ storage: storageLogosCloudinary });

// --- Storage Cloudinary pour les Fiches (PDFs cours/exercices) ---
const storageFichesCloudinary = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'mathscollege/fiches',
        resource_type: 'auto',
        public_id: (req, file) => file.fieldname + '-' + Date.now()
    }
});
const upload = multer({ storage: storageFichesCloudinary });

// Middleware fichiers statiques & body parsers
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../Frontend')));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============= CONFIGURATION EMAIL =============
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'ritakngot3@gmail.com',
        pass: process.env.EMAIL_PASS
    }
});

// ============= CONNEXION MYSQL =============
const mysql = require('mysql2/promise'); // Utilise directement /promise

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    ssl: process.env.DB_SSL === 'true' ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    } : undefined
});

module.exports = db;

// ============= TÂCHE AUTOMATIQUE : VÉRIFICATION ABONNEMENTS EXPIRÉS =============
async function verifierAbonnementsExpires() {
    try {
        const updateExpiredSql = `
            UPDATE ecoles 
            SET statut_abonnement = 'suspendu' 
            WHERE date_fin_abonnement IS NOT NULL 
              AND date_fin_abonnement < NOW() 
              AND statut_abonnement = 'actif'
        `;
        const [result] = await db.query(updateExpiredSql);
        if (result.affectedRows > 0) {
            console.log(`[CRON Abonnements] ${result.affectedRows} école(s) passée(s) en statut suspendu.`);
        }
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
            console.error(
                `[CRON Abonnements] La table 'ecoles' est introuvable sur le serveur MySQL ` +
                `${process.env.DB_HOST}:${process.env.DB_PORT || 3306}, base '${process.env.DB_NAME}'.`
            );
        } else {
            console.error("[CRON Abonnements] Erreur mise à jour statut :", err);
        }
    }
}

// Test de connexion asynchrone au démarrage
(async () => {
    try {
        const connection = await db.getConnection();
        console.log('Connecté à MySQL');
        console.log(`[DB] Hôte : ${process.env.DB_HOST} | Port : ${process.env.DB_PORT || 3306} | Base demandée : ${process.env.DB_NAME}`);

        const [r1] = await connection.query('SELECT DATABASE() AS base, @@hostname AS serveur, @@port AS port');
        if (r1 && r1[0]) {
            console.log(`[DB] Base active : ${r1[0].base} | Serveur MySQL : ${r1[0].serveur} | Port : ${r1[0].port}`);
        }

        const [r2] = await connection.query("SHOW TABLES LIKE 'ecoles'");
        connection.release();

        if (!r2 || r2.length === 0) {
            console.error("[DB] ATTENTION : la table 'ecoles' n'existe pas sur CE serveur MySQL.");
        } else {
            console.log("[DB] Table 'ecoles' trouvée.");
        }

        verifierAbonnementsExpires();
        setInterval(verifierAbonnementsExpires, 1000 * 60 * 60);
    } catch (err) {
        console.log('Erreur MySQL au démarrage:', err);
    }
})();

// ============= FONCTIONS UTILITAIRES =============
function genererMotDePasseTemp() {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = 'Prof-';
    for (let i = 0; i < 6; i++) {
        pass += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return pass;
}

// ============= MIDDLEWARE : VÉRIFICATION QUOTA IA (3 QST / JOUR) =============
async function verifierQuotaIA(req, res, next) {
    const { userId } = req.body; 

    if (!userId) {
        return res.status(403).json({ 
            answer: "Vous devez être connecté pour poser des questions à Coach Sylvie. Les comptes publics ont droit à 3 questions par jour !" 
        });
    }

    try {
        const sql = "SELECT id, ecole_id, questions_posees_aujourdhui, date_derniere_question FROM users WHERE id = ?";
        const [results] = await db.query(sql, [userId]);

        if (results.length === 0) {
            return res.status(404).json({ answer: "Utilisateur non trouvé." });
        }

        const user = results[0];
        const ecoleId = user.ecole_id || 1;

        if (ecoleId !== 1) {
            req.userContext = { userId: user.id, ecoleId: ecoleId };
            return next();
        }

        const aujourdhui = new Date().toISOString().split('T')[0];
        const dateDerniere = user.date_derniere_question ? new Date(user.date_derniere_question).toISOString().split('T')[0] : null;

        let questionsAujourdhui = user.questions_posees_aujourdhui || 0;

        if (dateDerniere !== aujourdhui) {
            questionsAujourdhui = 0;
        }

        if (questionsAujourdhui >= 3) {
            return res.status(429).json({ 
                answer: "Limite atteinte ! Vous avez posé vos 3 questions gratuites aujourd'hui. Demandez à votre établissement de rejoindre MathsCollege pour débloquer l'accès illimité !" 
            });
        }

        const updateSql = "UPDATE users SET questions_posees_aujourdhui = ?, date_derniere_question = ? WHERE id = ?";
        await db.query(updateSql, [questionsAujourdhui + 1, aujourdhui, user.id]);
        
        req.userContext = { userId: user.id, ecoleId: ecoleId };
        next();
    } catch (error) {
        console.error("Erreur serveur quotas :", error);
        res.status(500).json({ answer: "Erreur lors du traitement des quotas." });
    }
}

// ============= ROUTE IA =============
async function callGeminiWithRetry(model, prompt, retries = 2, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return result;
        } catch (error) {
            const is503 = error.status === 503 || (error.message && error.message.includes('503'));
            if (is503 && i < retries - 1) {
                console.warn(`[IA] Surcharge 503 détectée. Nouvelle tentative (${i + 1}/${retries})...`);
                await new Promise(res => setTimeout(res, delay));
                continue;
            }
            throw error;
        }
    }
}

// --- Sécurité : nettoyage du HTML produit par l'IA ---
const OPTIONS_HTML = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'span', 'img', 'u']),
    allowedAttributes: { '*': ['class', 'style'], 'img': ['src', 'alt'] },
    allowedSchemes: ['http', 'https']
};
const nettoyerHtml = (html) => sanitizeHtml(html || '', OPTIONS_HTML);
const nettoyerTexte = (t, max = 200) => sanitizeHtml(t || '', { allowedTags: [], allowedAttributes: {} }).trim().slice(0, max);

// Un seul endroit pour identifier l'utilisateur.
// TODO : quand le login sera sécurisé (JWT/session), remplacer par req.user.id
function identifierUtilisateur(req) {
    return req.body.userId || null;
}

// --- COACH SYLVIE (ÉLÈVES & PROFESSEURS) ---
app.post('/ask-ai', verifierQuotaIA, async (req, res) => {
    try {
        const prompt = typeof req.body.prompt === 'string' ? req.body.prompt.trim().slice(0, 4000) : '';
        const userId = identifierUtilisateur(req);

        if (!prompt) {
            return res.status(400).json({ answer: "Le serveur n'a pas reçu de texte." });
        }

        // 1. Informations de l'utilisateur (rôle, niveau et école lus en base, jamais dans le body)
        let userName = "Utilisateur";
        let userRole = "eleve";
        let niveauEleve = "6ème";
        let ecoleIdEleve = 1;

        if (userId) {
            const [userInfos] = await db.query("SELECT username, role, niveau, ecole_id FROM users WHERE id = ?", [userId]);
            if (userInfos && userInfos.length > 0) {
                userName = userInfos[0].username || "Utilisateur";
                userRole = userInfos[0].role || "eleve";
                niveauEleve = userInfos[0].niveau || "6ème";
                ecoleIdEleve = userInfos[0].ecole_id || 1;
            }
        }

        // 2. Cours pour alimenter le contexte
        const htmlEnTexte = (html, max = 1500) => (html || '')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, max);

        const formaterCours = (liste) => liste
            .map(c => `- [${c.domaine ? c.domaine.toUpperCase() : 'MATHS'}] ${c.titre} : ${htmlEnTexte(c.contenu) || 'Disponible'}`)
            .join("\n");

        // "5ème" -> 5 -> id 2 dans la table niveaux
        const NIVEAU_IDS = { 6: 1, 5: 2, 4: 3, 3: 4 };
        const chiffre = parseInt((String(niveauEleve).match(/\d/) || [])[0]);
        const niveauId = NIVEAU_IDS[chiffre] || null;

        let coursContexte = "";
        try {
            if (userRole === 'professeur' || !niveauId) {
                const [coursList] = await db.query(
                    `SELECT titre, domaine, contenu FROM cours
                     WHERE ecole_id = ? OR ecole_id = 1 OR ecole_id IS NULL`,
                    [ecoleIdEleve]
                );
                if (coursList.length > 0) coursContexte = formaterCours(coursList);
            } else {
                const [communs] = await db.query(
                    `SELECT titre, domaine, contenu FROM cours
                     WHERE ecole_id = 1 AND niveau_id = ?`,
                    [niveauId]
                );
                let specifiques = [];
                if (Number(ecoleIdEleve) !== 1) {
                    [specifiques] = await db.query(
                        `SELECT titre, domaine, contenu FROM cours
                         WHERE ecole_id = ? AND niveau_id = ?`,
                        [ecoleIdEleve, niveauId]
                    );
                }
                if (communs.length > 0) {
                    coursContexte += `COURS COMMUNS (programme de ${niveauEleve}) :\n${formaterCours(communs)}`;
                }
                if (specifiques.length > 0) {
                    coursContexte += `\n\nCOURS SPÉCIFIQUES À SON ÉCOLE (${niveauEleve}) :\n${formaterCours(specifiques)}`;
                }
            }
        } catch (err) {
            console.error("Erreur lors de la récupération des cours pour l'IA :", err);
        }

        // 3. Instructions système selon le rôle
        let systemInstruction = "";

        if (userRole === 'professeur') {
            systemInstruction = `
                Tu es Sylvie, une assistante pédagogique intelligente et experte en mathématiques, conçue pour aider les professeurs.
                Tu t'adresses à ${userName}, qui est professeur dans l'établissement.

                Voici la liste des cours de la plateforme de l'école pour référence :
                ${coursContexte ? coursContexte : "Aucun cours enregistré pour le moment."}

                Directives pour le professeur :
                - Aide-le à concevoir des plans de cours, formuler des exercices, structurer des interros ou trouver des approches pédagogiques adaptées.
                - Sois professionnelle, créative, technique et force de proposition dans tes réponses.
                - Tutoie le professeur et adopte un ton constructif et collégial.

                Publication directe :
                - Si le professeur te demande de PUBLIER un cours ou un exercice, tu ne publies rien toi-même : tu prépares la publication, et il la validera d'un clic.
                - Si le niveau (6ème, 5ème, 4ème ou 3ème) n'est pas précisé, DEMANDE-LE avant de préparer quoi que ce soit, sans écrire de bloc.
                - Pour un COURS, termine ta réponse par un bloc EXACTEMENT dans ce format :
[[PUBLICATION]]
type: cours
titre: <titre du cours>
niveau: <6ème | 5ème | 4ème | 3ème>
domaine: <algebre | geometrie | ...>
---CONTENU---
<le contenu complet en HTML>
[[FIN_PUBLICATION]]
                - Pour un EXERCICE, ne demande PAS quel cours ni quelle classe : le professeur les choisira dans des listes affichées sous ton aperçu. Si le niveau n'est pas précisé, demande-le d'abord. Termine ta réponse par un bloc EXACTEMENT dans ce format :
[[PUBLICATION]]
type: exercice
titre: <titre de l'exercice>
niveau: <6ème | 5ème | 4ème | 3ème>
domaine: <algebre | geometrie | ...>
---ENONCE---
<l'énoncé complet en HTML>
---REPONSE---
<la réponse correcte, courte>
[[FIN_PUBLICATION]]
                - Avant le bloc, écris une phrase courte du type "Voici l'aperçu : choisis la classe et le cours, puis clique sur Publier."
                - Après le bloc, ne dis rien de plus.
                - N'utilise un bloc que si le professeur demande explicitement de publier.
            `;
        } else {
            systemInstruction = `
                Tu es Sylvie, une coach et tutrice de mathématiques bienveillante, dynamique et pédagogique.
                Tu t'adresses à l'élève ${userName}, qui est en classe de ${niveauEleve}.

                Voici les COURS disponibles sur la plateforme pour son niveau et son établissement :
                ${coursContexte ? coursContexte : "Aucun cours n'a encore été publié pour le moment."}

                Directives pour l'élève :
                - Si l'élève te demande quels sont ses cours ou sa liste de cours, liste précisément les cours affichés ci-dessus sous forme de puces. Ne dis jamais que tu n'as pas accès à sa liste !
                - Appuie-toi d'abord sur les cours ci-dessus (surtout ceux spécifiques à son école), cite leur titre quand tu t'y réfères, et reste cohérente avec leur méthode et leur vocabulaire.
                - Aide-le à réviser, explique les notions pas à pas sans donner directement les réponses aux exercices.
                - Sois encourageante et tutoie l'élève.
                - Ne produis jamais de bloc [[PUBLICATION]] : tu ne publies rien.
            `;
        }

        // 4. Appel au modèle Gemini
        const model = genAI.getGenerativeModel({
            model: "gemini-3.6-flash",
            systemInstruction: systemInstruction
        });

        const result = await callGeminiWithRetry(model, prompt);
        const text = result.response.text();

        // 5. Extraction d'une publication proposée (professeurs uniquement, rôle lu en base)
        let publication = null;
        let answer = text;

        // Retirer tout bloc technique du texte affiché, pour tout le monde
        const regexBloc = /\[\[PUBLICATION\]\]([\s\S]*?)\[\[FIN_PUBLICATION\]\]/;
        const m = text.match(regexBloc);

        if (m) {
            answer = text.replace(m[0], '').trim();

            if (userRole === 'professeur') {
                const corps = m[1];
                const entete = corps.split(/---(?:CONTENU|ENONCE)---/)[0];
                const champ = (nom) => {
                    const r = entete.match(new RegExp(nom + '\\s*:\\s*(.+)', 'i'));
                    return r ? r[1].trim() : '';
                };
                const type = champ('type').toLowerCase() === 'exercice' ? 'exercice' : 'cours';
                const titre = nettoyerTexte(champ('titre'), 200);
                const niveau = nettoyerTexte(champ('niveau'), 10);
                let domaine = nettoyerTexte(champ('domaine'), 30).toLowerCase();
                if (!/^[a-zé_ -]{2,30}$/.test(domaine)) domaine = 'algebre';

                if (type === 'exercice') {
                    const apres = corps.split('---ENONCE---')[1] || '';
                    const [enonce, reponse] = apres.split('---REPONSE---');

                    if (titre && enonce && enonce.trim()) {
                        publication = {
                            type, titre, niveau, domaine,
                            enonce: nettoyerHtml(enonce.trim()),
                            reponse: nettoyerTexte(reponse, 500)
                        };
                    }
                } else {
                    const contenu = nettoyerHtml(corps.split('---CONTENU---').slice(1).join('---CONTENU---').trim());
                    if (titre && contenu) {
                        publication = { type, titre, niveau, domaine, contenu };
                    }
                }
            }
        }

        // 6. Sauvegarde de la conversation
        if (userId) {
            await db.query("INSERT INTO conversations_ia (user_id, ecole_id, question, reponse) VALUES (?, ?, ?, ?)",
                [userId, ecoleIdEleve, prompt, text]
            ).catch(err => console.error("Erreur stockage conversation :", err));
        }

        res.json({ answer, publication });

    } catch (error) {
        console.error("Erreur technique IA :", error);
        res.status(500).json({
            answer: "Désolé, une erreur technique est survenue. Réessaie plus tard !"
        });
    }
});


// ============= AUTHENTIFICATION (SIGNUP & LOGIN) =============
app.post('/api/signup', async (req, res) => {
    const { username, email, password, role, niveau, ecole_id } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: "Tous les champs requis ne sont pas remplis." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const targetEcoleId = ecole_id || 1;
        
        const validRoles = ['eleve', 'professeur', 'admin_ecole', 'sudo_admin'];
        const userRole = validRoles.includes(role) ? role : 'eleve';
        
        const userNiveau = userRole === 'professeur' ? 'Enseignant' : (niveau || '6ème');
        const statutInitial = (userRole === 'eleve') ? 'en_attente' : 'actif';

        const sql = "INSERT INTO users (username, email, password, role, niveau, ecole_id, statut) VALUES (?, ?, ?, ?, ?, ?, ?)";
        const [result] = await db.query(sql, [username, email, hashedPassword, userRole, userNiveau, targetEcoleId, statutInitial]);

        const messageSucces = (userRole === 'eleve')
            ? "Inscription réussie ! Votre compte est en attente de validation par l'administrateur de votre école."
            : "Inscription réussie !";

        return res.status(201).json({ 
            success: true, 
            message: messageSucces,
            user: {
                id: result.insertId,
                username: username,
                email: email,
                role: userRole,
                niveau: userNiveau,
                ecole_id: targetEcoleId,
                statut: statutInitial
            }
        });
    } catch (e) {
        console.error("Erreur BDD Signup :", e);
        return res.status(400).json({ success: false, message: "Pseudo ou Email déjà utilisé." });
    }
});

app.get('/api/ecoles/liste', async (req, res) => {
    try {
        const sql = "SELECT id, nom FROM ecoles WHERE statut_abonnement = 'actif' ORDER BY nom ASC";
        const [results] = await db.query(sql);
        res.json({ success: true, ecoles: results });
    } catch (err) {
        console.error("Erreur chargement écoles :", err);
        res.status(500).json({ success: false, message: "Impossible de charger la liste des écoles." });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body; 

    try {
        const sql = `
            SELECT u.*, 
                   e.nom AS ecole_nom, 
                   e.logo_url, 
                   e.couleur_primaire, 
                   e.ville AS ecole_ville,
                   e.quartier AS ecole_quartier,
                   e.arrondissement AS ecole_arrondissement,
                   e.telephone AS ecole_telephone, 
                   e.email_contact AS ecole_email,
                   e.statut_abonnement, 
                   e.date_fin_abonnement
            FROM users u
            LEFT JOIN ecoles e ON u.ecole_id = e.id
            WHERE u.email = ?
        `;

        const [result] = await db.query(sql, [email]);
        if (result.length === 0) {
            return res.status(401).json({ success: false, message: "Email ou mot de passe incorrect" });
        }

        const user = result[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            if (user.role === 'eleve' && user.statut !== 'actif') {
                return res.status(403).json({ 
                    success: false, 
                    message: "Votre compte est en attente de validation par l'administrateur de l'école." 
                });
            }

            if (user.role !== 'super_admin' && user.ecole_id && user.ecole_id !== 1) {
                const estInactif = user.statut_abonnement === 'inactif';
                const estExpire = user.date_fin_abonnement && new Date(user.date_fin_abonnement) < new Date();

                if (estInactif || estExpire) {
                    return res.status(403).json({ 
                        success: false, 
                        message: "L'abonnement de votre établissement a expiré. Veuillez contacter la direction de votre école." 
                    });
                }
            }

            let redirectUrl = "index.html";
            if (user.role === 'professeur') {
                redirectUrl = "profs.html";
            } else if (user.role === 'admin_ecole') {
                redirectUrl = "admin_ecole.html";
            } else if (user.role === 'super_admin') {
                redirectUrl = "super_admin.html";
            }

            const elementsAdresse = [user.ecole_quartier, user.ecole_arrondissement, user.ecole_ville].filter(Boolean);
            const adresseFormatee = elementsAdresse.length > 0 ? elementsAdresse.join(', ') : null;

            res.json({ 
                success: true, 
                message: "Connexion réussie !",
                redirectUrl: redirectUrl,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    niveau: user.niveau,
                    role: user.role,
                    statut: user.statut,
                    ecole: {
                        id: user.ecole_id,
                        nom: user.ecole_nom || 'MathsCollege Officiel',
                        logo: user.logo_url,
                        couleur: user.couleur_primaire || '#4F46E5',
                        adresse: adresseFormatee,
                        telephone: user.ecole_telephone,
                        email_contact: user.ecole_email,
                        statut: user.statut_abonnement || 'actif'
                    }
                }
            });
        } else {
            res.status(401).json({ success: false, message: "Email ou mot de passe incorrect" });
        }
    } catch (err) {
        console.error("Erreur serveur Login:", err);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// ============= ROUTES PROFESSEUR =============
app.get('/api/prof/dashboard-stats', async (req, res) => {
    const professeurId = req.query.professeur_id;

    if (!professeurId) {
        return res.status(400).json({ success: false, message: "ID du professeur requis." });
    }

    try {
        const [profInfo] = await db.query(`
            SELECT u.ecole_id, e.nom AS ecole_nom 
            FROM users u
            LEFT JOIN ecoles e ON u.ecole_id = e.id
            WHERE u.id = ?
        `, [professeurId]);
        
        const ecoleId = profInfo[0]?.ecole_id || 1;
        const ecoleNom = profInfo[0]?.ecole_nom || "Établissement";

        const [classesProf] = await db.query(`
            SELECT c.id, c.nom, c.niveau_nom 
            FROM class_teachers ct
            JOIN classes c ON ct.class_id = c.id
            WHERE ct.teacher_id = ?
            ORDER BY c.nom ASC
        `, [professeurId]);

        const classesData = [];

        for (const cls of classesProf) {
            const [elevesCount] = await db.query(`
                SELECT COUNT(*) AS total 
                FROM users 
                WHERE role = 'eleve' AND (class_id = ? OR niveau = ?)
            `, [cls.id, cls.nom]);

            const [topQuestions] = await db.query(`
                SELECT ci.question, COUNT(*) as frequence 
                FROM conversations_ia ci
                JOIN users u ON ci.user_id = u.id
                WHERE u.class_id = ? OR u.niveau = ?
                GROUP BY ci.question 
                ORDER BY frequence DESC 
                LIMIT 10
            `, [cls.id, cls.nom]);

            classesData.push({
                id: cls.id,
                nom: cls.nom,
                totalEleves: elevesCount[0]?.total || 0,
                topQuestions: topQuestions || []
            });
        }

        const [coursPublies] = await db.query(`
            SELECT id, titre, domaine, 'cours' AS type
            FROM cours
            WHERE professeur_id = ? OR ecole_id = ?
            ORDER BY id DESC
        `, [professeurId, ecoleId]);

        res.json({
            success: true,
            ecoleNom: ecoleNom,
            classes: classesData,
            coursPublies: coursPublies
        });

    } catch (err) {
        console.error("Erreur Dashboard Prof Stats:", err);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la récupération des données." });
    }
});

app.post('/api/prof/cours', upload.single('pdf_file'), async (req, res) => {
    try {
        const { titre, contenu, niveau_id, domaine, ecole_id, professeur_id, est_public } = req.body;
        const pdf_path = req.file ? req.file.path : null;

        const sql = `
            INSERT INTO cours (titre, contenu, niveau_id, pdf_path, domaine, ecole_id, professeur_id, est_public) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.query(sql, [
            titre, 
            contenu || '', 
            niveau_id, 
            pdf_path, 
            domaine || 'algebre', 
            ecole_id || 1, 
            professeur_id || null, 
            est_public !== undefined ? est_public : 1
        ]);

        res.json({ message: "Cours publié avec succès !" });
    } catch (err) {
        console.error("Erreur Ajout Cours:", err);
        res.status(500).json({ error: "Impossible de publier le cours." });
    }
});

app.get('/api/prof/liste-cours', async (req, res) => {
    try {
        const professeur_id = req.query.professeur_id;
        const ecole_id = req.query.ecole_id || 1;

        if (!professeur_id) {
            return res.status(400).json({ error: "ID du professeur manquant" });
        }

        const sql = `
            SELECT id, titre 
            FROM cours 
            WHERE professeur_id = ? AND ecole_id = ? 
            ORDER BY titre ASC
        `;
        
        const [cours] = await db.query(sql, [professeur_id, ecole_id]);
        res.json(cours);
    } catch (err) {
        console.error("Erreur liste cours prof:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

app.post('/api/prof/exercices', upload.single('pdf_file'), async (req, res) => {
    try {
        const { cours_id, titre, enonce, reponse_correcte } = req.body;
        const pdf_path = req.file ? req.file.path : null;

        const sql = `
            INSERT INTO exercices (cours_id, titre, enonce, reponse_correcte, pdf_path) 
            VALUES (?, ?, ?, ?, ?)
        `;

        await db.query(sql, [
            cours_id, 
            titre, 
            enonce || '', 
            reponse_correcte || '', 
            pdf_path
        ]);

        res.json({ message: "Exercice publié avec succès !" });
    } catch (err) {
        console.error("Erreur Ajout Exercice:", err);
        res.status(500).json({ error: "Impossible de publier l'exercice." });
    }
});

// Liste des cours publiés par un professeur (pour la carte de Sylvie)
app.get('/api/prof/mes-cours', async (req, res) => {
    try {
        const professeurId = parseInt(req.query.professeur_id);
        if (!professeurId) return res.json([]);
        const [rows] = await db.query(
            "SELECT id, titre, niveau_id FROM cours WHERE professeur_id = ? ORDER BY id DESC",
            [professeurId]
        );
        res.json(rows);
    } catch (err) {
        console.error("Erreur mes-cours :", err);
        res.status(500).json([]);
    }
});

// Publication d'un exercice proposé par Sylvie (avec vérifications)
app.post('/api/prof/exercices-ia', async (req, res) => {
    try {
        const userId = identifierUtilisateur(req);
        const cours_id = parseInt(req.body.cours_id);
        const classe_id = parseInt(req.body.classe_id);
        const titre = nettoyerTexte(req.body.titre, 255);
        const enonce = nettoyerHtml(req.body.enonce);
        const reponse = nettoyerTexte(req.body.reponse_correcte, 500);

        if (!userId || !cours_id || !classe_id || !titre || !enonce) {
            return res.status(400).json({ error: "Données incomplètes." });
        }

        // Le rôle et l'école sont lus en base
        const [users] = await db.query("SELECT role, ecole_id FROM users WHERE id = ?", [userId]);
        if (!users.length || users[0].role !== 'professeur') {
            return res.status(403).json({ error: "Accès refusé." });
        }

        // Le cours doit appartenir à ce professeur
        const [cours] = await db.query(
            "SELECT id FROM cours WHERE id = ? AND professeur_id = ?", [cours_id, userId]
        );
        if (!cours.length) return res.status(403).json({ error: "Ce cours n'est pas le vôtre." });

        // La classe doit être dans son école
        const [classes] = await db.query(
            "SELECT id FROM classes WHERE id = ? AND ecole_id = ?", [classe_id, users[0].ecole_id]
        );
        if (!classes.length) return res.status(403).json({ error: "Classe non autorisée." });

        await db.query(
            "INSERT INTO exercices (cours_id, classe_id, titre, enonce, reponse_correcte) VALUES (?, ?, ?, ?, ?)",
            [cours_id, classe_id, titre, enonce, reponse]
        );
        res.json({ message: "Exercice publié avec succès !" });
    } catch (err) {
        console.error("Erreur exercices-ia :", err);
        res.status(500).json({ error: "Impossible de publier l'exercice." });
    }
});

// ============= ROUTES ADMIN ÉCOLE =============
app.get('/api/admin-ecole/dashboard/:ecoleId', async (req, res) => {
    const { ecoleId } = req.params;

    try {
        const [teachers] = await db.query(`
            SELECT 
                u.id, 
                u.username AS name, 
                u.email,
                COALESCE(GROUP_CONCAT(DISTINCT c.nom SEPARATOR ', '), 'Aucune classe') AS classes
            FROM users u
            LEFT JOIN class_teachers ct ON u.id = ct.teacher_id
            LEFT JOIN classes c ON ct.class_id = c.id
            WHERE u.role = 'professeur' AND u.ecole_id = ?
            GROUP BY u.id
        `, [ecoleId]);

        const [classes] = await db.query(`
            SELECT id, nom AS name, niveau_nom 
            FROM classes 
            WHERE ecole_id = ?
        `, [ecoleId]);

        const [eleves] = await db.query(`
            SELECT id, username, niveau, class_id, questions_posees_aujourdhui 
            FROM users 
            WHERE role = 'eleve' AND ecole_id = ?
        `, [ecoleId]);

        const [coursPublies] = await db.query(`
            SELECT c.id, c.titre, c.domaine, u.username AS professeur_nom
            FROM cours c
            LEFT JOIN users u ON c.professeur_id = u.id
            WHERE c.ecole_id = ? OR c.est_public = TRUE
        `, [ecoleId]);

        const [iaStats] = await db.query(`
            SELECT COUNT(*) AS total_questions_ia 
            FROM conversations_ia ci
            JOIN users u ON ci.user_id = u.id
            WHERE u.ecole_id = ?
        `, [ecoleId]);

        const classesList = classes.map(cls => {
            const classStudents = eleves
                .filter(e => e.class_id === cls.id || e.niveau === cls.name || e.niveau === cls.niveau_nom)
                .map(e => ({
                    id: e.id,
                    username: e.username || "Élève",
                    progression: e.questions_posees_aujourdhui 
                        ? `${Math.min(e.questions_posees_aujourdhui * 25, 100)}%` 
                        : "0%"
                }));

            return {
                id: cls.id,
                name: cls.name,
                students: classStudents
            };
        });

        res.json({
            success: true,
            classes: classesList,
            teachers: teachers,
            cours: coursPublies,
            totalQuestionsIA: iaStats[0]?.total_questions_ia || 0
        });

    } catch (err) {
        console.error("Erreur BDD Admin École Dashboard :", err);
        res.status(500).json({ error: "Erreur lors du chargement des données." });
    }
});

app.post('/api/admin-ecole/add-teacher', async (req, res) => {
    const { username, email, password, ecole_id, class_ids } = req.body;

    if (!username || !email || !ecole_id) {
        return res.status(400).json({ error: "Le nom, l'email et l'école sont requis." });
    }

    try {
        const passwordToHash = (password && password.trim() !== '') ? password : genererMotDePasseTemp();
        const hashedPassword = await bcrypt.hash(passwordToHash, 10);

        const [result] = await db.query(`
            INSERT INTO users (username, email, password, role, ecole_id)
            VALUES (?, ?, ?, 'professeur', ?)
        `, [username, email, hashedPassword, ecole_id]);

        const teacherId = result.insertId;

        if (class_ids && Array.isArray(class_ids) && class_ids.length > 0) {
            const values = class_ids.map(classId => [teacherId, classId]);
            await db.query(`
                INSERT INTO class_teachers (teacher_id, class_id) VALUES ?
            `, [values]);
        }

        res.json({
            success: true,
            message: "Professeur créé avec succès !"
        });

    } catch (err) {
        console.error("Erreur création professeur :", err);
        res.status(500).json({ error: "Erreur serveur lors de la création du compte." });
    }
});

app.delete('/api/admin-ecole/teacher/:id', async (req, res) => {
    const teacherId = req.params.id;
    try {
        await db.query("DELETE FROM users WHERE id = ? AND role = 'professeur'", [teacherId]);
        res.json({ success: true, message: "Professeur retiré avec succès." });
    } catch (err) {
        console.error("Erreur suppression professeur :", err);
        res.status(500).json({ error: "Erreur lors de la suppression." });
    }
});

app.get('/api/admin/demandes-eleves/:ecoleId', async (req, res) => {
    const ecoleId = req.params.ecoleId;
    try {
        const sql = `
            SELECT id, username, email, niveau 
            FROM users 
            WHERE ecole_id = ? AND role = 'eleve' AND statut = 'en_attente'
        `;
        const [results] = await db.query(sql, [ecoleId]);
        res.json(results);
    } catch (err) {
        console.error("Erreur SQL demandes élèves :", err);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

app.put('/api/admin/traiter-demande/:id', async (req, res) => {
    const eleveId = req.params.id;
    const { action } = req.body;

    try {
        if (action === 'accepter') {
            await db.query(`UPDATE users SET statut = 'actif' WHERE id = ?`, [eleveId]);
            res.json({ message: "Compte activé avec succès !" });
        } else if (action === 'refuser') {
            await db.query(`DELETE FROM users WHERE id = ?`, [eleveId]);
            res.json({ message: "Demande refusée et supprimée." });
        } else {
            res.status(400).json({ error: "Action non reconnue" });
        }
    } catch (err) {
        console.error("Erreur traiter demande :", err);
        res.status(500).send("Erreur serveur");
    }
});

// ============= ROUTES API ÉLÈVES & CONTENUS =============
app.get('/niveaux', async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM niveaux");
        res.json(results);
    } catch (err) {
        console.error("Erreur /niveaux :", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/cours/:niveau/:domaine', async (req, res) => {
    const { niveau, domaine } = req.params;
    const ecoleId = parseInt(req.query.ecole_id, 10) || 1;

    const niveauClean = niveau.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[èe]me/g, 'e');
    const niveauId = /^\d+$/.test(niveau) ? parseInt(niveau, 10) : 0;

    try {
        const sql = `
            SELECT c.*, n.nom AS nom_niveau
            FROM cours c
            JOIN niveaux n ON c.niveau_id = n.id
            WHERE c.ecole_id = ?
            AND (c.niveau_id = ? OR LOWER(REPLACE(n.nom, ' ', '')) = ?)
            AND LOWER(c.domaine) = LOWER(?)
        `;

        const [results] = await db.query(sql, [ecoleId, niveauId, niveauClean, domaine]);
        res.json(results);
    } catch (err) {
        console.error("❌ Erreur SQL cours :", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

app.get('/api/exercices/:niveau/:domaine', async (req, res) => {
    const { niveau, domaine } = req.params;
    const ecoleId = req.query.ecole_id || 1;

    const conditionEcole = (parseInt(ecoleId) === 1) 
        ? '(c.ecole_id = 1 OR c.ecole_id IS NULL)' 
        : 'c.ecole_id = ?';

    const sql = `
        SELECT 
          e.id,
          e.titre,
          e.enonce,
          e.reponse_correcte,
          e.pdf_path,
          c.titre AS cours_titre
        FROM exercices e
        JOIN cours c ON e.cours_id = c.id
        LEFT JOIN niveaux n ON c.niveau_id = n.id
        WHERE (c.niveau_id = ? OR LOWER(n.nom) = LOWER(?))
          AND LOWER(c.domaine) = LOWER(?)
          AND ${conditionEcole}
    `;

    const queryParams = (parseInt(ecoleId) === 1) 
        ? [niveau, niveau, domaine] 
        : [niveau, niveau, domaine, ecoleId];

    try {
        const [results] = await db.query(sql, queryParams);
        res.json(results);
    } catch (err) {
        console.error("Erreur SQL exercices :", err);
        res.status(500).send("Erreur serveur");
    }
});

app.get('/api/videos/:idDuNiveau', async (req, res) => {
    const niveauId = req.params.idDuNiveau;
    const domaine = req.query.domaine;
    const ecoleId = req.query.ecole_id || 1;

    const conditionEcole = (parseInt(ecoleId) === 1) 
        ? 'v.ecole_id = 1' 
        : 'v.ecole_id = ?';

    let sql = `
        SELECT v.* 
        FROM videos v
        LEFT JOIN niveaux n ON v.niveau_id = n.id
        WHERE (v.niveau_id = ? OR LOWER(n.nom) = LOWER(?))
          AND ${conditionEcole}
    `;

    let queryParams = (parseInt(ecoleId) === 1) 
        ? [niveauId, niveauId] 
        : [niveauId, niveauId, ecoleId];

    if (domaine) {
        sql += ` AND LOWER(v.domaine) = LOWER(?)`;
        queryParams.push(domaine);
    }

    try {
        const [results] = await db.query(sql, queryParams);
        res.json(results);
    } catch (err) {
        console.error("Erreur SQL videos :", err);
        res.status(500).send(err);
    }
});

app.get('/api/jeux/:niveauId', async (req, res) => {
    try {
        const query = "SELECT * FROM jeux WHERE niveau_id = ?";
        const [results] = await db.query(query, [req.params.niveauId]);
        res.json(results);
    } catch (err) {
        console.error("Erreur SQL Jeux:", err);
        res.status(500).send(err);
    }
});

// ============= SOLVEUR =============
app.post('/api/solveur', (req, res) => {
    let { expression } = req.body;
    try {
        if (expression.includes('<') || expression.includes('>')) {
            const symbole = expression.includes('<') ? '<' : '>';
            return res.json({ 
                success: true, 
                reponse: expression, 
                explication: `C'est une inéquation. Attention : si tu multiplies ou divises par un nombre négatif, le signe ${symbole} doit être inversé !`
            });
        }

        if (expression.includes('=') && expression.includes('x')) {
            const parties = expression.split('=');
            const gauche = parties[0].trim();
            const droite = evaluate(parties[1].trim());

            const match = gauche.match(/(-?\d*)x\s*([\+\-]\s*\d+)?/);

            if (match) {
                let a = match[1];
                if (a === "" || a === "+") a = 1;
                else if (a === "-") a = -1;
                else a = parseFloat(a);

                const b = match[2] ? evaluate(match[2].replace(/\s/g, '')) : 0;
                const solution = (droite - b) / a;

                return res.json({ 
                    success: true, 
                    reponse: `x = ${solution}`, 
                    explication: `On déplace le terme sans x : ${droite} - (${b}) = ${droite - b}. Puis on divise par le coefficient de x (${a}).`
                });
            }
        }

        const resultat = evaluate(expression);
        res.json({ 
            success: true, 
            reponse: resultat, 
            explication: "Calcul effectué en respectant les priorités opératoires." 
        });

    } catch (error) {
        res.json({ success: false, message: "Erreur : vérifie l'écriture (ex: 2x + 2 = 4)" });
    }
});

app.get('/api/classes', async (req, res) => {
    try {
        const sql = "SELECT id, nom, niveau_nom FROM classes ORDER BY nom ASC";
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        console.error("Erreur SQL classes :", err);
        res.status(500).json({ error: "Erreur lors de la récupération des classes" });
    }
});

// ==========================================
// ROUTES API - SUPER ADMIN
// ==========================================
app.get('/api/admin/stats', async (req, res) => {
    try {
        const sql = `
            SELECT 
                (SELECT COUNT(*) FROM ecoles) AS totalEcoles,
                (SELECT COUNT(*) FROM users WHERE role = 'eleve') AS totalEleves,
                (SELECT COUNT(*) FROM users WHERE role = 'professeur') AS totalProfs,
                (SELECT COUNT(*) FROM users WHERE role = 'prof_en_attente') AS pendingProfs
        `;
        const [results] = await db.query(sql);
        res.json(results[0] || { totalEcoles: 0, totalEleves: 0, totalProfs: 0, pendingProfs: 0 });
    } catch (err) {
        console.error("Erreur SQL stats:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/ecoles', async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM ecoles ORDER BY id DESC");
        res.json(Array.isArray(results) ? results : []);
    } catch (err) {
        console.error("Erreur SQL ecoles:", err);
        res.status(500).json([]);
    }
});

app.post('/api/admin/ecoles', uploadLogo.single('logo'), async (req, res) => {
    const { 
        nom, ville, quartier, arrondissement, couleur_primaire, 
        telephone, email_contact, formule_abonnement, statut_abonnement, date_fin_abonnement 
    } = req.body;

    const logo_url = req.file ? req.file.path : null;

    const slug = (nom || '').toLowerCase()
                    .trim()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/[\s_-]+/g, '-')
                    .replace(/^-+|-+$/g, '');

    let dateFinFormatted = null;
    if (date_fin_abonnement) {
        dateFinFormatted = new Date(date_fin_abonnement).toISOString().slice(0, 19).replace('T', ' ');
    }

    try {
        const sql = `
            INSERT INTO ecoles 
            (nom, ville, quartier, arrondissement, slug, logo_url, couleur_primaire, telephone, email_contact, formule_abonnement, statut_abonnement, date_fin_abonnement, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        const params = [
            nom, ville || null, quartier || null, arrondissement || null, 
            slug, logo_url, couleur_primaire || '#4F46E5', 
            telephone || null, email_contact || null,
            formule_abonnement || 'annuel', statut_abonnement || 'actif', dateFinFormatted
        ];

        const [result] = await db.query(sql, params);
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error("Erreur insertion école:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/ecoles/:id/renouveler', async (req, res) => {
    const ecoleId = req.params.id;
    const { formule } = req.body;

    try {
        const [results] = await db.query("SELECT date_fin_abonnement FROM ecoles WHERE id = ?", [ecoleId]);
        if (!results || results.length === 0) {
            return res.status(404).json({ error: "Établissement introuvable." });
        }

        const ancienneDate = results[0].date_fin_abonnement ? new Date(results[0].date_fin_abonnement) : new Date();
        const maintenant = new Date();
        let nouvelleDateFin = (ancienneDate > maintenant) ? ancienneDate : maintenant;

        if (formule === "annuel") {
            nouvelleDateFin.setFullYear(nouvelleDateFin.getFullYear() + 1);
        } else {
            nouvelleDateFin.setMonth(nouvelleDateFin.getMonth() + 1);
        }

        const dateSql = nouvelleDateFin.toISOString().slice(0, 19).replace('T', ' ');
        const updateSql = "UPDATE ecoles SET formule_abonnement = ?, date_fin_abonnement = ?, statut_abonnement = 'actif' WHERE id = ?";
        
        await db.query(updateSql, [formule || 'annuel', dateSql, ecoleId]);

        res.json({ 
            success: true, 
            message: "Abonnement prolongé avec succès jusqu'au " + nouvelleDateFin.toLocaleDateString('fr-FR') 
        });
    } catch (err) {
        console.error("Erreur renouvellement :", err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/ecoles/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM ecoles WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/users', async (req, res) => {
    try {
        const sql = `
            SELECT u.id, u.username, u.email, u.role, e.nom as ecole_nom 
            FROM users u 
            LEFT JOIN ecoles e ON u.ecole_id = e.id
            ORDER BY u.id DESC
        `;
        const [results] = await db.query(sql);
        res.json(Array.isArray(results) ? results : []);
    } catch (err) {
        console.error("Erreur SQL users:", err);
        res.status(500).json([]);
    }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM users WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/pending-profs', async (req, res) => {
    try {
        const sql = `
            SELECT u.id, u.username, u.email, e.nom as ecole_nom 
            FROM users u 
            LEFT JOIN ecoles e ON u.ecole_id = e.id 
            WHERE u.role = 'prof_en_attente'
        `;
        const [results] = await db.query(sql);
        res.json(Array.isArray(results) ? results : []);
    } catch (err) {
        console.error("Erreur SQL pending-profs:", err);
        res.status(500).json([]);
    }
});

app.post('/api/admin/validate-prof/:id', async (req, res) => {
    const { id } = req.params;
    const { approuve } = req.body;

    try {
        const sql = approuve 
            ? "UPDATE users SET role = 'professeur' WHERE id = ?" 
            : "DELETE FROM users WHERE id = ?";

        await db.query(sql, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/creer-admin-ecole', async (req, res) => {
    const { username, email, password, ecole_id } = req.body;

    if (!username || !email || !password || !ecole_id) {
        return res.status(400).json({ success: false, message: "Tous les champs sont requis." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `
            INSERT INTO users (username, email, password, role, ecole_id) 
            VALUES (?, ?, ?, 'admin_ecole', ?)
        `;

        await db.query(sql, [username, email, hashedPassword, ecole_id]);
        res.json({ success: true, message: "Administrateur d'école créé avec succès !" });
    } catch (err) {
        console.error("Erreur SQL création admin école :", err);
        res.status(500).json({ success: false, message: "Erreur lors de la création ou cet email est déjà utilisé." });
    }
});

app.put('/api/user/profile', async (req, res) => {
    const { userId, username, email, niveau } = req.body;
    try {
        const sql = `UPDATE users SET username = ?, email = ?, niveau = ? WHERE id = ?`;
        await db.query(sql, [username, email, niveau, userId]);
        res.json({ success: true, message: "Profil mis à jour" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Erreur serveur ou email déjà utilisé" });
    }
});

app.put('/api/user/password', async (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;

    try {
        const [result] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
        if (!result || result.length === 0) {
            return res.status(500).json({ success: false, message: "Utilisateur non trouvé" });
        }

        const user = result[0];
        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: "L'ancien mot de passe est incorrect" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
        
        res.json({ success: true, message: "Mot de passe modifié avec succès" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Erreur lors de la mise à jour" });
    }
});

app.post('/api/admin-ecole/classes', async (req, res) => {
    const { ecole_id, nom_classe, niveau } = req.body;

    if (!ecole_id || !nom_classe || !niveau) {
        return res.status(400).json({ success: false, message: "Tous les champs sont requis." });
    }

    try {
        const sql = `INSERT INTO classes (ecole_id, nom, niveau_nom) VALUES (?, ?, ?)`;
        await db.query(sql, [ecole_id, nom_classe, niveau]);

        res.json({ success: true, message: "Classe ajoutée avec succès !" });
    } catch (err) {
        console.error("Erreur ajout de classe :", err);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la création de la classe." });
    }
});

app.post('/api/videos', upload.single('video_file'), async (req, res) => {
    const { titre, niveau_id, domaine, ecole_id, prof_id, youtube_id } = req.body;
    
    const videoPath = req.file ? `/uploads/${req.file.filename}` : null;
    const finalYoutubeId = videoPath ? null : youtube_id;

    try {
        const sql = `
            INSERT INTO videos (titre, youtube_id, video_path, niveau_id, domaine, ecole_id, prof_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await db.query(sql, [titre, finalYoutubeId, videoPath, niveau_id, domaine, ecole_id || 1, prof_id]);
        res.status(201).json({ message: "Vidéo ajoutée avec succès", id: result.insertId });
    } catch (err) {
        console.error("Erreur SQL insertion vidéo :", err);
        res.status(500).send("Erreur serveur");
    }
});

// ============= LANCEMENT DU SERVEUR =============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur prêt sur le port ${PORT}`);
});