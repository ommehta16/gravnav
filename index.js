// @ts-check
import "./LinkedList.js";
import "./src/format.js";
/** @import * as L from "./leaflet/dist/leaflet-src.esm.js" */

// @ts-ignore
window.L = L;

// @ts-ignore
document.querySelector("#big-title").innerHTML = `GravNav`;

/** @type {[number,number][]} */
const mapCenter = [[40.5, -75], [41.5, -74]];
// [[40.67,-74.22], [40.71, -74.14]];
// [[25,-100],[50,-60]];

/** Sync this between here and ./src/worker.js !! */
const clampWithin = [[40.5, -75], [41.5, -73]];

// @ts-ignore
const mapDataWorker = window.mapDataWorker = new Worker("src/worker.js", {type:"module"});

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
}).setView([(mapCenter[0][0] + mapCenter[1][0])/2,(mapCenter[0][1] + mapCenter[1][1])/2], 9);

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
	 * 	chosenPoints: [LatLng,LatLng]|null,
	 * 	chipotleRoute?: (LatLng|[number,number])[]|null,
	 * 	normalRoute?: (LatLng|[number,number])[]|null,
	 * 	navigation: string,
	 * 	error:string
	 * }|{
	 * 	from: "findPathUpdate",
	 * 	routeDesc: string,
	 * 	progress: number
	 * }
	 * }
	 */
	const data = e.data;
	
	if (data.from=="getMap") {
		if (!data.bounds || !data.clampWithin ) {
			// console.log("can confirm.");
			boundsRect.setBounds([[0,0],[0,0]]);
			document.body.attributes.getNamedItem("data-loading") && document.body.attributes.removeNamedItem("data-loading");
			return;
		}
		boundsRect.setBounds(data.bounds);
		if (!data.circleLocs) return;

		circles.forEach(el=>el.remove());
		// @ts-ignore
		data.circleLocs.forEach(loc => circles.push(L.circle(loc).addTo(map)));

		// @ts-ignore
		L.rectangle(data.bounds, {fillColor: "#8f8", weight: 1, color: "transparent",interactive:false}).addTo(map);
		boundsRect.setBounds([[0,0],[1,1]]);
		return;
	}
	if (data.from == "findPath") {
		// console.log(data);
		if (!data.chosenPoints) return;
		chosenPoints = data.chosenPoints;
		drawChosenPoints();

		if (data.error) {
			console.log("Error recieved");
			routeLine.setLatLngs([[0,0],[0,0]]);
			routeLineB.setLatLngs([[0,0],[0,0]]);

			chosenPoints=[null,null];
			drawChosenPoints();

			setLoadingBar(100,"No route available",true);
			navigation="No route available";
			pushUpdate("");
			return;
		}
		
		navigation=data.navigation;

		if (!data.chosenPoints[1]) {
			setLoadingBar(0);
			document.querySelector("#output")?.removeAttribute("has-content");
			routeLine.setLatLngs([[0,0],[0,0]]);
			routeLineB.setLatLngs([[0,0],[0,0]]);
			return;
		}
		routeLine.setLatLngs(data.chosenPoints);
		routeLineB.setLatLngs(data.chosenPoints);
		pushUpdate("");
		routeLineB.setStyle({dashArray:`${5*(1<<10)/Math.pow(2,map._zoom)}`,opacity:0.5,weight:2});
		routeLineB.setStyle({dashArray:`${5*(1<<10)/Math.pow(2,map._zoom)}`,opacity:0.5,weight:2});

		if (!data.normalRoute) return;
		routeLine.setLatLngs(data.normalRoute);
		routeLine.setStyle({dashArray:``,opacity:1, weight:5});
		if (!data.chipotleRoute) return;
		routeLineB.setLatLngs(data.chipotleRoute);
		routeLineB.setStyle({dashArray:``,opacity:1, weight:5});
		navigation=data.navigation;
		document.querySelector("#output")?.setAttribute("has-content","");
		pushUpdate("");
		setLoadingBar(100, "done!");
	}
	if (data.from == "findPathUpdate") setLoadingBar(data.progress, data.routeDesc);
});

