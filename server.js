<<<<<<< HEAD
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
=======
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// I-serve ang lahat ng static files (HTML, CSS, JS, Images) mula sa root directory
app.use(express.static(path.join(__dirname)));

// Mga path para sa JSON storage files sa server
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');

// Helper function para basahin ang JSON file
function readJsonFile(filePath, defaultData = []) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return defaultData;
    }
}

// Helper function para isulat ang data sa JSON file
function writeJsonFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// I-initialize ang mga JSON files kung wala pa
readJsonFile(PRODUCTS_FILE, [
    {
        id: 1,
        name: "Sample Bluetooth Headphones",
        price: 1200,
        stock: 50,
        image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
        description: "High quality wireless headphones with deep bass."
    }
]);
readJsonFile(ORDERS_FILE, []);

/* --- PRODUCTS API --- */

// Get all products
app.get('/api/products', (req, res) => {
    const products = readJsonFile(PRODUCTS_FILE);
    res.json(products);
});

// Add a single product (ADMIN)
app.post('/api/products', (req, res) => {
    const { name, price, stock, image_url, description } = req.body;
    const products = readJsonFile(PRODUCTS_FILE);
    
    const newProduct = {
        id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
        name,
        price: Number(price),
        stock: Number(stock),
        image_url,
        description
    };

    products.push(newProduct);
    writeJsonFile(PRODUCTS_FILE, products);

    res.json({ message: 'Product added successfully', productId: newProduct.id });
});

// Bulk Add Products via CSV (ADMIN)
app.post('/api/products/bulk', (req, res) => {
    const newProducts = req.body;
    if (!Array.isArray(newProducts) || newProducts.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty product list' });
    }

    const products = readJsonFile(PRODUCTS_FILE);
    let currentId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;

    newProducts.forEach(prod => {
        products.push({
            id: currentId++,
            name: prod.name,
            price: Number(prod.price),
            stock: Number(prod.stock),
            image_url: prod.image_url,
            description: prod.description
        });
    });

    writeJsonFile(PRODUCTS_FILE, products);
    res.json({ message: `${newProducts.length} products added successfully!` });
});

// Delete a product (ADMIN)
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    let products = readJsonFile(PRODUCTS_FILE);
    
    const initialLength = products.length;
    products = products.filter(p => p.id != id);

    if (products.length === initialLength) {
        return res.status(404).json({ error: 'Product not found' });
    }

    writeJsonFile(PRODUCTS_FILE, products);
    res.json({ message: 'Product deleted successfully' });
});


/* --- ORDERS & PAYMENT API --- */

// Get all orders (ADMIN)
app.get('/api/orders', (req, res) => {
    const orders = readJsonFile(ORDERS_FILE);
    orders.sort((a, b) => b.id - a.id);
    res.json(orders);
});

// Create a new order (COD or Direct Checkout)
app.post('/api/orders', (req, res) => {
    const { customer_name, phone_number, shipping_address, landmark, payment_method, total_amount } = req.body;
    const orders = readJsonFile(ORDERS_FILE);

    const newOrder = {
        id: orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1,
        customer_name,
        phone_number,
        shipping_address,
        landmark,
        payment_method,
        total_amount: Number(total_amount),
        status: 'Pending',
        created_at: new Date().toISOString()
    };

    orders.push(newOrder);
    writeJsonFile(ORDERS_FILE, orders);

    res.json({ message: 'Order placed successfully', orderId: newOrder.id });
});

// Create PayMongo Checkout Session (Online Payment Gateway)
app.post('/api/create-checkout', async (req, res) => {
    const { customer_name, phone_number, shipping_address, landmark, cart, total_amount } = req.body;

    const PAYMONGO_SECRET_KEY = 'palit_mo_dito_ang_paymongo_secret_key_mo';  

    try {
        const lineItems = cart.map(item => ({
            currency: 'PHP',
            amount: Math.round(item.price * 100),
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
                        success_url: `${req.protocol}://${req.get('host')}/index.html?payment=success`,
                        cancel_url: `${req.protocol}://${req.get('host')}/index.html?payment=cancelled`,
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
            res.json({ error: data.errors ? data.errors[0].detail : 'PayMongo error initialization' });
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
    const orders = readJsonFile(ORDERS_FILE);

    const order = orders.find(o => o.id == id);
    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }

    order.status = status;
    writeJsonFile(ORDERS_FILE, orders);

    res.json({ message: 'Order status updated successfully' });
});

// Fallback para sa mga HTML pages (para diretso mag-load ang index.html sakaling i-refresh)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
>>>>>>> f320a616efbbe6a9c8afcdc853ff5ebdaeb186dd
