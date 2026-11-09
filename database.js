const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Definir la ruta de la base de datos (se guardará en un archivo llamado 'database.sqlite')
const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error al conectar con la base de datos SQLite:', err.message);
    } else {
        console.log('✅ Conectado a la base de datos SQLite.');
        inicializarTablas();
    }
});

function inicializarTablas() {
    db.serialize(() => {
        // 1. Tabla de Usuarios / Profesores
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            rol TEXT NOT NULL, -- 'admin' o 'profesor'
            activo INTEGER DEFAULT 1
        )`);

        // 2. Tabla de Centros Educativos
        db.run(`CREATE TABLE IF NOT EXISTS centros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE NOT NULL
        )`);

        // Modos de pago
        db.run(`CREATE TABLE IF NOT EXISTS modos_pago (
            codigo TEXT PRIMARY KEY,
            descripcion TEXT NOT NULL
        )`);

        // 3. Tabla de Alumnos
        db.run(`CREATE TABLE IF NOT EXISTS alumnos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            apellidos TEXT NOT NULL,
            curso TEXT,
            beca INTEGER DEFAULT 0,
            centro TEXT,
            fecha_comienzo TEXT,
            precio_terapia REAL DEFAULT 0,            
            contacto_padre TEXT,
            telefono_padre TEXT,
            email_padre TEXT,
            contacto_madre TEXT,
            telefono_madre TEXT,
            email_madre TEXT,
            activo INTEGER DEFAULT 1,
            observaciones TEXT,
            creado_por TEXT,
            modificado_por TEXT,
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
            modificado_en DATETIME
        )`);

        // 4. Tabla de Tarifas de Servicios
        db.run(`CREATE TABLE IF NOT EXISTS tarifas_servicios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo_servicio TEXT NOT NULL,
            codigo TEXT NOT NULL,
            descripcion TEXT,
            precio_1h REAL DEFAULT 0,
            precio_2h REAL DEFAULT 0,
            precio_3h REAL DEFAULT 0,
            precio_4h REAL DEFAULT 0,
            precio_5h REAL DEFAULT 0,
            tarifa_por_sesion REAL DEFAULT 0,
            fecha_inicio TEXT,
            fecha_fin TEXT,
            activa INTEGER DEFAULT 1,
            usuario_creacion TEXT,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            usuario_modificacion TEXT,
            fecha_modificacion DATETIME
        )`);

        // 5. Tabla de Asignaciones (Cuadrante Semanal con tarifa y asistencia)
        db.run(`CREATE TABLE IF NOT EXISTS asignaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            alumno_id INTEGER NOT NULL,
            fecha TEXT NOT NULL,         -- Formato YYYY-MM-DD
            franja TEXT NOT NULL,        -- Ejemplo: "15:30 - 16:30"
            tarifa_id INTEGER,           -- ID de la tarifa aplicada
            asistencia TEXT DEFAULT '',  -- '', 'na', 'nv', 'rec'
            semana TEXT NOT NULL,        -- Fecha del Lunes de referencia (YYYY-MM-DD)
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
            FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
            FOREIGN KEY (tarifa_id) REFERENCES tarifas_servicios(id)
        )`);
    });
}

module.exports = db;