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
            precio_terapia REAL DEFAULT NULL,            
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
        )`, () => {
            db.run("ALTER TABLE alumnos RENAME COLUMN contacto_padre TO contacto_1;", (err) => {});
            db.run("ALTER TABLE alumnos RENAME COLUMN telefono_padre TO telefono_1;", (err) => {});
            db.run("ALTER TABLE alumnos RENAME COLUMN email_padre TO email_1;", (err) => {});
            db.run("ALTER TABLE alumnos RENAME COLUMN contacto_madre TO contacto_2;", (err) => {});
            db.run("ALTER TABLE alumnos RENAME COLUMN telefono_madre TO telefono_2;", (err) => {});
            db.run("ALTER TABLE alumnos RENAME COLUMN email_madre TO email_2;", (err) => {});

            const nuevasColumnas = [
                "ALTER TABLE alumnos ADD COLUMN tarifa_refuerzo_id INTEGER;",
                "ALTER TABLE alumnos ADD COLUMN horas_refuerzo INTEGER DEFAULT 0;",
                "ALTER TABLE alumnos ADD COLUMN tarifa_dificultad_id INTEGER;",
                "ALTER TABLE alumnos ADD COLUMN horas_dificultad INTEGER DEFAULT 0;",
                "ALTER TABLE alumnos ADD COLUMN tarifa_logopedia_id INTEGER;",
                "ALTER TABLE alumnos ADD COLUMN horas_logopedia INTEGER DEFAULT 0;",
                "ALTER TABLE alumnos ADD COLUMN pago_banco INTEGER DEFAULT 0;"
            ];

            nuevasColumnas.forEach(sql => {
                db.run(sql, (err) => {});
            });
        });

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
                asistencia TEXT DEFAULT '',  -- '', 'na', 'nv', 'rec', 'extr'
                semana TEXT NOT NULL,        -- Fecha del Lunes de referencia (YYYY-MM-DD)
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
                FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
                FOREIGN KEY (tarifa_id) REFERENCES tarifas_servicios(id)
        )`);        

        // Creación de la tabla para almacenar la hoja de pago guardada por mes y alumno
        db.run(`CREATE TABLE IF NOT EXISTS hoja_pago_mensual (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    mes TEXT NOT NULL,                     -- Formato YYYY-MM
                    alumno_id INTEGER NOT NULL,            -- Clave foránea del alumno
                    pendiente_mes_anterior REAL DEFAULT 0, -- Pendiente de pago del mes anterior
                    clases_extra INTEGER DEFAULT 0,        -- Conteo de clases marcadas como EXTR en asignaciones_semanales
                    cobro_extra REAL DEFAULT 0,            -- Compatibilidad anterior (Importe Extra)
                    importe_extra REAL DEFAULT 0,          -- Importe Extra (editable)
                    otros_pagos REAL DEFAULT 0,            -- Compatibilidad anterior (Pagado Extra)
                    pagado_extra REAL DEFAULT 0,           -- Pagado Extra (editable)
                    ref_p INTEGER DEFAULT 0,               -- Cantidad tarifa REF P
                    ref_s INTEGER DEFAULT 0,               -- Cantidad tarifa REF S
                    ref_b INTEGER DEFAULT 0,               -- Cantidad tarifa REF B
                    da INTEGER DEFAULT 0,                  -- Cantidad tarifa DA
                    da_c INTEGER DEFAULT 0,                -- Cantidad tarifa DA C
                    log INTEGER DEFAULT 0,                 -- Cantidad tarifa LOG
                    log_m INTEGER DEFAULT 0,               -- Cantidad tarifa LOG M
                    num_clases INTEGER,                    -- Nº clases asistidas (no modificable)
                    total_clases INTEGER,                  -- Total clases asignadas (no modificable)
                    pct_dto REAL DEFAULT 0,                -- Porcentaje de descuento
                    importe_clases REAL DEFAULT 0,         -- Importe neto de clases
                    importe_pagado_clases REAL DEFAULT 0,  -- Importe pagado de clases (editable)
                    terapia_1 TEXT DEFAULT '',             -- T1 (alfanumérico máx 5)
                    terapia_1_pagado INTEGER DEFAULT 0,    -- Check pagado T1 (1/0)
                    terapia_2 TEXT DEFAULT '',             -- T2 (alfanumérico máx 5)
                    terapia_2_pagado INTEGER DEFAULT 0,    -- Check pagado T2 (1/0)
                    terapia_3 TEXT DEFAULT '',             -- T3 (alfanumérico máx 5)
                    terapia_3_pagado INTEGER DEFAULT 0,    -- Check pagado T3 (1/0)
                    terapia_4 TEXT DEFAULT '',             -- T4 (alfanumérico máx 5)
                    terapia_4_pagado INTEGER DEFAULT 0,    -- Check pagado T4 (1/0)
                    terapia_5 TEXT DEFAULT '',             -- T5 (alfanumérico máx 5)
                    terapia_5_pagado INTEGER DEFAULT 0,    -- Check pagado T5 (1/0)
                    terapia_6 TEXT DEFAULT '',             -- T6 (alfanumérico máx 5)
                    terapia_6_pagado INTEGER DEFAULT 0,    -- Check pagado T6 (1/0)
                    importe_terapias REAL DEFAULT 0,       -- Importe total terapias
                    importe_pagado_terapias REAL DEFAULT 0,-- Importe pagado terapias (no modificable)
                    observaciones TEXT,                    -- Notas complementarias
                    evaluacion INTEGER DEFAULT 0,          -- Compatibilidad anterior
                    importe_evaluacion REAL DEFAULT 0,     -- Importe Evaluación (editable)
                    pagado_evaluacion REAL DEFAULT 0,      -- Pagado Evaluación (editable)
                    total_final REAL DEFAULT 0,            -- Suma final calculada
                    total_pagado REAL DEFAULT 0,           -- Total pagado (no modificable)
                    FOREIGN KEY(alumno_id) REFERENCES alumnos(id),
                    UNIQUE(mes, alumno_id)                  -- Garantiza un registro único por alumno y mes
            )`, () => {
                // Migración segura para bases de datos existentes
                const columnasHojaPago = [
                    "ALTER TABLE hoja_pago_mensual ADD COLUMN clases_extra INTEGER DEFAULT 0;",
                    "ALTER TABLE hoja_pago_mensual ADD COLUMN importe_extra REAL DEFAULT 0;",
                    "ALTER TABLE hoja_pago_mensual ADD COLUMN pagado_extra REAL DEFAULT 0;",
                    "ALTER TABLE hoja_pago_mensual ADD COLUMN importe_evaluacion REAL DEFAULT 0;",
                    "ALTER TABLE hoja_pago_mensual ADD COLUMN pagado_evaluacion REAL DEFAULT 0;"
                ];
                columnasHojaPago.forEach(sql => {
                    db.run(sql, (err) => {});
                });
            });
    });
}

module.exports = db;