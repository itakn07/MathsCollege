// ============= IMPORTS =============
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const { evaluate } = require('mathjs');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

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

// ============= TÂCHE AUTOMATIQUE : VÉRIFICATION ABONNEMENTS EXPIRÉS =============
function verifierAbonnementsExpires() {
    const updateExpiredSql = `
        UPDATE ecoles 
        SET statut_abonnement = 'inactif' 
        WHERE date_fin_abonnement IS NOT NULL 
          AND date_fin_abonnement < NOW() 
          AND statut_abonnement = 'actif'
    `;
    db.query(updateExpiredSql, (err, result) => {
        if (err) {
            if (err.code === 'ER_NO_SUCH_TABLE') {
                console.error(
                    `[CRON Abonnements] La table 'ecoles' est introuvable sur le serveur MySQL ` +
                    `${process.env.DB_HOST}:${process.env.DB_PORT || 3306}, base '${process.env.DB_NAME}'. ` +
                    `Vérifie que le .env pointe vers le même serveur que MySQL Workbench.`
                );
            } else {
                console.error("[CRON Abonnements] Erreur mise à jour statut :", err);
            }
        } else if (result.affectedRows > 0) {
            console.log(`[CRON Abonnements] ${result.affectedRows} école(s) passée(s) en statut inactif/expiré.`);
        }
    });
}

