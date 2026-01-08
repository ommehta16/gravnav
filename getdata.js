// @ts-check

/**
 * @param {string} query
 * @returns {Promise<Object|null>}
 */
export async function getData(query) {
	const res = await fetch(
		"https://overpass-api.de/api/interpreter",
		{
			method:"POST",
			body: "data=" + encodeURIComponent(query)
		}
	)

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
	const res = await getData(query);
	if (!res) {
		if (maxAttempts <= 1) return null;
		sendUpdate(`Getting data...<br />Waiting ${waitTime}ms before trying again`);
		
		await new Promise((resolve, reject) => { setTimeout(resolve,waitTime); });
		waitTime *= BACKOFF_FACTOR;
		return await getDataPersist(query, sendUpdate,waitTime,maxAttempts-1);
	}

	return res;
}