/** @param {number} percentage @param {boolean|null} error */
function setLoadingBar(percentage, statusText="loading...", error=null) {
	/** @type {HTMLDivElement|null} */
	const loadingBar = document.querySelector(".loading-outer");
	/** @type {HTMLSpanElement|null|undefined} */
	const loadingText = loadingBar?.querySelector("span");
	if (!loadingBar || !loadingText) return;
	loadingBar.removeAttribute("error");
	if (error) loadingBar.setAttribute("error","");
	loadingBar.style.setProperty("--loading-progress",`${percentage}%`);
	if (percentage == 100) {
		loadingBar.classList.add("full");
		setTimeout(()=>{
			loadingBar.classList.remove("full");
			loadingBar.classList.add("empty");
			loadingBar.removeAttribute("error");
		},error ? 5_000:500);
	}
	else if (percentage == 0) loadingBar.classList.add("empty");
	else loadingBar.classList.remove("full","empty");
	if (loadingText.innerHTML!=statusText) loadingText.innerHTML=statusText;
}

/** 
 * @typedef {{
 * 	lat:number,
 * 	lng:number,
 * 	alt?:number
 * }|[number|null,number|null]|null} LatLng;
 * 
 * @typedef {{
 * 	latlng: LatLng,
 * 	layerPoint: {},
 * 	containerPoint: {},
 * }} LeafletMouseEvent;
*/

/** @type {[LatLng,LatLng]} */
let chosenPoints = [null, null];

// @ts-ignore
let routeLine = L.polyline([[0,0],[1,1]],{color:"#0f0",weight:5, opacity:1,interactive:false}).addTo(map);
// @ts-ignore
let routeLineB = L.polyline([[0,0],[1,1]],{color:"#f0f",weight:5, opacity:1,interactive:false}).addTo(map);

let chosePointCircles =[ //@ts-ignore
	L.circle( [0,0], { color: 'blue', fillColor: "rgb(0, 0, 145)", fillOpacity: 1, radius: 30, interactive: false,weight:5 } ).addTo(map), // @ts-ignore				
	L.circle( [0,0], { color: 'red', fillColor: "rgb(134, 0, 0)", fillOpacity: 1, radius: 30, interactive: false,weight:5 } ).addTo(map)
];

map.on("click",/** @param {LeafletMouseEvent} e */ e=> {
	mapDataWorker.postMessage({action: "findPath", eventPoint:e.latlng});
	// pushUpdate("thinking...");
});

function drawChosenPoints() {
	const inputs = document.querySelectorAll(".input-center button.point-selector");
	if (!inputs || inputs.length < 2) return;

	if (!chosenPoints[0]) chosePointCircles[0].setLatLng([0,0]);
	if (!chosenPoints[1]) chosePointCircles[1].setLatLng([0,0]);

	if (chosenPoints[0]) {
		chosePointCircles[0].setLatLng(chosenPoints[0]);
		let a = chosenPoints[0];
		inputs[0].innerHTML = "lat" in a ? `${a.lat.toFixed(2)} ${a.lng.toFixed(2)}` : `${a[0]?.toFixed(2)} ${a[1]?.toFixed(2)}`;
	}
	else inputs[0].innerHTML="Select a point";
	if (chosenPoints[1]) {
		chosePointCircles[1].setLatLng(chosenPoints[1]);
		let a = chosenPoints[1];
		inputs[1].innerHTML = "lat" in a ? `${a.lat.toFixed(2)} ${a.lng.toFixed(2)}` : `${a[0]?.toFixed(2)} ${a[1]?.toFixed(2)}`;
	}
	else inputs[1].innerHTML="Select a point";
}

/** @type {HTMLDialogElement} */ // @ts-ignore
const infoDialog = document.querySelector("dialog#info-dialog");

document.querySelector("button.info-button")?.addEventListener("click",() => {infoDialog.showModal()});
document.querySelector("button.info-close")?.addEventListener("click",() => {infoDialog.close()});