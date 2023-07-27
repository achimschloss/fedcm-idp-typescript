import { User } from "./user";
import type { AuthenticatorDevice, AuthenticatorTransportFuture } from '@simplewebauthn/typescript-types';
import base64url from "base64url";
import PouchDB from 'pouchdb';
import find from 'pouchdb-find';

/**
 * Type for serialization of Authenticator devices.
 */
export interface SerializedAuthenticatorDevice {
  _id: string; // The credentialID of the device.
  _rev?: string;  // The _rev field used by PouchDB/CouchDB for conflict resolution.
  accountID: string; // The accountID of the user
  credentialID: string; // The credentialID of the device base64url encoded.
  credentialPublicKey: string; // The credentialPublicKey of the device base64url encoded.
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

/**
 * UserManager class is responsible for managing user data.
 * It provides methods for retrieving, adding, and deleting users.
 * It also provides methods for retrieving, adding, and deleting authenticator devices.
 */
export class UserManager {

  private userDB: PouchDB.Database<User>;
  private deviceDB: PouchDB.Database<SerializedAuthenticatorDevice>;

  /**
   * Creates a new UserManager instance and initializes user maps for each hostname.
   * @param hostnames {string[]} An array of hostnames.
   */
  constructor(hostnames: string[]) {
    PouchDB.plugin(find);
    this.userDB = new PouchDB<User>('users');
    this.deviceDB = new PouchDB<SerializedAuthenticatorDevice>('devices');
  }

