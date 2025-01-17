# Vietinbank to Actual Budget Transaction Importer

This script allows you to import transactions from Vietinbank into Actual Budget
by processing the JSON response from Vietinbank's getHistTransactions API.

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/intagaming/actualbudget-vietinbank.git
   cd actualbudget-vietinbank
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Actual Budget credentials:
   ```env
   ACTUAL_SERVER_URL=your_actual_server_url
   ACTUAL_PASSWORD=your_actual_password
   ACTUAL_BUDGET_ID=your_budget_id_from_advanced_settings
   ACTUAL_ACCOUNT_NAME=your_budget_account_name
   ```

## Usage

1. Manually backup your budget on Actual Budget. I'm not responsible for your data loss.
2. Obtain the transaction data from Vietinbank's getHistTransactions API:
   1. Login to [https://ipay.vietinbank.vn/login](https://ipay.vietinbank.vn/login)
   2. Press F12 for the Chrome DevTools panel. Visit the Network tab.
   3. Click on your Bank Account. A transaction history will show up.
   4. In the Chrome DevTools' Network Tab, find the "getHistTransactions" row.
   5. Copy the JSON response of the request.
3. Run the script:
   ```bash
   node index.js
   ```
4. When prompted, paste the JSON response from the API
5. Review and confirm the transactions to be imported

## Post-Import Configuration

After successfully importing transactions, it's recommended to configure rules
in Actual Budget to save yourself some time the next time you use this script.

## Configuration

The following environment variables are required:

- `ACTUAL_SERVER_URL`: URL of your Actual Budget server
- `ACTUAL_PASSWORD`: Password for your Actual Budget server
- `ACTUAL_BUDGET_ID`: ID of the budget to import transactions into
- `ACTUAL_ACCOUNT_NAME`: Name of the account to import transactions into