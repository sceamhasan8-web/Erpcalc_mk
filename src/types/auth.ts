export type SectionId =
  | 'admin'
  | 'orders'
  | 'production'
  | 'planning'
  | 'warehouse'
  | 'inventory'
  | 'goods-receive'
  | 'inventory-transfer'
  | 'goods-store'
  | 'departments'
  | 'hr';

export interface SectionDefinition {
  id: SectionId;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  badgeBg: string;
  description: string;
  allowedRoutes: string[];
  defaultPath: string;
  defaultUsername: string;
  defaultRole: string;
  hidden?: boolean; // If true, won't appear on login page section selector
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  section: SectionId;
  role: string;
  avatar?: string;
  email?: string;
  allowedRoutes: string[];
  loginTime: string;
  sessionSig?: string; // Tamper-proof session signature
}

export interface LoginCredentials {
  username: string;
  password: string;
  sectionId?: SectionId;
}

// HR-managed user accounts stored in Firestore
export interface HRUser {
  id: string;
  username: string;
  password?: string; // Optional during runtime to prevent exposing plain text in state
  passwordHash?: string; // Salted SHA-256 hash
  passwordSalt?: string; // Unique cryptographic salt per user
  name: string;
  email: string;
  sectionId: SectionId;
  role: string;
  allowedRoutes?: string[]; // Custom module access permissions configured by HR
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  activeSection: SectionDefinition | null;
  allSections: SectionDefinition[];
  hrUsers: HRUser[];
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string; defaultPath?: string }>;
  logout: () => void;
  switchSection: (sectionId: SectionId) => void;
  canAccessRoute: (pathname: string) => boolean;
  addHRUser: (user: Omit<HRUser, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; error?: string }>;
  updateHRUser: (id: string, updates: Partial<HRUser>) => Promise<{ success: boolean; error?: string }>;
  deleteHRUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  refreshHRUsers: () => Promise<void>;
  updateUserAvatar: (avatarDataUrl: string | null) => void;
  updateUserProfile: (updates: Partial<AuthUser>) => void;
}
