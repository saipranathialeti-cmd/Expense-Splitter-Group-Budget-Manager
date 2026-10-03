const API_URL = "http://127.0.0.1:5000/api";



// ==========================================
// GROUPS
// ==========================================

let activeGroupId = localStorage.getItem("activeGroupId") || "";

// Add the selected group to all ledger API calls.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, options = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (url && url.startsWith(API_URL) && activeGroupId) {
        const headers = new Headers(options.headers || (typeof input !== "string" ? input.headers : undefined));
        headers.set("X-Group-Id", activeGroupId);
        options = { ...options, headers };
    }
    return nativeFetch(input, options);
};

async function loadGroups(preferredId = activeGroupId) {
    const select = document.getElementById("groupSelect");
    if (!select) return false;

    try {
        const response = await nativeFetch(`${API_URL}/groups`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const groups = await response.json();
        if (!response.ok) throw new Error(groups.message || "Failed to load groups");

        select.innerHTML = "";
        if (!groups.length) {
            activeGroupId = "";
            localStorage.removeItem("activeGroupId");
            select.innerHTML = `<option value="">No groups - create one</option>`;
            return false;
        }

        const validPreferred = groups.some(g => String(g.id) === String(preferredId));
        if (!validPreferred) {
            activeGroupId = String(groups[0].id);
            localStorage.setItem("activeGroupId", activeGroupId);
        }

        groups.forEach(group => {
            const option = document.createElement("option");
            option.value = group.id;
            option.textContent = group.name;
            select.appendChild(option);
        });
        select.value = activeGroupId;
        return true;
    } catch (error) {
        console.error("Load groups error:", error);
        alert("Unable to load groups. Please make sure the backend is running.");
        return false;
    }
}

async function createGroup() {
    const name = prompt("Enter a name for the new group:");
    if (name === null) return;
    const groupName = name.trim();
    if (!groupName) {
        alert("Group name is required.");
        return;
    }

    try {
        const response = await nativeFetch(`${API_URL}/groups`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ name: groupName })
        });
        const data = await response.json();
        if (!response.ok) {
            alert(data.message || "Failed to create group");
            return;
        }

        activeGroupId = String(data.group.id);
        localStorage.setItem("activeGroupId", activeGroupId);
        await loadGroups(activeGroupId);
        await refreshGroupData();
        alert(`Group "${groupName}" created successfully.`);
    } catch (error) {
        console.error("Create group error:", error);
        alert("Cannot connect to backend.");
    }
}

async function refreshGroupData() {
    if (!activeGroupId) {
        currentMembers = [];
        updatePaidBy();
        updateSplitMembers();
        return;
    }
    await loadMembers();
    await loadExpenses();
    await loadBalances();
    await loadSettlementPayments();
}

const createGroupBtn = document.getElementById("createGroupBtn");
if (createGroupBtn) createGroupBtn.addEventListener("click", createGroup);

const groupSelect = document.getElementById("groupSelect");
if (groupSelect) {
    groupSelect.addEventListener("change", async () => {
        activeGroupId = groupSelect.value;
        if (activeGroupId) localStorage.setItem("activeGroupId", activeGroupId);
        else localStorage.removeItem("activeGroupId");
        await refreshGroupData();
    });
}

// ==========================================
// LOGIN DETAILS
// ==========================================

const token =
    localStorage.getItem("token");

const user =
    JSON.parse(
        localStorage.getItem("user") || "null"
    );


// ==========================================
// CHECK LOGIN
// ==========================================

if (!token || !user) {
    window.location.href = "login.html";
}


// ==========================================
// LOGOUT
// ==========================================

const logoutBtn =
    document.getElementById("logoutBtn");

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        () => {

            localStorage.removeItem("token");
            localStorage.removeItem("user");

            window.location.href =
                "login.html";
        }
    );
}


// ==========================================
// MEMBERS
// ==========================================

let currentMembers = [];


