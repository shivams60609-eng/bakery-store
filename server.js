const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "bakerySecretKey",
    resave: false,
    saveUninitialized: false
}));

app.use(express.static("public"));

// File paths
const productsFile = path.join(__dirname, "products.json");
const ordersFile = path.join(__dirname, "orders.json");

// Create files if missing
if (!fs.existsSync(productsFile)) fs.writeFileSync(productsFile, "[]");
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, "[]");

// Upload folder
const uploadDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) =>
        cb(null, Date.now() + "-" + file.originalname.replace(/\s/g, "_"))
});
const upload = multer({ storage });

// Helpers
const readJSON = file => JSON.parse(fs.readFileSync(file));
const writeJSON = (file, data) =>
    fs.writeFileSync(file, JSON.stringify(data, null, 2));

const authMiddleware = (req, res, next) => {
    if (req.session.isAdmin) next();
    else res.status(401).json({ message: "Unauthorized" });
};



// ================= PRODUCTS =================

app.get("/products", (req, res) => {
    res.json(readJSON(productsFile));
});

app.post("/add-product", authMiddleware, upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Image required" });

    const products = readJSON(productsFile);

    const newProduct = {
        id: uuidv4(),
        name: req.body.name,
        price: parseFloat(req.body.price),
        image: "/uploads/" + req.file.filename
    };

    products.push(newProduct);
    writeJSON(productsFile, products);

    res.json({ message: "Product added" });
});

app.post("/edit-product/:id", authMiddleware, upload.single("image"), (req, res) => {
    const products = readJSON(productsFile);
    const product = products.find(p => p.id === req.params.id);

    if (!product) return res.status(404).json({ message: "Not found" });

    product.name = req.body.name;
    product.price = parseFloat(req.body.price);

    if (req.file) {
        // delete old image
        const oldPath = path.join(__dirname, "public", product.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        product.image = "/uploads/" + req.file.filename;
    }

    writeJSON(productsFile, products);
    res.json({ message: "Product updated" });
});

app.delete("/delete-product/:id", authMiddleware, (req, res) => {
    let products = readJSON(productsFile);
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });

    const imagePath = path.join(__dirname, "public", product.image);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

    products = products.filter(p => p.id !== req.params.id);
    writeJSON(productsFile, products);

    res.json({ message: "Deleted" });
});



// ================= ORDERS =================

app.post("/order", (req, res) => {
    const { items, total, address } = req.body;
    if (!items || !address) return res.status(400).json({ message: "Invalid" });

    const orders = readJSON(ordersFile);

    const newOrder = {
        id: uuidv4(),
        items,
        total,
        address,
        status: "Pending",
        date: new Date()
    };

    orders.push(newOrder);
    writeJSON(ordersFile, orders);

    res.json({ message: "Order placed" });
});

app.get("/orders", authMiddleware, (req, res) => {
    res.json(readJSON(ordersFile));
});

app.post("/update-order/:id", authMiddleware, (req, res) => {
    const orders = readJSON(ordersFile);
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ message: "Not found" });

    order.status = req.body.status;
    writeJSON(ordersFile, orders);

    res.json({ message: "Updated" });
});



// ================= AUTH =================

app.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (username === "admin" && password === "admin123") {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.get("/check-auth", (req, res) => {
    res.json({ authenticated: !!req.session.isAdmin });
});

app.listen(PORT, () =>
    console.log("Server running on http://localhost:" + PORT)
);
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});