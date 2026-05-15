interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const typeClasses = {
    success: 'bg-green border-green-bg',
    error: 'bg-red border-red-bg',
    info: 'bg-blue border-blue-bg',
  };

  return (
    <div className={`fixed top-5 right-5 ${typeClasses[type]} text-white px-4 py-3 rounded-xl shadow-lg z-[9999] max-w-[300px] text-sm animate-fade-in border`}>
      <div className="flex justify-between items-center gap-3">
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="bg-none border-none text-white text-lg cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;
