// @ts-check
import PriorityQueue from "./PriorityQueue.js";
import BitWise from "./bitwise.js";

/** 
 * @typedef {{
 * 	lat:number,
 * 	lng:number,
 * 	alt?:number
 * }|[number, number]} LatLng;
 */

/** 
 * @typedef {{
 * 	id:number;
 *  geometry: {
 * 		lat: number,
 * 		lon: number
 * 	}[];
 *	tags:{[key:string]:string};
 *	nodes: number[];
 *  type: "way";
 * }} OSMWay
 */

 /**
 * @typedef {{
 * 		id:number,
 * 		lat:number,
 * 		lon:number,
 * 		type: "node",
 * 		tags: { [key:string]: string|undefined }
 * }} OSMNode
 */

export class GraphNode {
	/** @type {number} */ id;

	/** @type {LatLng} */ coords;

	/** Node ID --> time to reach
	 * @type {Map<number,number>}
	 */ neighbors;

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

export class Graph {
	/** @type {Map<number, GraphNode>} */ nodes;
	/** @type {Map<number, LatLng>} */ locations;

	constructor() {
		this.nodes = new Map();
		this.locations = new Map();
	}

	/** Find the shortest path between nodes `a` and `b`, using A*
	 * @param {number} start id of starting node
	 * @param {number} end id of ending node
	 * @param {number} chipotleness scaling factor on the impact of chipotle distance on navigation
	 * @param {(percentage:number)=>void} updateFunc callback for relevant distance traversed %ages
	 * @param {number} timeout Maximum amount of time to process before assuming there's a problem
	 */
	findPath(start, end, chipotleness=1, updateFunc=(percentage)=>{}, timeout=15) {
		const SPICINESS =  1+chipotleness; // speed up by chipotleness
		let timeRemaining=true;
		const timer = setTimeout(()=>{timeRemaining=false;console.log("times up!")},timeout*1000);

		/** Parent in optimal traversal: node id --> node id
		 * @type {Map<number, number>} 
		 */ const bestFrom = new Map();

		/** id --> distance from start to node
		 * @type {Map<number, number>}
		 */ const distanceTo = new Map();

		/** All IDs that we've seen before
		 * @type {Set<number>}
		 */ const visited = new Set();

		/**
		 * @typedef {{
		 * 	reweighted: number,
		 * 	distance: number,
		 * 	to: number,
		 * 	locationMask: bigint
		 * }} toCheck 
		 *  - `reweighted`: the potential-re-weighted distance.
		 *  - `distance`: path distance from node A -> to.
		 *  - `to`: target node ID
		 */

		/** @type {PriorityQueue<toCheck>} */
		const todo = new PriorityQueue((a,b)=>a.reweighted-b.reweighted);
		
		bestFrom.set(start,-1);
		distanceTo.set(start,0);
		todo.push({to:start,distance:0,reweighted:0,locationMask:BigInt(0)});
		visited.add(start);

		const destCoords = this.nodes.get(end)?.coords;
		if (!destCoords) throw new Error("Couldn't find destination coords");

		let found=false;
		
		let resultDist = 1e18;
		let bestPercent=0;
		while (!found) {
			const check = todo.pop();
			if (!timeRemaining || !check) {
				// updateFunc(100);
				console.log(`timeRemaining:${timeRemaining}, check:${check}`)
				return {
					latLngs:null,
					navigation:"Could not find route",
					error:"noroute"
				}
			}
			const curr = check.to;
			const startDistance = check.distance;

			const neighbors = this.nodes.get(curr)?.neighbors;
			if (!neighbors) throw new Error("Neighbors not in graph (?)");

			for (const [neighbor,edgeLength] of neighbors) {
				if (visited.has(neighbor)) continue;

				bestFrom.set(neighbor,curr);

				const neighborCoords = this.nodes.get(neighbor)?.coords;
				if (!neighborCoords) throw new Error("Neighbor does not exist (?)");

				const dist = startDistance+edgeLength;
				const distanceRemaining = (distance(neighborCoords,destCoords))/1000;
				const potential = distanceRemaining/50;
				const radius=10_000;
				let minChipDist = Infinity;
				let mask=check.locationMask;
				let i=0;
				if (chipotleness!=0) for (const [, loc] of this.locations) {
					const dist = distance(loc, neighborCoords);
					minChipDist=Math.min(minChipDist,dist);
					if (BitWise.get(mask,i) || dist>radius) continue;
					BitWise.set(mask,i,1);
					i++;
				}
				let chipotlePoints = 0;
				const distKM = minChipDist/1000;
				if (chipotleness!=0) {
					chipotlePoints = 10-Math.min(BitWise.popCount(mask)/10,5)-Math.min(10/distKM, 5);
				}

				if (neighbor == end) {
					console.log("WEVE GOT HIMMMM!!");
					found=true;
					resultDist = dist;
					break;
				}
				const newPercent = Math.floor(100*dist/(dist+potential*SPICINESS));
				if (newPercent > bestPercent) { // does 100 updates so no perciptible performance problem
					bestPercent=newPercent;
					updateFunc(newPercent);
				}
				todo.push({reweighted:(dist+potential*SPICINESS)*(1 + chipotlePoints * chipotleness),distance:dist,to:neighbor,locationMask:mask});
				visited.add(neighbor);
			}
		}

		let curr = end;
		
		/** @type {LatLng[]} */
		let bruh = [];

		let dist=0;
		let prevNode=this.nodes.get(curr);
		if (!prevNode) throw new Error("bruh");
		while (curr != -1) {
			const currNode = this.nodes.get(curr);
			if (!currNode) throw new Error("bruh");
			
			bruh.push(currNode.coords);
			dist += distance(currNode.coords, prevNode.coords);
			prevNode=currNode;
			
			curr = bestFrom.get(curr) ?? NaN;
		}
		clearTimeout(timer);
		return {
			latLngs: bruh,
			navigation: `${Math.round(resultDist*100)/100}hr drive • ${Math.round(dist * 0.000621371*100)/100}mi<br/>`
		};
	}


