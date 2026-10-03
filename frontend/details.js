const API_URL = "http://127.0.0.1:5000/api";


// =====================================================
// LOGIN DETAILS
// =====================================================

const token =
    localStorage.getItem("token");

const user =
    JSON.parse(
        localStorage.getItem("user") || "null"
    );


// =====================================================
// CHECK LOGIN
// =====================================================

if (!token || !user) {

    window.location.href =
        "login.html";

}


// =====================================================
// WELCOME MESSAGE
// =====================================================

const welcomeMessage =
    document.getElementById(
        "welcomeMessage"
    );


if (welcomeMessage && user) {

    welcomeMessage.textContent =
        `Hello, ${user.name}`;

}


// =====================================================
// LOGOUT
// =====================================================

const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );


if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        () => {

            localStorage.removeItem(
                "token"
            );

            localStorage.removeItem(
                "user"
            );

            window.location.href =
                "login.html";

        }
    );

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// =====================================================
// FORMAT MONEY
// =====================================================

function formatMoney(value) {

    return Number(
        value || 0
    ).toFixed(2);

}


// =====================================================
// LOAD TRANSACTIONS
// =====================================================

async function loadTransactions() {

    const container =
        document.getElementById(
            "transactionsContainer"
        );


    if (!container) return;


    try {

        const response =
            await fetch(
                `${API_URL}/expenses`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        if (!response.ok) {

            container.innerHTML = `
                <p class="empty">
                    Failed to load transactions.
                </p>
            `;

            return;

        }


        const expenses =
            await response.json();


        if (
            !Array.isArray(expenses) ||
            expenses.length === 0
        ) {

            container.innerHTML = `
                <p class="empty">
                    No transactions yet.
                </p>
            `;

            return;

        }


        const table =
            document.createElement(
                "table"
            );

        table.className =
            "transactions-table";


        table.innerHTML = `

            <thead>

                <tr>

                    <th>
                        Description
                    </th>

                    <th>
                        Amount
                    </th>

                    <th>
                        Paid By
                    </th>

                    <th>
                        Split Among
                    </th>

                    <th>
                        Each Person
                    </th>

                    <th>
                        Action
                    </th>

                </tr>

            </thead>

            <tbody></tbody>

        `;


        const tbody =
            table.querySelector(
                "tbody"
            );


        expenses.forEach(
            expense => {

                const row =
                    document.createElement(
                        "tr"
                    );


                const payers =
                    Array.isArray(
                        expense.payers
                    )
                        ? expense.payers.join(
                            ", "
                        )
                        : expense.paid_by || "-";


                const splitMembers =
                    Array.isArray(
                        expense.splitMembers
                    )
                        ? expense.splitMembers.join(
                            ", "
                        )
                        : "-";


                const share =
                    Number(
                        expense.share || 0
                    );


                row.innerHTML = `

                    <td>
                        ${escapeHTML(
                            expense.description
                        )}
                    </td>

                    <td class="amount">
                        ₹${formatMoney(
                            expense.amount
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            payers
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            splitMembers
                        )}
                    </td>

                    <td>
                        ₹${formatMoney(
                            share
                        )}
                    </td>

                    <td>

                        <button
                            class="delete-btn"
                            data-id="${expense.id}"
                        >
                            Delete
                        </button>

                    </td>

                `;


                tbody.appendChild(
                    row
                );

            }
        );


        container.innerHTML = "";

        container.appendChild(
            table
        );


        // DELETE BUTTONS

        container
            .querySelectorAll(
                ".delete-btn"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            const expenseId =
                                button.dataset.id;


                            const confirmDelete =
                                confirm(
                                    "Are you sure you want to delete this transaction?"
                                );


                            if (
                                !confirmDelete
                            ) {
                                return;
                            }


                            await deleteExpense(
                                expenseId
                            );

                        }
                    );

                }
            );


    } catch (error) {

        console.error(
            "Transactions error:",
            error
        );


        container.innerHTML = `
            <p class="empty">
                Cannot connect to backend.
            </p>
        `;

    }

}


// =====================================================
// DELETE EXPENSE
// =====================================================

async function deleteExpense(
    expenseId
) {

    try {

        const response =
            await fetch(
                `${API_URL}/expenses/${expenseId}`,
                {
                    method: "DELETE",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message ||
                "Failed to delete transaction"
            );

            return;

        }


        alert(
            "Transaction deleted successfully."
        );


        await loadTransactions();

        await loadBalances();

        await loadSettlementPayments();


    } catch (error) {

        console.error(
            "Delete expense error:",
            error
        );


        alert(
            "Cannot connect to backend."
        );

    }

}


