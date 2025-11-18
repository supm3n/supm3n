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

    if (!addPersonBtn) return; // Safety check if elements aren't loaded

    addPersonBtn.addEventListener("click", handleAddPerson);
    expenseForm.addEventListener("submit", handleExpenseSubmit);
    cancelEditBtn.addEventListener("click", exitExpenseEditMode);
    computeBtn.addEventListener("click", handleComputeSettlement);

    ensureMinimumPeople(2);
    renderAll();
    updateComputeButtonState();

    window.runTests = runTests;
    console.log("SettleUp loaded");
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
        afterPeopleChanged();
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
        return renderPeople();
    }
    const person = appState.people.find((p) => p.id === personId);
    if (person) {
        person.name = trimmed;
        renderPeople();
        renderExpenses();
        renderBalances();
        resetSettlementResults();
        updateComputeButtonState();
    }
}

function handleDeletePerson(personId) {
    if (isPersonReferenced(personId)) {
        return;
    }
    const person = appState.people.find((p) => p.id === personId);
    if (!person) return;
    appState.people = appState.people.filter((p) => p.id !== personId);
    if (appState.people.length === 0) {
        ensureMinimumPeople(1);
    }
    afterPeopleChanged();
    if (
        appState.editingExpenseId &&
        !appState.people.find((p) => p.id === payerSelect.value)
    ) {
        exitExpenseEditMode();
    }
}

function isPersonReferenced(personId) {
    return appState.expenses.some((expense) => expense.payerId === personId);
}

