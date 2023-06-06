import { User } from '../../services/user';
import { IDPMetadata } from '../../config/idp_metadata.interface';
import "express-session";

declare module 'express-session' {
  interface SessionData {
    user?: User;
    IDPMetadata?: IDPMetadata;
  }
}