  /**
   * Retrieves a user object by email and hostname.
   * @param email {string} The email of the user.
   * @param hostname {string} The hostname associated with the user.
   * @returns {User | undefined} The user object if found, otherwise undefined.
   */
  async getUser(email: string, hostname: string): Promise<User | undefined> {
    if (!email || !hostname) return undefined;

    try {
      const result = await this.userDB.find({
        selector: {
          email: email,
          hostname: hostname
        },
        limit: 1
      });
      if (result.docs.length > 0) {
        return result.docs[0];
      }
      return undefined;
    } catch (error) {
      if (error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Retrieves a user object by accountID.
   * @param accountID {string} The accountID of the user.
   * @returns {User | undefined} The user object if found, otherwise undefined.
   */
  async getUserByAccountID(accountID: string): Promise<User | undefined> {
    try {
      const result = await this.userDB.get(accountID);
      return result;
    } catch (error) {
      if (error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Adds a new user object to the specified hostname.
   * @param newUser {User} The new user object to be added.
   * @param hostname {string} The hostname associated with the user.
   * @throws {Error} If the user already exists.
   */
  async addUser(newUser: User): Promise<void> {
    try {
      const user = await this.getUserByAccountID(newUser.accountId);
      if (user) {
        throw new Error("User already exists");
      }
      await this.userDB.put(newUser);
    } catch (error) {
      if (error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Retrieves a user object by credentialID and hostname.
   * @param credentialID {Uint8Array} The credentialID of the user.
   * @param hostname {string} The hostname associated with the user.
   * @returns {User | undefined} The user object if found, otherwise undefined.
   */
  async getUserByCredentialIDAndHostname(credentialID: Uint8Array, hostname: string): Promise<User | undefined> {
    try {
      const device = await this.deviceDB.get(base64url.encode(Buffer.from(credentialID)));
      if (device) {
        const user = await this.userDB.get(device.accountID);
        if (user && user.email && user.hostname === hostname) {
          return user;
        }
      }
      return undefined;
    } catch (error) {
      if (error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Deletes a user object by accountID.
   * @param accountID {string} The accountID of the user.
   */
  async deleteUserByAccountID(accountID: string): Promise<void> {
    try {
      const user = await this.getUserByAccountID(accountID)
      if (user) {
        await this.userDB.remove(user._id, user._rev);
      }
    } catch (error) {
      if (error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Adds a new authenticator device to the specified user.
   * @param user {User} The email of the user.
   * @param device {AuthenticatorDevice} The new authenticator device to be added.
   * @throws {Error} In case something unexpected happens
   */
  async addAuthenticatorDevice(user: User, device: AuthenticatorDevice): Promise<void> {
    try {
      const base64credentialID = base64url.encode(Buffer.from(device.credentialID));
      const base64CredentialPublicKey = base64url.encode(Buffer.from(device.credentialPublicKey));
      const serializedDevice: SerializedAuthenticatorDevice = {
        _id: base64credentialID,
        accountID: user.accountId,
        credentialID: base64credentialID,
        credentialPublicKey: base64CredentialPublicKey,
        counter: device.counter
      };
      await this.deviceDB.put(serializedDevice);
    } catch (error) {
      if (error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }
  /**
     * Retrieves an authenticator device by credentialID.
     * @param credentialID {Uint8Array} The credentialID of the device.
     * @returns {AuthenticatorDevice | undefined} The authenticator device if found, otherwise undefined.
     */
  async getAuthenticatorDevice(credentialID: Uint8Array): Promise<SerializedAuthenticatorDevice | undefined> {
    try {
      const base64credentialID = base64url.encode(Buffer.from(credentialID));
      const device = await this.deviceDB.get(base64credentialID);
      if (device) {
        return device;
      }
      return undefined;
    } catch (error) {
      if (error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Deletes an authenticator device by credentialID
   * @param credentialID {Uint8Array} The credentialID of the device.
   */
  async deleteAuthenticatorDevice(credentialID: Uint8Array): Promise<void> {
    try {
      const device = await this.deviceDB.get(base64url.encode(Buffer.from(credentialID)))
      if (device) {
        await this.deviceDB.remove(device);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retrieves all authenticator devices for the specified user.
   * @param accountID {string} The email of the user.
   * @returns {SerializedAuthenticatorDevice[]} An array of authenticator devices.
   */
  async getAuthenticatorDevicesForAccountID(accountID: string): Promise<SerializedAuthenticatorDevice[]> {
    try {
      const devices = await this.deviceDB.find({
        selector: {
          accountID: accountID
        }
      });
      return devices.docs.map(device => {
        return {
          ...device
        };
      });
    } catch (error) {
      if (error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Deserializes an authenticator device from its serialized form.
   * @param serializedDevice {SerializedAuthenticatorDevice} The serialized authenticator device.
   * @returns {Promise<AuthenticatorDevice>} The deserialized authenticator device.
   */
  async deserializeAuthenticatorDevice(serializedDevice: SerializedAuthenticatorDevice): Promise<AuthenticatorDevice> {
    const Uint8ArrayCredentialID = base64url.toBuffer(serializedDevice.credentialID);
    const Uint8ArrayCredentialPublicKey = base64url.toBuffer(serializedDevice.credentialPublicKey);
    const counter = serializedDevice.counter;
    return {
      credentialID: Uint8ArrayCredentialID,
      credentialPublicKey: Uint8ArrayCredentialPublicKey,
      counter: serializedDevice.counter
    };
  }


  /**
   * Adds a client ID to the user's list of approved clients if it's not already present.
   * @param user {User} The user object.
   * @param clientId {string} The client ID to be added.
   */
  async addApprovedClient(user: User, clientId: string) {
    if (!user.approved_clients.includes(clientId)) {
      user.approved_clients.push(clientId);
    }
    this.updateUser(user);
  }

  /**
   * Removes a client ID from the user's list of approved clients if it's present.
   * @param user {User} The user object.
   * @param clientId {string} The client ID to be removed.
   */
  async removeApprovedClient(user: User, clientId: string) {
    const index = user.approved_clients.indexOf(clientId);
    if (index !== -1) {
      user.approved_clients.splice(index, 1);
    }
    this.updateUser(user);
  }

  /**
   * Updates a user object in the database.
   * @param user {User} The user object to be updated.
   */
  async updateUser(user: User): Promise<void> {
    try {
      // Update the user in the database
      await this.userDB.put(user);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates an authenticator device object in the database.
   * @param device {SerializedAuthenticatorDevice} The serialized authenticator device object to be updated.
   * @throws {Error} In case something unexpected happens
   */
  async updateAuthDevice(device: SerializedAuthenticatorDevice): Promise<void> {
    try {
      // Update the device in the database
      await this.deviceDB.put(device);
    } catch (error) {
      throw error;
    }
  }
}
