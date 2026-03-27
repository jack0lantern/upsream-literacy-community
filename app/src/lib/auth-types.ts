import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    isAdmin: boolean;
    onboarded: boolean;
    emailVerified: boolean;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isAdmin: boolean;
      onboarded: boolean;
      emailVerified: boolean;
    };
  }
}

