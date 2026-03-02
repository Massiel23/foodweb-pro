const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./pos.db');

db.serialize(() => {
    // 1. Asegurar columnas
    db.run("ALTER TABLE restaurants ADD COLUMN plan TEXT DEFAULT 'Basico'", () => { });
    db.run("ALTER TABLE restaurants ADD COLUMN owner_email TEXT", () => { });
    db.run("ALTER TABLE users ADD COLUMN email TEXT", () => { });

    // 2. Activar PRO y vincular con un correo común para que aparezcan en la lista
    const testEmail = 'demo@foodweb.pro';

    db.run("UPDATE restaurants SET plan = 'Pro', owner_email = ?", [testEmail]);
    db.run("UPDATE users SET email = ? WHERE role = 'admin'", [testEmail], (err) => {
        if (err) {
            console.error('Error:', err.message);
        } else {
            console.log('✅ Plan Pro activado y sucursales vinculadas a ' + testEmail);
        }
        db.close();
    });
});