// ==========================================
// ADD PERSON
// ==========================================

const addPersonBtn =
    document.getElementById("addPersonBtn");

if (addPersonBtn) {

    addPersonBtn.addEventListener(
        "click",
        async () => {

            const personName =
                document
                    .getElementById("personName")
                    .value
                    .trim();

            if (!personName) {

                alert(
                    "Please enter a person's name"
                );

                return;
            }

            try {

                const response =
                    await fetch(
                        `${API_URL}/groups/members`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                "Authorization":
                                    `Bearer ${token}`
                            },

                            body:
                                JSON.stringify({
                                    name:
                                        personName
                                })
                        }
                    );

                const data =
                    await response.json();

                if (response.ok) {

                    alert(
                        "Person added successfully!"
                    );

                    document
                        .getElementById("personName")
                        .value = "";

                    loadMembers();

                    loadBalances();

                } else {

                    alert(
                        data.message ||
                        "Failed to add person"
                    );
                }

            } catch (error) {

                console.error(
                    "Add person error:",
                    error
                );

                alert(
                    "Cannot connect to backend."
                );
            }
        }
    );
}


// ==========================================
// LOAD MEMBERS
// ==========================================

async function loadMembers() {

    try {

        const response =
            await fetch(
                `${API_URL}/groups/members`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        if (!response.ok) {
            return;
        }

        const members =
            await response.json();

        currentMembers = members;


        // ==================================
        // DISPLAY MEMBERS
        // ==================================

        const membersList =
            document.getElementById(
                "membersList"
            );

        if (membersList) {

            membersList.innerHTML = "";

            if (members.length === 0) {

                membersList.innerHTML =
                    `
                    <p class="empty">
                        No members added yet.
                    </p>
                    `;

            } else {

                members.forEach(
                    member => {

                        const item =
                            document.createElement(
                                "span"
                            );

                        item.className =
                            "person-tag";

                        item.innerHTML =
    `
    <span>
        ${escapeHTML(member.name)}
    </span>

    <button
        class="remove-member"
        title="Remove ${escapeHTML(member.name)}"
        data-id="${escapeHTML(String(member.id))}"
        data-name="${escapeHTML(member.name)}"
        type="button"
    >
        ×
    </button>
    `;

                        membersList.appendChild(item);
                        const removeButton =
    item.querySelector(".remove-member");

removeButton.addEventListener(
    "click",
    async () => {
        const memberId =
            removeButton.dataset.id;

        const memberName =
            removeButton.dataset.name;

        if (!memberId) {
            alert(
                "This person cannot be removed because the backend did not provide an ID."
            );
            return;
        }

        const confirmed = confirm(
            `Remove ${memberName} from this group?`
        );

        if (!confirmed) {
            return;
        }

        try {
            const response =
                await fetch(
                    `${API_URL}/groups/members/${memberId}`,
                    {
                        method: "DELETE",

                        headers: {
                            "Authorization":
                                `Bearer ${token}`
                        }
                    }
                );

            const contentType =
                response.headers.get(
                    "content-type"
                ) || "";

            const responseText =
                await response.text();

            console.log(
                "DELETE MEMBER status:",
                response.status
            );

            console.log(
                "DELETE MEMBER response:",
                responseText
            );

            let data = {};

            if (
                contentType.includes(
                    "application/json"
                )
            ) {
                data =
                    JSON.parse(responseText);
            }

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    `Failed to remove person (${response.status})`
                );
            }

            alert(
                data.message ||
                "Person removed successfully."
            );

            await loadMembers();
            await loadBalances();

        } catch (error) {
            console.error(
                "Delete member error:",
                error
            );

            alert(
                error.message ||
                "Unable to remove person."
            );
        }
    }
);
                    }
                );
            }
        }


        updatePaidBy();

        updateSplitMembers();

    } catch (error) {

        console.error(
            "Load members error:",
            error
        );
    }
}


