const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Connect to SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Create tables if they don't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        stock INTEGER,
        image_url TEXT,
        description TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT,
        phone_number TEXT,
        shipping_address TEXT,
        landmark TEXT,
        payment_method TEXT,
        total_amount REAL,
        status TEXT DEFAULT 'Pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

/* --- PRODUCTS API --- */

// Get all products
app.get('/api/products', (req, res) => {
    db.all(`SELECT * FROM products`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Add a single product (ADMIN)
app.post('/api/products', (req, res) => {
    const { name, price, stock, image_url, description } = req.body;
    const query = `INSERT INTO products (name, price, stock, image_url, description) VALUES (?, ?, ?, ?, ?)`;
    
    db.run(query, [name, price, stock, image_url, description], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Product added successfully', productId: this.lastID });
    });
});

// Bulk Add Products via CSV (ADMIN)
app.post('/api/products/bulk', (req, res) => {
    const products = req.body;
    if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty product list' });
    }

    const query = `INSERT INTO products (name, price, stock, image_url, description) VALUES (?, ?, ?, ?, ?)`;
    
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare(query);
        
        products.forEach(prod => {
            stmt.run([prod.name, prod.price, prod.stock, prod.image_url, prod.description]);
        });
        
        stmt.finalize();
        db.run("COMMIT", (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ message: `${products.length} products added successfully!` });
            }
        });
    });
});

// Delete a product (ADMIN)
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM products WHERE id = ?`, id, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Product deleted successfully' });
    });
});


/* --- ORDERS & PAYMENT API --- */

// Get all orders (ADMIN)
app.get('/api/orders', (req, res) => {
    db.all(`SELECT * FROM orders ORDER BY id DESC`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Create a new order (COD or Direct Checkout)
app.post('/api/orders', (req, res) => {
    const { customer_name, phone_number, shipping_address, landmark, payment_method, total_amount } = req.body;
    const query = `INSERT INTO orders (customer_name, phone_number, shipping_address, landmark, payment_method, total_amount, status) VALUES (?, ?, ?, ?, ?, ?, 'Pending')`;
    
    db.run(query, [customer_name, phone_number, shipping_address, landmark, payment_method, total_amount], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Order placed successfully', orderId: this.lastID });
    });
});

// Create PayMongo Checkout Session (Online Payment Gateway)
app.post('/api/create-checkout', async (req, res) => {
    const { customer_name, phone_number, shipping_address, landmark, cart, total_amount } = req.body;

    // TODO: Palitan ito ng iyong totoong PayMongo Secret Key (sk_test_... o sk_live_...)
    const PAYMONGO_SECRET_KEY = 'palit_mo_dito_ang_paymongo_secret_key_mo'; 

    try {
        const lineItems = cart.map(item => ({
            currency: 'PHP',
            amount: Math.round(item.price * 100), // PayMongo uses centavos
            name: item.name,
            quantity: item.quantity
        }));

        const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authorization: 'Basic ' + Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')
            },
            body: JSON.stringify({
                data: {
                    attributes: {
                        line_items: lineItems,
                        payment_method_types: ['card', 'gcash', 'paymaya', 'qrph'],
                        success_url: 'http://localhost:3000/index.html?payment=success',
                        cancel_url: 'http://localhost:3000/index.html?payment=cancelled',
                        description: `Order for ${customer_name} (${phone_number})`,
                        metadata: {
                            customer_name,
                            phone_number,
                            shipping_address,
                            landmark
                        }
                    }
                }
            })
        });

        const data = await response.json();
        
        if (response.ok && data.data && data.data.attributes) {
            res.json({ checkoutUrl: data.data.attributes.checkout_url });
        } else {
            res.status(400).json({ error: data.errors ? data.errors[0].detail : 'PayMongo error initialization' });
        }
    } catch (error) {
        console.error('PayMongo API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update order status (ADMIN)
app.put('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Order status updated successfully' });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});