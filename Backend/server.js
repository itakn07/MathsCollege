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

// ============= CONFIGURATION =============
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const app = express();

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
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    port: 3307,
    database: 'maths_college'
});

db.connect(err => {
    if (err) {
        console.log('Erreur MySQL:', err);
    } else {
        console.log('Connecté à MySQL');
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
            model: "gemini-1.5-flash",
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
app.post('/signup', async (req, res) => {
    const { username, email, password, niveau } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = "INSERT INTO users (username, email, password, niveau) VALUES (?, ?, ?, ?)";
        db.query(sql, [username, email, hashedPassword, niveau], (err, result) => {
            if (err) {
                console.error(err);
                return res.json({ success: false, message: "Pseudo ou Email déjà utilisé." });
            }

            // Envoi de l'email de bienvenue

const mailHTML = `
<div style="font-family: Arial, sans-serif; background-color: #f4f7f6; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0;">
        <div style="background-color: #5b6cff; padding: 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">Bienvenue sur APP-MATHS !</h1>
        </div>
        
        <div style="padding: 30px; line-height: 1.6; color: #333333;">
            <p style="font-size: 18px;">Bonjour <strong>${username}</strong>,</p>
            <p>Nous sommes ravis de t'accueillir ! Ton compte a été créé avec succès. Tu peux maintenant accéder à tous tes cours de mathématiques et discuter avec <strong>Rita</strong>, ton IA coach.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="http://localhost:3000" style="background-color: #5b6cff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Commencer à réviser</a>
            </div>
            
            <p style="font-size: 14px; color: #777777;">Si tu as des questions, Rita est là pour t'aider directement sur la plateforme.</p>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #aaaaaa;">
            &copy; 2026 APP-MATHS - Le soutien scolaire nouvelle génération.
        </div>
    </div>
</div>
`;

        
        const mailOptions = {
    from: '"Maths Collège" <ritakngu13@gmail.com>',
    to: email,
    subject: 'Bienvenue sur APP-MATHS ! ',
    html: `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f0f4f8; padding: 40px 10px;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
            
            <div style="background-color: #007bff; padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 1px;">APP-MATHS</h1>
            </div>

            <div style="padding: 40px; text-align: center;">
                <h2 style="color: #1a202c; margin-bottom: 20px;">Bienvenue <span style="color: #007bff;">${username}</span> ! </h2>
                
                <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                    Ton compte est prêt ! Viens découvrir tes cours et discuter avec <strong>Sylvie</strong>, ton IA coach personnelle.
                </p>

                
                <p style="color: #a0aec0; font-size: 14px; margin-top: 40px;">
                    Ravi de t'accompagner vers la réussite en mathématiques !
                </p>
            </div>

            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #edf2f7;">
                <p style="color: #cbd5e0; font-size: 12px; margin: 0;">© 2026 Plateforme APP-MATHS</p>
            </div>
        </div>
    </div>
    `
};
  

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log("Erreur mail:", error);
                } else {
                    console.log("Email envoyé avec succès !");
                }
            });

            res.json({ success: true, message: "Inscription réussie !" });
        });
    } catch (e) {
        res.status(500).json({ success: false, message: "Erreur serveur." });
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

app.get('/api/cours/:idDuNiveau', (req, res) => {
    const niveauId = req.params.idDuNiveau;
    const sql = "SELECT * FROM cours WHERE niveau_id = ?";
    db.query(sql, [niveauId], (err, results) => {
        if (err) return res.status(500).send("Erreur serveur");
        res.json(results);
    });
});

app.get('/api/exercices/:idDuNiveau', (req, res) => {
    const niveauId = req.params.idDuNiveau;
    const sql = "SELECT * FROM exercices WHERE niveau_id = ?";
    db.query(sql, [niveauId], (err, results) => {
        if (err) return res.status(500).send("Erreur serveur");
        res.json(results);
    });
});

app.get('/api/videos/:idDuNiveau', (req, res) => {
    const niveauId = req.params.idDuNiveau;
    const sql = "SELECT * FROM videos WHERE niveau_id = ?";
    db.query(sql, [niveauId], (err, results) => {
        if (err) return res.status(500).send(err);
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
app.listen(3000, () => {
    console.log('Serveur prêt sur http://localhost:3000');
});