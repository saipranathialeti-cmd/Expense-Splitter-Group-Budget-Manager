require("dotenv").config();

const express = require("express");
const cors = require("cors");

const db = require("./db");
const authRoutes = require("./routes/auth");
const groupRoutes = require("./routes/groups");
const expenseRoutes = require("./routes/expenses");

const app = express();

app.use(cors());
app.use(express.json());

// Authentication routes
app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/expenses", expenseRoutes);


// Test route
app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1");

        res.json({
            status: "OK",
            message: "Expense Splitter connected to MySQL successfully"
        });

    } catch (error) {
        console.error("Database error:", error.message);

        res.status(500).json({
            status: "ERROR",
            message: "MySQL connection failed",
            error: error.message
        });
    }
});

// Home route
app.get("/", (req, res) => {
    res.send("Expense Splitter and Group Budget Manager Backend is running");
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});