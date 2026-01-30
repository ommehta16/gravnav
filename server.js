const express = require("express");
const crypto = require("crypto");
const fs = require("node:fs");
const simplify = require("simplify-js");
/** 
 * @import {OSMWay, OSMNode, LatLng} from "./src/mapData.js"
 */

const app = express();
const port = 3000;

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

/** @type {{[key:string]:string}} */
// let cached = {};

/** @type {Set<string>} */
let hashes = new Set();

app.use(express.json());
app.use(express.urlencoded({extended: true}))

app.get("/hello", (req, res) => {
	res.send("hi");
});

async function load() {
	try {
		// const data = fs.readFileSync("mem.json");
		// cached = JSON.parse(data.toString());

		const data = fs.readFileSync("hashes.json");
		hashes = new Set(JSON.parse(data.toString()));
	} catch {}
}

function save(attempt=0) {
	console.log("Saving...");
	try {
		// fs.writeFileSync("mem.json",JSON.stringify(cached));
		
		fs.writeFileSync("hashes.json", JSON.stringify(Array.from(hashes)));
		console.log("Saved!");
	} catch {
		if (attempt >= 10) return;
		console.log(`Could not save, trying again #${attempt+1}`);
		save(attempt+1);
	}
}

app.post("/", async (req,res) => {
	const hash = crypto.createHash("sha1")
						.update(encodeURI(req.body.data))
						.digest('base64url');
	console.log(`Got request ${hash}`);
	// if (hash in cached) {
	// 	console.log("hit.");
	// 	res.send(cached[hash]);
	// 	console.log("sent");
	// 	return;
	// }

	if (hashes.has(hash)) {
		try {
			console.log("hit.")
			const data = fs.readFileSync(`db/${hash}.json`);
			res.send(data.toString());
			console.log("sent!");
			return;
		}
		catch {}
	}
	console.log("Fetching from OSM...");
	const raw = await fetch(OVERPASS_API,{
		method: "POST",
		body: "data=" + encodeURI(req.body.data)
	});
	console.log("Got data");

	const data = (await raw.json()).elements;
	console.log("jsonified");
	// const processed = {elements:data}; //simplifyData(data.elements)// {elements:data.elements}; // strip away everything but elements bc... that's the only thing we use!
	const stringy = `{elements:${JSON.stringify(data)}}`;
	console.log("Stringified")
	res.send(stringy);
	fs.writeFile(`db/${hash}.json`,stringy,()=>{hashes.add(hash); console.log("saved");});
	
	console.log("sent");
});

/** bruh
 * @param {(OSMWay|OSMNode)[]} elements 
 */
function simplifyData(elements) {
	console.log("simplifying...")
	const start = Date.now();
	/** @type {{locations:(OSMWay|OSMNode)[]}} */
	const toReturn = {elements: []};

	/** @type {Map<number,number>} */
	const pointUses = new Map();
	for (const element of elements) {
		if (element.type == "node") {
			toReturn.elements.push(element);
			continue;
		}
		for (const node of element.nodes) {
			if (pointUses.has(node)) pointUses.set(node, pointUses.get(node)+1);
			else pointUses.set(node, 1);
		}
	}

	for (const element of elements) {
		if (element.type=="node") continue;
		const points = [];
		const nodes = element.nodes.map((id, i)=>(
			{ id: id, x: element.geometry[i].lon, y: element.geometry[i].lat, }
		)
		);

		for (let i=0;i<nodes.length;i++) {
			for (let j=i;j<nodes.length-1;j++) {
				if (pointUses.get(nodes[j].id) <= 1) continue; //ok so its defo duplicated
							
				const section = simplify(nodes.slice(i,j+1));
				points.pop();
				points.push(...section);
			}
		}
		toReturn.elements.push({
			type: element.type,
			tags: element.tags,
			geometry: points.map(pt=>({lon:pt.x, lat:pt.y})),
			nodes: points.map(pt=>pt.id)
		});
	}
	console.log(`${Date.now()-start}ms to simplify`);
	return toReturn;
}

load().then(()=>console.log("Loaded!"));

app.listen(port,()=>{console.log(`Running server on port ${port}.`);});

process.on("SIGINT",()=>{
	console.log();
	console.log("Shutting down gracefully. Ctrl-C again to terminate immediately.");
	process.on("SIGINT", ()=>process.exit(1));
	save();
	process.exit(0);
});

process.on("SIGTERM", ()=> {
	console.log();
	save();
	process.exit(0);
})