// Test de connexion + diagnostic (serveur, base, table ecoles), puis lancement de la tâche
db.getConnection((err, connection) => {
    if (err) {
        console.log('Erreur MySQL:', err);
        return;
    }

    console.log('Connecté à MySQL');
    console.log(`[DB] Hôte : ${process.env.DB_HOST} | Port : ${process.env.DB_PORT || 3306} | Base demandée : ${process.env.DB_NAME}`);

    connection.query('SELECT DATABASE() AS base, @@hostname AS serveur, @@port AS port', (e1, r1) => {
        if (!e1 && r1 && r1[0]) {
            console.log(`[DB] Base active : ${r1[0].base} | Serveur MySQL : ${r1[0].serveur} | Port : ${r1[0].port}`);
        }

        connection.query("SHOW TABLES LIKE 'ecoles'", (e2, r2) => {
            connection.release();

            if (e2) {
                console.error('[DB] Impossible de vérifier la table ecoles :', e2.message);
            } else if (!r2 || r2.length === 0) {
                console.error("[DB] ATTENTION : la table 'ecoles' n'existe pas sur CE serveur MySQL.");
            } else {
                console.log("[DB] Table 'ecoles' trouvée.");
            }

            // Lancement de la vérification au démarrage puis toutes les heures
            verifierAbonnementsExpires();
            setInterval(verifierAbonnementsExpires, 1000 * 60 * 60);
        });
    });
});

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
        db.query(sql, [userId], (err, results) => {
            if (err) {
                console.error("Erreur vérification quota :", err);
                return res.status(500).json({ answer: "Erreur serveur lors de la vérification de vos quotas." });
            }

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
            db.query(updateSql, [questionsAujourdhui + 1, aujourdhui, user.id], (updateErr) => {
                if (updateErr) console.error("Erreur mise à jour quota :", updateErr);
                req.userContext = { userId: user.id, ecoleId: ecoleId };
                next();
            });
        });
    } catch (error) {
        console.error("Erreur serveur :", error);
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

app.post('/ask-ai', verifierQuotaIA, async (req, res) => {
    try {
        const { prompt } = req.body;
        const { userId, ecoleId } = req.userContext || { userId: null, ecoleId: 1 };

        if (!prompt) {
            return res.status(400).json({ answer: "Le serveur n'a pas reçu de texte." });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-3.6-flash",
            systemInstruction: "Tu es Sylvie, une coach et tutrice de mathématiques pour les élèves du collège uniquement après la première quesion ou le premier message de l'utilisateur, pense toujours à lui demander sa classe et souvient toi de lui.Ton rôle et tes règles strictes :1. FOCALISATION EXCLUSIVE SUR LES MATHS DU COLLÈGE :Tu réponds UNIQUEMENT aux questions relatives au programme de mathématiques du collège (Nombres et calculs, Géométrie, Organisation et gestion de données, Grandeur et mesures, Algorithmique/Scratch).Si un élève te pose une question hors sujet (autre matière, culture générale, discussions personnelles, etc.), refuse poliment avec gentillesse et ramène-le doucement vers les mathématiques (ex: Je suis là uniquement pour t'aider à devenir un champion en maths du collège ! Pose-moi une question sur tes cours ou tes exercices !).Si une question concerne des mathématiques de niveau lycée ou supérieur (ex: dérivées, intégrales, matrices), explique gentiment que cela dépasse le programme du collège et propose de revoir les bases utiles du collège.2. STYLE ET PEDAGOGIE :Sois extrêmement bienveillante, enthousiaste, bienveillante et encourageante.Adapte tes explications à l'âge d'un collégien : utilise des phrases claires, des exemples simples de la vie quotidienne et des étapes détaillées pas à pas.Ne donne pas juste la réponse brute : guide l'élève pour qu'il comprenne la méthode et le raisonnement."
        });

        const result = await callGeminiWithRetry(model, prompt);
        const text = result.response.text();

        const saveSql = "INSERT INTO conversations_ia (user_id, ecole_id, question, reponse) VALUES (?, ?, ?, ?)";
        db.query(saveSql, [userId, ecoleId, prompt, text], (err) => {
            if (err) console.error("Erreur lors du stockage de la conversation IA :", err);
        });

        res.json({ answer: text });

    } catch (error) {
        console.error("Erreur technique IA:", error);

        if (error.status === 503 || (error.message && error.message.includes('503'))) {
            return res.status(503).json({ 
                answer: "Coach Sylvie est très sollicitée par d'autres élèves en ce moment ! 😅 Réessaye dans quelques secondes." 
            });
        }

        res.status(500).json({ 
            answer: "Désolé, une erreur technique est survenue. Réessaye plus tard !" 
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

        const sql = "INSERT INTO users (username, email, password, role, niveau, ecole_id) VALUES (?, ?, ?, ?, ?, ?)";
        db.query(sql, [username, email, hashedPassword, userRole, userNiveau, targetEcoleId], (err, result) => {
            if (err) {
                console.error("Erreur BDD :", err);
                return res.status(400).json({ success: false, message: "Pseudo ou Email déjà utilisé." });
            }

            return res.status(201).json({ 
                success: true, 
                message: "Inscription réussie !",
                user: {
                    id: result.insertId,
                    username: username,
                    email: email,
                    role: userRole,
                    niveau: userNiveau,
                    ecole_id: targetEcoleId
                }
            });
        });
    } catch (e) {
        console.error("Erreur serveur :", e);
        return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
});

// Route pour charger la liste des écoles dans le formulaire d'inscription
app.get('/api/ecoles/liste', (req, res) => {
    const sql = "SELECT id, nom FROM ecoles WHERE statut_abonnement = 'actif' ORDER BY nom ASC";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Erreur chargement écoles :", err);
            return res.status(500).json({ success: false, message: "Impossible de charger la liste des écoles." });
        }
        res.json({ success: true, ecoles: results });
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body; 

    const sql = `
        SELECT u.*, e.nom AS ecole_nom, e.logo_url, e.couleur_primaire, e.statut_abonnement, e.date_fin_abonnement
        FROM users u
        LEFT JOIN ecoles e ON u.ecole_id = e.id
        WHERE u.email = ?
    `;

    db.query(sql, [email], async (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Erreur serveur" });

        if (result.length === 0) {
            return res.status(401).json({ success: false, message: "Email ou mot de passe incorrect" });
        }

        const user = result[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            // Vérification du statut de l'abonnement de l'école
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
                    ecole: {
                        id: user.ecole_id,
                        nom: user.ecole_nom || 'MathsCollege Officiel',
                        logo: user.logo_url,
                        couleur: user.couleur_primaire || '#4F46E5',
                        statut: user.statut_abonnement || 'actif'
                    }
                }
            });
        } else {
            res.status(401).json({ success: false, message: "Email ou mot de passe incorrect" });
        }
    });
});

// ============= ROUTES PROFESSEUR =============
app.get('/api/prof/dashboard-stats', async (req, res) => {
    try {
        const [elevesCount] = await db.promise().query("SELECT COUNT(*) AS total FROM users WHERE role = 'eleve'");
        const [topQuestions] = await db.promise().query(`
            SELECT question, COUNT(*) as frequence 
            FROM conversations_ia 
            GROUP BY question 
            ORDER BY frequence DESC 
            LIMIT 10
        `);

        res.json({
            totalEleves: elevesCount[0].total,
            topQuestions: topQuestions
        });
    } catch (err) {
        console.error("Erreur Dashboard Stats:", err);
        res.status(500).json({ error: "Erreur lors de la récupération des données du tableau de bord." });
    }
});

