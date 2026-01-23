// @ts-check

import {getDataPersist} from "./getdata.js";
import "./LinkedList.js";
import LinkedList from "./LinkedList.js";
import "./PriorityQueue.js";
import PriorityQueue from "./PriorityQueue.js";

// @ts-ignore
document.querySelector("#big-title").innerHTML = `[project name goes here!]`;

/** @type {[number,number][]} */
const mapCenter = [[40.54, -75.33], [41.31, -74.09]];
//[[40.67,-74.22], [40.71, -74.14]];
// [[25,-100],[50,-60]];
/** @type {[number,number][]} */
let bounds = mapCenter.map(a=>[...a]);

class GraphNode {
	/** @type {number} */
	id;

	/** @type {LatLng} */
	coords;

	/** Node ID --> time to reach
	 * @type {Map<number,number>}
	 */
	neighbors;

	/** 
	 * @param {number} id
	 * @param {LatLng} latLng
	 */
	constructor(id, latLng) {
		this.id=id;
		this.coords=latLng;
		this.neighbors = new Map();
	}
}

/** @type {Map<number, GraphNode>} */
const nodes= new Map();

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

/**
 * @param {[number,number]} location 
 * @returns {[number,number][]}
 */
function offsetBounds(location) {
	const regionWidth = mapCenter[1][1] - mapCenter[0][1];
	const regionHeight = mapCenter[1][0] - mapCenter[0][0];

	/** @type {[number,number][]} */
	const bounds = [
		[mapCenter[0][0] + regionHeight*location[0], mapCenter[0][1] + regionWidth*location[1]],
		[mapCenter[1][0] + regionHeight*location[0], mapCenter[1][1] + regionWidth*location[1],]
	];

	return bounds;
}

/** 
 * @param {[number,number][]} bounds 
 * @returns {[number,number][]}
 */
function clampBounds(bounds) {
	
	// 38.02, -77.90 --> 42.50, -69.73 = DC --> NY metro ishhh
	// return [
	// 	[ clamp(-90, bounds[0][0], 90), clamp(-180, bounds[0][1], 180) ],
	// 	[ clamp(-90, bounds[1][0], 90), clamp(-180, bounds[1][1], 180) ]
	// ];
	// @ts-ignore
	L.rectangle([[38.02, -77.90], [42.50, -69.73]], {color: "black", weight: 2,fillColor: "transparent",interactive:false}).addTo(map);
	return [
		[ clamp(38.02, bounds[0][0], 42.55), clamp(-77.90, bounds[0][1], -69.73) ],
		[ clamp(38.02, bounds[1][0], 42.50), clamp(-77.90, bounds[1][1], -69.73) ]
	];
}

/** @param {number[][]} bounds */
const hasArea = (bounds) => bounds[0][0]!=bounds[1][0] && bounds[0][1]!=bounds[1][1];

/** @type {[number,number][][]} */
let boundsRemaining = [];

/** Determine if `loL` includes `item`
 * @param {number[][]} loL a list of list of numbers @param {number[]} item a list of numbers
 */
const includes = (loL, item) => loL.some(lis =>  lis.every((val, i)=>val == item[i]) );

async function generateBoundsOrder() {
	pushUpdate("Generating bounds...")

	/** @type {[number,number][]} */
	let offsets = [[0,0]];
	
	/** @type {LinkedList<number[]>} */
	let todo = new LinkedList();
	todo.push([0,0]);
	
	while (todo.length > 0 && offsets.length < 10_000) {
		const curr = todo.pop();
		if (!curr) return;

		const deltaLoc = [ [0,1], [0,-1], [1,0], [-1,0] ];

		for (const offset of deltaLoc) {
			/** @type {[number, number]} */
			const neighbor = [offset[0]+curr[0], offset[1]+curr[1]];
			if (includes(offsets,neighbor)) continue;
			if (!hasArea(clampBounds(offsetBounds(neighbor)))) continue;

			todo.push(neighbor);
			offsets.push(neighbor);
		}
	}
	boundsRemaining = offsets.map(offset => clampBounds(offsetBounds(offset))).toReversed();
	pushUpdate(`<i class="fa-solid fa-check" style="color:#aca"></i> Bounds Generated!`)
}

