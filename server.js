const express = require("express");
const crypto = require("crypto");
const { cacheSignal } = require("react");

const app = express();
const port = 3000;

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

/** @type {Map<string, string>} */
let cached = new Map();

app.use(express.json());
app.use(express.urlencoded({extended: true}))

app.get("/hello", (req, res) => {
	res.send("hi");
});

app.post("/", async (req,res) => {
	const hash = crypto.createHash("sha1")
						.update(encodeURIComponent(req.body))
						.digest('base64');
	console.log(`Got request ${hash}`);
	if (cached.has(hash)) {
		res.send(cached.get(hash));
		return;
	}
	
	const raw = await fetch(OVERPASS_API,{
		method: "POST",
		body: "data=" + encodeURI(req.body.data)
	});

	const data = await raw.text();
	res.send(data);
	cached.set(hash,data);
});

app.listen(port,()=>{console.log(`Running server on port ${port}.`);});