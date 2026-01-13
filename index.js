import {getData, getDataPersist} from "./getdata.js";
import "./LinkedList.js";
import LinkedList from "./LinkedList.js";

const targetName = "";

document.querySelector("#big-title").innerHTML = `[project name goes here!]`;

const mapCenter = [[40.67,-74.22], [40.71, -74.14]];
// [[25,-100],[50,-60]];
let bounds = mapCenter.map(a=>[...a]);

let query = "";

function updateQuery() {
	query = `
	[bbox:${bounds[0][0]},${bounds[0][1]}, ${bounds[1][0]}, ${bounds[1][1]}][out:json][timeout:90];

	way["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential|road|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|service|motorway)$"];
	out geom qt;
	`;
	// query = `[bbox:${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]}][out:json][timeout:90];

	// node["name"="${targetName}"];

	// out geom;
	// `;
}

/** @param {number} lo		@param {number} val		@param {number} hi */
const clamp = (lo, val, hi) => Math.min(Math.max(lo, val), hi);

/** @param {[number,number]} location */
function offsetBounds(location) {
	const regionWidth = mapCenter[1][1] - mapCenter[0][1];
	const regionHeight = mapCenter[1][0] - mapCenter[0][0];

	bounds = [
		[mapCenter[0][0] + regionHeight*location[0], mapCenter[0][1] + regionWidth*location[1]],
		[mapCenter[1][0] + regionHeight*location[0], mapCenter[1][1] + regionWidth*location[1], ]
	];

	return bounds;
}

/** @param {number[][]} bounds */
function clampBounds(bounds) {
	return [
		[
			clamp(-90, bounds[0][0], 90),
			clamp(-180, bounds[0][1], 180)
		],
		[
			clamp(-90, bounds[1][0], 90),
			clamp(-180, bounds[1][1], 180)
		]
	];
}

/** @param {number[][]} bounds */
const hasArea = (bounds) => bounds[0][0]!=bounds[1][0] && bounds[0][1]!=bounds[1][1];

let boundsRemaining = [];

/** @param {number[][]} loL @param {number[]} item  */
const includes = (loL, item) => loL.some(lis => 
	lis.every((val, i)=>val == item[i])
);

function generateBoundsOrder() {

	console.log("Generating bounds...")

	/** @type {[number,number][]} */
	let offsets = [[0,0]];
	
	/** @type {LinkedList<number[]>} */
	let todo = new LinkedList();
	todo.push([0,0]);
	
	while (todo.length > 0) {
		const curr = todo.pop();
		if (offsets.length > 5_000) break;

		if (!curr) return;

		const deltaLoc = [
			[0,1],
			[0,-1],
			[1,0],
			[-1,0]
		];

		for (const offset of deltaLoc) {
			const neighbor = [offset[0]+curr[0], offset[1] + curr[1]];
			if (includes(offsets,neighbor)) continue;
			if (!hasArea(clampBounds(offsetBounds(neighbor)))) continue;

			todo.push(neighbor);
			offsets.push(neighbor);
		}
	}
	console.log("Generated!")
	// console.log("Offsets: ", offsets);

	boundsRemaining = offsets.map(offset => clampBounds(offsetBounds(offset))).toReversed();	
	// console.log("Bounds Generated: ", boundsRemaining);
}


let contentPreserved = ``;

/**
 * @param {string} innerHTML
 */
function pushUpdate(innerHTML) {
	document.querySelector("#output").innerHTML = contentPreserved + innerHTML;
}

/** @type {HTMLDivElement} */
const mapElement = document.querySelector("#map");

const map = L.map(mapElement,{
	zoomControl: false,
	attributionControl: false,
	preferCanvas:true
}).setView([39.4, -96.5], 5);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

generateBoundsOrder();

updateQuery();

let rect = L.rectangle(bounds, {color: "#ff7800", weight: 1}).addTo(map);

