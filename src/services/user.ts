/**
 * User interface represents the structure of a user object.
 */
export interface User {
  _id: string; // The user's ID (accountID)
  _rev?: string;  // The _rev field used by PouchDB/CouchDB for conflict resolution.
  email: string; // The user's email address.
  name: string; // The user's name.
  hostname: string; // The hostname associated with the user.
  secret?: string; // The user's secret (optional in case of passkey-based authentication)
  accountId: string; // The user's account ID.
  avatarUrl: string; // The user's avatar URL.
  approved_clients: string[]; // An array of approved client IDs for the user.
}
