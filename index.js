require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();

//app.use(cors());
app.use(cors({
  origin: 'https://theitalianuncut.ch',
  credentials: true
}));

app.use(express.json());

// Rate limiter: massimo 30 richieste ogni 15 minuti per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Funzione per validare email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Endpoint POST per ricevere i dati dal form
app.post('/send', async (req, res) => {
  const { name, email, message, token } = req.body;

  // Validazione dei dati
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ message: 'Invalid name. It must be at least 2 characters.' });
  }

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email address.' });
  }

  if (!message || typeof message !== 'string' || message.trim().length < 5) {
    return res.status(400).json({ message: 'Invalid message. It must be at least 5 characters.' });
  }

  if (!token) {
    return res.status(400).json({ message: 'Missing reCAPTCHA token.' });
  }

  // Verifica del token reCAPTCHA
  try {
    const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`;

    const captchaRes = await fetch(verifyURL, { method: 'POST' });
    const captchaData = await captchaRes.json();

    if (!captchaData.success || captchaData.score < 0.5) {
      return res.status(403).json({ message: 'Failed reCAPTCHA verification.' });
    }

  } catch (err) {
    console.error('Error verifying reCAPTCHA:', err);
    return res.status(500).json({ message: 'reCAPTCHA verification failed.' });
  }

  // Invio email solo se la verifica è superata
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      replyTo: email,
      to: process.env.EMAIL_USER,
      subject: `New message from ${name.trim()}`,
      text: `Messaggio inviato da: ${name.trim()} <${email}>\n\n${message.trim()}`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email sent successfully!' });

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Error sending email.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