let navigation = ``;

/**
 * @param {string} innerHTML
 */
function pushUpdate(innerHTML) {
	// @ts-ignore
	document.querySelector("#output").innerHTML = navigation + innerHTML;
}

/** @type {HTMLDivElement} */
// @ts-ignore
const mapElement = document.querySelector("#map");

// @ts-ignore
const map = L.map(mapElement,{
	zoomControl: false,
	attributionControl: false,
	preferCanvas:true
}).setView([39.4, -96.5], 5);

// @ts-ignore
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const boundsPromise = generateBoundsOrder()
	.then(updateQuery);

// @ts-ignore
let rect = L.rectangle(bounds, {color: "#ff7800", weight: 1,interactive:false}).addTo(map);

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

// let circles = [];

/** 
 * @typedef {{
 * 	id:number;
 *  geometry: {
 * 		lat: number,
 * 		lon: number
 * 	}[];
 *	tags:{[key:string]:string};
 *	nodes: number[];
 *  type: string;
 * }} OSMWay
 */

async function getMap() {
	if (!boundsRemaining.length) return;

	// @ts-ignore
	bounds = boundsRemaining.pop();

	updateQuery();
	// console.log(query);
	rect.setBounds(bounds);

	/** @type {{elements:OSMWay[]}}} */
	// @ts-ignore
	const data = await getDataPersist(query,undefined,undefined,50);
	if (!data) return;
	// console.log(data);

	/** @type {OSMWay[]} */
	const elements = data.elements;
	const roads = elements.filter(el=>el.type==="way" && !nodes.has(el.id));

	roads.forEach(rd => {
		/** Speed in **km/h**
		 * @type {number} 
		 */
		let speed = 50;
		if ("maxspeed" in rd.tags) {
			/** @type {string} */ // @ts-ignore
			const spdText = rd.tags.maxspeed;
			if (Number.isFinite(+spdText)) speed=(+spdText);
			else {
				try {
					const [spd,unit] = spdText.split(" ");
					if (unit == "mph") speed = (+spd) * 1.609344;
					if (unit == "knots") speed = (+spd) * 1.852;
				}
				catch { }
			}
		}
		

		rd.nodes.forEach((id, i) => {
			const coords = rd.geometry[i];

			if (!nodes.has(id)) {
				const node = new GraphNode(id, {lat:coords.lat, lng:coords.lon});
				nodes.set(id, node);
			}

			const node = nodes.get(id);
			if (!node) return;

			if (i != 0) {
				/** Distance in **km** @type {number} */
				const dist = map.distance(rd.geometry[i-1],coords)/1000;
				const time = dist/speed;
				node.neighbors.set(rd.nodes[i-1],time);
			}
			if (i != rd.nodes.length-1) {
				/** Distance in **km** @type {number} */
				const dist = map.distance(rd.geometry[i+1],coords)/1000;
				const time = dist/speed;
				node.neighbors.set(rd.nodes[i+1],time);
			}

			// i!=0 				 && node.neighbors.add(rd.nodes[i-1]);
			// i!=rd.nodes.length-1 && node.neighbors.add(rd.nodes[i+1]);
		});
	});

	// @ts-ignore
	L.rectangle(bounds, {fillColor: "#8f8", weight: 1, color: "transparent",interactive:false}).addTo(map);

	// if (Date.now() - lastRedraw > 6_000_000) {
		
	// 	const oldRoadLines = roadLines;

	// 	roadLines = roads.map(rd => {
	// 		if (!([
	// 			"trunk",
	// 			"primary",
	// 			"secondary",
	// 			// "tertiary",
	// 			"motorway",
	// 		].includes(rd.tags["highway"]))) return null;
			
	// 		const points = rd.geometry.map(coord => [coord.lat, coord.lon]);
	// 		// let hexed = (rd.id % 0xFFFFFF).toString(16);
	// 		hexed = hexed.substring(0,Math.min(6,hexed.length));
	// 		return L.polyline(points,{color:`#0f0`,weight:1, opacity:1}).addTo(map);
	// 	}).filter(el => el);

	// 	oldRoadLines.forEach(el => el.remove());
	// 	lastRedraw = Date.now();
	// }

	// chipotles = Array.from((new Set([...elements.filter(el => el.type==="node"), ...chipotles])));
	// console.log(`Recieved ${elements.length} Chipotles. `)
	// const oldcircles = circles;

	// circles = [];

	// chipotles.forEach(chip => {
	// 	const coords = chip;

	// 	circles.push(
	// 			L.circle(
	// 			coords, {
	// 				color: 'red',
	// 				fillColor: "#f03",
	// 				fillOpacity: 0.5,
	// 				radius: 5,
	// 				interactive: false
	// 			}
	// 		).addTo(map)
	// 	);
	// });

	// for (const circle of oldcircles) circle.remove();

	document.body.attributes.getNamedItem("data-loading") && document.body.attributes.removeNamedItem("data-loading");
	// pushUpdate(`
	// 	<i class="fa-solid fa-check" style="color:#aca"></i>
	// 	Found ${total}. Loaded ${roads.length} ways = ${roadLines.length} roadlines
	// `);

	// console.log("just grabbed map, will do again soon");
	rect.setBounds([[0,0],[1,1]]);

	setTimeout(getMap,0);
}

