import inquirer from "inquirer";
import api from "@actual-app/api";
import { config } from "dotenv";
import fs from "fs";
config();

// Configuration
const ACTUAL_SERVER_URL = process.env.ACTUAL_SERVER_URL;
const ACTUAL_PASSWORD = process.env.ACTUAL_PASSWORD;
const ACTUAL_BUDGET_ID = process.env.ACTUAL_BUDGET_ID;
const ACTUAL_ACCOUNT_NAME = process.env.ACTUAL_ACCOUNT_NAME;
console.log("Configuration loaded:");
console.log("- ACTUAL_SERVER_URL:", ACTUAL_SERVER_URL ? "****" : "Not set");
console.log("- ACTUAL_PASSWORD:", ACTUAL_PASSWORD ? "****" : "Not set");
console.log(
  "- ACTUAL_BUDGET_ID:",
  ACTUAL_BUDGET_ID ? ACTUAL_BUDGET_ID : "Not set"
);
console.log(
  "- ACTUAL_ACCOUNT_NAME:",
  ACTUAL_ACCOUNT_NAME ? ACTUAL_ACCOUNT_NAME : "Not set"
);

// Helper functions
function parseDate(apiDate) {
  console.log(`Parsing date from API format: ${apiDate}`);
  const [datePart] = apiDate.split(" ");
  const [day, month, year] = datePart.split("-");
  const simpleDate = `${year}-${month}-${day}`;
  console.log(`Converted to simple date format: ${simpleDate}`);
  return simpleDate;
}

function parseAmount(amountStr) {
  console.log(`Parsing amount from string: ${amountStr}`);
  const cleaned = amountStr.replace(/[^-\d]/g, "");
  const amount = parseInt(cleaned, 10);
  const vndAmount = amount * 100; // Convert to VND by adding two zeros
  console.log(`Converted to number: ${vndAmount}`);
  return vndAmount;
}

async function getExistingTransactions(startDate, endDate) {
  try {
    const accounts = await api.getAccounts();
    let transactions = [];

    for (const account of accounts) {
      const accountTransactions = await api.getTransactions(
        account.id,
        new Date(startDate),
        new Date(endDate)
      );
      transactions = transactions.concat(accountTransactions);
    }

    return transactions;
  } catch (error) {
    console.error("Error fetching existing transactions:", error.message);
    return [];
  }
}

function isTransactionOverlap(newTransaction, existingTransactions) {
  return existingTransactions.some(
    (existing) =>
      existing.date === newTransaction.date &&
      Math.abs(existing.amount - newTransaction.amount) < 1
  );
}

async function promptForOverwrite(transaction) {
  const { overwrite } = await inquirer.prompt([
    {
      type: "confirm",
      name: "overwrite",
      message: `Transaction on ${transaction.date} for ${transaction.amount} already exists. Overwrite?`,
      default: false,
    },
  ]);
  return overwrite;
}

async function addTransactions(transactions) {
  try {
    const accounts = await api.getAccounts();
    if (accounts.length === 0) {
      throw new Error("No accounts found in Actual Budget");
    }

    // Find account by name
    const account = accounts.find((acc) => acc.name === ACTUAL_ACCOUNT_NAME);
    if (!account) {
      throw new Error(`Account with name "${ACTUAL_ACCOUNT_NAME}" not found`);
    }
    const accountId = account.id;

    const formattedTransactions = transactions.map((transaction) => ({
      date: transaction.date,
      amount: transaction.amount,
      payee_name: transaction.payee_name,
      notes: transaction.notes,
      cleared: transaction.cleared,
    }));

    await api.importTransactions(accountId, formattedTransactions);
  } catch (error) {
    console.error("Error adding transactions:", error.message);
    throw error;
  }
}

async function main() {
  // Backup confirmation
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message:
        "Have you manually backed up your Actual Budget data? This is critical in case something goes wrong with the import.",
      default: false,
    },
  ]);

  if (!confirm) {
    console.log("Please backup your data before proceeding.");
    process.exit(0);
  }
  try {
    // Ensure data directory exists
    fs.mkdirSync("./.actual-data", { recursive: true });

    // Initialize Actual API
    console.log("Initializing Actual API...");
    await api.init({
      dataDir: "./.actual-data",
      serverURL: ACTUAL_SERVER_URL,
      password: ACTUAL_PASSWORD,
    });
    console.log("API initialized successfully");

    // Download budget
    console.log(`Downloading budget with ID: ${ACTUAL_BUDGET_ID}`);
    await api.downloadBudget(ACTUAL_BUDGET_ID);
    console.log("Budget downloaded successfully");

    // Prompt for JSON input
    const { jsonInput } = await inquirer.prompt([
      {
        type: "editor",
        name: "jsonInput",
        message: "Paste the JSON response from getHistTransactions API:",
      },
    ]);

    let transactionsData;
    try {
      transactionsData = JSON.parse(jsonInput);
    } catch (error) {
      console.error("Invalid JSON input:", error.message);
      process.exit(1);
    }

    if (
      !transactionsData.transactions ||
      !Array.isArray(transactionsData.transactions)
    ) {
      console.error("Invalid transactions data - missing transactions array");
      process.exit(1);
    }

    // Get date range from transactions
    const firstDate = parseDate(transactionsData.transactions[0].processDate);
    const lastDate = parseDate(
      transactionsData.transactions[transactionsData.transactions.length - 1]
        .processDate
    );

    // Fetch existing transactions
    const existingTransactions = await getExistingTransactions(
      firstDate,
      lastDate
    );

    // Process transactions
    console.log("Starting transaction processing...");
    const transactionsBatch = [];

    for (const apiTransaction of transactionsData.transactions) {
      console.log(`\nProcessing transaction: ${apiTransaction.remark}`);
      const amount =
        parseAmount(apiTransaction.amount) *
        (apiTransaction.dorC === "D" ? -1 : 1);

      const transaction = {
        date: parseDate(apiTransaction.processDate),
        amount: amount,
        payee_name: apiTransaction.corresponsiveName || apiTransaction.remark,
        notes: apiTransaction.remark,
        cleared: true,
      };
      console.log("Transaction details:", {
        date: transaction.date,
        amount: transaction.amount,
        payee_name: transaction.payee_name,
      });

      // Check for overlaps
      if (isTransactionOverlap(transaction, existingTransactions)) {
        console.log("Potential duplicate transaction detected");
        const shouldOverwrite = await promptForOverwrite(transaction);
        if (!shouldOverwrite) {
          console.log(`Skipping transaction on ${transaction.date}`);
          continue;
        }
        console.log("User chose to overwrite existing transaction");
      }

      transactionsBatch.push(transaction);
    }

    // Add transactions in batch
    if (transactionsBatch.length > 0) {
      console.log(
        `Adding ${transactionsBatch.length} transactions to Actual Budget...`
      );
      await addTransactions(transactionsBatch);
      console.log(
        `Successfully added ${transactionsBatch.length} transactions`
      );
    }

    console.log("All transactions processed successfully");
  } catch (error) {
    console.error("\nERROR DETAILS:");
    console.error("- Message:", error.message);
    console.error("- Stack:", error.stack);
    console.error("Error occurred while processing transactions");
    process.exit(1);
  } finally {
    await api.shutdown();
  }
}

main();
