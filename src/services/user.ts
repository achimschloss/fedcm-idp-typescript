// user.ts
export interface User {
    email: string;
    name: string;
    secret: string;
    accountId: string;
    avatarUrl: string;
    approved_clients: string[];
  }
  
  // Then you can create a simple helper function for adding and removing approved clients
  export function addApprovedClient(user: User, clientId: string) {
    if (!user.approved_clients.includes(clientId)) {
      user.approved_clients.push(clientId);
    }
  }
  
  export function removeApprovedClient(user: User, clientId: string) {
    const index = user.approved_clients.indexOf(clientId);
    if (index !== -1) {
      user.approved_clients.splice(index, 1);
    }
  }
  