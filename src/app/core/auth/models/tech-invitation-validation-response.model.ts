export interface TechInvitationValidationResponse {
  valid: boolean;
  expired: boolean;
  used: boolean;
  message: string;
  email: string | null;
  sttId: string | null;
  sttName: string | null;
}