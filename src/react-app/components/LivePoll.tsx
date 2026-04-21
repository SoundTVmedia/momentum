import { useState } from 'react';
import { BarChart3, Check, Loader2 } from 'lucide-react';

interface PollOption {
  option_index: number;
  votes: number;
  percentage: number;
}

interface Poll {
  id: number;
  question: string;
  options: string[];
  is_active: boolean;
  results?: {
    total_votes: number;
    results: PollOption[];
  };
}

interface LivePollProps {
  poll: Poll;
  onVote?: () => void;
}

export default function LivePoll({ poll, onVote }: LivePollProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);

  const handleVote = async (optionIndex: number) => {
    if (hasVoted || !poll.is_active) return;

    setVoting(true);
    try {
      const response = await fetch(`/api/live/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option_index: optionIndex }),
      });

      if (response.ok) {
        setSelectedOption(optionIndex);
        setHasVoted(true);
        onVote?.();
      }
    } catch (err) {
      console.error('Failed to vote:', err);
    } finally {
      setVoting(false);
    }
  };

  const getOptionPercentage = (optionIndex: number): number => {
    if (!poll.results) return 0;
    const result = poll.results.results.find(r => r.option_index === optionIndex);
    return result?.percentage || 0;
  };

  const getOptionVotes = (optionIndex: number): number => {
    if (!poll.results) return 0;
    const result = poll.results.results.find(r => r.option_index === optionIndex);
    return result?.votes || 0;
  };

  return (
    <div className="bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-xl p-4 mb-4">
      <div className="flex items-center space-x-2 mb-3">
        <BarChart3 className="w-5 h-5 text-cyan-400" />
        <h3 className="text-white font-bold">Live Poll</h3>
        {!poll.is_active && (
          <span className="text-xs text-gray-400">(Ended)</span>
        )}
      </div>

      <p className="text-white mb-4 font-medium">{poll.question}</p>

      <div className="space-y-2">
        {poll.options.map((option, index) => {
          const percentage = getOptionPercentage(index);
          const votes = getOptionVotes(index);
          const isSelected = selectedOption === index;
          const showResults = hasVoted || !poll.is_active;

          return (
            <button
              key={index}
              onClick={() => handleVote(index)}
              disabled={hasVoted || !poll.is_active || voting}
              className={`w-full text-left p-3 rounded-lg transition-all relative overflow-hidden ${
                showResults
                  ? 'bg-white/10 cursor-default'
                  : 'bg-white/5 hover:bg-white/10 cursor-pointer'
              } ${isSelected ? 'border-2 border-cyan-400' : 'border border-white/20'}`}
            >
              {showResults && (
                <div
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 to-blue-600/30 transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              )}

              <div className="relative flex items-center justify-between">
                <div className="flex items-center space-x-2 flex-1">
                  {isSelected && hasVoted && (
                    <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  )}
                  <span className="text-white">{option}</span>
                </div>

                {showResults && (
                  <div className="flex items-center space-x-3 text-sm">
                    <span className="text-gray-400">{votes} votes</span>
                    <span className="font-bold text-cyan-400">{percentage}%</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {poll.results && (
        <div className="mt-3 text-center text-xs text-gray-400">
          {poll.results.total_votes} total votes
        </div>
      )}

      {voting && (
        <div className="mt-3 flex items-center justify-center space-x-2 text-cyan-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Submitting vote...</span>
        </div>
      )}
    </div>
  );
}
