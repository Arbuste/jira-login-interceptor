/**
 * Group Auto-Joiner Forge App
 * Main entry point — exports all handlers.
 */

import { handleWebtrigger } from './handlers/webtrigger';
import { configResolver } from './handlers/configResolver';

// Resolver for the admin config Custom UI
export { configResolver as resolver };

// Webtrigger handler for the Chrome extension
export { handleWebtrigger as webtriggerHandler };