app.post('/api/prof/cours', upload.single('pdf_file'), async (req, res) => {
    try {
        const { titre, contenu, niveau_id, domaine, ecole_id, professeur_id, est_public } = req.body;
        // Cloudinary renvoie l'URL HTTPS dans req.file.path
        const pdf_path = req.file ? req.file.path : null;

        const sql = `
            INSERT INTO cours (titre, contenu, niveau_id, pdf_path, domaine, ecole_id, professeur_id, est_public) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.promise().query(sql, [
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
        const [cours] = await db.promise().query('SELECT id, titre FROM cours ORDER BY titre ASC');
        res.json(cours);
    } catch (err) {
        console.error("Erreur lors de la récupération des cours:", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

app.post('/api/prof/exercices', upload.single('pdf_file'), async (req, res) => {
    try {
        const { cours_id, titre, enonce, reponse_correcte } = req.body;
        // Cloudinary renvoie l'URL HTTPS dans req.file.path
        const pdf_path = req.file ? req.file.path : null;

        const sql = `
            INSERT INTO exercices (cours_id, titre, enonce, reponse_correcte, pdf_path) 
            VALUES (?, ?, ?, ?, ?)
        `;

        await db.promise().query(sql, [
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

// ============= ROUTES ADMIN ÉCOLE =============
app.get('/api/admin-ecole/dashboard/:ecoleId', async (req, res) => {
    const { ecoleId } = req.params;

    try {
        const [teachers] = await db.promise().query(`
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

        const [classes] = await db.promise().query(`
            SELECT id, nom AS name 
            FROM classes 
            WHERE ecole_id = ?
        `, [ecoleId]);

        const [eleves] = await db.promise().query(`
            SELECT id, username, niveau, class_id 
            FROM users 
            WHERE role = 'eleve' AND ecole_id = ?
        `, [ecoleId]);

        const classesList = classes.map(cls => {
            const classStudents = eleves
                .filter(e => e.class_id === cls.id || e.niveau === cls.name)
                .map(e => e.username);

            return {
                id: cls.id,
                name: cls.name,
                teacher: 'Professeur attribué',
                students: classStudents
            };
        });

        res.json({
            classes: classesList,
            teachers: teachers
        });

    } catch (err) {
        console.error("Erreur BDD Admin École Dashboard :", err);
        res.status(500).json({ error: "Erreur lors du chargement des données." });
    }
});

app.post('/api/admin-ecole/add-teacher', async (req, res) => {
    const { username, email, ecole_id, class_ids } = req.body;

    if (!username || !email || !ecole_id) {
        return res.status(400).json({ error: "Le nom, l'email et l'école sont requis." });
    }

    try {
        const tempPassword = genererMotDePasseTemp();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const [result] = await db.promise().query(`
            INSERT INTO users (username, email, password, role, ecole_id)
            VALUES (?, ?, ?, 'professeur', ?)
        `, [username, email, hashedPassword, ecole_id]);

        const teacherId = result.insertId;

        if (class_ids && Array.isArray(class_ids) && class_ids.length > 0) {
            const values = class_ids.map(classId => [teacherId, classId]);
            await db.promise().query(`
                INSERT INTO class_teachers (teacher_id, class_id) VALUES ?
            `, [values]);
        }

        res.json({
            success: true,
            message: "Professeur créé avec succès !",
            generatedPassword: tempPassword
        });

    } catch (err) {
        console.error("Erreur lors de la création du professeur :", err);
        res.status(500).json({ error: "Erreur serveur lors de la création du compte." });
    }
});

app.delete('/api/admin-ecole/teacher/:id', async (req, res) => {
    const teacherId = req.params.id;
    try {
        await db.promise().query("DELETE FROM users WHERE id = ? AND role = 'professeur'", [teacherId]);
        res.json({ success: true, message: "Professeur retiré avec succès." });
    } catch (err) {
        console.error("Erreur suppression professeur :", err);
        res.status(500).json({ error: "Erreur lors de la suppression." });
    }
});

// ============= ROUTES API ÉLÈVES & CONTENUS =============
app.get('/niveaux', (req, res) => {
    const sql = "SELECT * FROM niveaux";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results); 
    });
});

app.get('/api/cours/:niveau/:domaine', (req, res) => {
    const { niveau, domaine } = req.params;
    const ecoleId = req.query.ecole_id || 1;

    const sql = `
        SELECT c.* 
        FROM cours c
        JOIN niveaux n ON c.niveau_id = n.id
        WHERE (c.niveau_id = ? OR LOWER(n.nom) = LOWER(?))
          AND LOWER(c.domaine) = LOWER(?)
          AND (c.est_public = TRUE OR c.ecole_id = ?)
    `;

    db.query(sql, [niveau, niveau, domaine, ecoleId], (err, results) => {
        if (err) {
            console.error("Erreur SQL :", err);
            return res.status(500).send("Erreur serveur");
        }
        res.json(results);
    });
});

