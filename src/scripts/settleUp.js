// src/scripts/settleUp.js

const appState = {
    people: [],
    expenses: [],
    editingExpenseId: null,
    nextGuestNumber: 1,
    lastTransfers: null,
};

const currencyFormatter = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
});

let addPersonBtn, peopleListEl, expenseForm, payerSelect, amountInput, expenseFeedbackEl;
let cancelEditBtn, expensesTbody, balancesListEl, computeBtn, settlementResultsEl, totalAmountEl;

export function init() {
    // Grab elements
    addPersonBtn = document.getElementById("add-person-btn");
    peopleListEl = document.getElementById("people-list");
    expenseForm = document.getElementById("expense-form");
    payerSelect = document.getElementById("expense-payer");
    amountInput = document.getElementById("expense-amount");
    expenseFeedbackEl = document.getElementById("expense-feedback");
    cancelEditBtn = document.getElementById("cancel-edit-btn");
    expensesTbody = document.getElementById("expenses-tbody");
    balancesListEl = document.getElementById("balances-list");
    computeBtn = document.getElementById("compute-btn");
    settlementResultsEl = document.getElementById("settlement-results");
    totalAmountEl = document.getElementById("total-amount");

    if (!addPersonBtn) return;

    addPersonBtn.addEventListener("click", handleAddPerson);
    expenseForm.addEventListener("submit", handleExpenseSubmit);
    cancelEditBtn.addEventListener("click", exitExpenseEditMode);
    computeBtn.addEventListener("click", handleComputeSettlement);

    ensureMinimumPeople(2);
    renderAll();
    updateComputeButtonState();
}

function updateComputeButtonState() {
    const hasExpenses = appState.expenses.length > 0;
    const enoughPeople = appState.people.length >= 2;
    computeBtn.disabled = !(hasExpenses && enoughPeople);
}

function ensureMinimumPeople(count) {
    while (appState.people.length < count) {
        addPerson({ skipRender: true });
    }
}

function addPerson({ name, skipRender = false } = {}) {
    const personName = name ?? `Guest ${appState.nextGuestNumber++}`;
    const person = {
        id: crypto.randomUUID(),
        name: personName,
        createdAt: new Date().toISOString(),
    };
    appState.people.push(person);
    if (!skipRender) {
        triggerUpdate();
        focusOnPerson(person.id);
    }
    return person;
}

function handleAddPerson() {
    addPerson();
}

function focusOnPerson(personId) {
    requestAnimationFrame(() => {
        const input = peopleListEl.querySelector(
            `[data-person-id="${personId}"] input.person-name`
        );
        if (input) {
            input.focus();
            input.select();
        }
    });
}

function handleRenamePerson(personId, newName) {
    const trimmed = newName.trim();
    if (!trimmed) {
        renderPeople(); // Revert to old name
        return;
    }
    const person = appState.people.find((p) => p.id === personId);
    if (person) {
        person.name = trimmed;
        triggerUpdate();
    }
}

function handleDeletePerson(personId) {
    if (isPersonReferenced(personId)) {
        alert("Cannot delete this guest because they are part of an existing expense. Remove their expenses first.");
        return;
    }

    // Filter out the person
    appState.people = appState.people.filter((p) => p.id !== personId);

    // If we drop below 2, add a placeholder
    if (appState.people.length === 0) {
        ensureMinimumPeople(1);
    }

    triggerUpdate();
}

function isPersonReferenced(personId) {
    return appState.expenses.some((expense) => expense.payerId === personId);
}

/* -------------------------------------------------------
   LOGIC & PARSING
   ------------------------------------------------------- */

function handleExpenseSubmit(event) {
    event.preventDefault();
    clearExpenseFeedback();
    if (!appState.people.length) {
        setExpenseFeedback("Add at least one guest first.");
        return;
    }

    const payerId = payerSelect.value;
    const amountRaw = amountInput.value;
    const amountCents = parseAmountToCents(amountRaw);

    if (amountCents === null || amountCents <= 0) {
        setExpenseFeedback("Please enter a valid amount (e.g. 10.50 or 10,50)");
        return;
    }

    if (!appState.people.some((p) => p.id === payerId)) {
        setExpenseFeedback("Invalid payer selected.");
        return;
    }

    if (appState.editingExpenseId) {
        updateExpense(appState.editingExpenseId, {
            payerId,
            amountCents,
        });
    } else {
        addExpense({
            payerId,
            amountCents,
        });
    }

    resetExpenseForm({ keepPayer: true });
    triggerUpdate();
}

