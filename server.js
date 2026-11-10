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
// RUTAS DE AUTENTICACIÓN (LOGIN)
// ----------------------------------------------------

// Iniciar sesión (Login)
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM usuarios WHERE email = ?`, [email], async (err, user) => {
        
        if (err || !user) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }
        if (user.activo === 0) {
            return res.status(401).json({ error: 'Usuario inactivo' });
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

// Cerrar sesión (Logout) - Nota: En JWT, el logout se maneja en el cliente eliminando el token
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'No se pudo cerrar la sesión' });
        }
        res.clearCookie('connect.sid'); // Limpia la cookie de sesión
        res.json({ mensaje: 'Sesión cerrada correctamente' });
    });
});

// ----------------------------------------------------
// RUTAS DE GESTIÓN DE USUARIOS
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

// Ruta para eliminar un usuario
app.delete('/api/usuarios/:id', (req, res) => {
    const { id } = req.params;
    
    // Opcional: Evitar que el admin se borre a sí mismo si lo deseas
    db.run(`DELETE FROM usuarios WHERE id = ?`, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error al eliminar el usuario de la base de datos.' });
        }
        res.json({ mensaje: 'Usuario eliminado con éxito' });
    });
});

// ----------------------------------------------------
// RUTAS GESTIÓN DE ALUMNOS
// ----------------------------------------------------

// Crear un nuevo alumno
app.post('/api/alumnos', (req, res) => {
    const { 
        nombre, apellidos, curso, beca, centro, fecha_comienzo, precio_terapia,
        contacto_padre, telefono_padre, email_padre, 
        contacto_madre, telefono_madre, email_madre, 
        observaciones, creado_por, activo 
    } = req.body;
    
    const estActivo = activo !== undefined ? activo : 1;
    const estBeca = beca !== undefined ? beca : 0;
    const estPrecio = precio_terapia !== undefined && precio_terapia !== '' ? parseFloat(precio_terapia) : 0;

    if (!nombre || !apellidos) {
        return res.status(400).json({ error: 'El nombre y los apellidos son obligatorios' });
    }

    const query = `INSERT INTO alumnos (
        nombre, apellidos, curso, beca, centro, fecha_comienzo, precio_terapia,
        contacto_padre, telefono_padre, email_padre, 
        contacto_madre, telefono_madre, email_madre, 
        observaciones, creado_por, activo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [
        nombre, apellidos, 
        curso || '', estBeca, centro || '', fecha_comienzo || '', estPrecio,
        contacto_padre || '', telefono_padre || '', email_padre || '', 
        contacto_madre || '', telefono_madre || '', email_madre || '', 
        observaciones || '', creado_por || 'Sistema', estActivo
    ], function(err) {
        if (err) {            
            // Si el error es por duplicidad de nombre y apellidos
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'YA_EXISTE' });
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
        nombre, apellidos, curso, beca, centro, fecha_comienzo, precio_terapia,
        contacto_padre, telefono_padre, email_padre, 
        contacto_madre, telefono_madre, email_madre, 
        observaciones, modificado_por, activo
    } = req.body;

    const estBeca = beca !== undefined ? beca : 0;
    const estPrecio = precio_terapia !== undefined && precio_terapia !== '' ? parseFloat(precio_terapia) : 0;

    const query = `UPDATE alumnos SET 
        nombre = ?, apellidos = ?, curso = ?, beca = ?, centro = ?, fecha_comienzo = ?, precio_terapia = ?,
        contacto_padre = ?, telefono_padre = ?, email_padre = ?, 
        contacto_madre = ?, telefono_madre = ?, email_madre = ?, 
        observaciones = ?, modificado_por = ?, modificado_en = CURRENT_TIMESTAMP, activo = ?
        WHERE id = ?`;

    db.run(query, [
        nombre, apellidos, 
        curso || '', estBeca, centro || '', fecha_comienzo || '', estPrecio,
        contacto_padre || '', telefono_padre || '', email_padre || '', 
        contacto_madre || '', telefono_madre || '', email_madre || '', 
        observaciones || '', modificado_por || 'Sistema', 
        activo !== undefined ? activo : 1, id
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

// Ruta para eliminar un alumno
app.delete('/api/alumnos/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM alumnos WHERE id = ?`, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error al eliminar el alumno' });
        }
        res.json({ mensaje: 'Alumno eliminado con éxito' });
    });
});

