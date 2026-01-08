import {getData, getDataPersist} from "./getdata.js";

const targetName = "Chipotle";

document.querySelector("#big-title").innerHTML = `${targetName} map of the United States`;

const query = `
[bbox:23,-129,48,-62][out:json][timeout:90];

node["name"="${targetName}"];

out geom;
`;

/**
 * @param {string} innerHTML
 */
function pushUpdate(innerHTML) {
	document.querySelector("#output").innerHTML = innerHTML;
}

/** @type {HTMLDivElement} */
const mapElement = document.querySelector("#map");

const map = L.map(mapElement,{zoomControl: false, attributionControl: false}).setView([39.4, -96.5], 5);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

/**
 * @typedef {{
 * 		id:number,
 * 		lat:number,
 * 		lon:number,
 * 		type:string,
 * 		tags:{}
 * }} OSMNode
 */

/** @type {OSMNode[]} */
let chipotles = [];

const mousePoint = L.circle([0,0], {color:"red",fillColor:"#f03", fillOpacity:1, radius:10}).addTo(map);
const closePoint = L.circle([0,0], {color:"orange",fillColor:"rgb(0, 72, 255)", fillOpacity:1, radius:20}).addTo(map);

const closeLine = [];

function createLines() {
	for (let i=0;i<Math.min(20, chipotles.length); i++) {
		closeLine.push(
			L.polyline([[0,0],[0,0]],{color:"#d66",weight:1, opacity:0.5}).addTo(map)
		);
	}
	console.log(closeLine);
}

setTimeout(async () => {
	const data = await getDataPersist(query,pushUpdate,null,50);
	if (!data) return;

	/** @type {any[]} */
	const elements = data.elements;
	chipotles = elements.filter(el => el.type==="node");

	chipotles.forEach(chip => {
		const coords = chip;

		const huh = L.circle(
			coords, {
				color: 'red',
				fillColor: "#f03",
				fillOpacity: 0.5,
				radius: 5
			}
		).addTo(map);
	});
	createLines();
	closePoint.redraw();
	document.body.attributes.removeNamedItem("data-loading");
	pushUpdate(`<i class="fa-solid fa-check" style="color:#aca"></i> Loaded!`)
}, 1000);

/** @param {OSMNode} location the location */
function locationString(location) {
	let locationText = "";
	if (location.tags["addr:street"]) locationText += location.tags["addr:street"];
	if (location.tags["addr:city"] && location.tags["addr:state"]) locationText += `, ${location.tags["addr:city"]}, ${location.tags["addr:state"]}`;
	else if (location.tags["addr:city"]) locationText += locationText && ", " + location.tags["addr:city"];
	else if (location.tags["addr:state"]) locationText += locationText && ", " + location.tags["addr:state"];

	return locationText;
}

/** @param {MouseEvent} e */
map.on("mousemove",e=>{
	const coords = e.latlng;
	mousePoint.setLatLng(coords);


	/** @type {[number,OSMNode][]} */
	let byDist = [];

	byDist = chipotles.map(node => {
		const dist = coords.distanceTo([node.lat, node.lon]);
		return [dist, node];
	});

	if (!byDist.length) return;
	byDist.sort((a,b) => a[0]-b[0]);

	/** @param {number} lo		@param {number} val		@param {number} hi */
	const clamp = (lo, val, hi) => Math.min(Math.max(lo, val), hi);

	for (let i=0;i<Math.min(byDist.length, 20); i++) {
		const [dist, location] = byDist[i];

		const options = {opacity:1, weight:1}

		if (i == 0) options.weight = clamp(1,1_000_000/dist,4);
		options.opacity = clamp(0.33,1_000_000/dist + (i==0)*0.5, (i==0) ? 1 : 0.5);

		closeLine[i].setLatLngs([[coords.lat, coords.lng], [location.lat, location.lon]]);
		closeLine[i].setStyle(options);
	}
	
	const loc = locationString(byDist[0][1]);

	pushUpdate(`${loc && (loc + ": ")}${formatDistanceImperial(byDist[0][0])} away`);

});

/** 
 * @param {number} distanceMeters distance in meters
 * @returns {string} distance as text
*/
function formatDistanceImperial(distanceMeters) {
	const MILES = 5280;
	
	let feet = distanceMeters * 3.281;
	
	if (feet < MILES * 0.5) {
		return `${feet.toLocaleString()}ft`;
	}
	return `${(feet/MILES).toLocaleString()}mi`;
}

/** @type {HTMLDialogElement} */
const infoDialog = document.querySelector("dialog#info-dialog");

document.querySelector("button.info-button").addEventListener("click",() => {infoDialog.showModal()});
document.querySelector("button.info-close").addEventListener("click",() => {infoDialog.close()});