// ==========================================
// PAID BY DROPDOWN
// ==========================================

function updatePaidBy() {

    const paidBySelect =
        document.getElementById(
            "paidBySelect"
        );

    if (!paidBySelect) {
        return;
    }

    paidBySelect.innerHTML = "";


    if (currentMembers.length === 0) {

        paidBySelect.innerHTML =
            `
            <option value="">
                No members available
            </option>
            `;

        return;
    }


    paidBySelect.innerHTML =
        `
        <option value="">
            Select person
        </option>
        `;


    currentMembers.forEach(
        member => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                member.name;

            option.textContent =
                member.name;

            paidBySelect.appendChild(
                option
            );
        }
    );
}


// ==========================================
// SPLIT MEMBERS
// ==========================================

function updateSplitMembers() {

    const splitMembers =
        document.getElementById(
            "splitMembers"
        );

    if (!splitMembers) {
        return;
    }

    splitMembers.innerHTML = "";


    if (currentMembers.length === 0) {

        splitMembers.innerHTML =
            `
            <p class="empty">
                No members available
            </p>
            `;

        return;
    }


    currentMembers.forEach(
        member => {

            const label =
                document.createElement(
                    "label"
                );

            label.className =
                "member-option";


            const checkbox =
                document.createElement(
                    "input"
                );

            checkbox.type =
                "checkbox";

            checkbox.className =
                "split-member";

            checkbox.value =
                member.name;


            const name =
                document.createElement(
                    "span"
                );

            name.className =
                "member-name";

            name.textContent =
                member.name;


            checkbox.addEventListener(
                "change",
                calculateSplit
            );


            label.appendChild(
                checkbox
            );

            label.appendChild(
                name
            );


            splitMembers.appendChild(
                label
            );
        }
    );
}


// ==========================================
// CALCULATE SPLIT
// ==========================================

function calculateSplit() {

    const amount =
        Number(
            document
                .getElementById(
                    "expenseAmount"
                )
                .value
        );


    const selected =
        document.querySelectorAll(
            ".split-member:checked"
        );


    const preview =
        document.getElementById(
            "splitPreview"
        );


    if (!preview) {
        return;
    }


    if (
        !amount ||
        selected.length === 0
    ) {

        preview.textContent =
            "Select members to see the split amount.";

        return;
    }


    const share =
        amount /
        selected.length;


    preview.textContent =
        `Each person pays: ₹${share.toFixed(2)}`;
}


// ==========================================
// AMOUNT CHANGE
// ==========================================

const expenseAmount =
    document.getElementById(
        "expenseAmount"
    );

if (expenseAmount) {

    expenseAmount.addEventListener(
        "input",
        calculateSplit
    );
}


// ==========================================
// ADD EXPENSE
// ==========================================

const addExpenseBtn =
    document.getElementById(
        "addExpenseBtn"
    );

