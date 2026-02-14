// @ts-check

export default class BitWise {
	/** 
	 * @param {bigint} num
	 * @param {number|bigint} i
	 */
	static get(num, i) {
		return Boolean((num>>BigInt(i)) % 2n);
	}

	/**
	 * @param {bigint} num 
	 * @param {number|bigint} i 
	 */
	static toggle(num, i) {
		const mask = 1n<<BigInt(i);
		return num ^ mask;
	}

	/**
	 * @param {bigint} num 
	 * @param {number|bigint} i 
	 * @param {boolean|1|0} val
	 */
	static set(num, i, val) {
		const mask = 1n<<BigInt(i);
		return Boolean(num&mask)==Boolean(val) ? num : num^mask;
	}
	
	/** 
	 * @param {bigint} num
	 */
	static popCount(num){
		let cnt=0;
		for (let n=num;n;n>>=1n) if (n%2n) cnt++;
		return cnt;
	}
}