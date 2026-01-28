// @ts-check
import PriorityQueue from "./PriorityQueue.js";

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
	 */
	findPath(start, end, chipotleness=1) {
		const SPICINESS = 2;

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
		 * 	reweighted: number;
		 * 	distance: number;
		 * 	to: number;
		 * }} toCheck 
		 *  - `reweighted`: the potential-re-weighted distance.
		 *  - `distance`: path distance from node A -> to.
		 *  - `to`: target node ID
		 */

		/** @type {PriorityQueue<toCheck>} */
		const todo = new PriorityQueue((a,b)=>a.reweighted-b.reweighted);
		
		bestFrom.set(start,-1);
		distanceTo.set(start,0);
		todo.push({to:start,distance:0,reweighted:0});
		visited.add(start);

		const destCoords = this.nodes.get(end)?.coords;
		if (!destCoords) throw new Error("Couldn't find destination coords");

		let found=false;
		
		let resultDist = 1e18;
		while (todo.length() && !found) {
			const check = todo.pop();
			if (!check) break;
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

				let minChipDist = Infinity;
				this.locations.forEach(loc=>{minChipDist = Math.min(distance(loc,neighborCoords),minChipDist);});

				if (neighbor == end) {
					console.log("WEVE GOT HIMMMM!!");
					found=true;
					resultDist = dist;
					break;
				}

				todo.push({reweighted:dist+potential*SPICINESS+minChipDist*chipotleness,distance:dist,to:neighbor});
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

		return {
			latLngs: bruh,
			navigation: `${Math.round(resultDist*100)/100}hr drive • ${Math.round(dist * 0.000621371*100)/100}mi<br/>`
		};
	}


	/** Parses speed text from OSM. See [OSM's key:maxspeed](https://wiki.openstreetmap.org/wiki/Key:maxspeed) for more info
	 * @param {string|number} spdText the text/number from the `maxspeed` tag on an OSM highway/railway/waterway
	 */
	static parseSpeed(spdText) {
		let speed=null;
		
		if (Number.isFinite(+spdText)) speed=(+spdText);
		else {
			try {
				const [spd,unit] = spdText.toString().split(" ");
				// see https://wiki.openstreetmap.org/wiki/Key:maxspeed#Values
				if (unit == "mph") speed = (+spd) * 1.609344;
				if (unit == "knots") speed = (+spd) * 1.852;
			}
			catch { }
		}
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
			const speed = Graph.parseSpeed(rd.tags.maxspeed ?? 50) ?? 50;
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
	const latR1 = lat1 * Math.PI/180; // φ, λ in radians
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

/** 
 * @param {{lat:number, lon:number}|number[]|LatLng} point
 * @returns {[number, number]};
 */
export function toLatLng(point) {
	if ("lon" in point) return [point.lat, point.lon];
	if ("lat" in point) return [point.lat, point.lng];
	if (Array.isArray(point)) return [point[0],point[1]];
	throw new Error(`Point ${point} is not latLng-able`)
}