if (addExpenseBtn) {

    addExpenseBtn.addEventListener(
        "click",
        async () => {

            const description =
                document
                    .getElementById(
                        "expenseDescription"
                    )
                    .value
                    .trim();


            const amount =
                Number(
                    document
                        .getElementById(
                            "expenseAmount"
                        )
                        .value
                );


            const paidBySelect =
                document.getElementById(
                    "paidBySelect"
                );


            const selectedPayer =
                paidBySelect
                    ? paidBySelect.value
                    : "";


            const selectedPayers =
                selectedPayer
                    ? [selectedPayer]
                    : [];


            const selectedMembers =
                Array.from(
                    document.querySelectorAll(
                        ".split-member:checked"
                    )
                ).map(
                    checkbox =>
                        checkbox.value
                );


            // ==================================
            // VALIDATION
            // ==================================

            if (!description) {

                alert(
                    "Please enter expense description"
                );

                return;
            }


            if (
                !amount ||
                amount <= 0
            ) {

                alert(
                    "Please enter a valid amount"
                );

                return;
            }


            if (
                selectedPayers.length === 0
            ) {

                alert(
                    "Please select who paid"
                );

                return;
            }


            if (
                selectedMembers.length === 0
            ) {

                alert(
                    "Please select at least one member"
                );

                return;
            }


            // ==================================
            // SEND TO BACKEND
            // ==================================

            try {

                const response =
                    await fetch(
                        `${API_URL}/expenses`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                "Authorization":
                                    `Bearer ${token}`
                            },

                            body:
                                JSON.stringify({

                                    description:
                                        description,

                                    amount:
                                        amount,

                                    paidBy:
                                        selectedPayers,

                                    splitMembers:
                                        selectedMembers
                                })
                        }
                    );


                const data =
                    await response.json();


                console.log(
                    "Expense response:",
                    data
                );


                // ==================================
                // SUCCESS
                // ==================================

                if (response.ok) {

                    const share =
                        Number(data.share || 0);


                    alert(
                        `Expense added successfully!\nEach person pays: ₹${share.toFixed(2)}`
                    );


                    // CLEAR DESCRIPTION

                    document
                        .getElementById(
                            "expenseDescription"
                        )
                        .value = "";


                    // CLEAR AMOUNT

                    document
                        .getElementById(
                            "expenseAmount"
                        )
                        .value = "";


                    // CLEAR PAID BY

                    if (paidBySelect) {

                        paidBySelect.value =
                            "";
                    }


                    // CLEAR CHECKBOXES

                    document
                        .querySelectorAll(
                            ".split-member"
                        )
                        .forEach(
                            checkbox => {

                                checkbox.checked =
                                    false;
                            }
                        );


                    // RESET PREVIEW

                    const splitPreview =
                        document.getElementById(
                            "splitPreview"
                        );

                    if (splitPreview) {

                        splitPreview.textContent =
                            "Select members to see the split amount.";
                    }


                    // RELOAD

                    await loadExpenses();

                    await loadBalances();

                } else {

                    alert(
                        data.message ||
                        "Failed to add expense"
                    );
                }

            } catch (error) {

                console.error(
                    "ADD EXPENSE ERROR:",
                    error
                );

                alert(
                    "Cannot connect to backend."
                );
            }
        }
    );
}


// ==========================================
// LOAD EXPENSES
// ==========================================

