// @ts-check

import "../LinkedList.js";
import LinkedList from "../LinkedList.js";
import {Graph, GraphNode, toLatLng, distance} from "./mapData.js";
import {getDataPersist} from "./getdata.js";
/** 
 * @import {OSMWay, OSMNode, LatLng} from "./mapData.js"
 * @import {LeafletMouseEvent} from "../index.js"
 */


console.log("im a worker bee! so loyal. so epic")
const graph = new Graph();

/** @type {[number,number][]} */
const mapCenter = [[40.5, -75], [41.5, -74]];
/** @type {[number,number][]} */
let bounds = mapCenter.map(a=>[...a]);
const clampWithin = [[39.5, -76], [41.5, -73]];

/** @type {[null|number,null|number]} */
let chosenPoints = [null, null];

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
	console.log("Generating bounds...")

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
	console.log("Bounds generated")
	// pushUpdate(`<i class="fa-solid fa-check" style="color:#aca"></i> Bounds Generated!`)
}

async function getMap() {
	
	/** 
	 * @type {{
	 * 	from: "getMap"
	 * 	bounds: [number,number][]|null,
	 * 	clampWithin: number[][]|null,
	 * 	circleLocs: LatLng[]|null,
	 * }}
	 * */
	const toReturn = {
		from: "getMap",
		bounds: null,
		clampWithin: null,
		circleLocs: null,
	};
	
	if (!boundsRemaining.length) return toReturn;

	// @ts-ignore
	bounds = boundsRemaining.pop();
	console.log(bounds);
	updateQuery();

	toReturn.bounds = bounds;
	toReturn.clampWithin = clampWithin;

	postMessage(toReturn);

	console.log("bouta get data");
	/** @type {{elements:OSMWay[]}}} */ // @ts-ignore
	const data = await getDataPersist(query,undefined,undefined,50);
	if (!data) return;
	graph.loadData(data);
	toReturn.circleLocs = Array.from(graph.locations.values());
	
	postMessage(toReturn);

	setTimeout(getMap,0);
}

/** @param {[number,number]} eventPoint */ 
async function findPath(eventPoint) {
	/** 
	 * @type {{
	 * 	from: "findPath",
	 * 	chosenPoints: [LatLng|null,LatLng|null]|null,
	 * 	chipotleRoute: LatLng[]|null,
	 * 	normalRoute: LatLng[]|null,
	 * 	navigation: string
	 * }}
	 */
	const toReturn = {
		from: "findPath",
		chosenPoints: null,
		chipotleRoute: null,
		normalRoute: null,
		navigation: ""
	}

	const clickPoint = toLatLng(eventPoint);
	let bestID = 0;
	let bestDist = Infinity;
	console.log("I'm thinking so hard")
	graph.nodes.forEach(point => {
		const dist = distance(clickPoint,point.coords)
		if (dist < bestDist) {
			bestDist = dist;
			bestID=point.id;
		}
	});
	
	if (!chosenPoints[0]) chosenPoints[0] = bestID;
	else if (!chosenPoints[1]) chosenPoints[1] = bestID;
	else chosenPoints = [bestID,null];

	toReturn.chosenPoints=[chosenPoints[0] ? (graph.nodes.get(chosenPoints[0])?.coords ?? null) : null, 
						   chosenPoints[1] ? (graph.nodes.get(chosenPoints[1])?.coords ?? null) : null];
	console.log("endpoints found");
	if (!(chosenPoints[0] && chosenPoints[1])) {
		postMessage(toReturn);
		return;
	}
	console.log("searching for path...");
	const chipotlePath = graph.findPath(chosenPoints[0],chosenPoints[1],0.75);
	if (!chipotlePath) {
		postMessage(toReturn);
		return;
	}
	console.log("searching for path B...")
	const normalPath = graph.findPath(chosenPoints[0],chosenPoints[1],0);
	if (!normalPath) {
		postMessage(toReturn);
		return;
	}
	console.log("got paths!");
	toReturn.chipotleRoute=chipotlePath.latLngs;
	toReturn.normalRoute=normalPath.latLngs;

	toReturn.navigation=chipotlePath.navigation+"<br/>"+normalPath.navigation;
	postMessage(toReturn);
}

addEventListener("message",e=>{
	
	/** 
	 * @type {{
	 * 	action:string
	 * 	eventPoint?:[number,number]
	 * }}
	 */
	const data = e.data;

	if (data.action == "findPath") {
		if (!data.eventPoint) throw new Error(`findPath called with no corresponding event. Message data:\n${data}`);
		findPath(data.eventPoint);
	}
})

const boundsPromise = generateBoundsOrder().then(updateQuery);
boundsPromise.then(getMap);