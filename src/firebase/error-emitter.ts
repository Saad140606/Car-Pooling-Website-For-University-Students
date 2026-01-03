// src/firebase/error-emitter.ts
import { EventEmitter } from 'events';

class ErrorEmitter extends EventEmitter {}

export const errorEmitter = new ErrorEmitter();
