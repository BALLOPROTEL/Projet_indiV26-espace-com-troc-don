export type AuthenticatedUser = {
  sub: string;
  preferredUsername?: string;
  roles: string[];
};

export type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
};
