// @ts-check

import {getDataPersist} from "./src/getdata.js";
import "./LinkedList.js";
import LinkedList from "./LinkedList.js";
import {Graph, GraphNode} from "./src/mapData.js";
import "./src/format.js";
/** 
 * @import {OSMWay, OSMNode} from "./src/mapData.js"
 * 
 */

// @ts-ignore
document.querySelector("#big-title").innerHTML = `gravnav`;

/** @type {[number,number][]} */
const mapCenter = [[40.54, -75.33], [41.31, -74.09]];
// [[40.67,-74.22], [40.71, -74.14]];
// [[25,-100],[50,-60]];

/** @type {[number,number][]} */
let bounds = mapCenter.map(a=>[...a]);

const clampWithin = [[40.43, -75.33], [41.93, -71.84]];
//[[-90, -180], [90, 180]];

const graph = new Graph();

// @ts-ignore
window.graph = graph;

let query = "";

function updateQuery() {
	query = `
	[bbox:${bounds[0][0]},${bounds[0][1]}, ${bounds[1][0]}, ${bounds[1][1]}][out:json][timeout:90];
	(
		way["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential|road|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|service|motorway)$"];
		node["name"="Chipotle"];
	);
	out geom qt;`;
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
	// return [
	// 	[ clamp(-90, bounds[0][0], 90), clamp(-180, bounds[0][1], 180) ],
	// 	[ clamp(-90, bounds[1][0], 90), clamp(-180, bounds[1][1], 180) ]
	// ];
	return [
		[ clamp(clampWithin[0][0], bounds[0][0], clampWithin[1][0]), clamp(clampWithin[0][1], bounds[0][1], clampWithin[1][1]) ],
		[ clamp(clampWithin[0][0], bounds[1][0], clampWithin[1][0]), clamp(clampWithin[0][1], bounds[1][1], clampWithin[1][1]) ]
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

let navigation = "";

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
}).setView([(mapCenter[0][0] + mapCenter[1][0])/2,(mapCenter[0][1] + mapCenter[1][1])/2], 4);

// @ts-ignore
window.map = map;

// @ts-ignore
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const boundsPromise = generateBoundsOrder()
	.then(updateQuery);


// @ts-ignore
const outline = L.rectangle(clampWithin, {color: "black", weight: 2,fillColor: "transparent",interactive:false}).addTo(map);

// @ts-ignore
let rect = L.rectangle(bounds, {color: "#ff7800", weight: 1,interactive:false}).addTo(map);

// /** @type {OSMNode[]} */
// let chipotles = [];
/** @type {any[]} */
let circles = [];

async function getMap() {
	if (!boundsRemaining.length) return;

	// @ts-ignore
	bounds = boundsRemaining.pop();

	updateQuery();
	rect.setBounds(bounds);

	console.log("bouta get data");
	/** @type {{elements:OSMWay[]}}} */ // @ts-ignore
	const data = await getDataPersist(query,pushUpdate,undefined,50);
	if (!data) return;
	graph.loadData(data);
	
	circles.forEach(el=>el.remove());
	circles = [];
	// @ts-ignore
	graph.locations.forEach(loc => circles.push(L.circle(loc).addTo(map)));

	// @ts-ignore
	L.rectangle(bounds, {fillColor: "#8f8", weight: 1, color: "transparent",interactive:false}).addTo(map);

	document.body.attributes.getNamedItem("data-loading") && document.body.attributes.removeNamedItem("data-loading");

	// console.log("just grabbed map, will do again soon");
	rect.setBounds([[0,0],[1,1]]);

	setTimeout(getMap,0);
}

boundsPromise.then(getMap);

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
	const clickPoint = [e.latlng.lat, e.latlng.lng];
	let bestID = 0;
	let bestDist = 1e18;
	
	graph.nodes.forEach((point) => {
		if (map.distance(clickPoint,point.coords) < bestDist) {
			bestDist = map.distance(clickPoint,point.coords);
			bestID=point.id;
		}
	});
	
	if (!chosenPoints[0]) chosenPoints[0] = bestID;
	else if (!chosenPoints[1]) chosenPoints[1] = bestID;
	else chosenPoints = [bestID,null];

	drawChosenPoints();

	routeLine.setLatLngs([[0,0],[0,0]]);
	routeLineB.setLatLngs([[0,0],[0,0]]);
	if (!(chosenPoints[0] && chosenPoints[1])) return;

	const res = graph.findPath(chosenPoints[0],chosenPoints[1],0.75);
	if (!res) return;
	routeLine.setLatLngs(res.latLngs);

	const resStinky = graph.findPath(chosenPoints[0],chosenPoints[1],0);
	if (!resStinky) return;
	routeLineB.setLatLngs(resStinky.latLngs);

	navigation = res.navigation + "<br>" + resStinky.navigation;
	pushUpdate("");
});

function drawChosenPoints() {
	if (chosenPoints[0]) chosePointCircles[0].setLatLng(graph.nodes.get(chosenPoints[0])?.coords);
	if (chosenPoints[1]) chosePointCircles[1].setLatLng(graph.nodes.get(chosenPoints[1])?.coords);
}

/** @type {HTMLDialogElement} */ // @ts-ignore
const infoDialog = document.querySelector("dialog#info-dialog");

document.querySelector("button.info-button")?.addEventListener("click",() => {infoDialog.showModal()});
document.querySelector("button.info-close")?.addEventListener("click",() => {infoDialog.close()});