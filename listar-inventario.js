// listarInventario.js
import fetch from "node-fetch";
import { SESSION_ID, STEAM_LOGIN_SECURE, STEAM_ID } from "./secrets.js";
import fs from "fs";

// Pega aquí tus cookies desde Steam Web
const sessionid = SESSION_ID;
const steamLoginSecure = STEAM_LOGIN_SECURE;
const itemsFile = "items.json";

// Configuraciones de constantes
const delayDuration = 1000; // milisegundos entre requests para evitar rate limits
const longDelayDuration = 60000; // 60 segundos para esperas largas

// Reemplaza con tu SteamID64 (lo ves en tu perfil -> "steamid.io")
const steamid = STEAM_ID;

// Menú interactivo para testear funciones
async function runTests() {
  const tests = [
    { name: "Test API Call", fn: testApiCall },
    { name: "Listar cromos solo Steam", fn: listSteamTradingCards },
    { name: "Listar cromos todos los juegos", fn: listTradingCards },
    { name: "Mostrar inventario completo", fn: showAllInventories },
    { name: "Test PriceOverview", fn: testPriceOverview },
    { name: "Vender ítems", fn: sellItems },
  ];
  console.log("\nSelecciona una función para testear:");
  tests.forEach((t, i) => console.log(`${i + 1}. ${t.name}`));
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("\nIngresa el número de la función: ", async (answer) => {
    const idx = parseInt(answer) - 1;
    rl.close();
    if (tests[idx]) {
      await tests[idx].fn();
    } else {
      console.log("Opción inválida.");
    }
  });
}

// Test para consultar priceoverview
async function testPriceOverview() {
  const url = "https://steamcommunity.com/market/priceoverview/?currency=1&appid=753&market_hash_name=250180-MARCO%20ROSSI";
  getLowestPrice("250180-MARCO ROSSI", 753).then(price => {
    if (price) {
      console.log(`Precio más bajo para MARCO ROSSI: $${(price / 100).toFixed(2)}`);
    } else {
      console.log("No se encontró precio para MARCO ROSSI.");
    }
  });
}

// Función reutilizable para hacer fetch con headers y parsear a JSON
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
    console.log("❌ Error al parsear la respuesta JSON:", e);
    console.log("Respuesta cruda:\n", rawText);
    return null;
  }
  return data;
}

// Función de prueba para mostrar la respuesta cruda de la API
async function testApiCall() {
  const url = `https://steamcommunity.com/inventory/${steamid}/753/6?l=english&count=5`;
  console.log(`\nProbando llamada a la API: ${url}`);
  const data = await fetchSteamJson(url);
  console.log("Respuesta cruda de la API:\n", data);
}

// Función para listar cromos solo del inventario de Steam
async function listSteamTradingCards() {
  const url = `https://steamcommunity.com/inventory/${steamid}/753/6?l=english&count=500`;
  console.log(`\nConsultando cromos en Steam...`);
  const data = await fetchSteamJson(url);
  if (!data || !data.descriptions || !data.assets) {
    console.log("❌ No se pudo cargar el inventario de Steam.");
    return;
  }
  const cards = data.descriptions.filter(desc => desc.type && desc.type.toLowerCase().includes("trading card"));
  if (cards.length === 0) {
    console.log("No se encontraron cromos en el inventario de Steam.");
    return;
  }
  let totalCards = 0;
  console.log("\n🎴 Cromos en Steam:");
  for (const card of cards) {
    const asset = data.assets.find(a => a.classid === card.classid && a.instanceid === card.instanceid);
    const cantidad = asset ? asset.amount : 1;
    console.log(`- ${card.market_name} (Cantidad: ${cantidad})`);
    totalCards += parseInt(cantidad);
  }
  console.log(`\nTotal de cromos en Steam: ${totalCards}`);
}

// Función para listar solo los cromos (trading cards) de todos los juegos
async function listTradingCards() {
  const allInventories = await getInventory();
  let totalCards = 0;
  for (const inv of allInventories) {
    const cards = inv.descriptions.filter(desc => desc.type && desc.type.toLowerCase().includes("trading card"));
    if (cards.length > 0) {
      console.log(`\n🎴 Cromos de ${inv.name}:`);
      for (const card of cards) {
        // Buscar cantidad del cromo
        const asset = inv.assets.find(a => a.classid === card.classid && a.instanceid === card.instanceid);
        const cantidad = asset ? asset.amount : 1;
        console.log(`- ${card.market_name} (Cantidad: ${cantidad})`);
        totalCards += parseInt(cantidad);
      }
    }
  }
  console.log(`\nTotal de cromos encontrados: ${totalCards}`);
}

