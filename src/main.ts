import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

const START_LOCATION = leaflet.latLng(36.98949379578401, -122.06277128548504);

const ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const SEARCH_SIZE = 8;
const ITEM_SPAWN_PROBABILITY = 0.1;

const map = leaflet.map(document.getElementById("map")!, {
  center: START_LOCATION,
  zoom: ZOOM_LEVEL,
  minZoom: ZOOM_LEVEL,
  maxZoom: ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const playerMarker = leaflet.marker(START_LOCATION);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const playerItems: Item[] = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No items yet...";

interface Cell {
  i: number;
  j: number;
  items: Item[];
}

interface Item {
  cell: Cell;
  serialNum: number;
  getId: () => string;
}

const cellCache = new Map<string, Cell>();

function getCell(i: number, j: number): Cell {
  const key = `${i}:${j}`;
  if (!cellCache.has(key)) {
    const cell: Cell = { i, j, items: [] };
    cellCache.set(key, cell);
  }
  return cellCache.get(key)!;
}

function createItem(cell: Cell): Item {
  const serialNum = cell.items.length;
  const item: Item = {
    cell,
    serialNum,
    getId: () => `${cell.i}:${cell.j}#${serialNum}`,
  };
  cell.items.push(item);
  return item;
}

function latLngToCell(lat: number, lng: number): { i: number; j: number } {
  return {
    i: Math.floor(lat / TILE_DEGREES),
    j: Math.floor(lng / TILE_DEGREES),
  };
}

function cellToLatLng(i: number, j: number): { lat: number; lng: number } {
  return {
    lat: i * TILE_DEGREES,
    lng: j * TILE_DEGREES,
  };
}

function updateStatusPanel() {
  // Update collected items
  const collectedItems = playerItems
    .map((item) => `<li>${item.getId()}</li>`)
    .join("");
  statusPanel.innerHTML = `
    <div>Collected Items:</div>
    <ul>${collectedItems || "<li>No items collected yet</li>"}</ul>
  `;
}

function spawnItem(i: number, j: number) {
  const { lat, lng } = cellToLatLng(i, j);
  const bounds = leaflet.latLngBounds([
    [lat, lng],
    [lat + TILE_DEGREES, lng + TILE_DEGREES],
  ]);

  const numItems = Math.floor(luck([i, j, "initialValue"].toString()) * 10) +
    1;
  const cell = getCell(i, j);
  for (let i = 0; i < numItems; i++) {
    createItem(cell);
  }

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>Tile (${i}, ${j})</div>
    `;
    const tileItemsList = document.createElement("ul");
    cell.items.forEach((tileItem) => {
      const itemElement = document.createElement("li");
      itemElement.textContent = tileItem.getId();
      tileItemsList.appendChild(itemElement);
    });

    popupDiv.appendChild(tileItemsList);

    // Add the collect button
    const collectButton = document.createElement("button");
    collectButton.textContent = "Collect Item";
    collectButton.addEventListener("click", () => {
      if (cell.items.length > 0) {
        const collectedItem = cell.items.pop()!;
        playerItems.push(collectedItem);
        updateStatusPanel();
        while (tileItemsList.firstChild) {
          tileItemsList.removeChild(tileItemsList.firstChild);
        }
        cell.items.forEach((tileItem) => {
          const itemElement = document.createElement("li");
          itemElement.textContent = tileItem.getId();
          tileItemsList.appendChild(itemElement);
        });
      } else {
        alert("No items left in this tile!");
      }
    });
    popupDiv.appendChild(collectButton);

    // Add the deposit button
    const depositButton = document.createElement("button");
    depositButton.textContent = "Deposit Item";
    depositButton.addEventListener("click", () => {
      if (playerItems.length > 0) {
        const depositedItem = playerItems.pop()!;
        cell.items.push(depositedItem);
        updateStatusPanel();
        while (tileItemsList.firstChild) {
          tileItemsList.removeChild(tileItemsList.firstChild);
        }
        cell.items.forEach((tileItem) => {
          const itemElement = document.createElement("li");
          itemElement.textContent = tileItem.getId();
          tileItemsList.appendChild(itemElement);
        });
      } else {
        alert("No items to deposit!");
      }
    });
    popupDiv.appendChild(depositButton);
    return popupDiv;
  });
}

const globalTile = latLngToCell(START_LOCATION.lat, START_LOCATION.lng);
for (let i = globalTile.i - SEARCH_SIZE; i < globalTile.i + SEARCH_SIZE; i++) {
  for (
    let j = globalTile.j - SEARCH_SIZE;
    j < globalTile.j + SEARCH_SIZE;
    j++
  ) {
    if (luck([i, j].toString()) < ITEM_SPAWN_PROBABILITY) {
      spawnItem(i, j);
    }
  }
}
