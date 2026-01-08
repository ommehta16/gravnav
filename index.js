import {getData, getDataPersist} from "./getdata.js";

const query = `
[bbox:23,-129,48,-62][out:json][timeout:90];

node["name"="Chipotle"];

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

const map = L.map(mapElement).setView([39.4, -96.5], 5);

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
/** @type {LatLng[]} */
let chipotleLocations = [];

function updateChipotleLocations() {
	for (const node of chipotles) chipotleLocations.push(L.latLng(node.lat, node.lon));
}

const mousePoint = L.circle([0,0], {color:"red",fillColor:"#f03", fillOpacity:1, radius:10}).addTo(map);
const closePoint = L.circle([0,0], {color:"orange",fillColor:"rgb(0, 72, 255)", fillOpacity:1, radius:20}).addTo(map);

const closeLine = L.polyline([[0,0],[0,0]],{color:"orange",weight:5, opacity:50}).addTo(map);

setTimeout(async () => {
	const data = await getDataPersist(query,pushUpdate,null,50);
	if (!data) return;

	/** @type {any[]} */
	const elements = data.elements;
	chipotles = elements.filter(el => el.type==="node");

	pushUpdate(chipotles)

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
	updateChipotleLocations();
	closePoint.redraw();
}, 1000);

/** @param {MouseEvent} e */
map.on("mousemove",e=>{
	const coords = e.latlng;
	mousePoint.setLatLng(coords);

	let bestDist = Infinity;

	/** @type {LatLng} */
	let bestLocation = null;
	for (const location of chipotleLocations) {
		/** @type {number} */	
		const dist = coords.distanceTo(location);

		if (dist < bestDist) {
			bestDist = dist;
			bestLocation = location;
		}
	}
	// console.log("Best Location: ", bestLocation)
	if (!bestLocation) return;

	closePoint.setLatLng(bestLocation);
	closeLine.setLatLngs([coords, bestLocation]);

	pushUpdate(`The closest Chipotle is ${formatDistanceImperial(bestDist)} away`)

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