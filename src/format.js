export default class Format {
	/** 
	 * @param {number} distanceMeters distance in meters
	 * @returns {string} distance as text
	*/
	static distanceImperial(distanceMeters) {
		const MILE = 5280;
		const feet = distanceMeters * 3.281;
		
		if (feet < MILE * 0.5) return `${feet.toLocaleString()}ft`;
		return `${(feet/MILE).toLocaleString()}mi`;
	}
	/** @param {OSMNode} location the location */
	static locationString(location) {
		let locationText = "";
		if (location.tags["addr:street"]) locationText += location.tags["addr:street"];
		if (location.tags["addr:city"] && location.tags["addr:state"]) locationText += `, ${location.tags["addr:city"]}, ${location.tags["addr:state"]}`;
		else if (location.tags["addr:city"]) locationText += locationText && ", " + location.tags["addr:city"];
		else if (location.tags["addr:state"]) locationText += locationText && ", " + location.tags["addr:state"];

		return locationText;
	}
}