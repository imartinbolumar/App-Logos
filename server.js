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
// RUTAS DEGESTIÓN DE USUARIOS
// ----------------------------------------------------

// Crear un nuevo usuario (Contraseña encriptada)
app.post('/api/usuarios', async (req, res) => {
    const { nombre, email, password, rol, activo } = req.body;

    const estadoActivo = activo !== undefined ? activo : 1;

    if (!nombre || !email || !password || !rol) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const query = `INSERT INTO usuarios (nombre, email, password, rol, activo) VALUES (?, ?, ?, ?, ?)`;
        db.run(query, [nombre.trim(), email.trim(), hashedPassword, rol, estadoActivo], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'El email ya está registrado.' });
                }
                return res.status(400).json({ error: 'Error al registrar el usuario.' });
            }
            res.json({ mensaje: 'Usuario creado con éxito', id: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar la contraseña.' });
    }
});

// Modificar un usuario existente (Encripta contraseña solo si se introduce una nueva)
app.put('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, email, rol, password, activo } = req.body;

    try {
        let query, params;

        const estadoActivo = activo !== undefined ? activo : 1;

        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            query = `UPDATE usuarios SET nombre = ?, email = ?, rol = ?, password = ?, activo = ? WHERE id = ?`;
            params = [nombre.trim(), email.trim(), rol, hashedPassword, estadoActivo, id];
        } else {
            query = `UPDATE usuarios SET nombre = ?, email = ?, rol = ?, activo = ? WHERE id = ?`;
            params = [nombre.trim(), email.trim(), rol, estadoActivo, id];
        }

        db.run(query, params, function(err) {
            if (err) {
                return res.status(400).json({ error: 'Error al actualizar el usuario.' });
            }
            res.json({ mensaje: 'Usuario actualizado con éxito' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar la contraseña.' });
    }
});

// Listar todos los usuarios
app.get('/api/usuarios', (req, res) => {
    db.all(`SELECT id, nombre, email, rol, activo FROM usuarios`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener los usuarios' });
        }
        res.json(rows);
    });
});

// 💾 Función para Guardar (Nuevo) o Modificar (Actualizar)
async function guardarUsuario(e) {
    e.preventDefault();
    
    const id = document.getElementById('usuario-id').value;
    const datos = {
        nombre: document.getElementById('nombre').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        rol: document.getElementById('rol').value,
        activo: document.getElementById('activo').value
    };

    // Si hay ID es una modificación (PUT), si no, es un registro nuevo (POST)
    const url = id ? `/api/usuarios/${id}` : '/api/usuarios';
    const metodo = id ? 'PUT' : 'POST';

    try {
        const respuesta = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            alert(id ? '¡Usuario actualizado con éxito!' : '¡Usuario registrado con éxito!');
            limpiarFormulario();
            cargarUsuarios(); // Recarga la tabla de inmediato
        } else {
            alert('❌ Error: ' + (resultado.error || 'No se pudo completar la operación'));
        }
    } catch (error) {
        console.error('Error de red:', error);
        alert('❌ Error de conexión con el servidor.');
    }
}

// ----------------------------------------------------
// RUTAS DE AUTENTICACIÓN (LOGIN Y REGISTRO)
// ----------------------------------------------------


// Iniciar sesión (Login)
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM usuarios WHERE email = ? AND activo = 1`, [email], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Credenciales incorrectas o usuario inactivo' });
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
// RUTAS GESTIÓN DE ALUMNOS
// ----------------------------------------------------

// Ruta para registrar un nuevo alumno
app.post('/api/alumnos', (req, res) => {
    const { 
        nombre, apellidos, 
        contacto_padre, telefono_padre, email_padre, 
        contacto_madre, telefono_madre, email_madre, 
        observaciones, creado_por, activo 
    } = req.body;

    if (!nombre || !apellidos) {
        return res.status(400).json({ error: 'El nombre y los apellidos son obligatorios' });
    }

    const query = `INSERT INTO alumnos (
        nombre, apellidos, 
        contacto_padre, telefono_padre, email_padre, 
        contacto_madre, telefono_madre, email_madre, 
        observaciones, creado_por, modificado_por, modificado_en, activo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [
        nombre, apellidos, 
        contacto_padre || '', telefono_padre || '', email_padre || '', 
        contacto_madre || '', telefono_madre || '', email_madre || '', 
        observaciones || '', creado_por || 'Sistema', creado_por || 'Sistema', new Date().toISOString(), activo !== undefined ? activo : 1
    ], function(err) {
        if (err) {
            // Si el error es por duplicidad de nombre y apellidos
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Ya existe un alumno registrado con ese mismo nombre y apellidos.' });
            }
            return res.status(400).json({ error: 'Error al registrar el alumno en la base de datos.' });
        }
        res.json({ 
            mensaje: 'Alumno registrado con éxito', 
            id: this.lastID 
        });
    });
});

// Ruta para actualizar un alumno existente
app.put('/api/alumnos/:id', (req, res) => {
    const { id } = req.params;
    const { 
        nombre, apellidos, 
        contacto_padre, telefono_padre, email_padre, 
        contacto_madre, telefono_madre, email_madre, 
        observaciones, modificado_por 
    } = req.body;

    const query = `UPDATE alumnos SET 
        nombre = ?, apellidos = ?, 
        contacto_padre = ?, telefono_padre = ?, email_padre = ?, 
        contacto_madre = ?, telefono_madre = ?, email_madre = ?, 
        observaciones = ?, modificado_por = ?, modificado_en = CURRENT_TIMESTAMP 
        WHERE id = ?`;

    db.run(query, [
        nombre, apellidos, 
        contacto_padre || '', telefono_padre || '', email_padre || '', 
        contacto_madre || '', telefono_madre || '', email_madre || '', 
        observaciones || '', modificado_por || 'Sistema', id
    ], function(err) {
        if (err) {
            return res.status(400).json({ error: 'Error al actualizar el alumno' });
        }
        res.json({ mensaje: 'Alumno actualizado con éxito' });
    });
});


// Ruta para cargar alumnos
app.get('/api/alumnos', (req, res) => {
    db.all(`SELECT * FROM alumnos ORDER BY creado_en DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener los alumnos' });
        }
        res.json(rows);
    });
});


// ----------------------------------------------------
// INICIO DEL SERVIDOR
// ----------------------------------------------------
app.listen(PORT, () => {
    console.log(`Servidor en marcha en http://localhost:${PORT}`);
});