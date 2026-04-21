import QuickRecordButton from './QuickRecordButton';

interface QuickRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickRecordModal({ isOpen, onClose }: QuickRecordModalProps) {
  if (!isOpen) return null;
  
  return <QuickRecordButton isOpen={isOpen} onClose={onClose} />;
}
