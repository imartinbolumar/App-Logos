const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'clave_secreta_super_segura_cambiar_en_produccion';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// RUTAS DE AUTENTICACIÓN (LOGIN Y REGISTRO)
// ----------------------------------------------------

// Registrar un nuevo usuario (útil para administradores)
app.post('/api/auth/registro', async (req, res) => {
    const { nombre, email, password, rol, tarifa_base } = req.body;

    if (!nombre || !email || !password || !rol) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = `INSERT INTO usuarios (nombre, email, password, rol, tarifa_base) VALUES (?, ?, ?, ?, ?)`;
        
        db.run(query, [nombre, email, hashedPassword, rol, tarifa_base || 0], function(err) {
            if (err) {
                return res.status(400).json({ error: 'El email ya está registrado o hay un error.' });
            }
            res.json({ mensaje: 'Usuario registrado con éxito', id: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ error: 'Error del servidor al encriptar contraseña' });
    }
});

// Iniciar sesión (Login)
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM usuarios WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        // Crear Token de acceso válido por 8 horas
        const token = jwt.sign({ id: user.id, rol: user.rol, nombre: user.nombre }, SECRET_KEY, { expiresIn: '8h' });
        
        res.json({ 
            mensaje: 'Login exitoso', 
            token, 
            usuario: { nombre: user.nombre, rol: user.rol, email: user.email } 
        });
    });
});

// ----------------------------------------------------
// INICIO DEL SERVIDOR
// ----------------------------------------------------
app.listen(PORT, () => {
    console.log(`Servidor en marcha en http://localhost:${PORT}`);
});