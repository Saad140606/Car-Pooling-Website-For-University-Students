// src/lib/university-verification.ts
export function getUniversityEmailDomain(university: 'fast' | 'ned'): string {
  switch (university) {
    case 'fast':
      return '@nu.edu.pk';
    case 'ned':
      return '@neduet.edu.pk';
    default:
      return '';
  }
}

export function isValidUniversityEmail(email: string, university: 'fast' | 'ned'): boolean {
  const domain = getUniversityEmailDomain(university);
  return email.toLowerCase().endsWith(domain.toLowerCase());
}

export function getVerificationEmailMessage(university: 'fast' | 'ned'): string {
  const domain = getUniversityEmailDomain(university);
  return `Enter your university email (${domain}) to verify your account and gain trusted status. We’ll send a 6-digit code — check your inbox and spam/junk folder if you don’t see it.`;
}
