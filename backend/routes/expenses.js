const express = require("express");
const db = require("../db");
const { authenticateToken, getUserGroupId } = require("../middleware/auth");

const router = express.Router();


// =====================================================
// ADD EXPENSE
// POST /api/expenses
// =====================================================

router.post("/", authenticateToken, async (req, res) => {

    try {

        const {
            description,
            amount,
            paidBy,
            splitMembers
        } = req.body;


        // -----------------------------
        // VALIDATION
        // -----------------------------

        if (!description || !amount) {

            return res.status(400).json({
                message: "Description and amount are required"
            });

        }


        if (!paidBy || !Array.isArray(paidBy) || paidBy.length === 0) {

            return res.status(400).json({
                message: "Select at least one person who paid"
            });

        }


        if (
            !splitMembers ||
            !Array.isArray(splitMembers) ||
            splitMembers.length === 0
        ) {

            return res.status(400).json({
                message: "Select at least one person to split the expense"
            });

        }


        // -----------------------------
        // GET USER'S LATEST GROUP
        // -----------------------------

        const groupId = await getUserGroupId(req.user.id, req.headers["x-group-id"]);


        if (!groupId) {

            return res.status(400).json({
                message: "Please create a group first"
            });

        }




        // -----------------------------
        // CALCULATE SHARE
        // -----------------------------

        const share =
            Number(amount) / splitMembers.length;


        // -----------------------------
        // INSERT EXPENSE
        // -----------------------------

        const [expenseResult] = await db.query(
            `INSERT INTO expenses
             (group_id, description, amount, paid_by, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [
                groupId,
                description,
                amount,
                paidBy.join(", "),
                req.user.id
            ]
        );


        const expenseId = expenseResult.insertId;


        // -----------------------------
        // INSERT PAYERS
        // -----------------------------

        for (const payer of paidBy) {

            await db.query(
                `INSERT INTO expense_payers
                 (expense_id, person_name)
                 VALUES (?, ?)`,
                [
                    expenseId,
                    payer
                ]
            );

        }


        // -----------------------------
        // INSERT SPLIT MEMBERS
        // -----------------------------

        for (const member of splitMembers) {

            await db.query(
                `INSERT INTO expense_splits
                 (expense_id, person_name)
                 VALUES (?, ?)`,
                [
                    expenseId,
                    member
                ]
            );

        }


        // -----------------------------
        // RESPONSE
        // -----------------------------

        return res.status(201).json({

            message:
                "Expense added and split successfully",

            expenseId:
                expenseId,

            share:
                Number(share.toFixed(2))

        });


    } catch (error) {

        console.error(
            "Expense error:",
            error
        );

        return res.status(500).json({
            message: "Failed to add expense"
        });

    }

});


// =====================================================
// GET EXPENSES
// GET /api/expenses
// =====================================================

router.get("/", authenticateToken, async (req, res) => {

    try {

        // -----------------------------
        // GET USER'S LATEST GROUP
        // -----------------------------

        const groupId = await getUserGroupId(req.user.id, req.headers["x-group-id"]);


        if (!groupId) {

            return res.json([]);

        }




        // -----------------------------
        // GET EXPENSES
        // -----------------------------

        const [expenses] = await db.query(
            `SELECT
                 id,
                 description,
                 amount,
                 paid_by,
                 created_at
             FROM expenses
             WHERE group_id = ?
             ORDER BY id DESC`,
            [groupId]
        );


        // -----------------------------
        // GET PAYERS + SPLITS
        // -----------------------------

        for (const expense of expenses) {

            // -------------------------
            // PAYERS
            // -------------------------

            const [payers] = await db.query(
                `SELECT person_name
                 FROM expense_payers
                 WHERE expense_id = ?`,
                [expense.id]
            );


            expense.payers =
                payers.map(
                    payer => payer.person_name
                );


            // -------------------------
            // SPLIT MEMBERS
            // -------------------------

            const [splits] = await db.query(
                `SELECT person_name
                 FROM expense_splits
                 WHERE expense_id = ?`,
                [expense.id]
            );


            expense.splitMembers =
                splits.map(
                    split => split.person_name
                );


            // -------------------------
            // CALCULATE SHARE
            // -------------------------

            if (expense.splitMembers.length > 0) {

                expense.share =
                    Number(
                        (
                            Number(expense.amount) /
                            expense.splitMembers.length
                        ).toFixed(2)
                    );

            } else {

                expense.share = 0;

            }

        }


        return res.json(expenses);


    } catch (error) {

        console.error(
            "Load expenses error:",
            error
        );

        return res.status(500).json({
            message: "Failed to load expenses"
        });

    }

});


// =====================================================
// GET BALANCES
// GET /api/expenses/balances
// =====================================================

router.get("/balances", authenticateToken, async (req, res) => {

    try {

        // -----------------------------
        // GET USER'S LATEST GROUP
        // -----------------------------

        const groupId = await getUserGroupId(req.user.id, req.headers["x-group-id"]);


        if (!groupId) {

            return res.json([]);

        }




        // -----------------------------
        // GET ALL MEMBERS
        // -----------------------------

        const [members] = await db.query(
            `SELECT name
             FROM group_members
             WHERE group_id = ?`,
            [groupId]
        );


        // -----------------------------
        // GET ALL EXPENSES
        // -----------------------------

        const [expenses] = await db.query(
            `SELECT
                 id,
                 amount,
                 paid_by
             FROM expenses
             WHERE group_id = ?`,
            [groupId]
        );


        // -----------------------------
        // INITIALIZE BALANCES
        // -----------------------------

        const balances = {};


        members.forEach(member => {

            balances[member.name] = {

                name: member.name,

                paid: 0,

                share: 0,

                balance: 0

            };

        });


        // -----------------------------
        // PROCESS EXPENSES
        // -----------------------------

        for (const expense of expenses) {

            const amount =
                Number(expense.amount);


            // -------------------------
            // GET SPLIT MEMBERS
            // -------------------------

            const [splits] = await db.query(
                `SELECT person_name
                 FROM expense_splits
                 WHERE expense_id = ?`,
                [expense.id]
            );


            if (splits.length === 0) {
                continue;
            }


            // -------------------------
            // CALCULATE EACH SHARE
            // -------------------------

            const share =
                amount / splits.length;


            // -------------------------
            // ADD SHARE
            // -------------------------

            splits.forEach(split => {

                const name =
                    split.person_name;


                if (balances[name]) {

                    balances[name].share +=
                        share;

                }

            });


            // -------------------------
            // GET PAYERS
            // -------------------------

            const [payers] = await db.query(
                `SELECT person_name
                 FROM expense_payers
                 WHERE expense_id = ?`,
                [expense.id]
            );


            // -------------------------
            // DIVIDE PAYMENT
            // -------------------------

            if (payers.length > 0) {

                const paidAmount =
                    amount / payers.length;


                payers.forEach(payer => {

                    const name =
                        payer.person_name;


                    if (balances[name]) {

                        balances[name].paid +=
                            paidAmount;

                    }

                });

            }

        }


        // -----------------------------
        // FINAL BALANCES
        // -----------------------------

        Object.values(balances).forEach(person => {

            person.paid =
                Number(
                    person.paid.toFixed(2)
                );


            person.share =
                Number(
                    person.share.toFixed(2)
                );


            person.balance =
                Number(
                    (
                        person.paid -
                        person.share
                    ).toFixed(2)
                );

        });


        return res.json(
            Object.values(balances)
        );


    } catch (error) {

        console.error(
            "Balance error:",
            error
        );

        return res.status(500).json({
            message: "Failed to calculate balances"
        });

    }

});


// =====================================================
// DELETE EXPENSE
// DELETE /api/expenses/:id
// =====================================================

router.delete("/:id", authenticateToken, async (req, res) => {

    try {

        const expenseId =
            Number(req.params.id);


        // -----------------------------
        // VALIDATE ID
        // -----------------------------

        if (!Number.isInteger(expenseId)) {

            return res.status(400).json({
                message: "Invalid expense ID"
            });

        }


        // -----------------------------
        // GET USER'S LATEST GROUP
        // -----------------------------

        const groupId = await getUserGroupId(req.user.id, req.headers["x-group-id"]);


        if (!groupId) {

            return res.status(404).json({
                message: "Group not found"
            });

        }




        // -----------------------------
        // CHECK EXPENSE
        // -----------------------------

        const [expenses] = await db.query(
            `SELECT id
             FROM expenses
             WHERE id = ?
             AND group_id = ?`,
            [
                expenseId,
                groupId
            ]
        );


        if (expenses.length === 0) {

            return res.status(404).json({
                message: "Expense not found"
            });

        }


        // -----------------------------
        // DELETE SPLIT MEMBERS
        // -----------------------------

        await db.query(
            `DELETE FROM expense_splits
             WHERE expense_id = ?`,
            [expenseId]
        );


        // -----------------------------
        // DELETE PAYERS
        // -----------------------------

        await db.query(
            `DELETE FROM expense_payers
             WHERE expense_id = ?`,
            [expenseId]
        );


        // -----------------------------
        // DELETE EXPENSE
        // -----------------------------

        const [deleteResult] =
            await db.query(
                `DELETE FROM expenses
                 WHERE id = ?
                 AND group_id = ?`,
                [
                    expenseId,
                    groupId
                ]
            );


        if (deleteResult.affectedRows === 0) {

            return res.status(404).json({
                message: "Expense could not be deleted"
            });

        }


        // -----------------------------
        // SUCCESS
        // -----------------------------

        return res.status(200).json({

            success: true,

            message:
                "Expense deleted successfully",

            expenseId:
                expenseId

        });


    } catch (error) {

        console.error(
            "DELETE EXPENSE ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to delete expense",

            error:
                error.message

        });

    }

});


// =====================================================
// SETTLEMENT PAYMENTS
// =====================================================


// =====================================================
// GET SETTLEMENT PAYMENTS
// GET /api/expenses/settlements
// =====================================================

router.get("/settlements", authenticateToken, async (req, res) => {

    try {

        // -----------------------------
        // GET USER'S LATEST GROUP
        // -----------------------------

        const groupId = await getUserGroupId(req.user.id, req.headers["x-group-id"]);


        if (!groupId) {

            return res.json([]);

        }




        // -----------------------------
        // GET SETTLEMENT PAYMENTS
        // -----------------------------

        const [settlements] = await db.query(
            `SELECT
                 id,
                 from_person,
                 to_person,
                 amount,
                 created_at
             FROM settlements
             WHERE group_id = ?
             ORDER BY id DESC`,
            [groupId]
        );


        return res.json(settlements);


    } catch (error) {

        console.error(
            "Load settlements error:",
            error
        );


        return res.status(500).json({
            message: "Failed to load settlement payments"
        });

    }

});


// =====================================================
// RECORD SETTLEMENT PAYMENT
// POST /api/expenses/settlements
// =====================================================

router.post("/settlements", authenticateToken, async (req, res) => {

    try {

        const {
            fromPerson,
            toPerson,
            amount
        } = req.body;


        // -----------------------------
        // VALIDATION
        // -----------------------------

        if (
            !fromPerson ||
            !toPerson ||
            amount === undefined ||
            amount === null
        ) {

            return res.status(400).json({
                message:
                    "From person, to person and amount are required"
            });

        }


        const paymentAmount =
            Number(amount);


        if (
            !Number.isFinite(paymentAmount) ||
            paymentAmount <= 0
        ) {

            return res.status(400).json({
                message:
                    "Payment amount must be greater than 0"
            });

        }


        if (fromPerson === toPerson) {

            return res.status(400).json({
                message:
                    "A person cannot pay themselves"
            });

        }


        // -----------------------------
        // GET USER'S LATEST GROUP
        // -----------------------------

        const groupId = await getUserGroupId(req.user.id, req.headers["x-group-id"]);


        if (!groupId) {

            return res.status(400).json({
                message:
                    "Please create a group first"
            });

        }




        // -----------------------------
        // CHECK BOTH PEOPLE
        // -----------------------------

        const [members] = await db.query(
            `SELECT name
             FROM group_members
             WHERE group_id = ?
             AND name IN (?, ?)`,
            [
                groupId,
                fromPerson,
                toPerson
            ]
        );


        if (members.length !== 2) {

            return res.status(400).json({
                message:
                    "Both people must belong to the group"
            });

        }


        // -----------------------------
        // INSERT PAYMENT
        // -----------------------------

        const [result] = await db.query(
            `INSERT INTO settlements
             (group_id, from_person, to_person, amount)
             VALUES (?, ?, ?, ?)`,
            [
                groupId,
                fromPerson,
                toPerson,
                paymentAmount
            ]
        );


        return res.status(201).json({

            success: true,

            message:
                "Settlement payment recorded successfully",

            settlementId:
                result.insertId,

            fromPerson:
                fromPerson,

            toPerson:
                toPerson,

            amount:
                Number(paymentAmount.toFixed(2))

        });


    } catch (error) {

        console.error(
            "Record settlement error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to record settlement payment"

        });

    }

});


// =====================================================
// DELETE SETTLEMENT PAYMENT
// DELETE /api/expenses/settlements/:id
// =====================================================

router.delete("/settlements/:id", authenticateToken, async (req, res) => {

    try {

        const settlementId =
            Number(req.params.id);


        // -----------------------------
        // VALIDATE ID
        // -----------------------------

        if (!Number.isInteger(settlementId)) {

            return res.status(400).json({
                message:
                    "Invalid settlement ID"
            });

        }


        // -----------------------------
        // GET USER'S LATEST GROUP
        // -----------------------------

        const groupId = await getUserGroupId(req.user.id, req.headers["x-group-id"]);


        if (!groupId) {

            return res.status(404).json({
                message:
                    "Group not found"
            });

        }




        // -----------------------------
        // DELETE PAYMENT
        // -----------------------------

        const [result] = await db.query(
            `DELETE FROM settlements
             WHERE id = ?
             AND group_id = ?`,
            [
                settlementId,
                groupId
            ]
        );


        if (result.affectedRows === 0) {

            return res.status(404).json({
                message:
                    "Settlement payment not found"
            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Settlement payment deleted successfully",

            settlementId:
                settlementId

        });


    } catch (error) {

        console.error(
            "DELETE SETTLEMENT ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to delete settlement payment"

        });

    }

});


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;