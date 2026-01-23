const express = require("express");

const app = express();
const OVERPASS_API = "https://overpass-api.de/api/interpreter";

app.use(express.json());
app.use(express.urlencoded({extended: true}))

app.get("/hello", (req, res) => {
	res.send("hi");
});

app.post("/", async (req,res) => {
	console.log("Recieved epic request: ");
	console.log(req.body);
	
	const raw = await fetch(OVERPASS_API,{
		method: "POST",
		body: req.body
	});

	const data = await raw.text();
	res.send(data);
});


app.listen(3000,()=>{console.log("bro")});