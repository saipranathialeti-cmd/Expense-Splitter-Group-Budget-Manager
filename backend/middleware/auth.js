const jwt = require("jsonwebtoken");
const db = require("../db");

function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Access denied. Please login." });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        return res.status(403).json({ message: "Invalid or expired token" });
    }
}

async function getUserGroupId(userId, requestedGroupId) {
    if (requestedGroupId !== undefined && requestedGroupId !== null && requestedGroupId !== "") {
        const id = Number(requestedGroupId);
        if (!Number.isInteger(id)) return null;

        const [rows] = await db.query(
            "SELECT id FROM `groups` WHERE id = ? AND owner_id = ? LIMIT 1",
            [id, userId]
        );
        return rows.length ? rows[0].id : null;
    }

    const [rows] = await db.query(
        "SELECT id FROM `groups` WHERE owner_id = ? ORDER BY id DESC LIMIT 1",
        [userId]
    );
    return rows.length ? rows[0].id : null;
}

module.exports = { authenticateToken, getUserGroupId };
