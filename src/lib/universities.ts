export const UNIVERSITY_ADDRESSES: Record<string, string> = {
  ned: 'NED UET, University Road, Billys Homes, Gul Houses, Gulshan-e-Iqbal Town, Gulshan District, Karachi Division, Sindh, 75300, Pakistan',
  fast: 'FAST National University of Computer and Emerging Sciences, Bin Qasim Town, Malir District, Karachi Division, Sindh, 75030, Pakistan',
};

export function getUniversityLabel(university?: string | null) {
  if (!university) return 'Unknown';
  return UNIVERSITY_ADDRESSES[university] || (university === 'ned' ? 'NED University' : university === 'fast' ? 'FAST University' : university);
}

export function getUniversityShortLabel(university?: string | null) {
  if (!university) return 'Unknown';
  if (university === 'ned') return 'NED University';
  if (university === 'fast') return 'FAST University';
  return university;
}