async function loadExpenses() {

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
            return;
        }


        const expenses =
            await response.json();


        const transactionsList =
            document.getElementById(
                "transactionsList"
            );


        if (!transactionsList) {
            return;
        }


        transactionsList.innerHTML = "";


        if (
            !expenses ||
            expenses.length === 0
        ) {

            transactionsList.innerHTML =
                `
                <p class="empty">
                    No transactions yet.
                </p>
                `;

            return;
        }


        // ==================================
        // TABLE
        // ==================================

        const table =
            document.createElement(
                "table"
            );

        table.className =
            "transactions-table";


        table.innerHTML =
            `
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Paid by</th>
                    <th>Split among</th>
                    <th style="text-align:right;">
                        Amount
                    </th>
                    <th></th>
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


                const date =
                    formatDate(
                        expense.date ||
                        expense.created_at ||
                        expense.createdAt
                    );


                const splitMembers =
                    Array.isArray(
                        expense.splitMembers
                    )
                        ? expense.splitMembers.join(
                            ", "
                        )
                        : (
                            expense.split_members ||
                            ""
                        );


                const paidBy =
                    expense.paid_by ||
                    (
                        Array.isArray(
                            expense.paidBy
                        )
                            ? expense.paidBy.join(
                                ", "
                            )
                            : expense.paidBy
                    ) ||
                    "";


                row.innerHTML =
                    `
                    <td>
                        ${escapeHTML(date)}
                    </td>

                    <td>
                        ${escapeHTML(
                            expense.description || ""
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            paidBy
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            splitMembers
                        )}
                    </td>

                    <td class="amount-cell">
                        ₹${formatMoney(
                            expense.amount
                        )}
                    </td>

                    <td>
                        <button
                            class="delete-expense"
                            title="Delete expense"
                            data-id="${escapeHTML(
                                String(
                                    expense.id ||
                                    expense._id ||
                                    ""
                                )
                            )}"
                        >
                            ×
                        </button>
                    </td>
                    `;


                tbody.appendChild(row);
            }
        );


        transactionsList.appendChild(
            table
        );


        // ==================================
        // DELETE BUTTONS
        // ==================================

        document
            .querySelectorAll(
                ".delete-expense"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            const id =
                                button.dataset.id;


                            if (!id) {

                                alert(
                                    "This expense cannot be deleted because the backend did not provide an ID."
                                );

                                return;
                            }


                            const confirmed =
                                confirm(
                                    "Delete this expense?"
                                );


                            if (!confirmed) {
                                return;
                            }


                            await deleteExpense(
                                id
                            );
                        }
                    );
                }
            );

    } catch (error) {

        console.error(
            "Load expenses error:",
            error
        );
    }
}


// ==========================================
// DELETE EXPENSE
// ==========================================

async function deleteExpense(expenseId) {
    const confirmed = confirm(
        "Are you sure you want to delete this transaction?"
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            `${API_URL}/expenses/${expenseId}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            }
        );

        // Don't blindly call response.json()
        const contentType = response.headers.get("content-type") || "";
        const responseText = await response.text();

        console.log("DELETE status:", response.status);
        console.log("DELETE response:", responseText);

        if (!response.ok) {
            throw new Error(
                `Delete failed (${response.status}): ${responseText}`
            );
        }

        let data = {};

        if (contentType.includes("application/json")) {
            data = JSON.parse(responseText);
        }

        alert(data.message || "Transaction deleted successfully.");

        await loadExpenses();
        await loadBalances();

    } catch (error) {
        console.error("Delete expense error:", error);
        alert(error.message || "Unable to delete transaction.");
    }
}


// ==========================================
// LOAD BALANCES
// ==========================================

async function loadBalances() {

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
            return;
        }


        const balances =
            await response.json();


        const balanceList =
            document.getElementById(
                "balanceList"
            );


        if (!balanceList) {
            return;
        }


        balanceList.innerHTML = "";


        if (
            !balances ||
            balances.length === 0
        ) {

            balanceList.innerHTML =
                `
                <p class="empty">
                    No balances yet.
                </p>
                `;

            return;
        }


        // ==================================
        // BALANCE CARDS
        // ==================================

        const grid =
            document.createElement(
                "div"
            );

        grid.className =
            "balance-grid";


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


                const paid =
                    Number(
                        person.paid || 0
                    );


                const share =
                    Number(
                        person.share || 0
                    );


                let statusHTML = "";


                if (balance > 0.005) {

                    statusHTML =
                        `
                        <div class="balance-positive">
                            Gets:
                            ₹${formatMoney(balance)}
                        </div>
                        `;

                } else if (
                    balance < -0.005
                ) {

                    statusHTML =
                        `
                        <div class="balance-negative">
                            Pays:
                            ₹${formatMoney(
                                Math.abs(balance)
                            )}
                        </div>
                        `;

                } else {

                    statusHTML =
                        `
                        <div class="balance-positive">
                            Settled
                        </div>
                        `;
                }


                card.innerHTML =
                    `
                    <div class="balance-name">
                        ${escapeHTML(
                            person.name || ""
                        )}
                    </div>

                    <div class="balance-row">
                        <span>Paid</span>
                        <span>
                            ₹${formatMoney(paid)}
                        </span>
                    </div>

                    <div class="balance-row">
                        <span>Share</span>
                        <span>
                            ₹${formatMoney(share)}
                        </span>
                    </div>

                    ${statusHTML}
                    `;


                grid.appendChild(card);
            }
        );


        balanceList.appendChild(grid);


        // ==================================
        // SETTLEMENTS
        // ==================================

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
                        name: person.name,
                        amount:
                            Number(
                                person.balance
                            )
                    })
                );


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
                        name: person.name,
                        amount:
                            Math.abs(
                                Number(
                                    person.balance
                                )
                            )
                    })
                );


        const settlements =
            calculateSettlements(
                debtors,
                creditors
            );


        if (
            settlements.length > 0
        ) {

            const settlementsContainer =
                document.createElement(
                    "div"
                );

            settlementsContainer.className =
                "settlements";


            const title =
                document.createElement(
                    "div"
                );

            title.className =
                "settlements-title";

            title.textContent =
                "Suggested settlements";


            settlementsContainer.appendChild(
                title
            );


            settlements.forEach(
                settlement => {

                    const row =
                        document.createElement(
                            "div"
                        );

                    row.className =
                        "settlement-row";


                    row.textContent =
                        `${settlement.from} pays ${settlement.to} ₹${formatMoney(settlement.amount)}`;


                    settlementsContainer.appendChild(
                        row
                    );
                }
            );


            balanceList.appendChild(
                settlementsContainer
            );
        }

    } catch (error) {

        console.error(
            "Balance error:",
            error
        );
    }
}


