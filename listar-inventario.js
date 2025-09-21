// inventory-list.js
import fetch from "node-fetch";
import { SESSION_ID, STEAM_LOGIN_SECURE, STEAM_ID } from "./secrets.js";
import fs from "fs";

// Paste your cookies from Steam Web here
const sessionid = SESSION_ID;
const steamLoginSecure = STEAM_LOGIN_SECURE;
const itemsFile = "items.json";

// Constant configurations
const delayDuration = 1000; // milliseconds between requests to avoid rate limits
const longDelayDuration = 60000; // 60 seconds for long waits
const wantToSellItem = true; // Default value for new items in items.json

// Replace with your SteamID64 (see your profile -> "steamid.io")
const steamid = STEAM_ID;

// Interactive menu to test functions
async function runTests() {
  const tests = [
    { name: "Show Full Inventory", fn: retrieveAndDisplayInventories },
    { name: "Sell Items", fn: sellItems },
    { name: "Test API Call", fn: testApiCall },
    { name: "Test PriceOverview", fn: testPriceOverview },
    { name: "List Steam Trading Cards Only", fn: listSteamTradingCards },
    { name: "List Trading Cards All Games", fn: listTradingCards },
  ];
  console.log("\nSelect a function to test:");
  tests.forEach((t, i) => console.log(`${i + 1}. ${t.name}`));
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("\nEnter the function number: ", async (answer) => {
    const idx = parseInt(answer) - 1;
    rl.close();
    if (tests[idx]) {
      await tests[idx].fn();
    } else {
      console.log("Invalid option.");
    }
  });
}

// Test to query priceoverview
async function testPriceOverview() {
  const url = "https://steamcommunity.com/market/priceoverview/?currency=1&appid=753&market_hash_name=250180-MARCO%20ROSSI";
  getLowestPrice("250180-MARCO ROSSI", 753).then(price => {
    if (price) {
      console.log(`Lowest price for MARCO ROSSI: $${(price / 100).toFixed(2)}`);
    } else {
      console.log("No price found for MARCO ROSSI.");
    }
  });
}

// Reusable function to fetch with headers and parse to JSON
async function fetchSteamJson(url) {
  const res = await fetch(url, {
    headers: {
      Cookie: `sessionid=${sessionid}; steamLoginSecure=${steamLoginSecure}`,
    },
  });
  let rawText = await res.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    console.log("❌ Error parsing JSON response:", e);
    console.log("Raw response:\n", rawText);
    return null;
  }
  return data;
}

// Test function to show raw API response
async function testApiCall() {
  const url = `https://steamcommunity.com/inventory/${steamid}/753/6?l=english&count=5`;
  console.log(`\nTesting API call: ${url}`);
  const data = await fetchSteamJson(url);
  console.log("Raw API response:\n", data);
}

// Function to list only Steam trading cards
async function listSteamTradingCards() {
  const url = `https://steamcommunity.com/inventory/${steamid}/753/6?l=english&count=500`;
  console.log(`\nFetching Steam trading cards...`);
  const data = await fetchSteamJson(url);
  if (!data || !data.descriptions || !data.assets) {
    console.log("❌ Could not load Steam inventory.");
    return;
  }
  const cards = data.descriptions.filter(desc => desc.type && desc.type.toLowerCase().includes("trading card"));
  if (cards.length === 0) {
    console.log("No trading cards found in Steam inventory.");
    return;
  }
  let totalCards = 0;
  console.log("\n🎴 Steam Trading Cards:");
  for (const card of cards) {
    const asset = data.assets.find(a => a.classid === card.classid && a.instanceid === card.instanceid);
    const amount = asset ? asset.amount : 1;
    console.log(`- ${card.market_name} (Amount: ${amount})`);
    totalCards += parseInt(amount);
  }
  console.log(`\nTotal Steam trading cards: ${totalCards}`);
}

