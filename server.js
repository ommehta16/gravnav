const express = require("express");
const crypto = require("crypto");
const fs = require("node:fs");

const app = express();
const port = 3000;

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

/** @type {{[key:string]:string}} */
let cached = {};

app.use(express.json());
app.use(express.urlencoded({extended: true}))

app.get("/hello", (req, res) => {
	res.send("hi");
});

async function load() {
	try {
		const data = fs.readFileSync("mem.json");
		cached = JSON.parse(data.toString());
	} catch {}
}

function save(attempt=0) {
	console.log("Saving...");
	try {
		fs.writeFileSync("mem.json",JSON.stringify(cached));
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
						.digest('base64');
	console.log(`Got request ${hash}`);
	if (hash in cached) {
		console.log("hit.");
		res.send(cached[hash]);
		console.log("sent");
		return;
	}
	console.log("Fetching from OSM...");
	const raw = await fetch(OVERPASS_API,{
		method: "POST",
		body: "data=" + encodeURI(req.body.data)
	});
	console.log("Got data");

	const data = (await raw.json());
	const processed = {elements:data.elements}; // strip away everything but elements bc... that's the only thing we use!
	cached[hash]=processed;
	res.send(JSON.stringify(processed));
	console.log("sent");
});

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