// ==========================================
// CALCULATE SETTLEMENTS
// ==========================================

function calculateSettlements(
    debtors,
    creditors
) {

    const debtorsCopy =
        debtors.map(
            person => ({
                ...person
            })
        );


    const creditorsCopy =
        creditors.map(
            person => ({
                ...person
            })
        );


    const settlements = [];


    let debtorIndex = 0;
    let creditorIndex = 0;


    while (
        debtorIndex <
            debtorsCopy.length &&
        creditorIndex <
            creditorsCopy.length
    ) {

        const debtor =
            debtorsCopy[debtorIndex];

        const creditor =
            creditorsCopy[creditorIndex];


        const amount =
            Math.min(
                debtor.amount,
                creditor.amount
            );


        if (amount > 0.005) {

            settlements.push({

                from:
                    debtor.name,

                to:
                    creditor.name,

                amount:
                    amount
            });
        }


        debtor.amount -= amount;

        creditor.amount -= amount;


        if (
            debtor.amount <= 0.005
        ) {

            debtorIndex++;
        }


        if (
            creditor.amount <= 0.005
        ) {

            creditorIndex++;
        }
    }


    return settlements;
}


// ==========================================
// FORMAT MONEY
// ==========================================

function formatMoney(value) {

    const number =
        Number(value || 0);

    return number.toFixed(2);
}


// ==========================================
// FORMAT DATE
// ==========================================

function formatDate(value) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);
    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}
// =====================================================
// SETTLEMENT PAYMENTS
// =====================================================

