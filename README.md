# Steam Inventory Tools

This project is a Node.js script to list, analyze, and sell items from your Steam inventory, including trading cards, skins, and other marketable objects.

## Features
- List Steam trading cards and cards from popular games.
- Check current prices on the Steam Market.
- Save item information to `items.json`.
- Automatically list selected items for sale on the Steam Market.

## Requirements
- Node.js 18+
- A Steam account with a public inventory.
- Session cookies (`sessionid` and `steamLoginSecure`).

## Installation
1. Clone this repository and enter the folder:
   ```bash
   git clone <repo-url>
   cd steam
   ```
2. Install dependencies:
   ```bash
   npm install node-fetch
   ```
3. Create a `secrets.js` file with the following content:
   ```js
   export const SESSION_ID = "<your sessionid>";
   export const STEAM_LOGIN_SECURE = "<your steamLoginSecure>";
   export const STEAM_ID = "<your SteamID64>";
   ```

## Usage
Run the main script:
```bash
node listar-inventario.js
```
Follow the interactive menu to list cards, check prices, or sell items.

## items.json
The script saves item information in `items.json`. To sell items, mark those you want to sell with `"wantToSell": true` and run the sell option.

## Notes
- Do not share your cookies or your `secrets.js` file.
- Respect Steam's rate limits to avoid temporary bans.

## License
MIT