app.get('/api/exercices/:niveau/:domaine', (req, res) => {
    const { niveau, domaine } = req.params;

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
        JOIN niveaux n ON c.niveau_id = n.id
        WHERE (c.niveau_id = ? OR LOWER(n.nom) = LOWER(?))
          AND LOWER(c.domaine) = LOWER(?)
    `;

    db.query(sql, [niveau, niveau, domaine], (err, results) => {
        if (err) {
            console.error("Erreur SQL exercices :", err);
            return res.status(500).send("Erreur serveur");
        }
        res.json(results);
    });
});

app.get('/api/videos/:idDuNiveau/:domaine', (req, res) => {
    const niveauId = req.params.idDuNiveau;
    const domaine = req.params.domaine;

    const sql = `
        SELECT v.* 
        FROM videos v
        LEFT JOIN niveaux n ON v.niveau_id = n.id
        WHERE (v.niveau_id = ? OR LOWER(n.nom) = LOWER(?))
          AND LOWER(v.domaine) = LOWER(?)
    `;

    db.query(sql, [niveauId, niveauId, domaine], (err, results) => {
        if (err) {
            console.error("Erreur SQL videos :", err);
            return res.status(500).send(err);
        }
        res.json(results);
    });
});

app.get('/api/videos/:idDuNiveau', (req, res) => {
    const niveauId = req.params.idDuNiveau;

    const sql = `
        SELECT v.* 
        FROM videos v
        LEFT JOIN niveaux n ON v.niveau_id = n.id
        WHERE v.niveau_id = ? OR LOWER(n.nom) = LOWER(?)
    `;

    db.query(sql, [niveauId, niveauId], (err, results) => {
        if (err) {
            console.error("Erreur SQL videos :", err);
            return res.status(500).send(err);
        }
        res.json(results);
    });
});

app.get('/api/jeux/:niveauId', (req, res) => {
    const query = "SELECT * FROM jeux WHERE niveau_id = ?";
    db.query(query, [req.params.niveauId], (err, results) => {
        if (err) {
            console.error("Erreur SQL Jeux:", err);
            return res.status(500).send(err);
        }
        res.json(results);
    });
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

// Route pour récupérer la liste de toutes les classes (6ème A, 6ème B, etc.)
app.get('/api/classes', (req, res) => {
    const sql = "SELECT id, nom, niveau_nom FROM classes ORDER BY nom ASC";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Erreur SQL lors de la récupération des classes :", err);
            return res.status(500).json({ error: "Erreur lors de la récupération des classes" });
        }
        res.json(results);
    });
});

// ==========================================
// ROUTES API - SUPER ADMIN
// ==========================================

// 1. Statistiques globales
app.get('/api/admin/stats', (req, res) => {
    const sql = `
        SELECT 
            (SELECT COUNT(*) FROM ecoles) AS totalEcoles,
            (SELECT COUNT(*) FROM users WHERE role = 'eleve') AS totalEleves,
            (SELECT COUNT(*) FROM users WHERE role = 'professeur') AS totalProfs,
            (SELECT COUNT(*) FROM users WHERE role = 'prof_en_attente') AS pendingProfs
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Erreur SQL stats:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results[0] || { totalEcoles: 0, totalEleves: 0, totalProfs: 0, pendingProfs: 0 });
    });
});

// 2. Écoles
app.get('/api/admin/ecoles', (req, res) => {
    db.query("SELECT * FROM ecoles ORDER BY id DESC", (err, results) => {
        if (err) {
            console.error("Erreur SQL ecoles:", err);
            return res.status(500).json([]);
        }
        res.json(Array.isArray(results) ? results : []);
    });
});

