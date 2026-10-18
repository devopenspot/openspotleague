export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
  canAccessAdmin: boolean;
  canCurate: boolean;
  isAdministrator: boolean;
  // Scoped curation — always set at runtime; optional for test stubs
  canCurateSpots?: boolean;
  canCurateEvents?: boolean;
  canCurateTricks?: boolean;
  canCurateTv?: boolean;
  canManageLeague?: boolean;
  curatedCountryCodes?: readonly string[];
  curatedDisciplineSlugs?: readonly string[];
}
