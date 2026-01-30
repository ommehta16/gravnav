// @ts-check

/** 
 * @typedef {{
 * 	[key:string]: {}
 * }} OSMResponse
 * 
 */


const OSM_API_URL = "https://api.gravnav.ommehta.us";//"http://127.0.0.1:3000";
//"https://104.236.249.234:3000";

/**
 * @param {string} query
 * @returns {Promise<Object|null>}
 */
export async function getData(query) {
	console.log(OSM_API_URL);
	const res = await fetch(
		OSM_API_URL,
		{
			headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
			method:"POST",
			body: "data=" + encodeURIComponent(query)
		}
	)
	console.log("Recieved!");

	if (!res.ok) return null;
	const data = await res.json();
	console.log("jasoned!");
	
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
	console.log(`Got data @ !`);
	sendUpdate(`Got data @ !`);

	return res;
}