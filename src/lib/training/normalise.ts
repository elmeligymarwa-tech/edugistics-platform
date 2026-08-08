const SCHOOL_NAME_TRAILING_WORDS = new Set(['school', 'schools', 'international', 'academy'])

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalisePhone(phone: string): string {
  return phone.trim().replace(/[\s()[\]-]/g, '')
}

export function normaliseSchoolNameKey(name: string): string {
  const cleaned = name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

  let words = cleaned.split(' ').filter(Boolean)
  while (words.length > 1 && SCHOOL_NAME_TRAILING_WORDS.has(words[words.length - 1]!)) {
    words = words.slice(0, -1)
  }
  return words.join(' ')
}

export function normaliseSubject(subject: string): string {
  return subject.trim().toLowerCase()
}

export function normaliseGrade(grade: string): string {
  return grade.trim().toLowerCase()
}
