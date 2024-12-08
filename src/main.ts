import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

const START_LOCATION = leaflet.latLng(36.98949379578401, -122.06277128548504);

const northButton = document.getElementById("north")!;
const southButton = document.getElementById("south")!;
const westButton = document.getElementById("west")!;
const eastButton = document.getElementById("east")!;
const sensorButton = document.getElementById("sensor")!;
const resetButton = document.getElementById("reset")!;

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
let playerPos = START_LOCATION;
const playerMarker = leaflet.marker(START_LOCATION);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const playerItems: Item[] = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No items yet...";

// Flyweight pattern for cells and items

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

// Cache setup using momento pattern

class CacheMemento {
  private state: Map<string, Cell>;

  constructor(state: Map<string, Cell>) {
    this.state = new Map(state);
  }

  getState(): Map<string, Cell> {
    return this.state;
  }
}

// Cache handler for save and loading states

class CacheCaretaker {
  private mementos: Map<string, CacheMemento> = new Map();

  saveState(key: string, cell: Cell): void {
    if (!this.mementos.has(key)) {
      this.mementos.set(key, new CacheMemento(new Map([[key, cell]])));
    }
  }

  restoreState(key: string): Cell | null {
    const memento = this.mementos.get(key);
    return memento?.getState().get(key) || null;
  }
}

const cacheCaretaker = new CacheCaretaker();
const cellCache = new Map<string, Cell>();

function getCell(i: number, j: number): Cell {
  const key = `${i}:${j}`;
  if (!cellCache.has(key)) {
    const cell: Cell = { i, j, items: [] };
    cellCache.set(key, cell);
  }
  return cellCache.get(key)!;
}

// Create item at cell

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

// Update item display

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
  // Generate number of items per cell
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

// Initial Generation
const globalTile = latLngToCell(playerPos.lat, playerPos.lng);
const visibleCells = new Set<string>();
for (let i = globalTile.i - SEARCH_SIZE; i <= globalTile.i + SEARCH_SIZE; i++) {
  for (
    let j = globalTile.j - SEARCH_SIZE;
    j <= globalTile.j + SEARCH_SIZE;
    j++
  ) {
    visibleCells.add(`${i}:${j}`);
    if (!cellCache.has(`${i}:${j}`)) {
      if (luck([i, j].toString()) < ITEM_SPAWN_PROBABILITY) {
        spawnItem(i, j);
      }
    }
  }
}

// Reloading map
function regenerateMap() {
  const globalTile = latLngToCell(playerPos.lat, playerPos.lng);
  const visibleCells = new Set<string>();

  for (
    let i = globalTile.i - SEARCH_SIZE;
    i <= globalTile.i + SEARCH_SIZE;
    i++
  ) {
    for (
      let j = globalTile.j - SEARCH_SIZE;
      j <= globalTile.j + SEARCH_SIZE;
      j++
    ) {
      const cellKey = `${i}:${j}`;
      visibleCells.add(cellKey);

      if (!cellCache.has(cellKey)) {
        // Restore from caretaker
        const cachedCell = cacheCaretaker.restoreState(cellKey);
        if (cachedCell) {
          cellCache.set(cellKey, cachedCell);
          drawTileOnMap(i, j, cachedCell);
        } else if (luck([i, j].toString()) < ITEM_SPAWN_PROBABILITY) {
          // Generate new cell if not in cache
          const newCell = getCell(i, j);
          spawnItem(i, j);
          cacheCaretaker.saveState(cellKey, newCell); // Save to caretaker
        }
      } else {
        // Ensure tile is on map if already cached
        const cachedCell = cellCache.get(cellKey)!;
        if (!isTileOnMap(i, j)) {
          drawTileOnMap(i, j, cachedCell);
        }
      }
    }
  }

  // Remove out-of-range tiles
  map.eachLayer((layer: leaflet.Layer) => {
    if (layer instanceof leaflet.Rectangle) {
      const northWest = layer.getBounds().getNorthWest();
      const lat = northWest.lat;
      const lng = northWest.lng;
      const cellKey = `${Math.floor(lat / TILE_DEGREES)}:${
        Math.floor(lng / TILE_DEGREES)
      }`;
      if (!visibleCells.has(cellKey)) {
        map.removeLayer(layer);
      }
    }
  });
}

// Redraw tiles on map to display info
function drawTileOnMap(i: number, j: number, cell: Cell) {
  const { lat, lng } = cellToLatLng(i, j);
  const bounds = leaflet.latLngBounds([
    [lat, lng],
    [lat + TILE_DEGREES, lng + TILE_DEGREES],
  ]);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `<div>Tile (${i}, ${j})</div>`;
    const tileItemsList = document.createElement("ul");
    cell.items.forEach((tileItem) => {
      const itemElement = document.createElement("li");
      itemElement.textContent = tileItem.getId();
      tileItemsList.appendChild(itemElement);
    });
    popupDiv.appendChild(tileItemsList);
    return popupDiv;
  });
}
// Check if a tile is being displayed
function isTileOnMap(i: number, j: number): boolean {
  const { lat, lng } = cellToLatLng(i, j);
  const bounds = leaflet.latLngBounds([
    [lat, lng],
    [lat + TILE_DEGREES, lng + TILE_DEGREES],
  ]);

  let tile = false;
  map.eachLayer((layer: leaflet.Layer) => {
    if (layer instanceof leaflet.Rectangle) {
      if (layer.getBounds().equals(bounds)) {
        tile = true;
      }
    }
  });
  return tile;
}

function geoLocation() {
  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    playerPos = leaflet.latLng(
      latitude,
      longitude,
    );
    map.setView(playerPos);
    playerMarker.setLatLng(playerPos);

    regenerateMap();
  }, (error) => {
    console.error("Geolocation error:", error);
  }, {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 5000,
  });
}

function reset() {
  console.log("reset");
}

// Player movement
function movePlayer(latMove: number, lngMove: number) {
  playerPos = leaflet.latLng(
    playerPos.lat + latMove,
    playerPos.lng + lngMove,
  );
  playerMarker.setLatLng(playerPos);
  regenerateMap();
}

northButton.addEventListener("click", () => movePlayer(TILE_DEGREES, 0));
southButton.addEventListener("click", () => movePlayer(-TILE_DEGREES, 0));
westButton.addEventListener("click", () => movePlayer(0, -TILE_DEGREES));
eastButton.addEventListener("click", () => movePlayer(0, TILE_DEGREES));
sensorButton.addEventListener("click", () => geoLocation());
resetButton.addEventListener("click", () => reset());