// =====================================================
// LOAD BALANCES
// =====================================================

async function loadBalances() {

    const container =
        document.getElementById(
            "balanceContainer"
        );


    if (!container) return;


    try {

        const response =
            await fetch(
                `${API_URL}/expenses/balances`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        if (!response.ok) {

            container.innerHTML = `
                <p class="empty">
                    Failed to load balances.
                </p>
            `;

            return;

        }


        const balances =
            await response.json();


        if (
            !Array.isArray(balances) ||
            balances.length === 0
        ) {

            container.innerHTML = `
                <p class="empty">
                    No balances yet.
                </p>
            `;

            return;

        }


        container.innerHTML = "";


        balances.forEach(
            person => {

                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    "balance-person";


                const balance =
                    Number(
                        person.balance || 0
                    );


                let resultHTML;


                if (balance > 0.005) {

                    resultHTML = `

                        <div
                            class="balance-result gets"
                        >
                            Gets:
                            ₹${formatMoney(
                                balance
                            )}
                        </div>

                    `;

                } else if (
                    balance < -0.005
                ) {

                    resultHTML = `

                        <div
                            class="balance-result pays"
                        >
                            Pays:
                            ₹${formatMoney(
                                Math.abs(
                                    balance
                                )
                            )}
                        </div>

                    `;

                } else {

                    resultHTML = `

                        <div
                            class="balance-result settled"
                        >
                            Settled
                        </div>

                    `;

                }


                card.innerHTML = `

                    <div class="balance-name">

                        ${escapeHTML(
                            person.name
                        )}

                    </div>


                    <div class="balance-row">

                        <span>
                            Paid
                        </span>

                        <strong>
                            ₹${formatMoney(
                                person.paid
                            )}
                        </strong>

                    </div>


                    <div class="balance-row">

                        <span>
                            Share
                        </span>

                        <strong>
                            ₹${formatMoney(
                                person.share
                            )}
                        </strong>

                    </div>


                    ${resultHTML}

                `;


                container.appendChild(
                    card
                );

            }
        );


    } catch (error) {

        console.error(
            "Balance error:",
            error
        );


        container.innerHTML = `
            <p class="empty">
                Cannot connect to backend.
            </p>
        `;

    }

}


// =====================================================
// CALCULATE SETTLEMENTS
// =====================================================

function calculateSettlements(
    debtors,
    creditors
) {

    const result = [];


    const debtorList =
        debtors.map(
            person => ({
                name: person.name,
                amount: Number(
                    person.amount
                )
            })
        );


    const creditorList =
        creditors.map(
            person => ({
                name: person.name,
                amount: Number(
                    person.amount
                )
            })
        );


    let debtorIndex = 0;

    let creditorIndex = 0;


    while (
        debtorIndex <
            debtorList.length &&
        creditorIndex <
            creditorList.length
    ) {

        const debtor =
            debtorList[debtorIndex];

        const creditor =
            creditorList[creditorIndex];


        const payment =
            Math.min(
                debtor.amount,
                creditor.amount
            );


        if (payment > 0.005) {

            result.push({

                from:
                    debtor.name,

                to:
                    creditor.name,

                amount:
                    Number(
                        payment.toFixed(2)
                    )

            });

        }


        debtor.amount -= payment;

        creditor.amount -= payment;


        if (
            debtor.amount <=
            0.005
        ) {

            debtorIndex++;

        }


        if (
            creditor.amount <=
            0.005
        ) {

            creditorIndex++;

        }

    }


    return result;

}


// =====================================================
// LOAD SETTLEMENT PAYMENTS
// =====================================================

async function loadSettlementPayments() {

    const container =
        document.getElementById(
            "settlementContainer"
        );


    if (!container) return;


    try {

        // -----------------------------------------
        // GET BALANCES
        // -----------------------------------------

        const balanceResponse =
            await fetch(
                `${API_URL}/expenses/balances`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        if (!balanceResponse.ok) {

            throw new Error(
                "Failed to load balances"
            );

        }


        const balances =
            await balanceResponse.json();


        // -----------------------------------------
        // GET PAYMENT HISTORY
        // -----------------------------------------

        const paymentResponse =
            await fetch(
                `${API_URL}/expenses/settlements`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        if (!paymentResponse.ok) {

            throw new Error(
                "Failed to load payments"
            );

        }


        const payments =
            await paymentResponse.json();


        // -----------------------------------------
        // CREATE CREDITORS
        // -----------------------------------------

        const creditors =
            balances
                .filter(
                    person =>
                        Number(
                            person.balance || 0
                        ) > 0.005
                )
                .map(
                    person => ({
                        name:
                            person.name,

                        amount:
                            Number(
                                person.balance
                            )
                    })
                );


        // -----------------------------------------
        // CREATE DEBTORS
        // -----------------------------------------

        const debtors =
            balances
                .filter(
                    person =>
                        Number(
                            person.balance || 0
                        ) < -0.005
                )
                .map(
                    person => ({
                        name:
                            person.name,

                        amount:
                            Math.abs(
                                Number(
                                    person.balance
                                )
                            )
                    })
                );


        // -----------------------------------------
        // CALCULATE WHO SHOULD PAY WHOM
        // -----------------------------------------

        const settlements =
            calculateSettlements(
                debtors,
                creditors
            );


        // -----------------------------------------
        // CALCULATE PREVIOUS PAYMENTS
        // -----------------------------------------

        const paymentTotals = {};


        payments.forEach(
            payment => {

                const key =
                    `${payment.from_person}|||${payment.to_person}`;


                if (
                    !paymentTotals[key]
                ) {

                    paymentTotals[key] = 0;

                }


                paymentTotals[key] +=
                    Number(
                        payment.amount || 0
                    );

            }
        );


        // -----------------------------------------
        // DISPLAY CONTAINER
        // -----------------------------------------

        container.innerHTML = "";


        // -----------------------------------------
        // NO SETTLEMENTS
        // -----------------------------------------

        if (
            settlements.length === 0
        ) {

            container.innerHTML = `

                <p class="empty">
                    Everyone is settled. No payment is required.
                </p>

            `;

        } else {

            const list =
                document.createElement(
                    "div"
                );

            list.className =
                "settlement-list";


            settlements.forEach(
                settlement => {

                    const from =
                        settlement.from;

                    const to =
                        settlement.to;

                    const owed =
                        Number(
                            settlement.amount
                        );


                    const key =
                        `${from}|||${to}`;


                    const paid =
                        Number(
                            paymentTotals[key] || 0
                        );


                    const remaining =
                        Math.max(
                            0,
                            owed - paid
                        );


                    const card =
                        document.createElement(
                            "div"
                        );

                    card.className =
                        "settlement-card";


                    let bottomHTML;


                    if (
                        remaining > 0.005
                    ) {

                        bottomHTML = `

                            <div class="remaining">

                                Remaining:
                                ₹${formatMoney(
                                    remaining
                                )}

                            </div>


                            <button
                                class="record-payment-btn"
                                data-from="${escapeHTML(from)}"
                                data-to="${escapeHTML(to)}"
                                data-remaining="${remaining}"
                            >
                                Record Payment
                            </button>

                        `;

                    } else {

                        bottomHTML = `

                            <div
                                class="remaining settled-payment"
                            >
                                ✓ Settled
                            </div>

                        `;

                    }


                    card.innerHTML = `

                        <div class="settlement-title">

                            ${escapeHTML(from)}

                            →

                            ${escapeHTML(to)}

                        </div>


                        <div class="settlement-row">

                            <span>
                                Owes
                            </span>

                            <strong>
                                ₹${formatMoney(
                                    owed
                                )}
                            </strong>

                        </div>


                        <div class="settlement-row">

                            <span>
                                Paid
                            </span>

                            <strong>
                                ₹${formatMoney(
                                    paid
                                )}
                            </strong>

                        </div>


                        ${bottomHTML}

                    `;


                    list.appendChild(
                        card
                    );

                }
            );


            container.appendChild(
                list
            );

        }


        // -----------------------------------------
        // PAYMENT HISTORY
        // -----------------------------------------

        const historyTitle =
            document.createElement(
                "h3"
            );

        historyTitle.className =
            "history-title";

        historyTitle.textContent =
            "Payment History";


        container.appendChild(
            historyTitle
        );


        if (
            !Array.isArray(payments) ||
            payments.length === 0
        ) {

            const empty =
                document.createElement(
                    "p"
                );

            empty.className =
                "empty";

            empty.textContent =
                "No settlement payments recorded yet.";

            container.appendChild(
                empty
            );

        } else {

            const history =
                document.createElement(
                    "div"
                );

            history.className =
                "payment-history";


            // Header

            const header =
                document.createElement(
                    "div"
                );

            header.className =
                "payment-history-row payment-history-header";


            header.innerHTML = `

                <div>
                    From
                </div>

                <div>
                    To
                </div>

                <div>
                    Amount
                </div>

                <div>
                    Action
                </div>

            `;


            history.appendChild(
                header
            );


            payments.forEach(
                payment => {

                    const row =
                        document.createElement(
                            "div"
                        );

                    row.className =
                        "payment-history-row";


                    row.innerHTML = `

                        <div>
                            ${escapeHTML(
                                payment.from_person
                            )}
                        </div>

                        <div>
                            ${escapeHTML(
                                payment.to_person
                            )}
                        </div>

                        <div>
                            ₹${formatMoney(
                                payment.amount
                            )}
                        </div>

                        <div>

                            <button
                                class="delete-payment"
                                data-id="${payment.id}"
                            >
                                Delete
                            </button>

                        </div>

                    `;


                    history.appendChild(
                        row
                    );

                }
            );


            container.appendChild(
                history
            );


            // DELETE PAYMENT BUTTONS

            history
                .querySelectorAll(
                    ".delete-payment"
                )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            async () => {

                                const paymentId =
                                    button.dataset.id;


                                const confirmDelete =
                                    confirm(
                                        "Delete this settlement payment?"
                                    );


                                if (
                                    !confirmDelete
                                ) {

                                    return;

                                }


                                await deleteSettlementPayment(
                                    paymentId
                                );

                            }
                        );

                    }
                );

        }


        // -----------------------------------------
        // RECORD PAYMENT BUTTONS
        // -----------------------------------------

        container
            .querySelectorAll(
                ".record-payment-btn"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            const from =
                                button.dataset.from;

                            const to =
                                button.dataset.to;

                            const remaining =
                                Number(
                                    button.dataset.remaining
                                );


                            const entered =
                                prompt(
                                    `${from} is paying ${to}.\n\n` +
                                    `Remaining: ₹${formatMoney(
                                        remaining
                                    )}\n\n` +
                                    `Enter payment amount:`
                                );


                            if (
                                entered === null
                            ) {

                                return;

                            }


                            const amount =
                                Number(
                                    entered
                                );


                            if (
                                !Number.isFinite(
                                    amount
                                ) ||
                                amount <= 0
                            ) {

                                alert(
                                    "Please enter a valid payment amount."
                                );

                                return;

                            }


                            if (
                                amount >
                                remaining + 0.005
                            ) {

                                alert(
                                    `Payment cannot be greater than ₹${formatMoney(
                                        remaining
                                    )}.`
                                );

                                return;

                            }


                            await recordSettlementPayment(
                                from,
                                to,
                                amount
                            );

                        }
                    );

                }
            );


    } catch (error) {

        console.error(
            "Settlement error:",
            error
        );


        container.innerHTML = `

            <p class="empty">
                Cannot connect to backend.
            </p>

        `;

    }

}


