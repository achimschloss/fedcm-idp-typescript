import { User } from '../../services/user';
import { IDPMetadata } from '../../config/idp_metadata.interface';
import "express-session";

declare module 'express-session' {
  interface SessionData {
    loggedInUser?: User
    IDPMetadata?: IDPMetadata
    currentChallenge?: string
    passkeyRegistration?: User
    passkeyLogin?: string
    loginSessionExpiration?: number
  }
}
