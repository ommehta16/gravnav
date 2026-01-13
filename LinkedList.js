// @ts-check

/** 
 * @template T
 * @typedef {{next: Node<T>|null, prev:Node<T>|null, val:T}} Node<T> 
 */

/** @template T */
export default class LinkedList {
	/** @type {Node<T> | null} */
	first = null;
	
	/** @type {Node<T> | null} */
	last = null;

	/** @type {number} */
	length=0;
	
	constructor() {

	}

	/** @param {T} el */
	push(el) {
		/** @type {Node<T>} */
		const node = {val: el, next:null, prev:null}

		if (this.last) {
			this.last.next = node;
			node.prev = this.last;
		}
		if (!this.first) this.first=node;
		this.last=node;

		this.length++;
	}

	/** @returns {T|null} */
	pop() {
		const el = this.first;
		if (!el) return null;
		this.length--;
		const val = el.val;

		this.first = el.next;
		if (this.last == el) this.last = el.next;

		return val;
	}
}