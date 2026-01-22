// @ts-check

/** @template T */
export default class PriorityQueue {
    /** @type {T[]} */
    heap = [];
    
    /** @type {(a:T,b:T)=>number} */
    comparator = (a,b)=>(a>b ? 1 : (a == b) ? 0 : -1);
    
    /** 
     * @param {(a:T,b:T)=>number} comparator lowest item according to comparator bubbles to top of heap 
     */
    constructor(comparator) {
        this.heap = [];
        this.comparator=comparator ?? this.comparator;
    }

    // Helper Methods

    /** @param {number} parentIndex */
    #getLeftChildIndex(parentIndex) {
        return 2 * parentIndex + 1;
    }

    /** @param {number} parentIndex */
    #getRightChildIndex(parentIndex) {
        return 2 * parentIndex + 2;
    }

    /** @param {number} childIndex */
    #getParentIndex(childIndex) {
        return Math.floor((childIndex - 1) / 2);
    }

    /** @param {number} index */
    #hasLeftChild(index) {
        return this.#getLeftChildIndex(index) < this.heap.length;
    }

    /** @param {number} index */
    #hasRightChild(index) {
        return this.#getRightChildIndex(index) < this.heap.length;
    }

    /** @param {number} index */
    #hasParent(index) {
        return this.#getParentIndex(index) >= 0;
    }

    /** @param {number} index */
    #leftChild(index) {
        return this.heap[this.#getLeftChildIndex(index)];
    }

    /** @param {number} index */
    #rightChild(index) {
        return this.heap[this.#getRightChildIndex(index)];
    }

    /** @param {number} index */
    #parent(index) {
        return this.heap[this.#getParentIndex(index)];
    }

    /** @param {number} indexOne, @param {number} indexTwo */
    #swap(indexOne, indexTwo) {
        const temp = this.heap[indexOne];
        this.heap[indexOne] = this.heap[indexTwo];
        this.heap[indexTwo] = temp;
    }

    peek() {
        if (this.heap.length === 0) return null;
        return this.heap[0];
    }

    // Removing an element will remove the
    // top element with highest priority then
    // heapifyDown will be called 
    remove() {
        if (this.heap.length === 0) return null;
        
        const item = this.heap[0];
        this.heap[0] = this.heap[this.heap.length - 1];
        this.heap.pop();
        this.#heapifyDown();
        return item;
    }

    /** @param {T} item */
    push(item) {
        this.heap.push(item);
        this.#heapifyUp();
    }

    pop() {
        const val = this.peek();
        this.remove();
        return val;
    }

    length() {
        return this.heap.length;
    }

    #heapifyUp() {
        let index = this.heap.length - 1;
        while (this.#hasParent(index) && this.comparator(this.#parent(index), this.heap[index]) > 0) { // i.e. parent > curr
            // swap new element through our parent chain (otherwise sorted)
            this.#swap(this.#getParentIndex(index), index);
            index = this.#getParentIndex(index);
        }
    }

    #heapifyDown() {
        let index = 0;
        while (this.#hasLeftChild(index)) { // will only have a left child if also has a right child
            let smallerChildIndex = this.#getLeftChildIndex(index);
            if (this.#hasRightChild(index) && this.comparator(this.#rightChild(index), this.#leftChild(index)) < 0) // i.e. right child < left child
                smallerChildIndex = this.#getRightChildIndex(index);
            
            if (this.comparator(this.heap[index], this.heap[smallerChildIndex])<0) break;
            this.#swap(index, smallerChildIndex);

            index = smallerChildIndex;
        }
    }
}