import type { AuthenticatorDevice } from '@simplewebauthn/typescript-types';
/**
 * User interface represents the structure of a user object.
 */
export interface User {
  email: string; // The user's email address.
  name: string; // The user's name.
  secret?: string; // The user's secret (optional in case of passkey-based authentication)
  authDevice?: AuthenticatorDevice[]; // The user's authenticator device.
  accountId: string; // The user's account ID.
  avatarUrl: string; // The user's avatar URL.
  approved_clients: string[]; // An array of approved client IDs for the user.
}

/**
 * Adds a client ID to the user's list of approved clients if it's not already present.
 * @param user {User} The user object.
 * @param clientId {string} The client ID to be added.
 */
export function addApprovedClient(user: User, clientId: string) {
  if (!user.approved_clients.includes(clientId)) {
    user.approved_clients.push(clientId);
  }
}

/**
 * Adds an authenticator device to the user object.
 * @param user {User} The user object.
 * @param device {AuthenticatorDevice} The authenticator device to be added.
 */
export function addAuthenticatorDevice(user: User, device: AuthenticatorDevice) {
  if (user.authDevice) {
    user.authDevice.push(device);
  } else {
    user.authDevice = [device];
  }
}

/**
 * Removes a client ID from the user's list of approved clients if it's present.
 * @param user {User} The user object.
 * @param clientId {string} The client ID to be removed.
 */
export function removeApprovedClient(user: User, clientId: string) {
  const index = user.approved_clients.indexOf(clientId);
  if (index !== -1) {
    user.approved_clients.splice(index, 1);
  }
}
