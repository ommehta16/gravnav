// @ts-check

import "../LinkedList.js";
import LinkedList from "../LinkedList.js";
import {Graph, GraphNode, toLatLng, distance} from "./mapData.js";
import {getDataPersist} from "./getdata.js";
/** 
 * @import {OSMWay, OSMNode, LatLng} from "./mapData.js"
 */


console.log("im a worker bee! so loyal. so epic")
const graph = new Graph();

/** @type {[number,number][]} */
const mapCenter = [[40.5, -75], [41, -74.75]];
/** @type {[number,number][]} */
let bounds = mapCenter.map(a=>[...a]);
const clampWithin = [[40.5, -75], [41.5, -72.5]];

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
	
	if (!boundsRemaining.length) {
		postMessage(toReturn);
		return;
	}

	// @ts-ignore
	bounds = boundsRemaining.pop();
	updateQuery();

	toReturn.bounds = bounds;
	toReturn.clampWithin = clampWithin;

	postMessage(toReturn);

	// console.log("bouta get data");
	/** @type {{elements:OSMWay[]}}} */ // @ts-ignore
	const data = await getDataPersist(query,undefined,undefined,50);
	if (!data) return;
	graph.loadData(data);
	toReturn.circleLocs = Array.from(graph.locations.values());
	
	postMessage(toReturn);
	// console.log(`Now has ${graph.nodes.size} nodes, ${graph.locations.size} points`);
	setTimeout(getMap,0);
}

let chipotleness=1;
/** @param {[number,number]|null} eventPoint @param {number} eventPointIndex */ 
async function findPath(eventPoint,eventPointIndex=-1) {
	/** 
	 * @type {{
	 * 	from: "findPath",
	 * 	chosenPoints: [LatLng|null,LatLng|null]|null,
	 * 	chipotleRoute: LatLng[]|null,
	 * 	normalRoute: LatLng[]|null,
	 * 	navigation: string,
	 * 	error:string
	 * }}
	 */
	const toReturn = {
		from: "findPath",
		chosenPoints: null,
		chipotleRoute: null,
		normalRoute: null,
		navigation: "",
		error:""
	}

	if (!eventPoint) {
		chosenPoints = [null,null];
		toReturn.chosenPoints=[null,null];
		postMessage(toReturn);
		return;
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
	
	if (eventPointIndex!=-1) chosenPoints[eventPointIndex] = bestID;
	else {
		if (!chosenPoints[0]) chosenPoints[0] = bestID;
		else if (!chosenPoints[1]) chosenPoints[1] = bestID;
		else chosenPoints = [bestID,null];
	}

	toReturn.chosenPoints=[chosenPoints[0] ? (graph.nodes.get(chosenPoints[0])?.coords ?? null) : null, 
						   chosenPoints[1] ? (graph.nodes.get(chosenPoints[1])?.coords ?? null) : null];
	console.log("endpoints found");
	if (!(chosenPoints[0] && chosenPoints[1])) {
		postMessage(toReturn);
		return;
	}
	postMessage({...toReturn,navigation:`<span class="thinking">thinking...</span>`});
	console.log("searching for path...");
	let start=Date.now();
	const normalPath = await graph.findPath(chosenPoints[0],chosenPoints[1],0,percentage=>{
		postMessage({from:"findPathUpdate",progress:percentage*0.2,routeDesc:`${Math.floor(percentage*0.2)}% • normal route`});
	});
	toReturn.normalRoute=normalPath.latLngs;
	console.log(`${(Date.now()-start)/1000} seconds to get normal path`);
	postMessage({...toReturn,navigation:`<span class="thinking">waiting on Chipotle-d path...</span>`});
	start=Date.now();
	
	if (normalPath.error) {
		toReturn.error=normalPath.error;
		chosenPoints=[null,null];
		postMessage(toReturn);
		return;
	}

	const chipotlePath = await graph.findPath(chosenPoints[0],chosenPoints[1],chipotleness,percentage=>{
		postMessage({from:"findPathUpdate",progress:20+percentage*0.8,routeDesc:`${Math.floor(20+percentage*0.8)}% • chipotle route`});
	});
	console.log("searching for goofy path")
	if (!chipotlePath) {
		postMessage(toReturn);
		return;
	}
	console.log(`${(Date.now()-start)/1000} seconds to get goofy path`);
	if (!normalPath) {
		postMessage(toReturn);
		return;
	}
	console.log("got paths!");
	toReturn.chipotleRoute=chipotlePath.latLngs;
	
	toReturn.navigation=`<div><h3>Regular Route</h3>${normalPath.navigation}</div><div><h3>"Chipotle-d" Route</h3>${chipotlePath.navigation}</div>`;
	postMessage(toReturn);
}

addEventListener("message",e=>{
	/** 
	 * @type {{
	 * 	action:string
	 * 	eventPoint?:[number,number]|null
	 * 	eventPointIndex?:number
	 * 	value?: number;
	 * }}
	 */
	const data = e.data;

	if (data.action == "findPath") {
		if (!data.eventPoint) data.eventPoint=null;
		// if (!data.eventPoint) throw new Error(`findPath called with no corresponding event. Message data:\n${data}`);
		console.log("Got request", data);
		findPath(data.eventPoint, data.eventPointIndex);
	}
	if (data.action=="setchip") {
		if (!data.value) return;
		chipotleness = data.value;
	}
});

const boundsPromise = generateBoundsOrder().then(updateQuery);
boundsPromise.then(getMap);