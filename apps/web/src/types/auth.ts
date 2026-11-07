export type AppRole = "STUDENT" | "MODERATOR" | "ADMIN";

export type AppUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  phone?: string;
  role: AppRole;
  emailVerified: boolean;
  phoneVerified: boolean;
};

export type AppSession = {
  token: string;
  user: AppUser;
  mode?: "demo";
};