async function loadSettlementPayments() {

    try {

        const response = await fetch(
            `${API_URL}/expenses/settlements`,
            {
                headers: {
                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                "Failed to load settlement payments"
            );
        }

        const payments =
            await response.json();


        // -----------------------------------------
        // GET CURRENT BALANCES
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
        // FIND SETTLEMENT CONTAINER
        // -----------------------------------------

        const container =
            document.getElementById(
                "settlementPayments"
            );

        if (!container) {
            return;
        }

        container.innerHTML = "";


        // -----------------------------------------
        // GET SUGGESTED SETTLEMENTS
        // -----------------------------------------

        const creditors =
            balances
                .filter(
                    person =>
                        Number(person.balance || 0)
                        > 0.005
                )
                .map(
                    person => ({
                        name: person.name,
                        amount:
                            Number(person.balance)
                    })
                );


        const debtors =
            balances
                .filter(
                    person =>
                        Number(person.balance || 0)
                        < -0.005
                )
                .map(
                    person => ({
                        name: person.name,
                        amount:
                            Math.abs(
                                Number(
                                    person.balance
                                )
                            )
                    })
                );


        const settlements =
            calculateSettlements(
                debtors,
                creditors
            );


        if (settlements.length === 0) {

            container.innerHTML = `
                <div class="settlements">
                    <div class="settlements-title">
                        Settlement payments
                    </div>

                    <p class="empty">
                        Everyone is settled.
                    </p>
                </div>
            `;

            return;
        }


        // -----------------------------------------
        // BUILD PAYMENT TOTALS
        // -----------------------------------------

        const paymentTotals = {};

        payments.forEach(payment => {

            const key =
                `${payment.from_person}|||${payment.to_person}`;

            if (!paymentTotals[key]) {
                paymentTotals[key] = 0;
            }

            paymentTotals[key] +=
                Number(payment.amount || 0);
        });


        // -----------------------------------------
        // DISPLAY SETTLEMENTS
        // -----------------------------------------

        const wrapper =
            document.createElement("div");

        wrapper.className =
            "settlements";


        const title =
            document.createElement("div");

        title.className =
            "settlements-title";

        title.textContent =
            "Settlement payments";

        wrapper.appendChild(title);


        settlements.forEach(
            settlement => {

                const from =
                    settlement.from ||
                    settlement.debtor;

                const to =
                    settlement.to ||
                    settlement.creditor;

                const owed =
                    Number(
                        settlement.amount || 0
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
                    document.createElement("div");

                card.className =
                    "settlement-payment";


                let statusHTML = "";


                if (remaining > 0.005) {

                    statusHTML = `
                        <div
                            class="settlement-remaining"
                        >
                            Remaining:
                            ₹${formatMoney(
                                remaining
                            )}
                        </div>

                        <button
                            class="settlement-record-btn"
                            data-from="${escapeHTML(from)}"
                            data-to="${escapeHTML(to)}"
                            data-remaining="${remaining}"
                        >
                            Record Payment
                        </button>
                    `;

                } else {

                    statusHTML = `
                        <div
                            class="settlement-remaining settlement-settled"
                        >
                            ✓ Settled
                        </div>
                    `;
                }


                card.innerHTML = `

                    <div
                        class="settlement-payment-title"
                    >
                        ${escapeHTML(from)}
                        →
                        ${escapeHTML(to)}
                    </div>

                    <div
                        class="settlement-payment-row"
                    >
                        <span>Owes</span>

                        <span>
                            ₹${formatMoney(owed)}
                        </span>
                    </div>

                    <div
                        class="settlement-payment-row settlement-paid"
                    >
                        <span>Paid</span>

                        <span>
                            ₹${formatMoney(paid)}
                        </span>
                    </div>

                    ${statusHTML}

                `;


                wrapper.appendChild(card);
            }
        );


        // -----------------------------------------
        // ADD TO PAGE
        // -----------------------------------------

        container.appendChild(wrapper);


        // -----------------------------------------
        // PAYMENT BUTTONS
        // -----------------------------------------

        container
            .querySelectorAll(
                ".settlement-record-btn"
            )
            .forEach(button => {

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
                                `Remaining: ₹${formatMoney(remaining)}\n\n` +
                                `Enter payment amount:`
                            );


                        if (
                            entered === null
                        ) {
                            return;
                        }


                        const amount =
                            Number(entered);


                        if (
                            !Number.isFinite(
                                amount
                            ) ||
                            amount <= 0
                        ) {

                            alert(
                                "Please enter a valid amount."
                            );

                            return;
                        }


                        if (
                            amount >
                            remaining + 0.005
                        ) {

                            alert(
                                `Payment cannot be greater than the remaining amount of ₹${formatMoney(remaining)}.`
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

            });

    } catch (error) {

        console.error(
            "Settlement payment error:",
            error
        );
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
            "Payment recorded successfully!"
        );


        // Reload everything

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

// ==========================================
// INITIAL LOAD
// ==========================================

loadMembers();

loadExpenses();

loadBalances();
loadSettlementPayments();