// Function to list only trading cards from all games
async function listTradingCards() {
  const allInventories = await getInventory();
  let totalCards = 0;
  for (const inv of allInventories) {
    const cards = inv.descriptions.filter(desc => desc.type && desc.type.toLowerCase().includes("trading card"));
    if (cards.length > 0) {
      console.log(`\n🎴 Trading Cards from ${inv.name}:`);
      for (const card of cards) {
        // Find card amount
        const asset = inv.assets.find(a => a.classid === card.classid && a.instanceid === card.instanceid);
        const amount = asset ? asset.amount : 1;
        console.log(`- ${card.market_name} (Amount: ${amount})`);
        totalCards += parseInt(amount);
      }
    }
  }
  console.log(`\nTotal trading cards found: ${totalCards}`);
}

async function getInventory() {
  // List of popular games and contexts
  const games = [
    { appid: 753, contextid: 6, name: "Steam" },
    { appid: 730, contextid: 2, name: "CS:GO" },
    { appid: 570, contextid: 2, name: "Dota 2" },
    { appid: 440, contextid: 2, name: "TF2" },
    { appid: 238010, contextid: 1, name: "Deus Ex: Human Revolution" }, // contextid 1 is common for most games
    { appid: 1091500, contextid: 1, name: "Cyberpunk 2077" },
    // add more games as needed 
  ];

  let allItems = [];
  for (const game of games) {
    const url = `https://steamcommunity.com/inventory/${steamid}/${game.appid}/${game.contextid}?l=english&count=500`;
    console.log(`Fetching inventory for ${game.name}...`);
    const data = await fetchSteamJson(url);
    if (data && data.descriptions && data.assets) {
      allItems.push({
        name: game.name,
        descriptions: data.descriptions,
        assets: data.assets,
      });
    } else {
      console.log(`❌ Could not load inventory for ${game.name}.`);
    }
    await delayExecution(); // pause between requests
  }
  return allItems;
}

async function getLowestPrice(itemName, appid) {
  const url =
    `https://steamcommunity.com/market/priceoverview/?currency=1&appid=${appid}&market_hash_name=` +
    encodeURIComponent(itemName);

  const res = await fetch(url);
  const data = await res.json();

  if (!data || !data.lowest_price) return null;
  let priceStr = data.lowest_price.replace("$", "");
  return Math.round(parseFloat(priceStr) * 100); // in cents
}

// Read items.json (returns array)
function readItemsJson() {
  if (fs.existsSync(itemsFile)) {
    try {
      return JSON.parse(fs.readFileSync(itemsFile, "utf8"));
    } catch (e) {
      console.error("❌ Error reading items.json:", e);
      return [];
    }
  }
  return [];
}

// Save array to items.json
function writeItemsJson(itemsData) {
  try {
    fs.writeFileSync(itemsFile, JSON.stringify(itemsData, null, 2));
  } catch (e) {
    console.error("❌ Error saving items.json:", e);
  }
}

// Find an item by assetid
function findItemByAssetId(itemsData, assetid) {
  return itemsData.find((item) => item.assetid === assetid);
}

// Show the full inventory of all games and save info to items.json
async function retrieveAndDisplayInventories() {
  const allInventories = await getInventory();

  let itemsData = readItemsJson();

  let totalItems = 0;
  let index = 0;
  for (const inv of allInventories) {
    console.log(`\n📦 Inventory of ${inv.name}: ${inv.descriptions.length} items`);
    totalItems += inv.descriptions.length;
    for (const item of inv.descriptions) {
      index++;
      const name = item.market_hash_name;
      const asset = inv.assets.find(
        (a) => a.classid === item.classid && a.instanceid === item.instanceid
      );
      const assetid = asset?.assetid;
      const appid = item.appid;
      const contextid = asset?.contextid || inv.assets[0]?.contextid || 6;
      const amount = asset?.amount ? parseInt(asset.amount) : 1;

      if (!assetid) continue;

      let existing = findItemByAssetId(itemsData, assetid);

      if (existing) {
        console.log(`\n${index}: appid: ${appid} - ${name} (assetid: ${assetid}) already registered. Price: $${existing.price} Sold: ${existing.sold ? "Yes" : "No"}`);
        continue;
      }

      console.log(`\n${index}: appid: ${appid} - Fetching price for: ${name} (assetid: ${assetid})...`);
      if (index % 20 === 0 && index !== 0) {
        console.log(`Waiting ${longDelayDuration / 1000} seconds for rate limit...`);
        await delayExecution(longDelayDuration);
      }
      const lowest = await getLowestPrice(name, appid);
      if (!lowest) {
        console.log(`⚠️ ${name} (assetid: ${assetid}) → No price in market`);
        continue;
      }

      const suggested = Math.max(lowest - 1, 1);
      const price = parseFloat((suggested / 100).toFixed(2));
      console.log(
        `${name}\n   assetid: ${assetid}\n   Current price: $${(lowest / 100).toFixed(2)} → List at: $${price}\n`
      );

      // Save to itemsData
      itemsData.push({
        assetid: assetid,
        appid: appid,
        contextid: contextid,
        amount: amount,
        price: price,
        sold: false,
        wantToSell: wantToSellItem,
      });

      // Save itemsData to items.json
      writeItemsJson(itemsData);

      await delayExecution(); // pause between requests
    }
  }
  console.log(`\nTotal items in all games: ${totalItems}`);
}

