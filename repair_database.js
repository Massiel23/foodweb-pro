const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./pos.db');

db.serialize(() => {
    // 1. Asegurar esquema una vez más
    db.run("ALTER TABLE restaurants ADD COLUMN plan TEXT DEFAULT 'Basico'", () => { });
    db.run("ALTER TABLE restaurants ADD COLUMN owner_email TEXT", () => { });

    // 2. Forzar 'Pro' en todos los registros de forma redundante
    db.run("UPDATE restaurants SET plan = 'Pro', owner_email = 'demo@foodweb.pro'", (err) => {
        if (err) {
            console.error('❌ Error actualizando restaurants:', err.message);
        } else {
            console.log('✅ Base de Datos: Todos los restaurantes ahora son Plan PRO.');
        }
    });

    // 3. Vincular todos los usuarios admin
    db.run("UPDATE users SET email = 'demo@foodweb.pro' WHERE role = 'admin'", (err) => {
        if (err) {
            console.error('❌ Error actualizando users:', err.message);
        } else {
            console.log('✅ Base de Datos: Todos los administradores vinculados a demo@foodweb.pro.');
        }
        db.close();
    });
});
