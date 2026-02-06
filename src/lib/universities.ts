export const UNIVERSITY_ADDRESSES: Record<string, string> = {
  ned: 'NED UET, University Road, Gulshan-e-Iqbal Town, Gulshan District, Karachi Division, Sindh, 75300, Pakistan',
  fast: 'FAST National University of Computer and Emerging Sciences, Bin Qasim Town, Malir District, Karachi Division, Sindh, 75030, Pakistan',
  karachi: 'University of Karachi, Main University Road, Karachi, Sindh, 75270, Pakistan',
};

export function getUniversityLabel(university?: string | null) {
  if (!university) return 'Unknown';
  return UNIVERSITY_ADDRESSES[university] || (university === 'ned' ? 'NED University' : university === 'fast' ? 'FAST University' : university === 'karachi' ? 'Karachi University' : university);
}

export function getUniversityShortLabel(university?: string | null) {
  if (!university) return 'Unknown';
  if (university === 'ned') return 'NED University';
  if (university === 'fast') return 'FAST University';
  if (university === 'karachi') return 'Karachi University';
  return university;
}

// Heuristic: detect if a free-text location string refers to a known university
export function detectUniversityFromString(value?: string | null): 'ned' | 'fast' | 'karachi' | null {
  if (!value) return null;
  const s = value.toLowerCase();
  if (s.includes('ned') || s.includes('ned uet')) return 'ned';
  if (s.includes('fast') || s.includes('national university of computer')) return 'fast';
  if (s.includes('karachi university') || s.includes('university of karachi') || s.includes('uok')) return 'karachi';
  return null;
}