// =====================================================
// RECORD SETTLEMENT PAYMENT
// =====================================================

async function recordSettlementPayment(
    fromPerson,
    toPerson,
    amount
) {

    try {

        const response =
            await fetch(
                `${API_URL}/expenses/settlements`,
                {
                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body: JSON.stringify({

                        fromPerson:
                            fromPerson,

                        toPerson:
                            toPerson,

                        amount:
                            amount

                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message ||
                "Failed to record payment"
            );

            return;

        }


        alert(
            "Settlement payment recorded successfully!"
        );


        await loadBalances();

        await loadSettlementPayments();

    } catch (error) {

        console.error(
            "Record payment error:",
            error
        );


        alert(
            "Cannot connect to backend."
        );

    }

}


// =====================================================
// DELETE SETTLEMENT PAYMENT
// =====================================================

async function deleteSettlementPayment(
    paymentId
) {

    try {

        const response =
            await fetch(
                `${API_URL}/expenses/settlements/${paymentId}`,
                {
                    method: "DELETE",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message ||
                "Failed to delete payment"
            );

            return;

        }


        alert(
            "Settlement payment deleted."
        );


        await loadBalances();

        await loadSettlementPayments();


    } catch (error) {

        console.error(
            "Delete payment error:",
            error
        );


        alert(
            "Cannot connect to backend."
        );

    }

}


// =====================================================
// INITIAL LOAD
// =====================================================

loadTransactions();

loadBalances();

loadSettlementPayments();