// @ts-check
import "./LinkedList.js";
import "./src/format.js";
/** @import * as L from "./leaflet/dist/leaflet-src.esm.js" */

// @ts-ignore
window.L = L;

// @ts-ignore
document.querySelector("#big-title").innerHTML = `gravnav`;

/** @type {[number,number][]} */
const mapCenter = [[40.5, -75], [41.5, -74]];
// [[40.67,-74.22], [40.71, -74.14]];
// [[25,-100],[50,-60]];

/** Sync this between here and ./src/worker.js !! */
const clampWithin = [[39.5, -76], [41.5, -73]];

const mapDataWorker = new Worker("src/worker.js", {type:"module"});

let navigation = "";

/** @param {string} innerHTML */
function pushUpdate(innerHTML) {
	// @ts-ignore
	document.querySelector("#output").innerHTML = navigation + innerHTML;
}

/** @type {HTMLDivElement} */ // @ts-ignore
const mapElement = document.querySelector("div#map");

// @ts-ignore
const map = window.map = L.map(mapElement,{
	zoomControl: false,
	attributionControl: false,
	preferCanvas:true
}).setView([(mapCenter[0][0] + mapCenter[1][0])/2,(mapCenter[0][1] + mapCenter[1][1])/2], 4);

// @ts-ignore
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// @ts-ignore // big black region borders
L.rectangle(clampWithin, {color: "black", weight: 2,fillColor: "transparent",interactive:false}).addTo(map);

// @ts-ignore
let boundsRect = L.rectangle([[0,0],[0,0]], {color: "#ff7800", weight: 1,interactive:false}).addTo(map);

/** @type {any[]} */
let circles = [];

mapDataWorker.addEventListener("message",e=>{
	/** 
	 * @type {{
	 * 	from:"getMap",
	 * 	bounds:[number,number][]|null,
	 * 	clampWithin:[number,number][]|null,
	 * 	circleLocs: [number,number][]|null
	 * }|{
	 * 	from: "findPath",
	 * 	chosenPoints: [number|null,number|null]|null,
	 * 	chipotleRoute?: (LatLng|[number,number])[]|null,
	 * 	normalRoute?: (LatLng|[number,number])[]|null,
	 * 	navigation: string
	 * }
	 * }
	 */
	const data = e.data;
	
	if (data.from=="getMap") {
		if (!data.bounds || !data.clampWithin ) {
			boundsRect.setBounds([[0,0],[0,0]]);
			return;
		}
		boundsRect.setBounds(data.bounds);
		if (!data.circleLocs) return;

		circles.forEach(el=>el.remove());
		// @ts-ignore
		data.circleLocs.forEach(loc => circles.push(L.circle(loc).addTo(map)));

		// @ts-ignore
		L.rectangle(data.bounds, {fillColor: "#8f8", weight: 1, color: "transparent",interactive:false}).addTo(map);
		document.body.attributes.getNamedItem("data-loading") && document.body.attributes.removeNamedItem("data-loading");
		boundsRect.setBounds([[0,0],[1,1]]);
		return;
	}
	if (data.from == "findPath") {
		if (!data.chosenPoints) return;
		chosenPoints = data.chosenPoints;
		drawChosenPoints();
		
		navigation=data.navigation;
		routeLine.setLatLngs(data.chosenPoints);
		routeLineB.setLatLngs([[0,0],[0,0]]);
		pushUpdate("");

		if (!data.chipotleRoute || !data.normalRoute) return;
		routeLine.setLatLngs(data.chipotleRoute);
		routeLineB.setLatLngs(data.normalRoute);
		navigation=data.navigation;
		pushUpdate("");
	}
})

/** 
 * @typedef {{
 * 	lat:number,
 * 	lng:number,
 * 	alt?:number
 * }} LatLng;
 * 
 * @typedef {{
 * 	latlng: LatLng,
 * 	layerPoint: {},
 * 	containerPoint: {},
 * }} LeafletMouseEvent;
*/

/** @type {[null|number,null|number]} */
let chosenPoints = [null, null];

// @ts-ignore
let routeLine = L.polyline([[0,0],[1,1]],{color:"#0f0",weight:5, opacity:1,interactive:false}).addTo(map);
// @ts-ignore
let routeLineB = L.polyline([[0,0],[1,1]],{color:"#f0f",weight:5, opacity:1,interactive:false}).addTo(map);

// @ts-ignore
let chosePointCircles =[L.circle( [0,0], { color: 'red', fillColor: "#f03", fillOpacity: 0.5, radius: 20, interactive: false } ).addTo(map), // @ts-ignore				
	L.circle( [0,0], { color: 'blue', fillColor: "#30f", fillOpacity: 0.5, radius: 20, interactive: false } ).addTo(map)];

map.on("click",/** @param {LeafletMouseEvent} e */ e=> {
	mapDataWorker.postMessage({action: "findPath", eventPoint:e.latlng});
	pushUpdate("thinking...");
});

function drawChosenPoints() {
	if (chosenPoints[0]) chosePointCircles[0].setLatLng(chosenPoints[0]);
	if (chosenPoints[1]) chosePointCircles[1].setLatLng(chosenPoints[1]);
}

/** @type {HTMLDialogElement} */ // @ts-ignore
const infoDialog = document.querySelector("dialog#info-dialog");

document.querySelector("button.info-button")?.addEventListener("click",() => {infoDialog.showModal()});
document.querySelector("button.info-close")?.addEventListener("click",() => {infoDialog.close()});