	/** Parses speed text from OSM. See [OSM's key:maxspeed](https://wiki.openstreetmap.org/wiki/Key:maxspeed) for more info
	 * @param {OSMWay} rd the text/number from the `maxspeed` tag on an OSM highway/railway/waterway
	 */
	static parseSpeed(rd) {
		let speed=null;
		
		if ("maxspeed" in rd.tags && Number.isFinite(+rd.tags.maxspeed)) {
			speed= (+rd.tags.maxspeed);
			return speed;
		}
		if ("maxspeed" in rd.tags) {
			try {
				const [spd,unit] = rd.toString().split(" ");
				// see https://wiki.openstreetmap.org/wiki/Key:maxspeed#Values
				if (unit == "mph") speed = (+spd) * 1.609344;
				if (unit == "knots") speed = (+spd) * 1.852;
				if (speed) return speed;
			}
			catch { }
		}
		
		if (!("highway" in rd.tags)) throw new Error("how?");
		if (rd.tags.highway == "motorway") speed=100;
		else if (rd.tags.highway == "trunk") speed=90;
		else if (rd.tags.highway == "primary") speed=80;
		else if (rd.tags.highway == "secondary") speed=70;
		else if (rd.tags.highway == "tertiary") speed=60;
		else if (rd.tags.highway == "residential") speed=40;
		else if (rd.tags.highway in ["motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link"]) speed=80;
		else speed=45;
		return speed;
	}

	/** 
	 * @param {{
	 * 	elements: OSMWay[]
	 * }} data
	 */
	loadData(data) {
		/** @type {(OSMWay|OSMNode)[]} */
		const elements = data.elements;
		
		/** @type {OSMWay[]} */ // @ts-ignore
		const roads = elements.filter(el=>el.type==="way" && !this.nodes.has(el.id));
		
		/** @type {OSMNode[]} */ // @ts-ignore
		const locations = elements.filter(el=>el.type==="node" && !this.locations.has(el.id));
		locations.forEach(loc => { this.locations.set(loc.id,[loc.lat, loc.lon]); });
		
		roads.forEach(rd => {
			/** Speed in **km/h**
			 * @type {number} 
			 */
			const speed = Graph.parseSpeed(rd);
			let direction=0;
			if ("oneway" in rd.tags) {
				if (rd.tags.oneway == "-1") direction=-1;
				else if (rd.tags.oneway != "no") direction=1;
			}
			rd.nodes.forEach((id, i) => {
				const coords = rd.geometry[i];

				if (!this.nodes.has(id)) {
					const node = new GraphNode(id, {lat:coords.lat, lng:coords.lon});
					this.nodes.set(id, node);
				}

				const node = this.nodes.get(id);
				if (!node) return;

				// link backwards
				if (i != 0 && (direction==0 || direction==-1)) {
					/** Distance in **km** @type {number} */
					const dist = distance(rd.geometry[i-1],coords)/1000;
					const time = dist/speed;
					node.neighbors.set(rd.nodes[i-1],time);
				}
				// link forwards
				if (i != rd.nodes.length-1 && (direction==0 || direction==1)) {
					/** Distance in **km** @type {number} */
					const dist = distance(rd.geometry[i+1],coords)/1000;
					const time = dist/speed;
					node.neighbors.set(rd.nodes[i+1],time);
				}
			});
		});
	}
}

/** Find the distance between `pt1` and `pt2` in **meters** using the [Haversine formula](https://en.wikipedia.org/wiki/Haversine_formula)
 * @param {LatLng|{lat:number, lon:number}|number[]} pt1
 * @param {LatLng|{lat:number, lon:number}|number[]} pt2
 */
export function distance(pt1, pt2) {
	const [lat1, lon1] = toLatLng(pt1);
	const [lat2, lon2] = toLatLng(pt2);
	
	const R = 6371e3; // radius of earth, meters
	const latR1 = lat1 * Math.PI/180; // in radians ._.
	const latR2 = lat2 * Math.PI/180;
	const dLatR = latR2-latR1;
	const dLonR = (lon2-lon1) * Math.PI/180;

	const a = Math.sin(dLatR/2) * Math.sin(dLatR/2) +
			  Math.cos(latR1) * Math.cos(latR2) *
			  Math.sin(dLonR/2) * Math.sin(dLonR/2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	const d = R * c; // in metres
	return d;
}

/** Converts a point into a guaranteed LatLng value 
 * @param {{lat:number, lon:number}|number[]|LatLng} point
 * @returns {[number, number]};
 */
export function toLatLng(point) {
	if ("lon" in point) return [point.lat, point.lon];
	if ("lat" in point) return [point.lat, point.lng];
	if (Array.isArray(point)) return [point[0],point[1]];
	throw new Error(`Point ${point} is not latLng-able`)
}