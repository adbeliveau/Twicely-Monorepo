/**
 * Crosslister framework barrel export.
 * Re-exports all types, DB types, interfaces, and registries for
 * consumption by Phase F connector implementations and actions.
 */

export * from './types';
export * from './db-types';
export * from './connector-interface';
export * from './connector-registry';
export * from './channel-registry';

// Connector implementations — import to trigger self-registration
import './connectors'; // registers ebay, poshmark, mercari