async function getInventory() {
  // Lista de juegos y contextos populares
  const games = [
    { appid: 753, contextid: 6, name: "Steam" },
    { appid: 730, contextid: 2, name: "CS:GO" },
    { appid: 570, contextid: 2, name: "Dota 2" },
    { appid: 440, contextid: 2, name: "TF2" },
    { appid: 238010, contextid: 1, name: "Deus Ex: Human Revolution" }, // contextid 1 es común para la mayoría de juegos
  ];

  let allItems = [];
  for (const game of games) {
    const url = `https://steamcommunity.com/inventory/${steamid}/${game.appid}/${game.contextid}?l=english&count=500`;
    console.log(`Consultando inventario de ${game.name}...`);
    const data = await fetchSteamJson(url);
    if (data && data.descriptions && data.assets) {
      allItems.push({
        name: game.name,
        descriptions: data.descriptions,
        assets: data.assets,
      });
    } else {
      console.log(`❌ No se pudo cargar inventario de ${game.name}.`);
    }
    await delayExecution(); // pausa entre requests
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
  return Math.round(parseFloat(priceStr) * 100); // en centavos
}

// Función para mostrar el inventario completo de todos los juegos
// Utilidades para manejar items.json


// Leer items.json (devuelve array)
function readItemsJson() {
  if (fs.existsSync(itemsFile)) {
    try {
      return JSON.parse(fs.readFileSync(itemsFile, "utf8"));
    } catch (e) {
      console.error("❌ Error al leer items.json:", e);
      return [];
    }
  }
  return [];
}

// Guardar array en items.json
function writeItemsJson(itemsData) {
  try {
    fs.writeFileSync(itemsFile, JSON.stringify(itemsData, null, 2));
  } catch (e) {
    console.error("❌ Error al guardar items.json:", e);
  }
}

// Buscar un ítem por assetid
function findItemByAssetId(itemsData, assetid) {
  return itemsData.find((item) => item.assetid === assetid);
}

// Mostrar el inventario completo de todos los juegos y guardar info en items.json
async function showAllInventories() {
  const allInventories = await getInventory();

  let itemsData = readItemsJson();

  let totalItems = 0;
  let index = 0;
  for (const inv of allInventories) {
    console.log(`\n📦 Inventario de ${inv.name}: ${inv.descriptions.length} items`);
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
        console.log(`\n${index}: appid: ${appid} - ${name} (assetid: ${assetid}) ya registrado. Precio: $${existing.price} Vendido: ${existing.sold ? "Sí" : "No"}`);
        continue;
      }

      console.log(`\n${index}: appid: ${appid} - Buscando precio para: ${name} (assetid: ${assetid})...`);
      if (index % 20 === 0 && index !== 0) {
        console.log(`Esperando ${longDelayDuration} segundos por límite de rate...`);
        await delayExecution(longDelayDuration);
      }
      const lowest = await getLowestPrice(name, appid);
      if (!lowest) {
        console.log(`⚠️ ${name} (assetid: ${assetid}) → Sin precio en mercado`);
        continue;
      }

      const suggested = Math.max(lowest - 1, 1);
      const price = parseFloat((suggested / 100).toFixed(2));
      console.log(
        `${name}\n   assetid: ${assetid}\n   Precio actual: $${(lowest / 100).toFixed(2)} → Publicar a: $${price}\n`
      );

      // Guardar en itemsData
      itemsData.push({
        assetid: assetid,
        appid: appid,
        contextid: contextid,
        amount: amount,
        price: price,
        sold: false
      });

      // Guardar itemsData en items.json
      writeItemsJson(itemsData);

      await delayExecution(); // pausa entre requests
    }
  }
  console.log(`\nTotal de items en todos los juegos: ${totalItems}`);
}

// Publicar un ítem en el mercado de Steam
async function sellItem(assetid, appid, contextid, amount, price) {
  // El precio debe estar en centavos (ej: $0.05 => 5)
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
      console.log(`✅ Publicado: assetid=${assetid}, appid=${appid}, contextid=${contextid}, amount=${amount}, price=$${price}`);
      return json;
    } else {
      console.error('❌ Error al publicar:', json);
      return json;
    }
  } catch (err) {
    console.error('❌ Error de red al publicar:', err);
    return null;
  }
}


  // Recorrer un arreglo y publicar cada ítem en el mercado
  async function sellItemsBatch(items) {
    const results = [];
    for (const item of items) {
      const { assetid, appid, contextid, amount, price } = item;
      console.log(`\nPublicando assetid=${assetid}, appid=${appid}, contextid=${contextid}, amount=${amount}, price=$${price}...`);
      const res = await sellItem(assetid, appid, contextid, amount, price);
      results.push({
        assetid,
        success: res?.success || false,
        message: res?.message || null
      });
      await delayExecution(); // Espera 1 segundo entre publicaciones
    }
    console.log("\n✅ Proceso de publicación por lote finalizado.");
    return results;

    async function delayExecution(time = delayDuration) {
      await new Promise(res => setTimeout(res, time));
    }
  }

  // Función para vender ítems
  async function sellItems() {
    // Leer items.json y filtrar los que tienen wantToSell: true y sold: false
    const itemsData = readItemsJson();
    const itemsToSell = itemsData.filter(item => item.wantToSell === true && item.sold === false);

    if (itemsToSell.length === 0) {
      console.log("No hay ítems marcados para vender (wantToSell: true) en items.json.");
      return;
    }

    // Llamada al batch
    const results = await sellItemsBatch(itemsToSell);

    // Marcar como vendidos en itemsData y guardar resultado de publicación
    for (const result of results) {
      const idx = itemsData.findIndex(i => i.assetid === result.assetid);
      if (idx !== -1) {

        // Si la respuesta fue false cambiar wantToSell a false para no intentar venderlo de nuevo
        if (result.success === false) {
          itemsData[idx].wantToSell = false;
        }

        itemsData[idx].sold = result.success;
        itemsData[idx].sellResult = {
          success: result.success,
          message: result.message || null
        };
        // Incrementar soldAttempts
        if (typeof itemsData[idx].soldAttempts === "number") {
          itemsData[idx].soldAttempts += 1;
        } else {
          itemsData[idx].soldAttempts = 1;
        }
      }
    }
    writeItemsJson(itemsData);
    console.log("Se actualizaron los ítems con el resultado de la venta en items.json.");
    return;
  }

(async () => {
  await runTests();
})();

