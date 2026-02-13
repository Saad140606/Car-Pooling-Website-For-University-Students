// src/lib/university-verification.ts
export function getUniversityEmailDomain(university: 'fast' | 'ned' | 'karachi'): string {
  switch (university) {
    case 'fast':
      return '@nu.edu.pk';
    case 'ned':
      return '@cloud.neduet.edu.pk';
    case 'karachi':
      return '@uok.edu.pk';
    default:
      return '';
  }
}

export function isValidUniversityEmail(email: string, university: 'fast' | 'ned' | 'karachi'): boolean {
  const domain = getUniversityEmailDomain(university);
  return email.toLowerCase().endsWith(domain.toLowerCase());
}

export function getVerificationEmailMessage(university: 'fast' | 'ned' | 'karachi'): string {
  const domain = getUniversityEmailDomain(university);
  return `Enter your university email (${domain}) to verify your account and gain trusted status. We’ll send a 6-digit code — check your inbox and spam/junk folder if you don’t see it.`;
}
