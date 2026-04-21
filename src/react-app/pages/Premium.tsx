import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { 
  Crown, Check, Zap, Star, Video, Gift, Calendar, 
  MessageCircle, Heart, Sparkles, X, Loader2 
} from 'lucide-react';
import Header from '@/react-app/components/Header';

interface PremiumPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  popular?: boolean;
}

export default function PremiumPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string>('premium-monthly');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const plans: PremiumPlan[] = [
    {
      id: 'premium-monthly',
      name: 'Premium Monthly',
      price: 9.99,
      interval: 'month',
      features: [
        'Early access to concert tickets',
        'Exclusive behind-the-scenes content',
        'Ad-free experience',
        'Priority live chat during shows',
        'Exclusive member badge',
        'Save unlimited clips',
        'HD video quality',
        'Access to VIP events'
      ]
    },
    {
      id: 'premium-yearly',
      name: 'Premium Yearly',
      price: 99.99,
      interval: 'year',
      features: [
        'Everything in Monthly',
        'Save 17% with annual billing',
        'Exclusive annual merch drop',
        'Priority customer support',
        'Yearly member anniversary badge',
        'Bonus content releases',
        'Early beta feature access',
        'Meet & greet opportunities'
      ],
      popular: true
    }
  ];

  const handleUpgrade = async () => {
    if (!user) {
      navigate('/?login=true');
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement Stripe checkout
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: selectedPlan,
        }),
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to start upgrade process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlanData = plans.find(p => p.id === selectedPlan);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      <Header />
      
      {/* Hero Section */}
      <div className="relative py-20 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-block mb-6 animate-bounce-slow">
            <Crown className="w-20 h-20 text-yellow-400 mx-auto filter drop-shadow-glow" />
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
            Level Up to <span className="bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 bg-clip-text text-transparent">Premium</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8">
            Join the inner circle. Get early access to tickets, exclusive artist content, and VIP experiences before anyone else.
          </p>

          <div className="flex items-center justify-center space-x-2 text-yellow-400 mb-8">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="font-medium">Limited time: First month FREE</span>
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <div className="flex items-center space-x-2 px-4 py-2 bg-yellow-400/10 border border-yellow-400/30 rounded-full">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-medium">No Ads</span>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-yellow-400/10 border border-yellow-400/30 rounded-full">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-medium">Early Access</span>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-yellow-400/10 border border-yellow-400/30 rounded-full">
              <Star className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-medium">Exclusive Content</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-black/40 backdrop-blur-lg border rounded-2xl p-8 transition-all duration-300 hover:scale-105 cursor-pointer ${
                selectedPlan === plan.id
                  ? 'border-yellow-400/50 shadow-2xl shadow-yellow-500/20'
                  : 'border-white/10 hover:border-yellow-400/30'
              } ${plan.popular ? 'lg:scale-105' : ''}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="px-4 py-1 bg-gradient-to-r from-yellow-400 to-amber-600 rounded-full text-black text-sm font-bold">
                    ⭐ MOST POPULAR
                  </div>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center space-x-2">
                  <span className="text-5xl font-bold text-white">${plan.price}</span>
                  <span className="text-gray-400">/ {plan.interval}</span>
                </div>
                {plan.interval === 'year' && (
                  <div className="mt-2 text-green-400 text-sm font-medium">
                    Save $20 per year
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <Check className="w-5 h-5 text-yellow-400" />
                    </div>
                    <span className="text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlan(plan.id);
                  setShowModal(true);
                }}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  selectedPlan === plan.id
                    ? 'bg-gradient-to-r from-yellow-400 to-amber-600 text-black hover:scale-105 shadow-lg shadow-yellow-500/30'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {selectedPlan === plan.id ? 'Selected Plan' : 'Select Plan'}
              </button>
            </div>
          ))}
        </div>

        {/* Benefits Grid */}
        <div className="mt-20">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
            What You'll Get with Premium
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-black/40 backdrop-blur-lg border border-yellow-400/20 rounded-xl p-6 text-center hover:border-yellow-400/50 transition-all hover:scale-105">
              <Video className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Exclusive Videos</h3>
              <p className="text-gray-400 text-sm">
                Behind-the-scenes content and artist interviews
              </p>
            </div>

            <div className="bg-black/40 backdrop-blur-lg border border-yellow-400/20 rounded-xl p-6 text-center hover:border-yellow-400/50 transition-all hover:scale-105">
              <Calendar className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Early Tickets</h3>
              <p className="text-gray-400 text-sm">
                Get first access to concert tickets before general sale
              </p>
            </div>

            <div className="bg-black/40 backdrop-blur-lg border border-yellow-400/20 rounded-xl p-6 text-center hover:border-yellow-400/50 transition-all hover:scale-105">
              <Gift className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Exclusive Merch</h3>
              <p className="text-gray-400 text-sm">
                Limited edition merchandise drops for members only
              </p>
            </div>

            <div className="bg-black/40 backdrop-blur-lg border border-yellow-400/20 rounded-xl p-6 text-center hover:border-yellow-400/50 transition-all hover:scale-105">
              <MessageCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Priority Chat</h3>
              <p className="text-gray-400 text-sm">
                Stand out in live chats with priority messaging
              </p>
            </div>
          </div>
        </div>

        {/* Social Proof */}
        <div className="mt-20 text-center">
          <div className="inline-flex items-center space-x-2 mb-8">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <img
                  key={i}
                  src={`https://images.unsplash.com/photo-${1494790108755 + i}?w=40&h=40&fit=crop&crop=face`}
                  alt="Member"
                  className="w-10 h-10 rounded-full border-2 border-black"
                />
              ))}
            </div>
            <span className="text-gray-300">
              <span className="font-bold text-yellow-400">10,000+</span> members and counting
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-gray-400 text-sm">
            <div className="flex items-center space-x-2">
              <Heart className="w-4 h-4 text-red-400 fill-current" />
              <span>No hidden fees</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-400" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>30-day money back</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <button
            onClick={() => setShowModal(true)}
            className="px-12 py-6 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 rounded-2xl font-bold text-xl text-black hover:scale-105 transition-all shadow-2xl shadow-yellow-500/30 animate-pulse-glow"
          >
            Join Premium Today
          </button>
          <p className="text-gray-400 text-sm mt-4">
            Just ${plans[0].price}/{plans[0].interval} to unlock it all
          </p>
        </div>
      </div>

      {/* Checkout Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-yellow-400/30 rounded-2xl max-w-md w-full p-8 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Confirm Upgrade</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {selectedPlanData && (
              <div className="mb-6">
                <div className="bg-black/40 border border-yellow-400/20 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-gray-400">Plan</span>
                    <span className="text-white font-bold">{selectedPlanData.name}</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-gray-400">Billing</span>
                    <span className="text-white font-bold capitalize">{selectedPlanData.interval}ly</span>
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold">Total</span>
                      <span className="text-2xl font-bold text-yellow-400">
                        ${selectedPlanData.price}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-600 rounded-xl font-bold text-black hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 mb-4"
            >
              {loading ? (
                <span className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </span>
              ) : (
                'Continue to Payment'
              )}
            </button>

            <p className="text-xs text-gray-400 text-center">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
