const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Base de datos SQLite conectada correctamente.');
    }
});

// Inicialización de tablas y relaciones
db.serialize(() => {
    
    // 1. Tabla de Usuarios (Profesionales / Admins)
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        rol TEXT CHECK(rol IN ('admin', 'pedagogo', 'profesor')) NOT NULL,
        UNIQUE(email)
    )`);

   db.run(`CREATE TABLE IF NOT EXISTS alumnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    contacto_padre TEXT,
    telefono_padre TEXT,
    email_padre TEXT,
    contacto_madre TEXT,
    telefono_madre TEXT,
    email_madre TEXT,
    observaciones TEXT,
    creado_por TEXT,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    modificado_por TEXT,
    modificado_en DATETIME,
    UNIQUE(nombre, apellidos)
)`);
   
});

// 2. Intentar añadir la columna 'activo' mediante ALTER TABLE (por si la tabla ya existía)
db.run(`ALTER TABLE alumnos ADD COLUMN activo INTEGER DEFAULT 1`, (err) => {
    // Si da error, normalmente es porque la columna ya existe, lo cual es normal y se puede ignorar
});

db.run(`ALTER TABLE usuarios ADD COLUMN activo INTEGER DEFAULT 1`, (err) => {
    // Idem para usuarios
});

module.exports = db;