// ----------------------------------------------------
// RUTAS PARA EL CALENDARIO DE ASIGNACIONES SEMANALES
// ----------------------------------------------------

// Ruta para guardar las asignaciones semanales
app.post('/api/asignaciones/guardar', (req, res) => {
    const { semana, asignaciones } = req.body; 

    if (!asignaciones || !Array.isArray(asignaciones)) {
        return res.status(400).json({ error: 'Datos de asignación inválidos' });
    }

    // Regla: Máximo 3 alumnos por profesor en la misma fecha y franja
    const conteoProfesorFranjaFecha = {};
    for (const a of asignaciones) {
        const claveProf = `${a.usuario_id}_${a.fecha}_${a.franja}`;
        conteoProfesorFranjaFecha[claveProf] = (conteoProfesorFranjaFecha[claveProf] || 0) + 1;
        if (conteoProfesorFranjaFecha[claveProf] > 6) {
            return res.status(400).json({ error: 'Un profesor no puede tener más de 6 alumnos en la misma fecha y franja horaria.' });
        }
    }

    // Regla: Anti-cruces de alumnos en la misma fecha y franja
    const controlCrucesAlumnos = new Set();
    for (const a of asignaciones) {
        const claveAlumno = `${a.fecha}_${a.franja}_${a.alumno_id}`;
        if (controlCrucesAlumnos.has(claveAlumno)) {
            return res.status(400).json({ error: 'Un alumno no puede estar asignado a dos profesores distintos en la misma fecha y franja horaria.' });
        }
        controlCrucesAlumnos.add(claveAlumno);
    }

    // Guardado en base de datos
    db.serialize(() => {
        db.run(`DELETE FROM asignaciones_semanales WHERE semana = ?`, [semana], (err) => {
            if (err) {
                console.error("Error al limpiar asignaciones:", err.message);
                return res.status(500).json({ error: 'Error al actualizar las asignaciones' });
            }

            const stmt = db.prepare(`INSERT INTO asignaciones_semanales (usuario_id, alumno_id, fecha, franja, tarifa_id, asistencia, semana) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            asignaciones.forEach(a => {
                stmt.run(a.usuario_id, a.alumno_id, a.fecha, a.franja, a.tarifa_id, a.asistencia, semana);
            });
            stmt.finalize();

            res.json({ mensaje: 'Asignaciones guardadas correctamente con fechas reales' });
        });
    });
});

// Ruta para obtener las asignaciones de una semana y cargarlas en pantalla
app.get('/api/asignaciones', (req, res) => {
    const { semana } = req.query;
    db.all(`SELECT * FROM asignaciones_semanales WHERE semana = ?`, [semana], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener asignaciones' });
        }
        res.json(rows);
    });
});

// Ruta para copiar asignaciones de una semana origen a una semana destino
app.post('/api/asignaciones/copiar', (req, res) => {
    const { semanaOrigen, semanaDestino } = req.body;

    if (!semanaOrigen || !semanaDestino) {
        return res.status(400).json({ error: 'Faltan datos de origen o destino' });
    }

    db.serialize(() => {
        // 1. Limpiamos la semana destino por si ya tenía datos
        db.run(`DELETE FROM asignaciones_semanales WHERE semana = ?`, [semanaDestino], (err) => {
            if (err) return res.status(500).json({ error: 'Error al limpiar semana destino' });

            // 2. Leemos las asignaciones de la semana origen
            db.all(`SELECT usuario_id, alumno_id, fecha, franja, tarifa_id FROM asignaciones_semanales WHERE semana = ? AND asistencia NOT IN ('REC', 'ADEL', 'EXTR')`, [semanaOrigen], (err, rows) => {
                if (err) return res.status(500).json({ error: 'Error al leer la semana origen' });

                if (rows.length === 0) {
                    return res.status(400).json({ error: 'No hay asignaciones en la semana origen para copiar.' });
                }

                // Cálculo exacto de la diferencia en días enteros para evitar desajustes horarios
                const dOrig = new Date(semanaOrigen);
                const dDest = new Date(semanaDestino);
                const diffTime = dDest.getTime() - dOrig.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                const stmt = db.prepare(`INSERT INTO asignaciones_semanales (usuario_id, alumno_id, fecha, franja, tarifa_id, semana) VALUES (?, ?, ?, ?, ?, ?)`);
                
                rows.forEach(r => {
                    // Desplazamos la fecha sumando exactamente los días de diferencia
                    const [fYear, fMonth, fDay] = r.fecha.split('-').map(Number);
                    const fechaAntigua = new Date(fYear, fMonth - 1, fDay);
                    fechaAntigua.setDate(fechaAntigua.getDate() + diffDays);
                    
                    const yyyy = fechaAntigua.getFullYear();
                    const mm = String(fechaAntigua.getMonth() + 1).padStart(2, '0');
                    const dd = String(fechaAntigua.getDate()).padStart(2, '0');
                    const nuevaFechaIso = `${yyyy}-${mm}-${dd}`;

                    stmt.run(r.usuario_id, r.alumno_id, nuevaFechaIso, r.franja, r.tarifa_id, semanaDestino);
                });
                stmt.finalize();

                res.json({ mensaje: 'Semana copiada con éxito' });
            });
        });
    });
});

// ----------------------------------------------------
// RUTAS PARA EL GESTOR DE TARIFAS Y SERVICIOS
// ----------------------------------------------------

// 1. Obtener todas las tarifas ordenadas por código y fecha de inicio
app.get('/api/tarifas', (req, res) => {
    db.all(`SELECT * FROM tarifas_servicios ORDER BY codigo ASC, fecha_inicio ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al obtener las tarifas' });
        res.json(rows);
    });
});

// 2. Crear tarifa con validación de solapamiento de fechas para el mismo código
app.post('/api/tarifas', (req, res) => {
    const { 
        codigo, tipo_servicio, descripcion, 
        precio_1h, precio_2h, precio_3h, precio_4h, precio_5h, 
        tarifa_por_sesion, fecha_inicio, fecha_fin, usuario_creacion 
    } = req.body;

    if (!codigo || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({ error: 'El código y las fechas de validez son obligatorios.' });
    }

    // Validar si ya existe una tarifa para este código con fechas solapadas
    // Solapamiento: (InicioA <= FinB) y (FinA >= InicioB)
    const sqlValidacion = `SELECT COUNT(*) as total FROM tarifas_servicios WHERE codigo = ? AND fecha_inicio <= ? AND fecha_fin >= ?`;
    
    db.get(sqlValidacion, [codigo, fecha_fin, fecha_inicio], (err, row) => {
        if (err) return res.status(500).json({ error: 'Error al validar solapamiento' });

        if (row.total > 0) {
            return res.status(400).json({ error: `⚠️ Ya existe una tarifa para el código '${codigo}' en un rango de fechas que se solapa con el indicado.` });
        }

        // Si pasa la validación, insertamos
        db.run(`INSERT INTO tarifas_servicios 
            (codigo, tipo_servicio, descripcion, precio_1h, precio_2h, precio_3h, precio_4h, precio_5h, tarifa_por_sesion, fecha_inicio, fecha_fin, usuario_creacion) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                codigo.toUpperCase(), tipo_servicio, descripcion || '', 
                precio_1h || 0, precio_2h || 0, precio_3h || 0, precio_4h || 0, precio_5h || 0, 
                tarifa_por_sesion || 0, fecha_inicio, fecha_fin, usuario_creacion || 'Admin'
            ],
            function(err) {
                if (err) return res.status(400).json({ error: 'Error al registrar la tarifa' });
                res.json({ mensaje: 'Tarifa creada con éxito', id: this.lastID });
            }
        );
    });
});

// 3. Modificar tarifa por ID con validación de solapamiento (excluyendo el propio registro)
app.put('/api/tarifas/:id', (req, res) => {
    const { id } = req.params;
    const { 
        codigo, tipo_servicio, descripcion, 
        precio_1h, precio_2h, precio_3h, precio_4h, precio_5h, 
        tarifa_por_sesion, fecha_inicio, fecha_fin, usuario_modificacion 
    } = req.body;

    // Validar solapamiento excluyendo el ID actual
    const sqlValidacion = `SELECT COUNT(*) as total FROM tarifas_servicios WHERE codigo = ? AND id != ? AND fecha_inicio <= ? AND fecha_fin >= ?`;

    db.get(sqlValidacion, [codigo, id, fecha_fin, fecha_inicio], (err, row) => {
        if (err) return res.status(500).json({ error: 'Error al validar solapamiento' });

        if (row.total > 0) {
            return res.status(400).json({ error: `⚠️ Ya existe otra tarifa para el código '${codigo}' en un rango de fechas que se solapa.` });
        }

        db.run(`UPDATE tarifas_servicios SET 
            codigo = ?, tipo_servicio = ?, descripcion = ?, 
            precio_1h = ?, precio_2h = ?, precio_3h = ?, precio_4h = ?, precio_5h = ?, 
            tarifa_por_sesion = ?, fecha_inicio = ?, fecha_fin = ?, 
            usuario_modificacion = ?, fecha_modificacion = CURRENT_TIMESTAMP 
            WHERE id = ?`,
            [
                codigo.toUpperCase(), tipo_servicio, descripcion || '', 
                precio_1h || 0, precio_2h || 0, precio_3h || 0, precio_4h || 0, precio_5h || 0, 
                tarifa_por_sesion || 0, fecha_inicio, fecha_fin, usuario_modificacion || 'Admin', id
            ],
            function(err) {
                if (err) return res.status(400).json({ error: 'Error al actualizar la tarifa' });
                res.json({ mensaje: 'Tarifa actualizada con éxito' });
            }
        );
    });
});

// Ruta para eliminar una tarifa
app.delete('/api/tarifas/:id', (req, res) => {
    const { id } = req.params;
    
    db.run(`DELETE FROM tarifas_servicios WHERE id = ?`, [id], function(err) {
        if (err) {
            console.error("❌ Error real de SQLite al borrar tarifa:", err.message); // Muestra el error en tu terminal negra de Node
            return res.status(500).json({ error: 'Error de BD: ' + err.message }); // Te muestra el error exacto en el alert del navegador
        }
        res.json({ mensaje: 'Tarifa eliminada con éxito' });
    });
});

// ----------------------------------------------------
// RUTAS PARA LOS DATOS MAESTROS
// ----------------------------------------------------

// --- MODOS DE PAGO ---
app.get('/api/modos-pago', (req, res) => {
    db.all(`SELECT * FROM modos_pago`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/modos-pago', (req, res) => {
    const { codigo, descripcion } = req.body;
    db.run(`INSERT OR REPLACE INTO modos_pago (codigo, descripcion) VALUES (?, ?)`, 
        [codigo.toUpperCase(), descripcion], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, codigo });
    });
});

app.delete('/api/modos-pago/:codigo', (req, res) => {
    const { codigo } = req.params;
    db.run(`DELETE FROM modos_pago WHERE codigo = ?`, [codigo], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- CENTROS ---
app.get('/api/centros', (req, res) => {
    db.all(`SELECT * FROM centros ORDER BY nombre ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/centros', (req, res) => {
    const { nombre } = req.body;
    db.run(`INSERT INTO centros (nombre) VALUES (?)`, [nombre.trim().toUpperCase()], function(err) {
        if (err) return res.status(500).json({ error: "El centro ya existe o hay un error." });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/centros/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM centros WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ----------------------------------------------------
// INICIO DEL SERVIDOR
// ----------------------------------------------------
app.listen(PORT, () => {
    console.log(`Servidor en marcha en http://localhost:${PORT}`);
});