// ROUTE D'AJOUT D'UNE ÉCOLE AVEC UPLOAD DU LOGO SUR CLOUDINARY
app.post('/api/admin/ecoles', uploadLogo.single('logo'), (req, res) => {
    const { 
        nom, ville, quartier, arrondissement, couleur_primaire, 
        telephone, email_contact, formule_abonnement, statut_abonnement, date_fin_abonnement 
    } = req.body;

    // Cloudinary renvoie directement l'URL HTTPS hébergée dans req.file.path
    const logo_url = req.file ? req.file.path : null;

    // Génération automatique du slug
    const slug = (nom || '').toLowerCase()
                    .trim()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/[\s_-]+/g, '-')
                    .replace(/^-+|-+$/g, '');

    // Formatage de la date de fin au format MySQL (YYYY-MM-DD HH:MM:SS)
    let dateFinFormatted = null;
    if (date_fin_abonnement) {
        dateFinFormatted = new Date(date_fin_abonnement).toISOString().slice(0, 19).replace('T', ' ');
    }

    const sql = `
        INSERT INTO ecoles 
        (nom, ville, quartier, arrondissement, slug, logo_url, couleur_primaire, telephone, email_contact, formule_abonnement, statut_abonnement, date_fin_abonnement, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const params = [
        nom, 
        ville || null, 
        quartier || null, 
        arrondissement || null, 
        slug, 
        logo_url, 
        couleur_primaire || '#4F46E5', 
        telephone || null, 
        email_contact || null,
        formule_abonnement || 'annuel',
        statut_abonnement || 'actif',
        dateFinFormatted
    ];

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error("Erreur insertion école:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, id: result.insertId });
    });
});

// ROUTE DE RENOUVELLEMENT DE L'ABONNEMENT D'UNE ÉCOLE
app.post('/api/admin/ecoles/:id/renouveler', (req, res) => {
    const ecoleId = req.params.id;
    const { formule } = req.body; // 'mensuel' ou 'annuel'

    db.query("SELECT date_fin_abonnement FROM ecoles WHERE id = ?", [ecoleId], (err, results) => {
        if (err) {
            console.error("Erreur récupération école :", err);
            return res.status(500).json({ error: err.message });
        }

        if (!results || results.length === 0) {
            return res.status(404).json({ error: "Établissement introuvable." });
        }

        const ancienneDate = results[0].date_fin_abonnement ? new Date(results[0].date_fin_abonnement) : new Date();
        const maintenant = new Date();

        // Si l'abonnement est encore valide, on cumule à partir de l'ancienne date. Sinon, on repart d'aujourd'hui.
        let nouvelleDateFin = (ancienneDate > maintenant) ? ancienneDate : maintenant;

        if (formule === "annuel") {
            nouvelleDateFin.setFullYear(nouvelleDateFin.getFullYear() + 1);
        } else {
            nouvelleDateFin.setMonth(nouvelleDateFin.getMonth() + 1);
        }

        const dateSql = nouvelleDateFin.toISOString().slice(0, 19).replace('T', ' ');

        const updateSql = "UPDATE ecoles SET formule_abonnement = ?, date_fin_abonnement = ?, statut_abonnement = 'actif' WHERE id = ?";
        
        db.query(updateSql, [formule || 'annuel', dateSql, ecoleId], (updateErr) => {
            if (updateErr) {
                console.error("Erreur renouvellement :", updateErr);
                return res.status(500).json({ error: updateErr.message });
            }

            res.json({ 
                success: true, 
                message: "Abonnement prolongé avec succès jusqu'au " + nouvelleDateFin.toLocaleDateString('fr-FR') 
            });
        });
    });
});

app.delete('/api/admin/ecoles/:id', (req, res) => {
    db.query("DELETE FROM ecoles WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 3. Utilisateurs
app.get('/api/admin/users', (req, res) => {
    const sql = `
        SELECT u.id, u.username, u.email, u.role, e.nom as ecole_nom 
        FROM users u 
        LEFT JOIN ecoles e ON u.ecole_id = e.id
        ORDER BY u.id DESC
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Erreur SQL users:", err);
            return res.status(500).json([]);
        }
        res.json(Array.isArray(results) ? results : []);
    });
});

app.delete('/api/admin/users/:id', (req, res) => {
    db.query("DELETE FROM users WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 4. Demandes professeurs en attente
app.get('/api/admin/pending-profs', (req, res) => {
    const sql = `
        SELECT u.id, u.username, u.email, e.nom as ecole_nom 
        FROM users u 
        LEFT JOIN ecoles e ON u.ecole_id = e.id 
        WHERE u.role = 'prof_en_attente'
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Erreur SQL pending-profs:", err);
            return res.status(500).json([]);
        }
        res.json(Array.isArray(results) ? results : []);
    });
});

app.post('/api/admin/validate-prof/:id', (req, res) => {
    const { id } = req.params;
    const { approuve } = req.body;

    const sql = approuve 
        ? "UPDATE users SET role = 'professeur' WHERE id = ?" 
        : "DELETE FROM users WHERE id = ?";

    db.query(sql, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ============= LANCEMENT DU SERVEUR =============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur prêt sur le port ${PORT}`);
});