// List an item on the Steam market
async function sellItem(assetid, appid, contextid, amount, price) {
  // Price must be in cents (e.g. $0.05 => 5)
  const priceCents = Math.round(price * 100);
  const url = `https://steamcommunity.com/market/sellitem/`;
  const body = new URLSearchParams({
    sessionid: SESSION_ID,
    appid: appid,
    contextid: contextid,
    assetid: assetid,
    amount: amount,
    price: priceCents
  });
  const headers = {
    'Cookie': `sessionid=${SESSION_ID}; steamLoginSecure=${STEAM_LOGIN_SECURE}`,
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Origin': 'https://steamcommunity.com',
    'Referer': 'https://steamcommunity.com/market/',
    'User-Agent': 'Mozilla/5.0'
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body
    });
    const json = await res.json();
    if (json.success) {
      console.log(`✅ Listed: assetid=${assetid}, appid=${appid}, contextid=${contextid}, amount=${amount}, price=$${price}`);
      return json;
    } else {
      console.error('❌ Error listing:', json);
      return json;
    }
  } catch (err) {
    console.error('❌ Network error while listing:', err);
    return null;
  }
}

// Iterate over an array and list each item on the market
async function sellItemsBatch(items) {
  const results = [];
  for (const item of items) {
    const { assetid, appid, contextid, amount, price } = item;
    console.log(`\nListing assetid=${assetid}, appid=${appid}, contextid=${contextid}, amount=${amount}, price=$${price}...`);
    const res = await sellItem(assetid, appid, contextid, amount, price);
    results.push({
      assetid,
      success: res?.success || false,
      message: res?.message || null
    });
    await delayExecution(); // Wait 1 second between listings
  }
  console.log("\n✅ Batch listing process finished.");
  return results;
}

// Function to sell items
async function sellItems() {
  // Read items.json and filter those with wantToSell: true and sold: false
  const itemsData = readItemsJson();
  const itemsToSell = itemsData.filter(item => item.wantToSell === true && item.sold === false);

  if (itemsToSell.length === 0) {
    console.log("No items marked for sale (wantToSell: true) in items.json.");
    return;
  }

  // Call batch
  const results = await sellItemsBatch(itemsToSell);

  // Mark as sold in itemsData and save listing result
  for (const result of results) {
    const idx = itemsData.findIndex(i => i.assetid === result.assetid);
    if (idx !== -1) {
      // If response was false, set wantToSell to false to avoid retrying
      if (result.success === false) {
        itemsData[idx].wantToSell = false;
      }
      itemsData[idx].sold = result.success;
      itemsData[idx].sellResult = {
        success: result.success,
        message: result.message || null
      };
      // Increment soldAttempts
      if (typeof itemsData[idx].soldAttempts === "number") {
        itemsData[idx].soldAttempts += 1;
      } else {
        itemsData[idx].soldAttempts = 1;
      }
    }
  }
  writeItemsJson(itemsData);
  console.log("Items updated with sale result in items.json.");
  return;
}

async function delayExecution(time = delayDuration) {
  await new Promise(res => setTimeout(res, time));
}

(async () => {
  await runTests();
})();

