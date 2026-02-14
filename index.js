// @ts-check
import "./LinkedList.js";
import "./src/format.js";

// import BitWise from "./src/bitwise.js";
// window.BitWise=BitWise;

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
const clampWithin = [[40.5, -75], [41.5, -72.5]];

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
}).setView([(clampWithin[0][0] + clampWithin[1][0])/2,(clampWithin[0][1] + clampWithin[1][1])/2], 9);

// @ts-ignore
L.control.scale().addTo(map);

// @ts-ignore
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// @ts-ignore // big black region borders
L.rectangle(clampWithin, {color: "black", weight: 2,fillColor: "transparent",interactive:false}).addTo(map);

// @ts-ignore
let boundsRect = L.rectangle([[0,0],[0,0]], {color: "#ff7800", weight: 1,interactive:false}).addTo(map);

class Intro extends EventTarget {
	state=0;
	constructor() {
		super();
		this.addEventListener("onepoint",this.advance.bind(this,1));
		this.addEventListener("twopoint",this.advance.bind(this,2)); // 2 points
		this.addEventListener("mapLoad",this.advance.bind(this,3)); // load
		this.addEventListener("zoom",this.advance.bind(this,4));
		this.state=0;
	}

	advance(stage=0) {
		if (stage < this.state) return;
		const el = document.querySelector("#intro-text i");
		if (!el) return;
		
		let text="";
		text = [
			"Click anywhere on the map", // start -->
			"Choose another point", // they've clicked 1 -->
			"Route may take a min to load...", // they've clicked 2 -->
			"Zoom in and explore the route!", // route just loaded
			`Keep exploring!`
		][stage];

		el.innerHTML=text;
	}
}

const intro = new Intro();

map.on("zoomend",()=>{intro.dispatchEvent(new Event("zoom"))});

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
		data.circleLocs.forEach(loc => circles.push(L.circle(loc, {interactive:false}).addTo(map)));

		// @ts-ignore
		L.rectangle(data.bounds, {fillColor: "#8f8", weight: 1, color: "transparent",interactive:false}).addTo(map);
		boundsRect.setBounds([[0,0],[1,1]]);
		return;
	}
	if (data.from == "findPath") {
		// console.log(data);
		console.log("Recieved [some] path data");
		if (!data.chosenPoints) {
			console.log("No chosen points", data);
			return;
		}
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
		document.querySelector("#output")?.removeAttribute("has-content");
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
		intro.dispatchEvent(new Event("mapLoad"));
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

/** @type {number} */
let lastFocused=0;

map.on("click",/** @param {LeafletMouseEvent} e */ e=> {
	// send **coords** and 
	mapDataWorker.postMessage({action: "findPath", eventPoint:e.latlng,eventPointIndex:lastFocused ?? undefined});

	lastFocused = (lastFocused+1) % 2;
	document.body.setAttribute("last-focused",lastFocused.toString());
	// pushUpdate("thinking...");
});

function drawChosenPoints() {
	/** @type {NodeListOf<HTMLInputElement>} */
	const inputs = document.querySelectorAll(".input-center div.point-selector input");
	if (!inputs || inputs.length < 2) return;

	if (!chosenPoints[0]) chosePointCircles[0].setLatLng([0,0]);
	if (!chosenPoints[1]) chosePointCircles[1].setLatLng([0,0]);

	if (chosenPoints[0]) {
		intro.dispatchEvent(new Event("onepoint"));
		chosePointCircles[0].setLatLng(chosenPoints[0]);
		let a = chosenPoints[0];
		inputs[0].value = "lat" in a ? `${a.lat.toFixed(2)} ${a.lng.toFixed(2)}` : `${a[0]?.toFixed(2)} ${a[1]?.toFixed(2)}`;
	}
	else inputs[0].value="";
	if (chosenPoints[1]) {
		intro.dispatchEvent(new Event("twopoint"));
		chosePointCircles[1].setLatLng(chosenPoints[1]);
		let a = chosenPoints[1];
		inputs[1].value = "lat" in a ? `${a.lat.toFixed(2)} ${a.lng.toFixed(2)}` : `${a[0]?.toFixed(2)} ${a[1]?.toFixed(2)}`;
	}
	else inputs[1].value="";
}

/** @type {HTMLDialogElement} */ // @ts-ignore
const infoDialog = document.querySelector("dialog#info-dialog");

document.querySelector("button.info-button")?.addEventListener("click",() => {infoDialog.showModal()});
document.querySelector("button.info-close")?.addEventListener("click",() => {infoDialog.close()});

/** @param {HTMLInputElement} inputEl */
function processInput(inputEl, idx=0) {
	
	const newVal = inputEl.value;
	
	/** @type {(number|string)[]} */
	let coords = [];

	coords = newVal.split(/[,\s]+/).map(el=>(+el));
	console.log(coords);
	if (coords.length == 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
		mapDataWorker.postMessage({action: "findPath", eventPoint:coords, eventPointIndex:idx});
		return;
	}

	return;
}

// @ts-ignore
document.querySelectorAll(".input-center div.point-selector").forEach(/** @param {HTMLDivElement} el */ (el,idx)=>{
	const inp = el.querySelector("input");
	if (!inp) return;
	inp.addEventListener("keyup",e=>{
		console.log(e);
		if (e.key!="Enter") return;
		processInput(inp,idx);
	});
	el.querySelector("button")?.addEventListener("click",e=>{
		console.log(e);
		processInput(inp,idx);
	});
	inp.addEventListener("focus",e=>{
		lastFocused=idx;
		document.body.setAttribute("last-focused",lastFocused.toString());
	});
});

document.querySelector(".overlay button.route-control.clear")?.addEventListener("click",()=>mapDataWorker.postMessage({action: "findPath"}));

document.querySelector(".overlay button.route-control.hide")?.addEventListener("click",()=>{
	document.querySelector(".overlay.directions")?.classList.add("hidden");
});

document.querySelector("button.unhide")?.addEventListener("click",()=>{
	document.querySelector(".overlay.directions")?.classList.remove("hidden");
});