boundsPromise.then(getMap);

/** @param {OSMNode} location the location */
function locationString(location) {
	let locationText = "";
	if (location.tags["addr:street"]) locationText += location.tags["addr:street"];
	if (location.tags["addr:city"] && location.tags["addr:state"]) locationText += `, ${location.tags["addr:city"]}, ${location.tags["addr:state"]}`;
	else if (location.tags["addr:city"]) locationText += locationText && ", " + location.tags["addr:city"];
	else if (location.tags["addr:state"]) locationText += locationText && ", " + location.tags["addr:state"];

	return locationText;
}

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
let chosePointCircles =[L.circle( [0,0], { color: 'red', fillColor: "#f03", fillOpacity: 0.5, radius: 20, interactive: false } ).addTo(map), // @ts-ignore				
	L.circle( [0,0], { color: 'blue', fillColor: "#30f", fillOpacity: 0.5, radius: 20, interactive: false } ).addTo(map)];

map.on("click",/** @param {LeafletMouseEvent} e */ e=> {
	const clickPoint = [e.latlng.lat, e.latlng.lng];
	let bestID = 0;
	let bestDist = 1e18;
	
	nodes.forEach((point) => {
		if (map.distance(clickPoint,point.coords) < bestDist) {
			bestDist = map.distance(clickPoint,point.coords);
			bestID=point.id;
		}
	});
	
	if (!chosenPoints[0]) chosenPoints[0] = bestID;
	else if (!chosenPoints[1]) chosenPoints[1] = bestID;
	else chosenPoints = [bestID,null];

	drawChosenPoints();

	// console.log(chosenPoints, nodes.has(chosenPoints[0]), nodes.has(chosenPoints[1]));
	// console.log(nodes.get(chosenPoints[0]));
	// console.log(nodes.get(chosenPoints[1]));
	routeLine.setLatLngs([[0,0],[0,0]]);
	chosenPoints[0] && chosenPoints[1] && findPath(chosenPoints[0],chosenPoints[1]);
});

/** Find the shortest path between nodes `a` and `b`, using A*
 * @param {number} start id of starting node
 * @param {number} end id of ending node
 */