function handleExpenseSubmit(event) {
    event.preventDefault();
    clearExpenseFeedback();
    if (!appState.people.length) {
        setExpenseFeedback("Add at least one guest before recording expenses.");
        return;
    }

    const payerId = payerSelect.value;
    const amountRaw = amountInput.value;
    const amountCents = parseAmountToCents(amountRaw);
    if (amountCents === null || amountCents <= 0) {
        setExpenseFeedback("Enter a valid amount greater than zero.");
        return;
    }

    if (!appState.people.some((p) => p.id === payerId)) {
        setExpenseFeedback("Select a valid payer.");
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
    afterExpensesChanged();
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
    amountInput.value = formatAmountInput(expense.amountCents);
    expenseForm.querySelector("#submit-expense-btn").textContent = "Update Expense";
    cancelEditBtn.hidden = false;
    expenseForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function exitExpenseEditMode() {
    appState.editingExpenseId = null;
    resetExpenseForm({ keepPayer: true });
    expenseForm.querySelector("#submit-expense-btn").textContent = "Add Expense";
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
}

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
    const orderedPeople = activePeople.slice().sort(compareByCreatedAtAndId);
    const orderLookup = new Map(orderedPeople.map((person, index) => [person.id, index]));
    const totalCents = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
    const paidMap = new Map(activePeople.map((person) => [person.id, 0]));
    for (const expense of expenses) {
        if (paidMap.has(expense.payerId)) {
            paidMap.set(expense.payerId, paidMap.get(expense.payerId) + expense.amountCents);
        }
    }

    const owedMap = computeOwedMap(totalCents, orderedPeople);
    const balances = activePeople.map((person) => {
        const paidCents = paidMap.get(person.id) ?? 0;
        const owedCents = owedMap.get(person.id) ?? 0;
        return {
            ...person,
            paidCents,
            owedCents,
            balanceCents: paidCents - owedCents,
            orderIndex: orderLookup.get(person.id) ?? 0,
        };
    });
    return { balances, totalCents, orderedPeople, orderLookup };
}

function computeOwedMap(totalCents, orderedPeople) {
    const owed = new Map();
    if (!orderedPeople.length) {
        return owed;
    }
    const share = Math.floor(totalCents / orderedPeople.length);
    let remainder = totalCents - share * orderedPeople.length;
    for (const person of orderedPeople) {
        const extra = remainder > 0 ? 1 : 0;
        owed.set(person.id, share + extra);
        if (remainder > 0) remainder -= 1;
    }
    return owed;
}

function settleBalances(financials) {
    const { balances, orderLookup } = financials;
    const creditors = balances
        .filter((item) => item.balanceCents > 0)
        .map((item) => ({ id: item.id, amountCents: item.balanceCents }));
    const debtors = balances
        .filter((item) => item.balanceCents < 0)
        .map((item) => ({ id: item.id, amountCents: Math.abs(item.balanceCents) }));
    const tieBreaker = (aId, bId) => {
        const diff = (orderLookup.get(aId) ?? 0) - (orderLookup.get(bId) ?? 0);
        if (diff !== 0) return diff;
        return aId.localeCompare(bId);
    };

    const sortByMagnitude = (a, b) => b.amountCents - a.amountCents || tieBreaker(a.id, b.id);

    creditors.sort(sortByMagnitude);
    debtors.sort(sortByMagnitude);

    const transfers = [];
    let guard = 0;
    while (creditors.length && debtors.length && guard < 1000) {
        creditors.sort(sortByMagnitude);
        debtors.sort(sortByMagnitude);
        const creditor = creditors[0];
        const debtor = debtors[0];
        const transferAmount = Math.min(creditor.amountCents, debtor.amountCents);
        transfers.push({ fromId: debtor.id, toId: creditor.id, amountCents: transferAmount });
        creditor.amountCents -= transferAmount;
        debtor.amountCents -= transferAmount;
        if (creditor.amountCents === 0) {
            creditors.shift();
        }
        if (debtor.amountCents === 0) {
            debtors.shift();
        }
        guard += 1;
    }

    const positiveTotal = balances
        .filter((item) => item.balanceCents > 0)
        .reduce((sum, item) => sum + item.balanceCents, 0);
    const transferredTotal = transfers.reduce((sum, transfer) => sum + transfer.amountCents, 0);
    const residual = positiveTotal - transferredTotal;
    if (residual !== 0 && transfers.length) {
        const last = transfers[transfers.length - 1];
        const adjusted = last.amountCents + residual;
        if (adjusted > 0) {
            last.amountCents = adjusted;
        }
    }
    return transfers;
}

function parseAmountToCents(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalised = trimmed.replace(/,/g, ".").replace(/\s+/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;
    const [eurosPart, decimalPartRaw = ""] = normalised.split(".");
    const euros = Number.parseInt(eurosPart, 10);
    if (Number.isNaN(euros)) return null;
    let decimalPart = decimalPartRaw.slice(0, 2);
    while (decimalPart.length < 2) {
        decimalPart += "0";
    }
    const cents = decimalPart ? Number.parseInt(decimalPart, 10) : 0;
    if (Number.isNaN(cents)) return null;
    return euros * 100 + cents;
}

function formatCurrency(cents) {
    return currencyFormatter.format(cents / 100);
}

function formatAmountInput(cents) {
    const euros = Math.trunc(cents / 100);
    const remainder = Math.abs(cents % 100);
    return `${euros},${String(remainder).padStart(2, "0")}`;
}

function compareByCreatedAtAndId(a, b) {
    if (a.createdAt < b.createdAt) return -1;
    if (a.createdAt > b.createdAt) return 1;
    return a.id.localeCompare(b.id);
}

function renderAll() {
    renderPeople();
    renderPayerOptions();
    renderExpenses();
    renderBalances();
    updateTotalAmount();
    resetSettlementResults();
}

function afterPeopleChanged() {
    renderPeople();
    renderPayerOptions();
    renderExpenses();
    renderBalances();
    updateTotalAmount();
    resetSettlementResults();
    updateComputeButtonState();
}

function afterExpensesChanged() {
    renderExpenses();
    renderBalances();
    updateTotalAmount();
    resetSettlementResults();
    updateComputeButtonState();
}

function renderPeople() {
    peopleListEl.innerHTML = "";
    if (!appState.people.length) {
        const empty = document.createElement("li");
        empty.textContent = "Add guests to get started.";
        empty.className = "person-meta";
        peopleListEl.appendChild(empty);
        return;
    }

    const fragment = document.createDocumentFragment();
    for (const person of appState.people) {
        const row = document.createElement("li");
        row.className = "person-row";
        row.dataset.personId = person.id;

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.value = person.name;
        nameInput.className = "person-name";
        nameInput.setAttribute("aria-label", `Name for ${person.name}`);
        nameInput.addEventListener("blur", (event) =>
            handleRenamePerson(person.id, event.target.value)
        );
        nameInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                nameInput.blur();
            } else if (event.key === "Escape") {
                event.preventDefault();
                nameInput.value = person.name;
                nameInput.blur();
            }
        });
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "secondary";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => handleDeletePerson(person.id));
        const referenced = isPersonReferenced(person.id);
        if (referenced) {
            deleteBtn.disabled = true;
            deleteBtn.title = "Delete disabled: referenced by expenses.";
        } else {
            deleteBtn.title = "Remove this guest.";
        }

        row.appendChild(nameInput);
        row.appendChild(deleteBtn);
        fragment.appendChild(row);
    }
    peopleListEl.appendChild(fragment);
}

