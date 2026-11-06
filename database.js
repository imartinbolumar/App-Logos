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
        tarifa_base REAL DEFAULT 0
    )`);

    // 2. Tabla de Clientes (Familias / Centros)
    db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        contacto TEXT,
        email TEXT,
        telefono TEXT
    )`);

    // 3. Tabla de Servicios / Tarifas especiales
    db.run(`CREATE TABLE IF NOT EXISTS tarifas_servicio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo_servicio TEXT NOT NULL,
        precio_hora REAL NOT NULL
    )`);

    // 4. Tabla de Sesiones del Calendario e Imputación de Horas
    db.run(`CREATE TABLE IF NOT EXISTS sesiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        cliente_id INTEGER,
        servicio_id INTEGER,
        fecha TEXT NOT NULL,
        horas REAL NOT NULL,
        tarifa_aplicada REAL NOT NULL,
        importe_total REAL NOT NULL,
        estado TEXT CHECK(estado IN ('Programada', 'Completada', 'Cancelada')) DEFAULT 'Programada',
        observaciones TEXT,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),
        FOREIGN KEY (servicio_id) REFERENCES tarifas_servicio(id)
    )`);
});

module.exports = db;