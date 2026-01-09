// src/firebase/error-emitter.ts
// Lightweight EventEmitter replacement to avoid depending on Node 'events' typings
type Listener = (...args: any[]) => void;

class ErrorEmitter {
	private listeners: Record<string, Listener[]> = {};
	on(event: string, fn: Listener) {
		(this.listeners[event] ||= []).push(fn);
	}
	off(event: string, fn: Listener) {
		this.listeners[event] = (this.listeners[event] || []).filter(f => f !== fn);
	}
	emit(event: string, ...args: any[]) {
		(this.listeners[event] || []).forEach(fn => { try { fn(...args); } catch(e) { /* ignore */ } });
	}
}

export const errorEmitter = new ErrorEmitter();
