// @ts-check

/** 
 * @typedef {{
 * 	[key:string]: {}
 * }} OSMResponse
 * 
 */


let OSM_API_URL = document.body.getAttribute("OSM-API-URL") || "http://104.236.249.234:3000"; // "https://overpass-api.de/api/interpreter";
document.body.setAttribute("OSM-API-URL",OSM_API_URL);

if (OSM_API_URL == "http://127.0.0.1:3000") {
	fetch(`${OSM_API_URL}/hello`).then(()=>{}, err=>{
		console.log("Tried to grab localhost, got ", err);
		OSM_API_URL = "https://overpass-api.de/api/interpreter";
		console.log(`Could not find local dev server, switching to ${OSM_API_URL}`)
	});
}

/**
 * @param {string} query
 * @returns {Promise<Object|null>}
 */
export async function getData(query) {
	const res = await fetch(
		OSM_API_URL,
		{
			headers: {
				"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
			},
			method:"POST",
			body: "data=" + encodeURIComponent(query)
		}
	)
	console.log("Recieved!");

	if (!res.ok) return null;
	const data = await res.json();
	
	return data;
}

/**
 * 
 * @param {string} query 
 * @param {( (updateText:string)=>any ) | null} sendUpdate 
 * @param {number} waitTime Amount of time to wait until next attempt.
 * @param {number} maxAttempts Amount of remaining attempts. Set to -1 for infinite attempts
 * 
 * @returns {Promise<Object|null>}
 */
export async function getDataPersist(query, sendUpdate=null, waitTime=25, maxAttempts=25) {
	const BACKOFF_FACTOR = 2;

	sendUpdate = sendUpdate || ( (a)=>null );
	
	sendUpdate("Getting data...");
	console.log("Getting data...");
	const res = await getData(query);
	sendUpdate("Got data!")
	if (!res) {
		if (maxAttempts <= 1) return null;
		sendUpdate(`Getting data...<br />Waiting ${waitTime}ms before trying again`);
		
		await new Promise((resolve, reject) => { setTimeout(resolve,waitTime); });
		waitTime *= BACKOFF_FACTOR;
		return await getDataPersist(query, sendUpdate,waitTime,maxAttempts-1);
	}
	console.log(`Got data @ ${(new Date()).toLocaleDateString()}`);
	sendUpdate(`Got data @ ${(new Date()).toLocaleDateString()}`);

	return res;
}