// Robust parser for inputs like "10,50", "10.50", "1000", "1.2"
function parseAmountToCents(value) {
    if (!value) return null;
    let clean = value.toString().trim();

    // Replace commas with dots for standardization
    clean = clean.replace(/,/g, '.');

    // Check if it looks like a number
    if (isNaN(clean) || clean === '') return null;

    const floatVal = parseFloat(clean);
    if (floatVal < 0) return null;

    // Convert to integer cents safely
    return Math.round(floatVal * 100);
}

function addExpense({ payerId, amountCents }) {
    const expense = {
        id: crypto.randomUUID(),
        payerId,
        amountCents,
        createdAt: new Date().toISOString(),
    };
    appState.expenses.push(expense);
}

function updateExpense(expenseId, updates) {
    const expense = appState.expenses.find((item) => item.id === expenseId);
    if (!expense) return;
    expense.payerId = updates.payerId;
    expense.amountCents = updates.amountCents;
    exitExpenseEditMode();
}

function enterExpenseEditMode(expense) {
    appState.editingExpenseId = expense.id;
    payerSelect.value = expense.payerId;

    // Convert cents back to readable string
    const euros = Math.floor(expense.amountCents / 100);
    const cents = expense.amountCents % 100;
    amountInput.value = `${euros}.${String(cents).padStart(2, '0')}`;

    const btn = expenseForm.querySelector("button[type='submit']");
    if (btn) btn.textContent = "Update";

    cancelEditBtn.hidden = false;
    expenseForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function exitExpenseEditMode() {
    appState.editingExpenseId = null;
    resetExpenseForm({ keepPayer: true });

    const btn = expenseForm.querySelector("button[type='submit']");
    if (btn) btn.textContent = "Add Expense";

    cancelEditBtn.hidden = true;
}

function resetExpenseForm({ keepPayer } = {}) {
    const currentPayer = payerSelect.value;
    expenseForm.reset();
    if (keepPayer && currentPayer) {
        payerSelect.value = currentPayer;
    } else if (appState.people[0]) {
        payerSelect.value = appState.people[0].id;
    }
}

function setExpenseFeedback(message) {
    expenseFeedbackEl.textContent = message;
}

function clearExpenseFeedback() {
    expenseFeedbackEl.textContent = "";
}

function removeExpense(expenseId) {
    appState.expenses = appState.expenses.filter((expense) => expense.id !== expenseId);
    if (appState.editingExpenseId === expenseId) {
        exitExpenseEditMode();
    }
    triggerUpdate();
}

/* -------------------------------------------------------
   CALCULATIONS
   ------------------------------------------------------- */

function handleComputeSettlement() {
    const financials = computeFinancialSnapshot();
    const hasBalance = financials.balances.some(
        (item) => item.balanceCents !== 0
    );
    if (!financials.totalCents || !hasBalance) {
        renderSettlementResults([], financials, { computed: true });
        appState.lastTransfers = null;
        updateComputeButtonState();
        return;
    }

    const transfers = settleBalances(financials);
    appState.lastTransfers = transfers;
    renderSettlementResults(transfers, financials, { computed: true });
    updateComputeButtonState();
}

function computeFinancialSnapshot(people = appState.people, expenses = appState.expenses) {
    const activePeople = [...people];
    const orderedPeople = activePeople.slice().sort((a, b) => a.id.localeCompare(b.id));

    const totalCents = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
    const paidMap = new Map(activePeople.map((person) => [person.id, 0]));

    for (const expense of expenses) {
        if (paidMap.has(expense.payerId)) {
            paidMap.set(expense.payerId, paidMap.get(expense.payerId) + expense.amountCents);
        }
    }

    // Split Logic: Even split
    const count = orderedPeople.length;
    const sharePerPerson = Math.floor(totalCents / count);
    let remainder = totalCents % count;

    const owedMap = new Map();
    // Distribute remainder 1 cent at a time to first n people
    for (const person of orderedPeople) {
        let amount = sharePerPerson;
        if (remainder > 0) {
            amount += 1;
            remainder--;
        }
        owedMap.set(person.id, amount);
    }

    const balances = activePeople.map((person) => {
        const paidCents = paidMap.get(person.id) ?? 0;
        const owedCents = owedMap.get(person.id) ?? 0;
        return {
            ...person,
            paidCents,
            owedCents,
            balanceCents: paidCents - owedCents,
        };
    });
    return { balances, totalCents };
}

function settleBalances(financials) {
    const { balances } = financials;
    // Deep copy to avoid mutating display state
    const creditors = balances
        .filter((item) => item.balanceCents > 0)
        .map((item) => ({ id: item.id, amountCents: item.balanceCents }));
    const debtors = balances
        .filter((item) => item.balanceCents < 0)
        .map((item) => ({ id: item.id, amountCents: Math.abs(item.balanceCents) }));

    // Sort by magnitude (largest debts settled first usually minimizes transactions)
    creditors.sort((a, b) => b.amountCents - a.amountCents);
    debtors.sort((a, b) => b.amountCents - a.amountCents);

    const transfers = [];

    // Greedy match
    let i = 0; // creditor index
    let j = 0; // debtor index

    while (i < creditors.length && j < debtors.length) {
        let creditor = creditors[i];
        let debtor = debtors[j];

        let amount = Math.min(creditor.amountCents, debtor.amountCents);

        transfers.push({
            fromId: debtor.id,
            toId: creditor.id,
            amountCents: amount
        });

        creditor.amountCents -= amount;
        debtor.amountCents -= amount;

        if (creditor.amountCents === 0) i++;
        if (debtor.amountCents === 0) j++;
    }

    return transfers;
}

function formatCurrency(cents) {
    return currencyFormatter.format(cents / 100);
}

/* -------------------------------------------------------
   RENDERING
   ------------------------------------------------------- */

function triggerUpdate() {
    renderPeople();
    renderPayerOptions();
    renderExpenses();
    renderBalances();
    updateTotalAmount();
    resetSettlementResults();
    updateComputeButtonState();
}

function renderAll() {
    triggerUpdate();
}

function renderPeople() {
    peopleListEl.innerHTML = "";
    const fragment = document.createDocumentFragment();

    appState.people.forEach((person) => {
        const row = document.createElement("li");
        row.className = "person-row";
        row.dataset.personId = person.id;

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.value = person.name;
        nameInput.className = "person-name";
        nameInput.addEventListener("blur", (e) => handleRenamePerson(person.id, e.target.value));
        nameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") nameInput.blur();
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "secondary btn-xs"; // Same classes as expense delete
        deleteBtn.innerHTML = "&times;"; // Same symbol as expense delete
        deleteBtn.title = "Remove Guest";
        deleteBtn.addEventListener("click", () => handleDeletePerson(person.id));

        row.append(nameInput, deleteBtn);
        fragment.appendChild(row);
    });

    peopleListEl.appendChild(fragment);
}

function renderPayerOptions() {
    // Save current selection if possible
    const currentVal = payerSelect.value;
    payerSelect.innerHTML = "";

    appState.people.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        payerSelect.appendChild(opt);
    });

    // Restore selection or default to first
    if (appState.people.some(p => p.id === currentVal)) {
        payerSelect.value = currentVal;
    } else if (appState.people.length > 0) {
        payerSelect.value = appState.people[0].id;
    }
}

