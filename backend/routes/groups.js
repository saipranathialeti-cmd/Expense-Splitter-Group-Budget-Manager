const express = require("express");
const db = require("../db");
const { authenticateToken, getUserGroupId } = require("../middleware/auth");

const router = express.Router();

// GET ALL GROUPS OWNED BY THE LOGGED-IN USER
router.get("/", authenticateToken, async (req, res) => {
    try {
        const [groups] = await db.query(
            `SELECT id, name, owner_id
             FROM \`groups\`
             WHERE owner_id = ?
             ORDER BY id DESC`,
            [req.user.id]
        );

        res.json(groups);
    } catch (error) {
        console.error("GET GROUPS ERROR:", error);
        res.status(500).json({ message: "Failed to load groups" });
    }
});

// CREATE GROUP
router.post("/", authenticateToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const name = String(req.body.name || "").trim();
        if (!name) {
            return res.status(400).json({ message: "Group name is required" });
        }
        if (name.length > 100) {
            return res.status(400).json({ message: "Group name must be 100 characters or less" });
        }

        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO \`groups\` (name, owner_id) VALUES (?, ?)`,
            [name, req.user.id]
        );

        // Add the logged-in user as the first member when the schema supports it.
        const [users] = await connection.query(
            "SELECT name FROM users WHERE id = ? LIMIT 1",
            [req.user.id]
        );
        if (users.length && users[0].name) {
            await connection.query(
                `INSERT INTO group_members (group_id, name) VALUES (?, ?)`,
                [result.insertId, users[0].name]
            );
        }

        await connection.commit();
        res.status(201).json({
            message: "Group created successfully",
            group: { id: result.insertId, name }
        });
    } catch (error) {
        await connection.rollback();
        console.error("CREATE GROUP ERROR:", error);
        res.status(500).json({ message: "Failed to create group" });
    } finally {
        connection.release();
    }
});

// ADD PERSON TO THE SELECTED GROUP
router.post("/members", authenticateToken, async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        if (!name) return res.status(400).json({ message: "Person name is required" });

        const groupId = await getUserGroupId(req.user.id, req.headers["x-group-id"]);
        if (!groupId) return res.status(400).json({ message: "Please create or select a group first" });

        const [existing] = await db.query(
            "SELECT id FROM group_members WHERE group_id = ? AND name = ? LIMIT 1",
            [groupId, name]
        );
        if (existing.length) return res.status(409).json({ message: "That person is already in the group" });

        await db.query(
            `INSERT INTO group_members (group_id, name) VALUES (?, ?)`,
            [groupId, name]
        );
        res.status(201).json({ message: "Person added successfully" });
    } catch (error) {
        console.error("ADD PERSON ERROR:", error);
        res.status(500).json({ message: "Failed to add person" });
    }
});

// GET MEMBERS OF THE SELECTED GROUP
router.get("/members", authenticateToken, async (req, res) => {
    try {
        const groupId = await getUserGroupId(req.user.id, req.headers["x-group-id"]);
        if (!groupId) return res.json([]);

        const [members] = await db.query(
            `SELECT id, name FROM group_members WHERE group_id = ? ORDER BY id ASC`,
            [groupId]
        );
        res.json(members);
    } catch (error) {
        console.error("GET MEMBERS ERROR:", error);
        res.status(500).json({ message: "Failed to load members" });
    }
});

// DELETE PERSON FROM THE SELECTED GROUP
router.delete("/members/:id", authenticateToken, async (req, res) => {
    try {
        const memberId = Number(req.params.id);
        if (!Number.isInteger(memberId)) return res.status(400).json({ message: "Invalid member ID" });

        const groupId = await getUserGroupId(req.user.id, req.headers["x-group-id"]);
        if (!groupId) return res.status(404).json({ message: "Group not found" });

        const [members] = await db.query(
            `SELECT id, name FROM group_members WHERE id = ? AND group_id = ?`,
            [memberId, groupId]
        );
        if (!members.length) return res.status(404).json({ message: "Person not found" });

        const personName = members[0].name;

        const [payerExpenses] = await db.query(
            `SELECT ep.expense_id FROM expense_payers ep
             INNER JOIN expenses e ON e.id = ep.expense_id
             WHERE ep.person_name = ? AND e.group_id = ? LIMIT 1`,
            [personName, groupId]
        );
        const [splitExpenses] = await db.query(
            `SELECT es.expense_id FROM expense_splits es
             INNER JOIN expenses e ON e.id = es.expense_id
             WHERE es.person_name = ? AND e.group_id = ? LIMIT 1`,
            [personName, groupId]
        );

        if (payerExpenses.length || splitExpenses.length) {
            return res.status(409).json({
                success: false,
                message: `${personName} cannot be removed because they are already used in an expense. Delete or edit those expenses first.`
            });
        }

        const [result] = await db.query(
            `DELETE FROM group_members WHERE id = ? AND group_id = ?`,
            [memberId, groupId]
        );
        if (!result.affectedRows) return res.status(404).json({ message: "Person could not be removed" });

        res.json({ success: true, message: "Person removed successfully" });
    } catch (error) {
        console.error("DELETE MEMBER ERROR:", error);
        res.status(500).json({ success: false, message: "Failed to remove person" });
    }
});

module.exports = router;
