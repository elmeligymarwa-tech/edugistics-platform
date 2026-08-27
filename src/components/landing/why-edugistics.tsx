const HEADING_FONT = 'font-[family-name:var(--font-league-spartan)] font-bold'

const ITEMS = [
  {
    num: '01',
    title: '25+ Years of Educational Leadership',
    description:
      'Over 25 years of experience in school management, education and professional development.',
  },
  {
    num: '02',
    title: 'Experienced Trainers Across Core Subjects',
    description:
      'Access experienced trainers and subject specialists across major teaching subjects and areas of education.',
  },
  {
    num: '03',
    title: 'Practical and Career Focused',
    description:
      'Courses provide practical strategies and skills teachers apply immediately in the classroom and use to advance their careers.',
  },
  {
    num: '04',
    title: 'Professional Growth and Excellence',
    description:
      'Edugistics helps teachers develop continuously, build confidence and stay ahead of the demands of modern education.',
  },
]

export function WhyEdugistics() {
  return (
    <section className="border-y border-edu-navy/10 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 className={`${HEADING_FONT} mb-10 text-[clamp(1.9rem,3.6vw,2.9rem)] tracking-tight text-edu-navy sm:mb-14`}>
          Why Edugistics?
        </h2>
        <div className="grid grid-cols-1 gap-x-16 sm:grid-cols-2">
          {ITEMS.map((item) => (
            <div
              key={item.num}
              className="grid grid-cols-[44px_1fr] items-start gap-5 border-t border-edu-navy/15 py-6"
            >
              <span className="pt-1 text-sm font-bold text-edu-navy">{item.num}</span>
              <div>
                <h3 className="mb-2 text-xl font-bold text-edu-navy">{item.title}</h3>
                <p className="max-w-[34ch] text-base leading-relaxed text-edu-navy/75">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
