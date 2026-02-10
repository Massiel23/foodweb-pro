require('dotenv').config();
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();

async function addExtrasProduct() {
    console.log('🔄 Agregando producto EXTRAS...');
    
    const isProduction = process.env.DATABASE_URL !== undefined;
    
    if (isProduction) {
        // PostgreSQL
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        try {
            // Verificar si ya existe el producto EXTRAS
            const existing = await pool.query(
                "SELECT * FROM products WHERE name = 'EXTRAS'"
            );
            
            if (existing.rows.length > 0) {
                console.log('⚠️  El producto EXTRAS ya existe');
                await pool.end();
                return;
            }
            
            // Agregar producto EXTRAS con precio base 0
            await pool.query(
                "INSERT INTO products (name, price, img) VALUES ($1, $2, $3)",
                ['EXTRAS', 0, '➕']
            );
            
            console.log('✅ Producto EXTRAS agregado exitosamente');
            console.log('   Nombre: EXTRAS');
            console.log('   Precio base: $0.00');
            console.log('   Emoji: ➕');
            
            await pool.end();
        } catch (error) {
            console.error('❌ Error:', error.message);
            throw error;
        }
    } else {
        // SQLite
        const db = new sqlite3.Database('./pos.db');
        
        db.get("SELECT * FROM products WHERE name = 'EXTRAS'", (err, row) => {
            if (err) {
                console.error('❌ Error:', err.message);
                return;
            }
            
            if (row) {
                console.log('⚠️  El producto EXTRAS ya existe');
                db.close();
                return;
            }
            
            db.run(
                "INSERT INTO products (name, price, img) VALUES (?, ?, ?)",
                ['EXTRAS', 0, '➕'],
                function(err) {
                    if (err) {
                        console.error('❌ Error:', err.message);
                    } else {
                        console.log('✅ Producto EXTRAS agregado exitosamente');
                        console.log('   ID:', this.lastID);
                        console.log('   Nombre: EXTRAS');
                        console.log('   Precio base: $0.00');
                        console.log('   Emoji: ➕');
                    }
                    db.close();
                }
            );
        });
    }
}

addExtrasProduct();
