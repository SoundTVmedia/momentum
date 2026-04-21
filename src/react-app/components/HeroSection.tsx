export default function HeroSection() {

  return (
    <div className="relative bg-black overflow-hidden h-[25vh] sm:h-[28vh] md:h-[32vh]">
      {/* Background Video Placeholder */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/80">
        <div 
          className="w-full h-full bg-cover bg-center opacity-40"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920&h=1080&fit=crop')"
          }}
        />
      </div>

      {/* Animated Background Elements - Concert Lighting */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '700ms'}}></div>
        <div className="absolute bottom-1/4 left-1/3 w-48 h-48 bg-cyan-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1400ms'}}></div>
        <div className="absolute top-1/2 right-1/3 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2100ms'}}></div>
      </div>

      <div className="relative z-10 flex flex-col justify-center h-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          {/* Main Headline - Smaller */}
          <div className="mb-1 sm:mb-2">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-headline mb-1 sm:mb-2 leading-tight">
              <span className="block bg-gradient-to-r from-blue-600 via-cyan-400 to-purple-600 bg-clip-text text-transparent animate-glow">
                WHERE LIVE
              </span>
              <span className="block text-white drop-shadow-2xl">
                MUSIC LIVES
              </span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed px-4 font-medium">
              Your nightly home for live music. Real moments, real fans, real artists.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