function renderExpenses() {
    expensesTbody.innerHTML = "";
    if (!appState.expenses.length) {
        const row = document.createElement("tr");
        row.className = "expenses-empty";
        row.innerHTML = `<td colspan="3">No expenses yet.</td>`;
        expensesTbody.appendChild(row);
        return;
    }

    const fragment = document.createDocumentFragment();
    // Show newest on top? Or oldest? Let's do newest on top.
    const sorted = [...appState.expenses].reverse();

    sorted.forEach((expense) => {
        const tr = document.createElement("tr");

        const tdPayer = document.createElement("td");
        tdPayer.textContent = getPersonName(expense.payerId);

        const tdAmount = document.createElement("td");
        tdAmount.textContent = formatCurrency(expense.amountCents);

        const tdActions = document.createElement("td");
        const actionDiv = document.createElement("div");
        actionDiv.className = "table-actions";

        const btnEdit = document.createElement("button");
        btnEdit.className = "secondary btn-xs";
        btnEdit.textContent = "Edit";
        btnEdit.onclick = () => enterExpenseEditMode(expense);

        const btnDel = document.createElement("button");
        btnDel.className = "secondary btn-xs btn-delete";
        btnDel.innerHTML = "&times;"; // Simple X
        btnDel.title = "Delete Expense";
        btnDel.onclick = () => removeExpense(expense.id);

        actionDiv.append(btnEdit, btnDel);
        tdActions.appendChild(actionDiv);

        tr.append(tdPayer, tdAmount, tdActions);
        fragment.appendChild(tr);
    });
    expensesTbody.appendChild(fragment);
}

