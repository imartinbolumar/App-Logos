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
         
       // Tabla de Asignaciones (Cuadrante Semanal con tarifa y asistencia)
        db.run(`CREATE TABLE IF NOT EXISTS asignaciones_semanales (
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

        // Tabla principal para guardar la cabecera de la Hoja de Pago por mes
        db.run(`CREATE TABLE IF NOT EXISTS hojas_pago (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mes TEXT NOT NULL, -- Formato 'YYYY-MM'
                alumno_id INTEGER NOT NULL,
                modo_pago TEXT DEFAULT NULL,
                fecha_pago TEXT DEFAULT NULL,
                
                -- Conteo de tarifas de clases
                ref_p INTEGER DEFAULT 0,
                ref_s INTEGER DEFAULT 0,
                ref_b INTEGER DEFAULT 0,
                da INTEGER DEFAULT 0,
                da_c INTEGER DEFAULT 0,
                log INTEGER DEFAULT 0,
                log_m INTEGER DEFAULT 0,
                
                -- Descuentos y totales de clases
                num_clases INTEGER DEFAULT 0,
                total_clases INTEGER DEFAULT 0,
                pct_dto REAL DEFAULT 0.0000,
                importe_clases REAL DEFAULT 0.00,
                
                -- 6 Campos de Terapias
                terapia_1 INTEGER DEFAULT 0,
                terapia_2 INTEGER DEFAULT 0,
                terapia_3 INTEGER DEFAULT 0,
                terapia_4 INTEGER DEFAULT 0,
                terapia_5 INTEGER DEFAULT 0,
                terapia_6 INTEGER DEFAULT 0,
                importe_terapias REAL DEFAULT 0.00,
                
                -- Observaciones, Evaluación y Total Final
                observaciones TEXT DEFAULT NULL,
                evaluacion INTEGER DEFAULT 0,
                total_final REAL DEFAULT 0.00,
                
                creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
                actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                CONSTRAINT unique_mes_alumno UNIQUE (mes, alumno_id)
            )`);

           // Creación de la tabla para almacenar la hoja de pago guardada por mes y alumno
        db.run(`CREATE TABLE IF NOT EXISTS hoja_pago_mensual (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    mes TEXT NOT NULL,                     -- Formato YYYY-MM
                    alumno_id INTEGER NOT NULL,            -- Clave foránea del alumno
                    modo_pago TEXT,                        -- Ej. Efectivo, Transferencia, Domiciliación
                    fecha_pago TEXT,                       -- Fecha en la que se realiza el pago
                    ref_p INTEGER DEFAULT 0,               -- Cantidad tarifa REF P
                    ref_s INTEGER DEFAULT 0,               -- Cantidad tarifa REF S
                    ref_b INTEGER DEFAULT 0,               -- Cantidad tarifa REF B
                    da INTEGER DEFAULT 0,                  -- Cantidad tarifa DA
                    da_c INTEGER DEFAULT 0,                -- Cantidad tarifa DA C
                    log INTEGER DEFAULT 0,                 -- Cantidad tarifa LOG
                    log_m INTEGER DEFAULT 0,               -- Cantidad tarifa LOG M
                    num_clases INTEGER,                    -- Nº clases asistidas (para dto.)
                    total_clases INTEGER,                  -- Total clases asignadas (para dto.)
                    pct_dto REAL DEFAULT 0,                -- Porcentaje de descuento
                    importe_clases REAL DEFAULT 0,         -- Importe neto de clases
                    terapia_1 INTEGER DEFAULT 0,           -- Días / sesiones T1
                    terapia_2 INTEGER DEFAULT 0,           -- Días / sesiones T2
                    terapia_3 INTEGER DEFAULT 0,           -- Días / sesiones T3
                    terapia_4 INTEGER DEFAULT 0,           -- Días / sesiones T4
                    terapia_5 INTEGER DEFAULT 0,           -- Días / sesiones T5
                    terapia_6 INTEGER DEFAULT 0,           -- Días / sesiones T6
                    importe_terapias REAL DEFAULT 0,       -- Importe total terapias
                    observaciones TEXT,                    -- Notas complementarias
                    evaluacion INTEGER DEFAULT 0,          -- Booleano: si incluye tasa de evaluación
                    total_final REAL DEFAULT 0,            -- Suma final calculada
                    FOREIGN KEY(alumno_id) REFERENCES alumnos(id),
                    UNIQUE(mes, alumno_id)                  -- Garantiza un registro único por alumno y mes
            )`);    

    });
}

module.exports = db;