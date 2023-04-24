// Import the User interface
import { User } from "./user";

export class UserManager {
  private userMaps: { [hostname: string]: Map<string, User> };

  constructor(hostnames: string[]) {
    this.userMaps = {};
    // Initialize user maps for each hostname
    for (const hostname of hostnames) {
      this.userMaps[hostname] = new Map();
    }
  }

  // Retrieves a user object by email and hostname
  getUser(email: string, hostname: string): User | undefined {
    const userMap = this.userMaps[hostname];
    return userMap ? userMap.get(email) : undefined;
  }

  // Adds a new user object to the specified hostname
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

  // Deletes a user object by email and hostname
  deleteUser(email: string, hostname: string) {
    const userMap = this.userMaps[hostname];
    if (userMap) {
      userMap.delete(email);
    }
  }
}
