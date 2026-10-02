// ============= IMPORTS =============
require('dotenv').config(); // Charge les variables du fichier .env
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

// ============= CONFIGURATION =============
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const app = express();

// Création automatique du dossier 'uploads/fiches'
const uploadDir = path.join(__dirname, 'uploads', 'fiches');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Dossier uploads/fiches créé avec succès !');
}

// Configuration de Multer pour l'upload de fichiers dans uploads/fiches/
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Rendre le dossier 'uploads' accessible au navigateur
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname, '../Frontend')));

app.use(cors());
app.use(express.json());

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

db.getConnection((err, connection) => {
    if (err) {
        console.log('Erreur MySQL:', err);
    } else {
        console.log('Connecté à MySQL');
        connection.release();
    }
});

// ============= MIDDLEWARE : VÉRIFICATION QUOTA IA (3 QST / JOUR) =============
async function verifierQuotaIA(req, res, next) {
    const { userId } = req.body; 

    // Si aucun utilisateur n'est connecté, on applique la restriction d'invité
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
            const ecoleId = user.ecole_id || 1; // 1 = MathsCollege Officiel (Public)

            // 1. Si l'utilisateur appartient à une école partenaire (ecole_id != 1), l'accès est illimité
            if (ecoleId !== 1) {
                req.userContext = { userId: user.id, ecoleId: ecoleId };
                return next();
            }

            // 2. Gestion du quota pour les utilisateurs de la formule publique (ecole_id = 1)
            const aujourdhui = new Date().toISOString().split('T')[0];
            const dateDerniere = user.date_derniere_question ? new Date(user.date_derniere_question).toISOString().split('T')[0] : null;

            let questionsAujourdhui = user.questions_posees_aujourdhui || 0;

            // Réinitialisation si changement de jour
            if (dateDerniere !== aujourdhui) {
                questionsAujourdhui = 0;
            }

            // Vérification de la limite de 3 questions
            if (questionsAujourdhui >= 3) {
                return res.status(429).json({ 
                    answer: "Limite atteinte ! Vous avez posé vos 3 questions gratuites aujourd'hui. Demandez à votre établissement de rejoindre MathsCollege pour débloquer l'accès illimité !" 
                });
            }

            // Mettre à jour le compteur
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
// 1. Fonction de retry pour gérer la surcharge (503) de Google
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

// 2. Route pour poser une question à Coach Sylvie
app.post('/ask-ai', verifierQuotaIA, async (req, res) => {
    try {
        const { prompt } = req.body;
        const { userId, ecoleId } = req.userContext || { userId: null, ecoleId: 1 };

        if (!prompt) {
            return res.status(400).json({ answer: "Le serveur n'a pas reçu de texte." });
        }

        // Configuration du modèle via le SDK officiel
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: "Tu es Sylvie, une coach de mathématiques super sympa. Tu adores le groupe de K-pop BTS (ton membre préféré est Jimin) et tu es fan de Michael Jackson. Tu es aussi très encourageante et gentille."
        });

        // Génération de la réponse avec la fonction de Retry
        const result = await callGeminiWithRetry(model, prompt);
        const text = result.response.text();

        // Sauvegarde de la conversation en BDD
        const saveSql = "INSERT INTO conversations_ia (user_id, ecole_id, question, reponse) VALUES (?, ?, ?, ?)";
        db.query(saveSql, [userId, ecoleId, prompt, text], (err) => {
            if (err) console.error("Erreur lors du stockage de la conversation IA :", err);
        });

        res.json({ answer: text });

    } catch (error) {
        console.error("Erreur technique IA:", error);

        // Si la surcharge persiste même après les tentatives
        if (error.status === 503 || (error.message && error.message.includes('503'))) {
            return res.status(503).json({ 
                answer: "Coach Sylvie est très sollicitée par d'autres élèves en ce moment ! 😅 Réessaye dans quelques secondes." 
            });
        }

        // Message propre pour les autres erreurs
        res.status(500).json({ 
            answer: "Désolé, une erreur technique est survenue. Réessaye plus tard !" 
        });
    }
});

// ============= SIGN UP =============
app.post('/api/signup', async (req, res) => {
    const { username, email, password, niveau, ecole_id } = req.body;

    if (!username || !email || !password || !niveau) {
        return res.status(400).json({ success: false, message: "Tous les champs sont obligatoires." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const targetEcoleId = ecole_id || 1; // 1 = MathsCollege Officiel par défaut
        const defaultRole = 'eleve';

        const sql = "INSERT INTO users (username, email, password, niveau, ecole_id, role) VALUES (?, ?, ?, ?, ?, ?)";
        db.query(sql, [username, email, hashedPassword, niveau, targetEcoleId, defaultRole], (err, result) => {
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
                    niveau: niveau,
                    role: defaultRole,
                    ecole_id: targetEcoleId
                }
            });
        });
    } catch (e) {
        console.error("Erreur serveur :", e);
        return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
});

// ============= LOG IN =============
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Jointure avec la table ecoles pour récupérer la charte graphique et le logo
    const sql = `
        SELECT u.*, e.nom AS ecole_nom, e.logo_url, e.couleur_primaire, e.statut_abonnement
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
            res.json({ 
                success: true, 
                message: "Connexion réussie !",
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    niveau: user.niveau,
                    role: user.role, // 'super_admin', 'admin_ecole', 'professeur', ou 'eleve'
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

// 1. Dashboard Stats (Nombre d'élèves inscrits & Top 10 des questions IA)
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

// 2. Publier un cours (avec possibilité d'uploader un fichier PDF)
app.post('/api/prof/cours', upload.single('pdf_file'), async (req, res) => {
    try {
        const { titre, contenu, niveau_id, domaine, ecole_id, professeur_id, est_public } = req.body;
        const pdf_path = req.file ? `uploads/fiches/${req.file.filename}` : null;

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

// 3. Publier un exercice & corrigé (avec possibilité d'uploader un fichier PDF)
app.post('/api/prof/exercices', upload.single('pdf_file'), async (req, res) => {
    try {
        const { cours_id, titre, enonce, reponse_correcte } = req.body;
        const pdf_path = req.file ? `uploads/fiches/${req.file.filename}` : null;

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
    const ecoleId = req.query.ecole_id || 1; // Filtre optionnel par école

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

// Route 1 : Quand le domaine est précisé
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

// Route 2 : Quand aucun domaine n'est précisé
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
        // INÉQUATIONS
        if (expression.includes('<') || expression.includes('>')) {
            const symbole = expression.includes('<') ? '<' : '>';
            return res.json({ 
                success: true, 
                reponse: expression, 
                explication:` C'est une inéquation. Attention : si tu multiplies ou divises par un nombre négatif, le signe ${symbole} doit être inversé !`
            });
        }

        // ÉQUATIONS COMPLEXES
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
                    reponse:` x = ${solution}`, 
                    explication: `On déplace le terme sans x : ${droite} - (${b}) = ${droite - b}. Puis on divise par le coefficient de x (${a}).`
                });
            }
        }

        // CALCULS DE BASE
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

// ============= LANCEMENT DU SERVEUR =============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur prêt sur le port ${PORT}`);
});