/**
 * @typedef {{
 * 		id:number,
 * 		lat:number,
 * 		lon:number,
 * 		type:string,
 * 		tags: { [key:string]: string|undefined }
 * }} OSMNode
 */

/** @type {OSMNode[]} */
let chipotles = [];

const mousePoint = L.circle([0,0], {color:"red",fillColor:"#f03",fillOpacity:1, radius:10, interactive:false}).addTo(map);

/** @type {any[]} */
const closeLine = [];
let circles = [];

function createLines() {
	for (let i=0;i<Math.min(20, chipotles.length); i++) {
		closeLine.push(
			L.polyline([[0,0],[0,0]],{color:"#d66",weight:1, opacity:0.5}).addTo(map)
		);
	}
}
/** 
 * @typedef {{
 * 	id:number;
 *  geometry: {
 * 		lat: number,
 * 		lon: number
 * 	}[];
 *  tags:{[string]:string};
 * }} OSMWay
 */

/** @type {OSMWay[]} */
let roads = [];

let roadLines = [];

async function getMap() {
	if (!boundsRemaining.length) return;

	bounds = boundsRemaining.pop();
	updateQuery();
	// console.log(query);
	rect.setBounds(bounds);

	const data = await getDataPersist(query,undefined,undefined,50);
	if (!data) return;
	// console.log(data);

	/** @type {any[]} */
	const elements = data.elements;
	
	roads = Array.from(new Set([...elements.filter(el=>el.type==="way"),...roads]));
	const oldRoadLines = roadLines;

	roadLines = roads.map(rd => {
		if (!([
			"trunk",
			"primary",
			"secondary",
			// "tertiary",
			"motorway",
		].includes(rd.tags["highway"]))) return null;
		
		const points = rd.geometry.map(coord => [coord.lat, coord.lon]);
		return L.polyline(points,{color:"#0f0",weight:1, opacity:1}).addTo(map);
	}).filter(el => el);

	oldRoadLines.forEach(el => el.remove());
	
	let repeatedIDs = {};

	/** @type {Set<number>} */
	let seenIDs = new Set();

	roads.forEach(rd => {
		if (rd.id in repeatedIDs) {
			repeatedIDs[rd.id]++;
			return;
		}

		if (seenIDs.has(rd.id)) {
			repeatedIDs[rd.id]=1;
			return;
		}

		seenIDs.add(rd.id);
	});

	console.log("Repeated: ", repeatedIDs);

	chipotles = Array.from((new Set([...elements.filter(el => el.type==="node"), ...chipotles])));
	console.log(`Recieved ${elements.length} Chipotles. `)
	const oldcircles = circles;

	circles = [];

	chipotles.forEach(chip => {
		const coords = chip;

		circles.push(
				L.circle(
				coords, {
					color: 'red',
					fillColor: "#f03",
					fillOpacity: 0.5,
					radius: 5,
					interactive: false
				}
			).addTo(map)
		);
	});

	for (const circle of oldcircles) circle.remove();

	createLines();
	document.body.attributes.getNamedItem("data-loading") && document.body.attributes.removeNamedItem("data-loading");
	pushUpdate(`<i class="fa-solid fa-check" style="color:#aca"></i> Loaded ${roads.length} ways = ${roadLines.length} roadlines`);

	console.log("just grabbed map, will do again soon");
	rect.setBounds([[0,0],[1,1]]);

	setTimeout(getMap,0);
}

setTimeout(getMap, 1000);

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

let chosenPoints = [null, null];

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

map.on("click",/** @param {LeafletMouseEvent} e */ e=> {
	contentPreserved += `Clicked @ ${e.latlng.lat}, ${e.latlng.lng}<br />`;

	if (!chosenPoints[0]) chosenPoints[0] = [e.latlng.lat, e.latlng.lng];
	else if (!chosenPoints[1]) chosenPoints[1] = [e.latlng.lat, e.latlng.lng];
	else chosenPoints = [[e.latlng.lat,e.latlng.lng],null];
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