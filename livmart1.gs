// ==========================================================
// CODE.GS (Must be saved and deployed in your Apps Script project)
// ==========================================================

// IMPORTANT: Ensure this script is linked to your LivmartDB Spreadsheet.
const SS_ID = SpreadsheetApp.getActiveSpreadsheet().getId(); 
const SHEETS = {
  USERS: 'Users',
  PRODUCTS: 'Products',
  SALE_OF_DAY: 'SaleOfTheDay'
};

const MASTER_EMAIL = 'adminlivmart@gmail.com';
const MASTER_PASS = 'admin123';

/**
 * Handles GET requests. Required for Web App deployment.
 */
function doGet(e) {
  return ContentService.createTextOutput('Livmart API Endpoint Active. Send POST requests for data operations.')
      .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Handles POST requests. This is the main API entry point.
 */
function doPost(e) {
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Invalid JSON payload. Check client-side data formatting.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const action = params.action;
  let result = {};

  try {
    switch (action) {
      case 'getSaleOfTheDayProducts':
        result.data = getSaleOfTheDayProducts();
        break;
      case 'getProducts':
        result.data = getProducts();
        break;
      case 'userLogin':
        result = userLogin(params.email, params.password);
        break;
      case 'masterLogin':
        result = masterLogin(params.email, params.password);
        break;
      case 'registerUser':
        result = registerUser(params.email, params.password);
        break;
      case 'addProduct':
        result = addProduct(params.productData, params.targetSheet);
        break;
      case 'removeProduct':
        result = removeProduct(params.rowIndex, params.targetSheet);
        break;
      default:
        result = { success: false, message: 'Invalid API action.' };
    }
  } catch (error) {
    Logger.log(error);
    result = { success: false, message: `Server error: ${error.message}. Check Apps Script logs.` };
  }
  
  // Return JSON response. Apps Script handles the necessary CORS headers for 'Anyone' access.
  return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
}


// --- Data Handling and Logic Functions ---

function fetchDataFromSheet(sheetName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet(); 
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    return data.map(row => {
      let item = {};
      headers.forEach((header, i) => {
        item[header] = row[i];
      });
      // rowIndex is added to track the row number in the sheet for deletion purposes
      item.rowIndex = data.indexOf(row) + 2; 
      return item;
    });
  } catch (e) {
    Logger.log(`Error fetching data from ${sheetName}: ${e}`);
    return [];
  }
}

function getProducts() { return fetchDataFromSheet(SHEETS.PRODUCTS); }
function getSaleOfTheDayProducts() {
  const products = fetchDataFromSheet(SHEETS.SALE_OF_DAY);
  return products.map(product => {
    product.FinalPrice = product.Price * (1 - product.OfferPercent / 100); 
    return product;
  });
}

function userLogin(email, password) {
  const users = fetchDataFromSheet(SHEETS.USERS);
  for (let i = 0; i < users.length; i++) {
    if (users[i].Email === email && users[i].Password === password && users[i].Role === 'user') {
      return { success: true, message: 'Login successful!' };
    }
  }
  return { success: false, message: 'Login failed. Incorrect email or password.' };
}

function masterLogin(email, password) {
  if (email === MASTER_EMAIL && password === MASTER_PASS) {
    return { success: true, message: 'Master login successful!' };
  }
  return { success: false, message: 'Master login failed. Incorrect credentials.' };
}

function registerUser(email, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.USERS);
  const users = fetchDataFromSheet(SHEETS.USERS);
  
  if (users.some(user => user.Email === email)) {
    return { success: false, message: 'Registration failed. User already exists.' };
  }
  
  // Appends new user with 'user' role
  sheet.appendRow([email, password, 'user']);
  return { success: true, message: 'Registration successful! Please refresh the page and login.' };
}

function addProduct(productData, targetSheet) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(targetSheet);
    
    const lastRow = sheet.getLastRow();
    const lastID = (lastRow > 1) ? sheet.getRange(lastRow, 1).getValue() : 0;
    const newID = lastID + 1;
    
    let newRow = [];
    
    if (targetSheet === SHEETS.PRODUCTS) {
      newRow = [
        newID, productData.imageUrl, productData.name, parseFloat(productData.price), 
        parseFloat(productData.offerPercent || 0), productData.category, productData.otherImageUrl || ''
      ];
    } else if (targetSheet === SHEETS.SALE_OF_DAY) {
      newRow = [
        newID, productData.imageUrl, productData.name, parseFloat(productData.price), 
        parseFloat(productData.offerPercent || 0)
      ];
    } else {
      return { success: false, message: 'Invalid target sheet specified.' };
    }
    
    sheet.appendRow(newRow);
    return { success: true, message: `Product "${productData.name}" added successfully with ID ${newID} to ${targetSheet}.` };

  } catch (e) {
    Logger.log(e);
    return { success: false, message: `Failed to add product: ${e.message}` };
  }
}

function removeProduct(rowIndex, targetSheet) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(targetSheet);
    // Deletes the row based on the rowIndex passed from the client
    sheet.deleteRow(rowIndex);
    
    return { success: true, message: `Product deleted successfully from ${targetSheet}.` };
  } catch (e) {
    Logger.log(e);
    return { success: false, message: `Failed to remove product: ${e.message}.` };
  }
}
