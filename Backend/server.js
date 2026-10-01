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

// ============= ROUTE IA =============
app.post('/ask-ai', async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ answer: "Le serveur n'a pas reçu de texte." });
        }

        // Configuration du modèle via le SDK officiel
        const model = genAI.getGenerativeModel({
            model: "gemini-3.6-flash",
            systemInstruction: "Tu es Sylvie, une coach de mathématiques super sympa. Tu adores le groupe de K-pop BTS (ton membre préféré est Jimin) et tu es fan de Michael Jackson. Tu es aussi très encourageante et gentille."
        });

        // Génération de la réponse
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        res.json({ answer: text });

    } catch (error) {
        console.error("Erreur technique:", error);
        res.status(500).json({ answer: "Erreur IA: " + error.message });
    }
});
// ============= SIGN UP =============
app.post('/api/signup', async (req, res) => {
    const { username, email, password, niveau } = req.body;

    if (!username || !email || !password || !niveau) {
        return res.status(400).json({ success: false, message: "Tous les champs sont obligatoires." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = "INSERT INTO users (username, email, password, niveau) VALUES (?, ?, ?, ?)";
        db.query(sql, [username, email, hashedPassword, niveau], (err, result) => {
            if (err) {
                console.error("Erreur BDD :", err);
                return res.status(400).json({ success: false, message: "Pseudo ou Email déjà utilisé." });
            }

            // Inscription réussie en BDD (sans envoi de mail)
            return res.status(201).json({ 
                success: true, 
                message: "Inscription réussie !",
                user: {
                    id: result.insertId,
                    username: username,
                    email: email,
                    niveau: niveau
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

    const sql = "SELECT * FROM users WHERE email = ?";
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
                username: user.username,
                niveau: user.niveau
            });
        } else {
            res.status(401).json({ success: false, message: "Email ou mot de passe incorrect" });
        }
    });
});

// ============= ROUTES API =============
app.get('/niveaux', (req, res) => {
    const sql = "SELECT * FROM niveaux";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results); 
    });
});

app.get('/api/cours/:niveau/:domaine', (req, res) => {
    const { niveau, domaine } = req.params;

    // Requête qui cherche par ID de niveau OU par nom (ex: "1" ou "6e")
    const sql = `
        SELECT c.* 
        FROM cours c
        JOIN niveaux n ON c.niveau_id = n.id
        WHERE (c.niveau_id = ? OR LOWER(n.nom) = LOWER(?))
          AND LOWER(c.domaine) = LOWER(?)
    `;

    db.query(sql, [niveau, niveau, domaine], (err, results) => {
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

// Route 1 : Quand le domaine est précisé (ex: /api/videos/6e/algebre)
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

// Route 2 : Quand aucun domaine n'est précisé (ex: /api/videos/6e)
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