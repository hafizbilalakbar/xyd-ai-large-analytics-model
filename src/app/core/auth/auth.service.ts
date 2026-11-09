import { Injectable, signal } from '@angular/core';

export interface AuthenticatedUser {
  readonly name: string;
  readonly role: string;
}

const DEFAULT_USER: AuthenticatedUser = {
  name: 'Administrator',
  role: 'Administrator',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userState = signal<AuthenticatedUser | null>(DEFAULT_USER);

  readonly user = this.userState.asReadonly();

  signIn(): void {
    this.userState.set(DEFAULT_USER);
  }

  signOut(): void {
    this.userState.set(null);
  }
}
