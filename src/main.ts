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

let playerItems = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

function spawnItem(i: number, j: number) {
  const origin = START_LOCATION;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);
  rect.bindPopup(() => {
    let pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 100);

    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is an item here at "${i},${j}". It has value <span id="value">${pointValue}</span>.</div>`;
    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!;
    const collectButton = document.createElement("button");
    collectButton.textContent = "Collect Item";
    collectButton.addEventListener("click", () => {
      playerItems++;
      pointValue--;
      popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = pointValue
        .toString();
      statusPanel.innerHTML = `${playerItems} items collected`;
    });
    popupDiv.appendChild(collectButton);
    const depositButton = document.createElement("button");
    depositButton.textContent = "Deposit Item";
    depositButton.addEventListener("click", () => {
      if (playerItems > 0) {
        playerItems--;
        pointValue++;
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          pointValue.toString();
        statusPanel.innerHTML = `${playerItems} items collected`;
      } else {
        alert("No items to deposit!");
      }
    });
    popupDiv.appendChild(depositButton);
    return popupDiv;
  });
}

for (let i = -SEARCH_SIZE; i < SEARCH_SIZE; i++) {
  for (let j = -SEARCH_SIZE; j < SEARCH_SIZE; j++) {
    if (luck([i, j].toString()) < ITEM_SPAWN_PROBABILITY) {
      spawnItem(i, j);
    }
  }
}