function findPath(start, end) {
	if (!(chosenPoints[0] && chosenPoints[1])) return;
	console.log(`Finding path between ${chosenPoints[0]} and ${chosenPoints[1]}`);

	/** Parent in optimal traversal: node id --> node id
	 * @type {Map<number, number>} 
	 */
	const bestFrom = new Map();

	/** id --> distance from start to node
	 * @type {Map<number, number>}
	 */
	const distanceTo = new Map();

	/** All IDs that we've seen before
	 * @type {Set<number>}
	 */
	const visited = new Set();

	/**
	 * @typedef {{
	 * 	reweighted: number;
	 * 	distance: number;
	 * 	to: number;
	 * }} toCheck 
	 *  - `reweighted`: the potential-re-weighted distance.
	 * 
	 *  - `distance`: path distance from node A -> to.
	 * 
	 *  - `to`: target node ID
	 */

	/** @type {PriorityQueue<toCheck>} */
	const todo = new PriorityQueue((a,b)=>a.reweighted-b.reweighted);
	
	bestFrom.set(start,-1);
	distanceTo.set(start,0);
	todo.push({to:start,distance:0,reweighted:0});
	visited.add(start);

	// @ts-ignore
	const destCoords = nodes.get(end).coords;

	let found=false;
	// console.log("hello");
	let dist = 1e18;
	while (todo.length() && !found) {
		const check = todo.pop();
		if (!check) break;
		const curr = check.to;
		const startDistance = check.distance;
		// const coords = nodes.get(curr).coords;

		// @ts-ignore
		for (const [neighbor,edgeLength] of nodes.get(curr).neighbors) {
			// console.log(`${curr} -> ${neighbor}`);
			if (visited.has(neighbor)) continue;

			bestFrom.set(neighbor,curr);

			// @ts-ignore
			const neighborCoords = nodes.get(neighbor).coords;

			const distance = startDistance+edgeLength;
			const distanceRemaining = (map.distance(neighborCoords,destCoords))/1000;
			const potential = distanceRemaining/50;

			if (neighbor == end) {
				// alert("WEVE GOT HIM");
				console.log("WEVE GOT HIMMMM");
				found=true;
				dist = distance;
				break;
			}

			todo.push({reweighted:distance+potential,distance:distance,to:neighbor});
			visited.add(neighbor);
		}
	}

	let curr = end;
	
	/** @type {LatLng[]} */
	let bruh = [];

	let distance=0;
	let prev=nodes.get(curr);
	while (curr != -1) {
		// @ts-ignore
		bruh.push(nodes.get(curr).coords);
		// @ts-ignore
		distance += map.distance(nodes.get(curr).coords, prev.coords);
		prev=nodes.get(curr);
		
		// @ts-ignore
		curr = bestFrom.get(curr);
	}

	routeLine.setLatLngs(bruh);
	navigation = `${Math.round(dist*100)/100}hr drive • ${Math.round(distance * 0.000621371*100)/100}mi<br/>`;
	pushUpdate("");
}

function drawChosenPoints() {
	// @ts-ignore
	if (chosenPoints[0]) chosePointCircles[0].setLatLng(nodes.get(chosenPoints[0]).coords);
	// @ts-ignore
	if (chosenPoints[1]) chosePointCircles[1].setLatLng(nodes.get(chosenPoints[1]).coords);
}

/** 
 * @param {number} distanceMeters distance in meters
 * @returns {string} distance as text
*/
function formatDistanceImperial(distanceMeters) {
	const MILE = 5280;
	const feet = distanceMeters * 3.281;
	
	if (feet < MILE * 0.5) return `${feet.toLocaleString()}ft`;
	return `${(feet/MILE).toLocaleString()}mi`;
}

/** @type {HTMLDialogElement} */ // @ts-ignore
const infoDialog = document.querySelector("dialog#info-dialog");

document.querySelector("button.info-button")?.addEventListener("click",() => {infoDialog.showModal()});
document.querySelector("button.info-close")?.addEventListener("click",() => {infoDialog.close()});