function renderBalances() {
    balancesListEl.innerHTML = "";
    const financials = computeFinancialSnapshot();

    financials.balances.forEach(item => {
        const li = document.createElement("li");
        li.className = "balance-item";

        // Apply border color class based on net balance
        if (item.balanceCents > 0) li.classList.add("balance-positive");
        else if (item.balanceCents < 0) li.classList.add("balance-negative");

        // Left side container
        const left = document.createElement("div");
        left.className = "balance-info";

        const nameEl = document.createElement("div");
        nameEl.className = "balance-name";
        nameEl.textContent = item.name;

        const metrics = document.createElement("div");
        metrics.className = "balance-metrics";

        // Paid Badge
        const paidBadge = document.createElement("span");
        paidBadge.className = "metric-badge";
        paidBadge.textContent = `Paid ${formatCurrency(item.paidCents)}`;

        // Owes Badge
        const owesBadge = document.createElement("span");
        owesBadge.className = "metric-badge";
        owesBadge.textContent = `Owes ${formatCurrency(item.owedCents)}`;

        metrics.append(paidBadge, owesBadge);
        left.append(nameEl, metrics);

        // Right side (Net Amount)
        const right = document.createElement("div");
        right.className = "balance-net";

        if (item.balanceCents > 0) {
            right.textContent = `+${formatCurrency(item.balanceCents)}`;
            right.classList.add("text-pos");
        } else if (item.balanceCents < 0) {
            right.textContent = formatCurrency(item.balanceCents); // Format handles negative sign often, but let's ensure visual consistency
            right.classList.add("text-neg");
        } else {
            right.textContent = "Settled";
            right.classList.add("text-muted");
        }

        li.append(left, right);
        balancesListEl.appendChild(li);
    });
}

function renderSettlementResults(transfers, financials, options = {}) {
    settlementResultsEl.innerHTML = "";

    if (!transfers || !transfers.length) {
        const p = document.createElement("p");
        p.className = "settlement-empty";
        const hasBalance = financials?.balances?.some((item) => item.balanceCents !== 0);
        if (options.computed && !hasBalance) {
            p.textContent = "Everything is already settled!";
        } else if (options.computed && hasBalance) {
            // Should logically not happen if transfers is empty but balance exists, unless rounding error < 1 cent
            p.textContent = "Differences are too small to settle.";
        } else {
            p.textContent = "Tap Compute to see who pays whom.";
        }
        settlementResultsEl.appendChild(p);
        return;
    }

    transfers.forEach(t => {
        const row = document.createElement("div");
        row.className = "transfer-line";

        const wrap = document.createElement("div");
        wrap.innerHTML = `
            <strong>${getPersonName(t.fromId)}</strong>
            <span class="transfer-arrow">→</span>
            <strong>${getPersonName(t.toId)}</strong>
        `;

        const amt = document.createElement("span");
        amt.className = "transfer-money";
        amt.textContent = formatCurrency(t.amountCents);

        row.append(wrap, amt);
        settlementResultsEl.appendChild(row);
    });
}

function resetSettlementResults() {
    appState.lastTransfers = null;
    settlementResultsEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "settlement-empty";
    p.textContent = "Tap Compute to calculate transfers.";
    settlementResultsEl.appendChild(p);
}

function updateTotalAmount() {
    const total = appState.expenses.reduce((sum, ex) => sum + ex.amountCents, 0);
    totalAmountEl.textContent = formatCurrency(total);
}

function getPersonName(id) {
    const p = appState.people.find(person => person.id === id);
    return p ? p.name : "Unknown";
}