function renderPayerOptions() {
    payerSelect.innerHTML = "";
    for (const person of appState.people) {
        const option = document.createElement("option");
        option.value = person.id;
        option.textContent = person.name;
        payerSelect.appendChild(option);
    }
    if (appState.people.length) {
        if (!appState.people.some((person) => person.id === payerSelect.value)) {
            payerSelect.value = appState.people[0].id;
        }
    }
}

function renderExpenses() {
    expensesTbody.innerHTML = "";
    if (!appState.expenses.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 3;
        cell.className = "expenses-empty";
        cell.textContent = "No expenses recorded yet.";
        row.appendChild(cell);
        expensesTbody.appendChild(row);
        return;
    }

    const fragment = document.createDocumentFragment();
    const sortedExpenses = [...appState.expenses].sort((a, b) => {
        if (a.createdAt === b.createdAt) return a.id.localeCompare(b.id);
        return a.createdAt > b.createdAt ? -1 : 1;
    });
    for (const expense of sortedExpenses) {
        const tr = document.createElement("tr");
        const payerCell = document.createElement("td");
        payerCell.textContent = getPersonName(expense.payerId);

        const amountCell = document.createElement("td");
        amountCell.textContent = formatCurrency(expense.amountCents);

        const actionsCell = document.createElement("td");
        actionsCell.className = "actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "secondary";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => enterExpenseEditMode(expense));
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "secondary";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => {
            if (window.confirm("Delete this expense?")) {
                removeExpense(expense.id);
                afterExpensesChanged();
            }
        });
        actionsCell.append(editBtn, deleteBtn);

        tr.append(payerCell, amountCell, actionsCell);
        fragment.appendChild(tr);
    }
    expensesTbody.appendChild(fragment);
}

function renderBalances() {
    balancesListEl.innerHTML = "";
    if (!appState.people.length) {
        return;
    }
    const financials = computeFinancialSnapshot();
    for (const item of financials.balances) {
        const li = document.createElement("li");
        li.className = "balance-item";
        if (item.balanceCents > 0) {
            li.classList.add("balance-positive");
        } else if (item.balanceCents < 0) {
            li.classList.add("balance-negative");
        }

        const name = document.createElement("span");
        name.className = "balance-name";
        name.textContent = item.name;

        const meta = document.createElement("div");
        meta.className = "balance-meta";

        const paid = document.createElement("span");
        paid.textContent = `Paid ${formatCurrency(item.paidCents)}`;
        const owed = document.createElement("span");
        owed.textContent = `Owes ${formatCurrency(item.owedCents)}`;

        const balanceAmount = document.createElement("span");
        balanceAmount.className = "balance-amount";
        balanceAmount.textContent = formatCurrency(item.balanceCents);
        meta.append(paid, owed, balanceAmount);
        li.append(name, meta);
        balancesListEl.appendChild(li);
    }
}

function renderSettlementResults(transfers, financials, options = {}) {
    settlementResultsEl.innerHTML = "";
    if (!transfers || !transfers.length) {
        const p = document.createElement("p");
        p.className = "settlement-empty";
        const hasBalance = financials?.balances?.some((item) => item.balanceCents !== 0);
        if (options.computed || hasBalance) {
            p.textContent = "Nothing to settle.";
        } else {
            p.textContent = "Tap Compute to see who should pay whom.";
        }
        settlementResultsEl.appendChild(p);
        return;
    }

    for (const transfer of transfers) {
        const line = document.createElement("div");
        line.className = "transfer-line";

        const names = document.createElement("span");
        names.className = "transfer-names";
        names.textContent = `${getPersonName(transfer.fromId)} → ${getPersonName(transfer.toId)}`;
        const amount = document.createElement("span");
        amount.className = "transfer-amount";
        amount.textContent = formatCurrency(transfer.amountCents);

        line.append(names, amount);
        settlementResultsEl.appendChild(line);
    }
}

