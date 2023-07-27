// Import the User interface
import { User } from "./user";
import { isoUint8Array } from '@simplewebauthn/server/helpers';


/**
 * UserManager class is responsible for managing user data.
 * It provides methods for retrieving, adding, and deleting users.
 */
export class UserManager {

  // Maps hostnames to a Map of users, where the key is the user's email.
  private userMaps: Record<string, Map<string, User>>;


  /**
   * Creates a new UserManager instance and initializes user maps for each hostname.
   * @param hostnames {string[]} An array of hostnames.
   */
  constructor(hostnames: string[]) {
    this.userMaps = {};

    // Initialize user maps for each hostname
    for (const hostname of hostnames) {
      this.userMaps[hostname] = new Map();
    }
  }


  /**
   * Retrieves a user object by email and hostname.
   * @param email {string} The email of the user.
   * @param hostname {string} The hostname associated with the user.
   * @returns {User | undefined} The user object if found, otherwise undefined.
   */
  getUser(email: string, hostname: string): User | undefined {
    const userMap = this.userMaps[hostname];
    return userMap ? userMap.get(email) : undefined;
  }


  /**
   * Adds a new user object to the specified hostname.
   * @param newUser {User} The new user object to be added.
   * @param hostname {string} The hostname associated with the user.
   * @throws {Error} If the user map is not found for the hostname or the user already exists.
   */
  addUser(newUser: User, hostname: string) {
    const userMap = this.userMaps[hostname];
    if (!userMap) {
      throw new Error(`User map not found for hostname: ${hostname}`);
    }
    if (userMap.has(newUser.email)) {
      throw new Error("User already exists");
    }
    userMap.set(newUser.email, newUser);
  }

   /**
     * Retrieves a user object by credentialID and hostname.
     * @param credentialID {Uint8Array} The credentialID of the user.
     * @param hostname {string} The hostname associated with the user.
     * @returns {User | undefined} The user object if found, otherwise undefined.
     */
   getUserByCredentialIDAndHostname(credentialID: Uint8Array, hostname: string): User | undefined {
    const userMap = this.userMaps[hostname];
    if (!userMap) {
      return undefined;
    }
    for (const user of userMap.values()) {
      for (const device of user.authDevice) {
        if (isoUint8Array.areEqual(device.credentialID, credentialID)) {
          return user;
        }
      }
    }
    return undefined;
  }

  /**
   * Deletes a user object by email and hostname.
   * @param email {string} The email of the user.
   * @param hostname {string} The hostname associated with the user.
   */
  deleteUser(email: string, hostname: string) {
    const userMap = this.userMaps[hostname];
    if (userMap) {
      userMap.delete(email);
    }
  }
}

