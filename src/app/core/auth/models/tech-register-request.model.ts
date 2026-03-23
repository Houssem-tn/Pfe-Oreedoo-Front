export interface TechRegisterRequest {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string | null;
}