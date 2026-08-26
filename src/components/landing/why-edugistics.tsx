import { Award, Target, TrendingUp, Users } from 'lucide-react'

const ITEMS = [
  {
    icon: Award,
    title: '25+ Years of Educational Leadership',
    description:
      'Over 25 years of experience in school management, education and professional development.',
  },
  {
    icon: Users,
    title: 'Experienced Trainers Across Core Subjects',
    description:
      'Access experienced trainers and subject specialists across major teaching subjects and areas of education.',
  },
  {
    icon: Target,
    title: 'Practical and Career Focused',
    description:
      'Courses provide practical strategies and skills teachers apply immediately in the classroom and use to advance their careers.',
  },
  {
    icon: TrendingUp,
    title: 'Professional Growth and Excellence',
    description:
      'Edugistics helps teachers develop continuously, build confidence and stay ahead of the demands of modern education.',
  },
]

export function WhyEdugistics() {
  return (
    <section className="bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 sm:gap-12">
        <h2 className="text-center font-heading text-2xl text-brand-navy sm:text-3xl">
          Why Edugistics
        </h2>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {ITEMS.map((item) => (
            <div key={item.title} className="flex flex-col gap-3">
              <item.icon aria-hidden="true" className="h-8 w-8 text-brand-teal" />
              <h3 className="font-heading text-xl text-brand-navy">{item.title}</h3>
              <p className="text-base leading-relaxed text-brand-navy sm:text-lg">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
