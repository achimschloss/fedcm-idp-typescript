import { User } from '../../services/user';
import "express-session";

declare module 'express-session' {
  interface SessionData {
    user?: User;
  }
}