function resetSettlementResults() {
    appState.lastTransfers = null;
    settlementResultsEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "settlement-empty";
    p.textContent = "Tap Compute to see who should pay whom.";
    settlementResultsEl.appendChild(p);
}

function updateTotalAmount() {
    const total = appState.expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
    totalAmountEl.textContent = formatCurrency(total);
}

function getPersonName(personId) {
    const person = appState.people.find((item) => item.id === personId);
    return person ? person.name : "Unknown";
}

function runTests() {
    const peopleTemplate = (names) =>
        names.map((name, index) => ({
            id: name,
            name,
            createdAt: new Date(2024, 0, index + 1).toISOString(),
        }));
    const scenarios = [
        {
            label: "Scenario 1",
            people: peopleTemplate(["A", "B", "C"]),
            expenses: [
                { id: "e1", payerId: "A", amountCents: 6000 },
                { id: "e2", payerId: "B", amountCents: 2000 },
            ],
            expected: [
                { fromId: "C", toId: "A", amountCents: 2666 },
                { fromId: "B", toId: "A", amountCents: 667 },
            ],
        },
        {
            label: "Scenario 2",
            people: peopleTemplate(["A", "B", "C", "D"]),
            expenses: [
                { id: "e1", payerId: "A", amountCents: 4000 },
                { id: "e2", payerId: "B", amountCents: 4000 },
                { id: "e3", payerId: "C", amountCents: 4000 },
            ],
            expected: [
                { fromId: "D", toId: "A", amountCents: 1000 },
                { fromId: "D", toId: "B", amountCents: 1000 },
                { fromId: "D", toId: "C", amountCents: 1000 },
            ],
        },
        {
            label: "Scenario 3",
            people: peopleTemplate(["A", "B", "C"]),
            expenses: [{ id: "e1", payerId: "C", amountCents: 10000 }],
            expected: [
                { fromId: "A", toId: "C", amountCents: 3334 },
                { fromId: "B", toId: "C", amountCents: 3333 },
            ],
        },
        {
            label: "Scenario 4",
            people: peopleTemplate(["A", "B", "C"]),
            expenses: [
                { id: "e1", payerId: "A", amountCents: 3000 },
                { id: "e2", payerId: "B", amountCents: 3000 },
                { id: "e3", payerId: "C", amountCents: 3000 },
            ],
            expected: [],
        },
    ];
    const results = scenarios.map((scenario) => {
        const financials = computeFinancialSnapshot(scenario.people, scenario.expenses);
        const transfers = financials.balances.some((item) => item.balanceCents !== 0)
            ? settleBalances(financials)
            : [];
        const pass = compareTransfers(transfers, scenario.expected);
        logScenarioResult(scenario.label, pass, transfers, scenario.expected);
        return pass;
    });
    if (results.every(Boolean)) {
        console.log("✅ All sanity scenarios passed.");
    } else {
        console.log("❌ One or more sanity scenarios failed.");
    }
}

function compareTransfers(actual, expected) {
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < actual.length; i += 1) {
        const a = actual[i];
        const e = expected[i];
        if (a.fromId !== e.fromId || a.toId !== e.toId || a.amountCents !== e.amountCents) {
            return false;
        }
    }
    return true;
}

function logScenarioResult(label, pass, actual, expected) {
    const formatLine = (transfer) =>
        `${transfer.fromId} → ${transfer.toId} ${formatCurrency(transfer.amountCents)}`;
    if (pass) {
        console.log(`✅ ${label}`);
    } else {
        console.group(`❌ ${label}`);
        console.log("Expected:", expected.map(formatLine));
        console.log("Actual:", actual.map(formatLine));
        console.groupEnd();
    }
}