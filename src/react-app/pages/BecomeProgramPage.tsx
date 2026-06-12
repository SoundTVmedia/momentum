import { useEffect } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAuth } from '@getmocha/users-service/react'
import Header from '@/react-app/components/Header'

type BecomeProgram = 'ambassador' | 'influencer'

const PROGRAM_COPY: Record<
  BecomeProgram,
  { title: string; description: string }
> = {
  ambassador: {
    title: 'Become an Ambassador',
    description: 'Ambassador onboarding is coming soon.',
  },
  influencer: {
    title: 'Become an Influencer',
    description: 'Influencer onboarding is coming soon.',
  },
}

type BecomeProgramPageProps = {
  program: BecomeProgram
}

export default function BecomeProgramPage({ program }: BecomeProgramPageProps) {
  const navigate = useNavigate()
  const { user, isPending } = useAuth()
  const copy = PROGRAM_COPY[program]

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth', { replace: true })
    }
  }, [user, isPending, navigate])

  if (isPending || !user) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-8 inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <div className="glass-panel rounded-2xl p-8 sm:p-10">
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-white mb-3">
            {copy.title}
          </h1>
          <p className="text-gray-300">{copy.description}</p>
        </div>
      </div>
    </div>
  )
}
